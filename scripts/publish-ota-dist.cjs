'use strict';

/**
 * Publishes dist/ to branch ota-dist.
 * GitHub Actions: npm run build may have no token (skip). electron-builder
 * afterPack has GH_TOKEN and publishes.
 * Local: ALEX_PUBLISH_OTA=1 plus gh token.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const inActions = process.env.GITHUB_ACTIONS === 'true';
const forced = process.env.ALEX_PUBLISH_OTA === '1';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

if (!forced && !inActions) {
  process.exit(0);
}

if (!token && !forced) {
  console.warn('[ota-dist] skip: no GITHUB_TOKEN/GH_TOKEN in this step');
  process.exit(0);
}

const dist = path.join(__dirname, '..', 'dist');
const manifestPath = path.join(dist, 'code-patch.json');
if (!fs.existsSync(manifestPath)) {
  console.error('[ota-dist] dist/code-patch.json missing');
  process.exit(inActions || forced ? 1 : 0);
}

const repo = process.env.GITHUB_REPOSITORY || 'BogdanKuklenko/ais-dev';

function gitCmd() {
  if (process.platform !== 'win32') return 'git';
  const candidates = [
    'git',
    'F:\\hermes\\git\\cmd\\git.exe',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd', 'git.exe'),
  ];
  for (const c of candidates) {
    if (c === 'git') return c;
    if (fs.existsSync(c)) return c;
  }
  return 'git';
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || result.error || 'git failed').toString();
    throw new Error(err.slice(0, 800));
  }
  return result;
}

const git = gitCmd();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'alex-ota-dist-'));
const sha = process.env.GITHUB_SHA || 'local';

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, name.name);
    const to = path.join(dest, name.name);
    if (name.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

try {
  copyTree(dist, work);
  run(git, ['init', '-b', 'ota-dist'], work);
  run(git, ['-c', 'user.name=github-actions', '-c', 'user.email=github-actions@github.com', 'add', '-A'], work);
  run(
    git,
    [
      '-c',
      'user.name=github-actions',
      '-c',
      'user.email=github-actions@github.com',
      'commit',
      '-m',
      `renderer patch ${sha}`,
    ],
    work
  );
  run(git, ['remote', 'add', 'origin', `https://github.com/${repo}.git`], work);
  if (inActions && token) {
    run(
      git,
      ['-c', `http.extraHeader=AUTHORIZATION: bearer ${token}`, 'push', '--force', 'origin', 'HEAD:ota-dist'],
      work
    );
  } else {
    run(
      git,
      [
        '-c',
        'credential.helper=',
        '-c',
        'credential.helper=!C:/Program\\ Files/GitHub\\ CLI/gh.exe auth git-credential',
        'push',
        '--force',
        'origin',
        'HEAD:ota-dist',
      ],
      work
    );
  }
  console.log('[ota-dist] published branch ota-dist for', sha);
} catch (e) {
  console.error('[ota-dist] publish failed:', e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  try {
    fs.rmSync(work, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
