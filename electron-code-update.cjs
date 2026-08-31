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
const PATCH_FILE_BASE = `https://raw.githubusercontent.com/${REPO}/ota-dist/`;
const PATCH_MANIFEST_URLS = [
  `https://api.github.com/repos/${REPO}/contents/code-patch.json?ref=ota-dist`,
  `https://raw.githubusercontent.com/${REPO}/ota-dist/code-patch.json`,
  `https://github.com/${REPO}/raw/ota-dist/code-patch.json`,
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

function overlayRoot() {
  return path.join(app.getPath('userData'), 'app-overlay');
}

function bakedDistRoot() {
  const unpacked = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist');
  if (unpacked && fs.existsSync(path.join(unpacked, 'index.html'))) return unpacked;
  return path.join(__dirname, 'dist');
}

function overlayInfoPath() {
  return path.join(overlayRoot(), 'overlay-info.json');
}

function readOverlayInfo() {
  try {
    return JSON.parse(fs.readFileSync(overlayInfoPath(), 'utf8'));
  } catch {
    return null;
  }
}

function currentRendererSha() {
  const overlayIndex = path.join(overlayRoot(), 'index.html');
  const info = readOverlayInfo();
  if (info && info.gitSha) return String(info.gitSha).toLowerCase();
  if (fs.existsSync(overlayIndex)) return 'overlay-unknown';
  return String(readBuildInfo().gitSha || '').toLowerCase();
}

function isPlaceholderSha(s) {
  const x = String(s || '').trim().toLowerCase();
  return !x || x === 'local' || x === 'unknown' || x === 'overlay-unknown';
}

function filesTotalBytes(manifest) {
  if (!manifest || !Array.isArray(manifest.files)) return 0;
  if (Number(manifest.totalBytes) > 0) return Number(manifest.totalBytes);
  return manifest.files.reduce((s, f) => s + (Number(f.size) || 0), 0);
}

function formatKb(n) {
  if (!n) return 'несколько файлов';
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function getRendererIndex() {
  const overlay = path.join(overlayRoot(), 'index.html');
  if (fs.existsSync(overlay)) return overlay;
  return path.join(bakedDistRoot(), 'index.html');
}

function withBust(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

function assertSafeRel(p) {
  if (typeof p !== 'string' || !p) throw new Error('пустой путь в манифесте патча');
  if (p.includes('\\') || p.includes('..') || p.startsWith('/') || p.includes('\0')) {
    throw new Error('небезопасный путь в патче: ' + p);
  }
  return p;
}

function sha256Sync(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyLocal(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.copyFileSync(src, dest);
  } catch {
    fs.writeFileSync(dest, fs.readFileSync(src));
  }
}

function resolveExistingFile(rel) {
  const o = path.join(overlayRoot(), ...rel.split('/'));
  if (fs.existsSync(o) && fs.statSync(o).isFile()) return o;
  const b = path.join(bakedDistRoot(), ...rel.split('/'));
  if (fs.existsSync(b) && fs.statSync(b).isFile()) return b;
  return null;
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
            Accept: json
              ? 'application/vnd.github.raw, application/json;q=0.9, */*;q=0.8'
              : '*/*',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
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

async function fetchPatchManifest() {
  let lastErr;
  for (const u of PATCH_MANIFEST_URLS) {
    try {
      const data = await httpsGet(withBust(u), { json: true });
      const parsed = unwrapGithubContents(data);
      if (parsed && parsed.format === 'alex_code_patch_v1' && Array.isArray(parsed.files) && parsed.gitSha) {
        return parsed;
      }
      lastErr = new Error('code-patch.json: нужен формат alex_code_patch_v1');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('code-patch.json не найден (ветка ota-dist)');
}

function unwrapGithubContents(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.format === 'alex_code_patch_v1') return data;
  if (data.encoding === 'base64' && typeof data.content === 'string') {
    try {
      return JSON.parse(Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
  return data;
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
let cachedPatchManifest = null;
let downloadedPath = null;

function findApplyScript() {
  const candidates = [
    path.join(process.resourcesPath || '', 'apply-code-update.cmd'),
    path.join(__dirname, 'scripts', 'apply-code-update.cmd'),
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function diffPatch(manifest) {
  const changed = [];
  const unchanged = [];
  for (const f of manifest.files) {
    assertSafeRel(f.path);
    const want = String(f.sha256 || '')
      .replace(/^sha256:/i, '')
      .toLowerCase();
    const local = resolveExistingFile(f.path);
    if (local) {
      try {
        if (sha256Sync(local).toLowerCase() === want) {
          unchanged.push(f);
          continue;
        }
      } catch {
        /* treat as changed */
      }
    }
    changed.push(f);
  }
  return { changed, unchanged };
}

function patchFileUrl(rel) {
  return PATCH_FILE_BASE + rel.split('/').map(encodeURIComponent).join('/');
}

async function swapOverlay(staging, getMainWindow) {
  const dest = overlayRoot();
  const bak = dest + '-bak';
  const win = typeof getMainWindow === 'function' ? getMainWindow() : null;

  if (win && !win.isDestroyed()) {
    try {
      await win.webContents.session.clearCache();
    } catch {
      /* cache clear is best-effort */
    }
    try {
      await win.loadURL('about:blank');
    } catch {
      /* continue swap even if blank load fails */
    }
    await wait(250);
  }

  if (fs.existsSync(bak)) fs.rmSync(bak, { recursive: true, force: true });
  if (fs.existsSync(dest)) {
    try {
      fs.renameSync(dest, bak);
    } catch {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  }
  fs.renameSync(staging, dest);

  if (win && !win.isDestroyed()) {
    await win.loadFile(path.join(dest, 'index.html'), {
      query: { alex: String(Date.now()) },
    });
  }
  try {
    if (fs.existsSync(bak)) fs.rmSync(bak, { recursive: true, force: true });
  } catch {
    /* leftover bak is harmless */
  }
}

async function applyRendererPatch(manifest, { getMainWindow, onProgress }) {
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!files.length) throw new Error('В патче нет файлов интерфейса');

  const staging = path.join(app.getPath('userData'), 'app-overlay-staging');
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  const totalDownload = files.reduce((s, f) => s + (Number(f.size) || 0), 0) || 1;
  let done = 0;
  for (const f of files) {
    assertSafeRel(f.path);
    const dest = path.join(staging, ...f.path.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await httpsGet(withBust(patchFileUrl(f.path)), {
      dest,
      onProgress: (p) => {
        if (!onProgress) return;
        const rec = Number(p.received) || 0;
        const overall = done + rec;
        onProgress({
          received: overall,
          total: totalDownload,
          percent: Math.min(99, Math.round((overall / totalDownload) * 100)),
        });
      },
    });
    const got = sha256Sync(dest).toLowerCase();
    const want = String(f.sha256 || '')
      .replace(/^sha256:/i, '')
      .toLowerCase();
    if (got !== want) {
      throw new Error('SHA-256 не совпал: ' + f.path);
    }
    done += Number(f.size) || fs.statSync(dest).size;
  }
  fs.writeFileSync(
    path.join(staging, 'overlay-info.json'),
    JSON.stringify(
      {
        gitSha: manifest.gitSha,
        appliedAt: new Date().toISOString(),
        version: manifest.version || '',
      },
      null,
      2
    )
  );
  if (onProgress) {
    onProgress({ received: totalDownload, total: totalDownload, percent: 100 });
  }

  await swapOverlay(staging, getMainWindow);
  writeState({
    ...readState(),
    appliedPatchGitSha: manifest.gitSha,
    appliedPatchAt: new Date().toISOString(),
  });
}

function registerCodeUpdateIpc(getMainWindow) {
  rememberPortablePath();

  ipcMain.handle('code-update-build-info', async () => readBuildInfo());

  ipcMain.handle('code-patch-check', async () => {
    const currentSha = currentRendererSha();
    try {
      const manifest = await fetchPatchManifest();
      cachedPatchManifest = manifest;
      const { changed, unchanged } = diffPatch(manifest);
      const remoteSha = String(manifest.gitSha || '').toLowerCase();
      const hasUpdate =
        isPlaceholderSha(currentSha) || currentSha !== remoteSha || changed.length > 0;
      const sizeBytes = hasUpdate
        ? filesTotalBytes(manifest)
        : 0;
      return {
        ok: true,
        desktop: true,
        kind: 'patch',
        hasUpdate,
        currentSha,
        remoteSha,
        version: manifest.version,
        sizeBytes,
        builtAt: manifest.builtAt,
        fileCount: manifest.files.length,
        changedCount: hasUpdate ? manifest.files.length : 0,
        unchangedCount: hasUpdate ? 0 : unchanged.length,
        changedFiles: (hasUpdate ? manifest.files : changed).slice(0, 24).map((f) => ({
          path: f.path,
          size: f.size,
        })),
        title: hasUpdate
          ? `Интерфейс с GitHub (${remoteSha.slice(0, 7)}), ${formatKb(sizeBytes)}`
          : 'Интерфейс уже совпадает с опубликованным патчем GitHub',
      };
    } catch (e) {
      return {
        ok: false,
        desktop: true,
        kind: 'patch',
        hasUpdate: false,
        currentSha,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle('code-patch-install', async () => {
    const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
    try {
      const manifest = await fetchPatchManifest();
      cachedPatchManifest = manifest;
      await applyRendererPatch(manifest, {
        getMainWindow,
        onProgress: (p) => {
          if (win && !win.isDestroyed()) win.webContents.send('code-update-progress', p);
        },
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

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
        kind: 'exe',
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
        kind: 'exe',
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
    try {
      const o = overlayRoot();
      if (fs.existsSync(o)) fs.rmSync(o, { recursive: true, force: true });
    } catch {
      /* overlay cleanup is best-effort */
    }
    writeState({
      ...readState(),
      appliedGitSha: (manifest && manifest.gitSha) || readState().pendingSha,
      portablePath: dest,
      appliedPatchGitSha: undefined,
      appliedPatchAt: undefined,
    });

    setTimeout(() => app.quit(), 500);
    return { ok: true };
  });
}

module.exports = { registerCodeUpdateIpc, readBuildInfo, getRendererIndex };
