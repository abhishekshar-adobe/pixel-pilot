const electron = require('electron');
const { app } = electron;
const Store = require('electron-store');
const { spawn } = require('child_process');
const path = require('path');

let store = null;
let mainWindow = null;
let serverProcess = null;
let viteProcess = null;

function startDevServer() {
  // Start Vite dev server
  viteProcess = spawn('npm', ['run', 'dev'], {
    shell: true,
    env: process.env,
    stdio: 'pipe'
  });

  viteProcess.stdout.on('data', (data) => {
    console.log(`Vite: ${data}`);
  });

  viteProcess.stderr.on('data', (data) => {
    console.error(`Vite Error: ${data}`);
  });

  // Start backend server
  const serverPath = path.join(__dirname, '../server/index.js');
  serverProcess = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: 5000
    },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

function initializeStore() {
  const config = {
    name: 'pixel-pilot',
    defaults: {
      firstRun: true
    }
  };
  
  try {
    store = new Store(config);
    return true;
  } catch (error) {
    console.error('Failed to initialize store:', error);
    return false;
  }
}

function createMainWindow() {
  const BrowserWindow = electron.BrowserWindow;
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  const isDev = process.env.NODE_ENV === 'development';
  const url = isDev ? 'http://localhost:5174' : `file://${__dirname}/../dist/index.html`;
  
  mainWindow.loadURL(url);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function waitForServer(port) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.on('connect', () => {
        clearInterval(interval);
        socket.destroy();
        resolve();
      });
      
      socket.on('error', () => {
        socket.destroy();
      });
      
      socket.connect(port, 'localhost');
    }, 500);
  });
}

app.on('ready', async () => {
  if (!initializeStore()) {
    electron.dialog.showErrorBox('Error', 'Failed to initialize application storage');
    app.quit();
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    startDevServer();
    
    // Wait for both servers to be ready
    try {
      await Promise.all([
        waitForServer(5173), // Vite server
        waitForServer(5000)  // Backend server
      ]);
      console.log('Both servers are ready');
    } catch (error) {
      console.error('Failed to start servers:', error);
      electron.dialog.showErrorBox('Error', 'Failed to start application servers');
      app.quit();
      return;
    }
  }
  
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.on('before-quit', () => {
  if (viteProcess) {
    viteProcess.kill();
  }
  if (serverProcess) {
    serverProcess.kill();
  }
});
