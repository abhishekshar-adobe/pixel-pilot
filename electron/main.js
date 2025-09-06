const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const store = new Store();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: !isDev  // Disable web security in dev mode for local file access
    },
    icon: path.join(__dirname, 'icons/icon.png'),
    show: false // Don't show until ready
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:5173'  // Vite dev server URL
    : `file://${path.join(__dirname, '../dist/index.html')}`; // Production build path
    
  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Show welcome dialog on first run
    if (!store.get('firstRun')) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Welcome to PixelPilot',
        message: 'Thank you for installing PixelPilot!',
        detail: 'This tool will help you manage visual regression tests.\n\nClick OK to get started!',
        buttons: ['OK']
      });
      store.set('firstRun', true);
    }
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// Create window when app is ready
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle backend server startup
const { spawn } = require('child_process');
let serverProcess;

function startBackendServer() {
  const serverPath = isDev 
    ? path.join(__dirname, '../server')
    : path.join(process.resourcesPath, 'server');

  serverProcess = spawn('node', ['index.js'], {
    cwd: serverPath
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

app.on('ready', startBackendServer);

// Cleanup server process on quit
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
