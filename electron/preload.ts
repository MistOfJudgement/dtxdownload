import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface ElectronAPI {
  // Directory selection
  selectDirectory: () => Promise<string | null>;
  
  // Dialog APIs
  showSaveDialog: (options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  
  showOpenDialog: (options: {
    properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[];
    title?: string;
    defaultPath?: string;
  }) => Promise<{ canceled: boolean; filePaths: string[] }>;
  
  showMessageBox: (options: {
    type?: 'none' | 'info' | 'error' | 'question' | 'warning';
    buttons?: string[];
    defaultId?: number;
    title?: string;
    message: string;
    detail?: string;
  }) => Promise<{ response: number; checkboxChecked?: boolean }>;
  
  // App info
  getAppVersion: () => Promise<string>;
  getAppPath: (name: 'home' | 'appData' | 'userData' | 'cache' | 'temp' | 'exe' | 'module' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'recent' | 'logs' | 'crashDumps') => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;
  
  // Platform detection
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
}

// Create the API object
const electronAPI: ElectronAPI = {
  // Directory selection
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // Dialog APIs
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Platform detection
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux'
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Declare global type for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
