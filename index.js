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
    contextIsolation: false,
    webviewTag: true,
    nodeIntegration: true,
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

  // Mute all audio to prevent notification sounds from causing crashes
  window.webContents.setAudioMuted(true);

  // Enhanced error handling and cleanup
  window.webContents.on('render-process-gone', (event, details) => {
    console.log(`[${email}] Render process gone: ${details.reason}`);
    clearInterval(pingInterval);

    // Give the process a moment to clean up
    setTimeout(() => {
      try {
        if (!window.isDestroyed()) {
          window.reload();
        }
      } catch (e) {
        console.error('Error during reload:', e);
      }
    }, 1000);
  });

  // Add crashed event handler
  window.webContents.on('crashed', (event, killed) => {
    console.log(`[${email}] Renderer crashed: ${killed ? 'killed' : 'crashed'}`);
    clearInterval(pingInterval);

    setTimeout(() => {
      try {
        if (!window.isDestroyed()) {
          window.reload();
        }
      } catch (e) {
        console.error('Error during reload:', e);
      }
    }, 1000);
  });

  // Add unresponsive handler
  window.on('unresponsive', () => {
    console.log(`[${email}] Window became unresponsive`);
    setTimeout(() => {
      try {
        if (!window.isDestroyed()) {
          window.reload();
        }
      } catch (e) {
        console.error('Error during reload:', e);
      }
    }, 1000);
  });

  window.on('closed', () => {
    clearInterval(pingInterval);
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
