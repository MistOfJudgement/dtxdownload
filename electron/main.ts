import { app, BrowserWindow, dialog, ipcMain, shell, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { Server } from 'http';

// Import the existing server using require for CommonJS compatibility
const { createApp } = require('../api/server');

let mainWindow: BrowserWindow | null = null;
let server: Server | null = null;
const serverPort = 3001;

interface DirectoryDialogOptions {
  properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[];
  title?: string;
  defaultPath?: string;
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
}

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'), // We'll create this later
    titleBarStyle: 'default',
    show: false, // Don't show until ready
    title: 'DTX Download Manager'
  });

  // Load the GUI
  mainWindow.loadFile(path.join(__dirname, '../../gui/index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
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

async function startServer(): Promise<Server | null> {
  return new Promise((resolve, reject) => {
    try {
      const app = createApp();
      const serverInstance = app.listen(serverPort, 'localhost', () => {
        console.log(`✅ DTX Download Manager server running on http://localhost:${serverPort}`);
        resolve(serverInstance);
      });
      
      serverInstance.on('error', (error: NodeJS.ErrnoException) => {
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
ipcMain.handle('select-directory', async (): Promise<string | null> => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Download Directory'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('show-save-dialog', async (_event: IpcMainInvokeEvent, options: SaveDialogOptions) => {
  if (!mainWindow) return null;
  
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (_event: IpcMainInvokeEvent, options: DirectoryDialogOptions) => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-message-box', async (_event: IpcMainInvokeEvent, options: MessageBoxOptions) => {
  if (!mainWindow) return null;
  
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('get-app-version', (): string => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', (_event: IpcMainInvokeEvent, name: Parameters<typeof app.getPath>[0]): string => {
  return app.getPath(name);
});

ipcMain.handle('get-platform', (): NodeJS.Platform => {
  return process.platform;
});

// App event handlers
app.whenReady().then(async () => {
  try {
    // Start the backend server
    server = await startServer();
    
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
  // Clean up server
  if (server) {
    server.close();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

// Handle certificate errors
app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
  if (url.startsWith('http://localhost:')) {
    // Allow localhost connections
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});
