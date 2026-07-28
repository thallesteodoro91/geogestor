const { contextBridge, ipcRenderer } = require('electron');

const apiToken = ipcRenderer.sendSync('get-api-token');
const apiPort = ipcRenderer.sendSync('get-api-port');
const allowedStartupMilestones = new Set(['first-route-usable']);

contextBridge.exposeInMainWorld('electronAPI', {
  getApiToken: () => apiToken,
  getApiPort: () => apiPort,
  setLocalSessionToken: (token) => ipcRenderer.send('set-local-session-token', token),
  selectBackupBundle: () => ipcRenderer.invoke('select-backup-bundle'),
  openDiagnosticsFolder: () => ipcRenderer.invoke('open-diagnostics-folder'),
  reportStartupMilestone: (name) => {
    if (allowedStartupMilestones.has(name)) {
      ipcRenderer.send('startup-milestone', name);
    }
  }
});
