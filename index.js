const { app, BrowserWindow, session } = require('electron');

// Wayland-specific optimizations
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer,WaylandWindowDecorations');
app.commandLine.appendSwitch('ozone-platform', 'wayland');
app.commandLine.appendSwitch('enable-wayland-ime');

// General Linux optimizations
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
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
    contextIsolation: true,  // Changed to true for security
    webviewTag: true,
    nodeIntegration: false,  // Changed to false for security
    nativeWindowOpen: true,
    session: ses,
    backgroundThrottling: false,
    enablePreferredSizeMode: true,
    // Added security options
    sandbox: true,
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
    show: false,
    backgroundColor: '#FFFFFF',
    webPreferences
  });

  // Prevent white flashes during loading
  window.webContents.on('did-start-loading', () => {
    console.log(`[${email}] Started loading`);
  });

  window.webContents.on('did-finish-load', () => {
    console.log(`[${email}] Finished loading`);
    // Small delay before showing to ensure content is rendered
    setTimeout(() => window.show(), 100);
  });

  // Monitor for main process hang
  let lastResponseTime = Date.now();
  const pingInterval = setInterval(() => {
    if (window.webContents) {
      window.webContents.executeJavaScript(`
        // Check if Outlook is responsive
        if (typeof OWA !== 'undefined' && OWA.enabled) {
          console.log('OWA active and responsive');
        }
      `)
        .then(() => {
          lastResponseTime = Date.now();
        })
        .catch(err => {
          const timeSinceLastResponse = Date.now() - lastResponseTime;
          if (timeSinceLastResponse > 5000) {
            console.log(`[${email}] Process appears hung, attempting recovery`);
            window.webContents.reload();
          }
        });
    }
  }, 2000);

  // Enhanced error handling for Wayland
  window.webContents.on('render-process-gone', (event, details) => {
    console.log(`[${email}] Render process gone:`, details.reason);
    clearInterval(pingInterval);
    
    if (details.reason !== 'clean-exit') {
      const options = {
        type: 'error',
        title: 'Process Terminated',
        message: `The window process was terminated (${details.reason}). Reload?`,
        buttons: ['Reload', 'Close']
      };
      
      require('electron').dialog.showMessageBox(window, options).then(result => {
        if (result.response === 0) {
          window.reload();
        } else {
          window.close();
        }
      });
    }
  });

  window.loadURL(`https://outlook.office.com/?email=${email}`);

  window.on('closed', () => {
    clearInterval(pingInterval);
    windows.delete(email);
  });

  return window;
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
