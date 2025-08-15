const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Import the existing server
const { createApp } = require('../dist/api/server');

let mainWindow;
let serverProcess;
const serverPort = 3001;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'), // We'll create this later
    titleBarStyle: 'default',
    show: false // Don't show until ready
  });

  // Load the GUI
  mainWindow.loadFile(path.join(__dirname, '../gui/index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Development tools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      const app = createApp();
      const server = app.listen(serverPort, 'localhost', () => {
        console.log(`✅ DTX Download Manager server running on http://localhost:${serverPort}`);
        resolve(server);
      });
      
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`Port ${serverPort} is already in use, trying to connect to existing server...`);
          resolve(null); // Server already running
        } else {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// IPC handlers for native OS integration
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Download Directory'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', (event, name) => {
  return app.getPath(name);
});

// App event handlers
app.whenReady().then(async () => {
  try {
    // Start the backend server
    await startServer();
    
    // Create the main window
    createWindow();
    
    // macOS specific behavior
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On platforms other than macOS, quit when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up server process
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});
