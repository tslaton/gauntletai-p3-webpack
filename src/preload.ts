import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config: any) => ipcRenderer.invoke('update-config', config),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', title, body),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  
  // PDF processing
  processPDF: (filePath: string) => ipcRenderer.invoke('process-pdf', filePath),
  
  // Listen for events
  onPDFAdded: (callback: (filePath: string) => void) => {
    ipcRenderer.on('pdf-added', (_event, filePath) => callback(filePath));
  },
  
  onProcessingUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('processing-update', (_event, data) => callback(data));
  },
});