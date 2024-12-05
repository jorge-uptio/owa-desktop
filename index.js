const { app, shell, BrowserWindow, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// Linux-specific optimizations
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

  // Linux-specific window configuration
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true,
    frame: false,
    show: false, // Don't show until ready
    backgroundColor: '#FFFFFF',
    webPreferences: {
      spellcheck: true,
      webSecurity: true,
      contextIsolation: false,
      webviewTag: true,
      nodeIntegration: true,
      nativeWindowOpen: true,
      session: ses,
      // Enable better handling of async operations
      backgroundThrottling: false
    }
  });

  // Debug async operations
  window.webContents.on('did-start-loading', () => {
    console.log(`[${email}] Started loading`);
  });

  window.webContents.on('did-finish-load', () => {
    console.log(`[${email}] Finished loading`);
    window.show();
  });

  // Monitor for hung renderer process
  let lastResponseTime = Date.now();
  const pingInterval = setInterval(() => {
    if (window.webContents) {
      window.webContents.executeJavaScript('console.log("ping")')
        .then(() => {
          lastResponseTime = Date.now();
        })
        .catch(err => {
          const timeSinceLastResponse = Date.now() - lastResponseTime;
          if (timeSinceLastResponse > 5000) { // 5 seconds
            console.log(`[${email}] Renderer appears hung, attempting recovery`);
            window.webContents.reload();
          }
        });
    }
  }, 1000);

  // Monitor Outlook's WebSocket connection
  window.webContents.on('did-navigate', () => {
    window.webContents.executeJavaScript(`
      (function() {
        let wsConnections = 0;
        const origWS = window.WebSocket;
        window.WebSocket = function(url, protocols) {
          const ws = new origWS(url, protocols);
          wsConnections++;
          console.log('WebSocket opened, total:', wsConnections);
          
          ws.addEventListener('close', () => {
            wsConnections--;
            console.log('WebSocket closed, total:', wsConnections);
            if (wsConnections === 0) {
              // Attempt to reconnect if all connections are lost
              setTimeout(() => window.location.reload(), 1000);
            }
          });
          
          return ws;
        };
      })()
    `);
  });

  // Handle renderer crashes more gracefully
  window.webContents.on('crashed', (event, killed) => {
    console.log(`[${email}] Renderer crashed, killed: ${killed}`);
    clearInterval(pingInterval);
    
    const options = {
      type: 'error',
      title: 'Process Crashed',
      message: 'The window crashed. Do you want to reload?',
      buttons: ['Reload', 'Close']
    };
    
    require('electron').dialog.showMessageBox(window, options).then(result => {
      if (result.response === 0) {
        window.reload();
      } else {
        window.close();
      }
    });
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
