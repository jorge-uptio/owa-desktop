const { app, shell, BrowserWindow, session } = require('electron');
const { Menu, MenuItem } = require('electron');

// Wayland-specific optimizations
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer,WaylandWindowDecorations,VaapiVideoDecoder');
app.commandLine.appendSwitch('ozone-platform', 'wayland');
app.commandLine.appendSwitch('enable-wayland-ime');

// General Linux optimizations
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-gpu-rasterization');

const windows = new Map();

function createWindow(email) {
  if (windows.has(email)) {
    windows.get(email).focus();
    return;
  }

  const partition = `persist:${email}`;
  const ses = session.fromPartition(partition);

  const webPreferences = {
    spellcheck: true,
    webSecurity: true,
    contextIsolation: false,
    webviewTag: true,
    nodeIntegration: true,
    nativeWindowOpen: true,
    session: ses,
    backgroundThrottling: false,
    enablePreferredSizeMode: true,
    // Enable only necessary permissions
    enableWebSQL: false,
    allowRunningInsecureContent: false,
    experimentalFeatures: false
  };

  // Wayland-optimized window configuration
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    frame: false,
    // show: false,
    backgroundColor: '#FFFFFF',
    webPreferences
  });

  // Handle external links
  window.webContents.setWindowOpenHandler(({ url }) => {
    // If it's an Outlook URL, create new window
    if (url.includes('outlook.office.com') || url.includes('login.microsoftonline.com')) {
      createWindow(email);
      return { action: 'deny' };
    }
    // For all other URLs, open in default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Add context menu
  window.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    // Add copy/paste actions when text is selected
    if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    // Always show these items
    menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
    menu.append(new MenuItem({ label: 'Cut', role: 'cut' }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }));

    // Add spelling suggestions if available
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion)
        }));
      }
      menu.append(new MenuItem({ type: 'separator' }));
    }

    // Show context menu
    menu.popup();
  });

  window.on('closed', () => {
    windows.delete(email);
  });

  window.loadURL(`https://outlook.office.com/?email=${email}`);

  return window;
}

app.on('render-process-gone', (event, webContents, details) => {
  console.error('Renderer process crashed:', details.reason);
});

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
