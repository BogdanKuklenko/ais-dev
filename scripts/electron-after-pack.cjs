'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

/**
 * electron-builder hook. On GitHub Actions the electron-builder step has GH_TOKEN.
 */
module.exports = async function afterPack() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) return;
  const script = path.join(__dirname, 'publish-ota-dist.cjs');
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      ALEX_PUBLISH_OTA: '1',
    },
  });
  if (result.status) {
    throw new Error('publish-ota-dist failed');
  }
};
