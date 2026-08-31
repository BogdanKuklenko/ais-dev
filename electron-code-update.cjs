'use strict';

const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REPO = 'BogdanKuklenko/ais-dev';
const TAG = 'latest-win';
const MANIFEST_URLS = [
  `https://github.com/${REPO}/releases/download/${TAG}/code-update.json`,
  `https://github.com/${REPO}/releases/latest/download/code-update.json`,
];

function readBuildInfo() {
  const candidates = [
    path.join(__dirname, 'build-info.json'),
    path.join(process.resourcesPath || '', 'build-info.json'),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch {
      /* next */
    }
  }
  return {
    gitSha: 'unknown',
    version: app.getVersion(),
    builtAt: '',
    channel: 'unknown',
  };
}

function getInstallStatePath() {
  return path.join(app.getPath('userData'), 'code-ota-state.json');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(getInstallStatePath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(s) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(getInstallStatePath(), JSON.stringify(s, null, 2));
}

function httpsGet(url, { json = false, dest = null, onProgress = null } = {}) {
  return new Promise((resolve, reject) => {
    const go = (u, hops) => {
      if (hops > 8) return reject(new Error('too many redirects'));
      const req = https.get(
        u,
        {
          headers: {
            'User-Agent': 'ALEX-Dosing-Control-OTA',
            Accept: json ? 'application/json' : '*/*',
          },
        },
        (res) => {
          const loc = res.headers.location;
          if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
            res.resume();
            const next = loc.startsWith('http') ? loc : new URL(loc, u).href;
            return go(next, hops + 1);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode} (${u})`));
          }
          const total = Number(res.headers['content-length'] || 0);
          if (dest) {
            const file = fs.createWriteStream(dest);
            let received = 0;
            res.on('data', (chunk) => {
              received += chunk.length;
              if (onProgress) {
                onProgress({
                  received,
                  total,
                  percent: total ? Math.round((received / total) * 100) : 0,
                });
              }
            });
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve({ dest, received, total })));
            file.on('error', reject);
            return;
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            try {
              resolve(json ? JSON.parse(buf.toString('utf8')) : buf);
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', reject);
      req.setTimeout(180000, () => {
        req.destroy(new Error('timeout'));
      });
    };
    go(url, 0);
  });
}

async function fetchManifest() {
  let lastErr;
  for (const u of MANIFEST_URLS) {
    try {
      const data = await httpsGet(u, { json: true });
      if (data && data.format === 'alex_code_ota_v1' && data.gitSha && data.downloadUrl) {
        return data;
      }
      lastErr = new Error('Манифест кода без gitSha/downloadUrl');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('code-update.json не найден (GitHub Release latest-win)');
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('data', (d) => h.update(d));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', reject);
  });
}

function resolvePortableTarget() {
  const envFile = process.env.PORTABLE_EXECUTABLE_FILE;
  if (envFile && fs.existsSync(envFile)) return envFile;
  const envDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (envDir) {
    const p = path.join(envDir, 'ALEX_Dosing_Control_Portable.exe');
    if (fs.existsSync(p)) return p;
  }
  const state = readState();
  if (state.portablePath && fs.existsSync(state.portablePath)) return state.portablePath;
  return null;
}

function rememberPortablePath() {
  const t = resolvePortableTarget();
  if (t) {
    writeState({ ...readState(), portablePath: t });
  }
}

let cachedManifest = null;
let downloadedPath = null;

function findApplyScript() {
  const candidates = [
    path.join(process.resourcesPath || '', 'apply-code-update.cmd'),
    path.join(__dirname, 'scripts', 'apply-code-update.cmd'),
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

function registerCodeUpdateIpc(getMainWindow) {
  rememberPortablePath();

  ipcMain.handle('code-update-build-info', async () => readBuildInfo());

  ipcMain.handle('code-update-check', async () => {
    const info = readBuildInfo();
    const state = readState();
    const currentSha = String(state.appliedGitSha || info.gitSha || '').toLowerCase();
    try {
      const manifest = await fetchManifest();
      cachedManifest = manifest;
      const remoteSha = String(manifest.gitSha || '').toLowerCase();
      const hasUpdate = Boolean(remoteSha) && remoteSha !== currentSha;
      return {
        ok: true,
        desktop: true,
        hasUpdate,
        currentSha,
        remoteSha,
        version: manifest.version,
        sizeBytes: manifest.size,
        builtAt: manifest.builtAt,
        title: manifest.title || `Сборка ${remoteSha.slice(0, 7)}`,
      };
    } catch (e) {
      return {
        ok: false,
        desktop: true,
        hasUpdate: false,
        currentSha,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle('code-update-download', async () => {
    const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
    try {
      const manifest = cachedManifest || (await fetchManifest());
      cachedManifest = manifest;
      const url = manifest.downloadUrl;
      if (!url) return { ok: false, error: 'В манифесте нет downloadUrl' };
      const dir = path.join(app.getPath('userData'), 'code-ota');
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, 'ALEX_Dosing_Control_Portable.exe');
      await httpsGet(url, {
        dest,
        onProgress: (p) => {
          if (win && !win.isDestroyed()) win.webContents.send('code-update-progress', p);
        },
      });
      if (manifest.sha256) {
        const got = await sha256File(dest);
        if (got.toLowerCase() !== String(manifest.sha256).replace(/^sha256:/i, '').toLowerCase()) {
          fs.unlinkSync(dest);
          return { ok: false, error: 'SHA-256 скачанного exe не совпал' };
        }
      }
      downloadedPath = dest;
      writeState({
        ...readState(),
        pendingExe: dest,
        pendingSha: manifest.gitSha,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('code-update-apply', async () => {
    const pending = downloadedPath || readState().pendingExe;
    if (!pending || !fs.existsSync(pending)) {
      return { ok: false, error: 'Сначала скачайте обновление программы' };
    }
    const dest = resolvePortableTarget() || pending;
    const script = findApplyScript();
    if (!script) return { ok: false, error: 'Не найден apply-code-update.cmd' };

    const safeTemp = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Temp')
      : process.env.TEMP;

    const child = spawn(
      'cmd.exe',
      ['/c', script, String(process.pid), pending, dest, dest],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: {
          ...process.env,
          TEMP: safeTemp,
          TMP: safeTemp,
        },
      }
    );
    child.unref();

    const manifest = cachedManifest;
    writeState({
      ...readState(),
      appliedGitSha: (manifest && manifest.gitSha) || readState().pendingSha,
      portablePath: dest,
    });

    setTimeout(() => app.quit(), 500);
    return { ok: true };
  });
}

module.exports = { registerCodeUpdateIpc, readBuildInfo };
