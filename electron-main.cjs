// Electron Main Process for Windows Portable (.exe)
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'АЛЕКС — Пульт дозирования и учёта замесов',
    backgroundColor: '#111215',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, 'public/icon.svg')
  });

  Menu.setApplicationMenu(null);

  // In production, load the built static single-page app
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  
  mainWindow.loadFile(indexPath).catch(() => {
    // If dev server or fallback
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
