/**
 * Build a portable Windows .exe from an ASCII working directory.
 *
 * Two Windows problems this project hits:
 * 1. Electron extract-zip fails when the project path has Cyrillic
 *    (Desktop\серегина прога).
 * 2. Vite realpaths junctions, so a junction back to that folder still
 *    makes Rollup emit an absolute Cyrillic path for index.html.
 *
 * Fix: copy sources to F:\tools\alex-dosing-build (real ASCII folder),
 * build there, copy the .exe back.
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const buildRoot = 'F:\\tools\\alex-dosing-build'
const exeName = 'ALEX_Dosing_Control_Portable.exe'
const safeTemp = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Bogdan\\AppData\\Local', 'Temp')
fs.mkdirSync(safeTemp, { recursive: true })

function hasNonAscii(p) {
  return /[^\x00-\x7F]/.test(p)
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      http_proxy: '',
      https_proxy: '',
      npm_config_proxy: 'null',
      npm_config_https_proxy: 'null',
      npm_config_noproxy: '*',
      // NSIS portable unpack/build fails when TEMP has a space
      // (this PC default: G:\Android Studio\temp).
      TEMP: safeTemp,
      TMP: safeTemp,
    },
    windowsHide: true,
  })
  if (result.error) {
    console.error('[build-exe] failed to start', command, result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status == null ? 1 : result.status)
  }
}

function syncToAsciiBuildDir() {
  fs.mkdirSync('F:\\tools', { recursive: true })
  fs.mkdirSync(buildRoot, { recursive: true })

  console.log('[build-exe] copying project ->', buildRoot)
  const copied = spawnSync(
    'robocopy',
    [
      projectRoot,
      buildRoot,
      '/E',
      '/XD',
      'node_modules',
      'dist',
      'dist-electron',
      'coverage',
      'Новая версия',
      '/NFL',
      '/NDL',
      '/NJH',
      '/NJS',
      '/NP',
      '/R:2',
      '/W:1',
    ],
    { windowsHide: true },
  )
  // robocopy: 0–7 = success, >= 8 = failure
  const code = copied.status == null ? 16 : copied.status
  if (code >= 8) {
    console.error('[build-exe] robocopy failed with code', code)
    process.exit(1)
  }
  return buildRoot
}

const workDir = hasNonAscii(projectRoot) ? syncToAsciiBuildDir() : projectRoot
console.log('[build-exe] working directory:', workDir)

function writeBuildInfo(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  const info = {
    gitSha: process.env.GITHUB_SHA || 'local',
    version: pkg.version,
    builtAt: new Date().toISOString(),
    channel: process.env.GITHUB_SHA ? 'github-actions' : 'local',
  }
  fs.writeFileSync(path.join(dir, 'build-info.json'), JSON.stringify(info, null, 2))
  console.log('[build-exe] build-info.json', info.gitSha, info.version)
}

writeBuildInfo(workDir)

const viteCli = path.join(workDir, 'node_modules', 'vite', 'dist', 'node', 'cli.js')
if (!fs.existsSync(viteCli)) {
  const brokenModules = path.join(workDir, 'node_modules')
  if (fs.existsSync(brokenModules)) {
    console.log('[build-exe] removing incomplete node_modules in ASCII build dir')
    fs.rmSync(brokenModules, { recursive: true, force: true })
  }
  console.log('[build-exe] npm.cmd install in ASCII build dir')
  run('npm.cmd', ['install', '--no-audit', '--no-fund', '--proxy=null', '--https-proxy=null'], workDir)
}

run('node', ['scripts/ensure-electron.cjs'], workDir)

console.log('[build-exe] Vite build')
run('npm.cmd', ['run', 'build'], workDir)

const builderCmd = path.join(workDir, 'node_modules', '.bin', 'electron-builder.cmd')
if (!fs.existsSync(builderCmd)) {
  console.error('[build-exe] electron-builder is not installed. Run npm.cmd install')
  process.exit(1)
}

console.log('[build-exe] electron-builder --win portable')
run(`"${builderCmd}"`, ['--win', 'portable'], workDir)

const builtExe = path.join(workDir, 'dist-electron', exeName)
if (!fs.existsSync(builtExe)) {
  console.error('[build-exe] Expected exe was not created:', builtExe)
  process.exit(1)
}

const destDir = path.join(projectRoot, 'dist-electron')
fs.mkdirSync(destDir, { recursive: true })
const destExe = path.join(destDir, exeName)
if (path.resolve(builtExe) !== path.resolve(destExe)) {
  try {
    fs.copyFileSync(builtExe, destExe)
  } catch (err) {
    if (err && err.code === 'EBUSY') {
      const alt = destExe.replace(/\.exe$/i, '_new.exe')
      fs.copyFileSync(builtExe, alt)
      console.warn('[build-exe] dest exe is locked (app running). Wrote:', alt)
    } else {
      throw err
    }
  }
}

const launcherSrc = path.join(projectRoot, 'scripts', 'Start_ALEX.bat')
const launcherDest = path.join(destDir, 'Start_ALEX.bat')
fs.copyFileSync(launcherSrc, launcherDest)

const unpackedSrc = path.join(workDir, 'dist-electron', 'win-unpacked')
const unpackedDest = path.join(destDir, 'ALEX_Dosing_Control')
if (fs.existsSync(unpackedSrc)) {
  console.log('[build-exe] copying unpacked folder ->', unpackedDest)
  if (fs.existsSync(unpackedDest)) {
    fs.rmSync(unpackedDest, { recursive: true, force: true })
  }
  fs.mkdirSync(unpackedDest, { recursive: true })
  const packCopy = spawnSync(
    'robocopy',
    [unpackedSrc, unpackedDest, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:2', '/W:1'],
    { windowsHide: true },
  )
  const packCode = packCopy.status == null ? 16 : packCopy.status
  if (packCode >= 8) {
    console.error('[build-exe] robocopy of win-unpacked failed with code', packCode)
    process.exit(1)
  }
}

console.log('[build-exe] OK:', destExe)
console.log('[build-exe] launcher:', launcherDest)
if (fs.existsSync(path.join(unpackedDest, 'ALEX Dosing Control.exe'))) {
  console.log('[build-exe] folder:', path.join(unpackedDest, 'ALEX Dosing Control.exe'))
}
