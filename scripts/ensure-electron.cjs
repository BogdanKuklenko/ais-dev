/**
 * Electron's extract-zip often fails under non-ASCII Windows paths
 * (this project lives in «серегина прога»). Fallback: extract the cached
 * zip into F:\tools\electron-<version> and junction it into node_modules.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

if (process.platform !== 'win32') {
  console.log('[ensure-electron] Not running on Windows, skipping.')
  process.exit(0)
}

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
const distDir = path.join(electronDir, 'dist')
const electronExe = path.join(distDir, 'electron.exe')

if (!fs.existsSync(path.join(electronDir, 'package.json'))) {
  console.log('[ensure-electron] electron package is not installed yet, skip')
  process.exit(0)
}

const version = require(path.join(electronDir, 'package.json')).version

if (fs.existsSync(electronExe)) {
  process.exit(0)
}

const cacheRoot = path.join(os.homedir(), 'AppData', 'Local', 'electron', 'Cache')
const zipName = `electron-v${version}-win32-x64.zip`

function findZip(dir) {
  if (!fs.existsSync(dir)) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = findZip(full)
      if (nested) return nested
    } else if (entry.name === zipName) {
      return full
    }
  }
  return null
}

function populateCache() {
  const installJs = path.join(electronDir, 'install.js')
  if (!fs.existsSync(installJs)) return
  try {
    execSync(`node "${installJs}"`, { cwd: electronDir, stdio: 'inherit' })
  } catch {
    // extract often fails on Cyrillic paths; zip may still land in the cache
  }
}

let zipPath = findZip(cacheRoot)
if (!zipPath) {
  populateCache()
  zipPath = findZip(cacheRoot)
}

if (fs.existsSync(electronExe)) {
  process.exit(0)
}

if (!zipPath) {
  console.error(`[ensure-electron] Missing cache zip: ${zipName}`)
  console.error('Run: npm.cmd install   (needs network once, to download Electron)')
  process.exit(1)
}

const toolsDist = path.join('F:', 'tools', `electron-${version}`)
fs.mkdirSync(path.dirname(toolsDist), { recursive: true })
if (fs.existsSync(toolsDist)) {
  fs.rmSync(toolsDist, { recursive: true, force: true })
}
fs.mkdirSync(toolsDist, { recursive: true })

console.log(`[ensure-electron] Extracting ${zipPath} -> ${toolsDist}`)

const sevenZipCandidates = [
  'C:\\Program Files\\7-Zip\\7z.exe',
  'C:\\Program Files (x86)\\7-Zip\\7z.exe',
]
const sevenZip = sevenZipCandidates.find((p) => fs.existsSync(p))

if (sevenZip) {
  execSync(`"${sevenZip}" x "${zipPath}" -o"${toolsDist}" -y`, { stdio: 'inherit' })
} else {
  const zipEsc = zipPath.replace(/'/g, "''")
  const destEsc = toolsDist.replace(/'/g, "''")
  execSync(
    `pwsh -NoProfile -Command "Expand-Archive -LiteralPath '${zipEsc}' -DestinationPath '${destEsc}' -Force"`,
    { stdio: 'inherit' },
  )
}

if (fs.existsSync(distDir)) {
  try {
    fs.rmSync(distDir, { recursive: true, force: true })
  } catch {
    try {
      fs.rmdirSync(distDir)
    } catch {
      /* junction busy — mklink will fail visibly below */
    }
  }
}

execSync(`cmd /c mklink /J "${distDir}" "${toolsDist}"`, { stdio: 'inherit' })
fs.writeFileSync(path.join(electronDir, 'path.txt'), 'electron.exe')
fs.writeFileSync(path.join(toolsDist, 'version'), version)

if (!fs.existsSync(electronExe)) {
  console.error('[ensure-electron] electron.exe still missing after junction')
  process.exit(1)
}

console.log('[ensure-electron] OK:', electronExe)
