const { app, shell, BrowserWindow, session } = require('electron');

const windows = new Map();

function createWindow(email) {
  if (windows.has(email)) {
    // If a window for this email already exists, focus it
    windows.get(email).focus();
    return;
  }

  const partition = `persist:${email}`;
  const ses = session.fromPartition(partition);

  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      spellcheck: true,
      webSecurity: true,
      contextIsolation: false,
      webviewTag: true,
      nodeIntegration: true,
      nativeWindowOpen: true,
      session: ses
    }
  });

  windows.set(email, window);
  window.loadURL(`https://outlook.office.com/?email=${email}`);

  // Handle navigation events
  window.webContents.on('did-fail-load', () => {
    window.loadURL(`https://outlook.office.com/?email=${email}`);
  });

  window.webContents.on('did-navigate', (event, url) => {
    if (!url.includes('outlook.office.com') && !url.includes('login.microsoftonline.com')) {
      window.loadURL(`https://outlook.office.com/?email=${email}`);
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('outlook.office.com') || url.includes('login.microsoftonline.com')) {
      createWindow(email);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.on('focus', () => {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'Alt') {
        window.setMenuBarVisibility(!window.isMenuBarVisible());
      }
    });
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
