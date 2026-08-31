const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { registerCodeUpdateIpc, getRendererIndex } = require('./electron-code-update.cjs');

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, 'public', 'icon.svg');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'АЛЕКС — Пульт дозирования и учёта замесов',
    backgroundColor: '#111215',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    icon: iconPath,
  });

  Menu.setApplicationMenu(null);

  const indexPath = getRendererIndex();
  mainWindow.loadFile(indexPath).catch(() => {
    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerCodeUpdateIpc(() => mainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
