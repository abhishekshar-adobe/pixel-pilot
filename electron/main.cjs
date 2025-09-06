'use strict';

const electron = require('electron');
const { app, BrowserWindow, dialog } = electron;
const path = require('path');
const Store = require('electron-store');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
let store = null;

const storeConfig = {
  name: 'pixel-pilot-config',
  defaults: {
    firstRun: true,
    serverPort: 5000,
    frontendPort: 5173
  }
};

async function createWindow() {
  try {
    // Initialize store
    if (!store) {
      store = new Store(storeConfig);
    }

    // Create the browser window
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      show: false
    });
  } catch (error) {
    console.error('Failed to create window:', error);
    dialog.showErrorBox('Error', `Failed to create window: ${error.message}`);
    app.quit();
    return;
  }
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false // Don't show until ready-to-show
  });

  // Start the backend server
  startBackendServer();

  // Load the app
  const startUrl = isDev 
    ? `http://localhost:${frontendPort}` 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
    
  // Wait for server to be ready
  setTimeout(() => {
    mainWindow.loadURL(startUrl);
  }, 2000);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Show welcome dialog on first run
    if (!store.get('firstRun')) {
      showWelcomeDialog();
      store.set('firstRun', true);
    }
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

async function startBackendServer() {
  const serverPath = isDev 
    ? path.join(__dirname, '../server/index.js')
    : path.join(process.resourcesPath, 'server/index.js');

  // Find available port
  serverPort = await findAvailablePort(5000);
  frontendPort = await findAvailablePort(5173);
  
  serverProcess = spawn('node', [serverPath], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT: serverPort,
      VITE_PORT: frontendPort
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

function showWelcomeDialog() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Welcome to PixelPilot',
    message: 'Thank you for installing PixelPilot!',
    detail: 'This tool will help you manage visual regression tests.\n\nClick OK to get started!',
    buttons: ['OK']
  });
}

  // Initialize app
const init = async () => {
  try {
    await app.whenReady();
    await createWindow();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    dialog.showErrorBox('Initialization Error', 
      `Failed to start application: ${error.message}`);
    app.quit();
  }
};

init();

// Handle window management
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

// Clean up on quit
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Error', 
    `An unexpected error occurred: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  dialog.showErrorBox('Error', 
    `An unexpected error occurred: ${error.message}`);
});