'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dist = path.join(__dirname, '..', 'dist');

function walk(dir, base) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      out.push(...walk(full, base));
      continue;
    }
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (rel === 'code-patch.json' || rel.endsWith('.map')) continue;
    const buf = fs.readFileSync(full);
    out.push({
      path: rel,
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
      size: buf.length,
    });
  }
  return out;
}

function readPkgVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  return pkg.version;
}

function gitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.ALEX_GIT_SHA) return process.env.ALEX_GIT_SHA;
  return 'local';
}

if (!fs.existsSync(dist)) {
  console.error('[code-patch] dist/ missing — run vite build first');
  process.exit(1);
}

const files = walk(dist, dist).sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  format: 'alex_code_patch_v1',
  gitSha: gitSha(),
  version: readPkgVersion(),
  builtAt: new Date().toISOString(),
  fileCount: files.length,
  totalBytes: files.reduce((s, f) => s + f.size, 0),
  files,
};

fs.writeFileSync(path.join(dist, 'code-patch.json'), JSON.stringify(manifest, null, 2));
console.log(
  '[code-patch] wrote',
  files.length,
  'files,',
  manifest.totalBytes,
  'bytes, sha',
  manifest.gitSha.slice(0, 7)
);
