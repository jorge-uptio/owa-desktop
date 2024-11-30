const { app, shell, BrowserWindow, Menu, MenuItem, session } = require('electron');
const Store = require('electron-store');
const path = require('path');

const store = new Store();
const windows = new Map();

function createWindow(email) {
  if (windows.has(email)) {
    windows.get(email).focus();
    return;
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      spellcheck: true,
      nodeIntegration: false,
      contextIsolation: true,
      partition: `persist:${email}`
    }
  });

  window.loadURL(`https://outlook.office.com/?email=${email}`);
  windows.set(email, window);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('outlook.office.com') || url.includes('login.microsoftonline.com')) {
      createWindow(email);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.on('closed', () => {
    windows.delete(email);
  });
}

app.whenReady().then(() => {
  const email = process.argv.find(arg => arg.startsWith('--email='))?.split('=')[1] 
    || 'default@example.com';
  createWindow(email);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
