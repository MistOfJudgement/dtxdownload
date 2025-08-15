const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Directory and file selection
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // App information
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  
  // Platform info
  platform: process.platform,
  isElectron: true
});
