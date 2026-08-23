const { contextBridge, ipcRenderer } = require('electron');

const apiToken = ipcRenderer.sendSync('get-api-token');
const apiPort = ipcRenderer.sendSync('get-api-port');
const allowedStartupMilestones = new Set(['first-route-usable']);

contextBridge.exposeInMainWorld('electronAPI', {
  getApiToken: () => apiToken,
  getApiPort: () => apiPort,
  setLocalSessionToken: (token) => ipcRenderer.send('set-local-session-token', token),
  selectBackupBundle: () => ipcRenderer.invoke('select-backup-bundle'),
  selectBackupRecoveryKit: () => ipcRenderer.invoke('select-backup-recovery-kit'),
  selectDataDirectory: () => ipcRenderer.invoke('select-data-directory'),
  selectBackupDirectory: () => ipcRenderer.invoke('select-backup-directory'),
  openBackupDirectory: (directory) => ipcRenderer.invoke('open-backup-directory', directory),
  getBackupRecoveryStatus: () => ipcRenderer.invoke('get-backup-recovery-status'),
  confirmBackupRecovery: (expectedKeyId) => ipcRenderer.invoke('confirm-backup-recovery', expectedKeyId),
  saveBackupRecoveryKit: (kit) => ipcRenderer.invoke('save-backup-recovery-kit', kit),
  onShutdownBackupStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('shutdown-backup-status', listener);
    return () => ipcRenderer.removeListener('shutdown-backup-status', listener);
  },
  openDiagnosticsFolder: () => ipcRenderer.invoke('open-diagnostics-folder'),
  showDeadlineNotification: (payload) => ipcRenderer.invoke('show-deadline-notification', payload),
  onOpenDeadlineAlert: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, link) => callback(link);
    ipcRenderer.on('open-deadline-alert', listener);
    return () => ipcRenderer.removeListener('open-deadline-alert', listener);
  },
  reportStartupMilestone: (name) => {
    if (allowedStartupMilestones.has(name)) {
      ipcRenderer.send('startup-milestone', name);
    }
  }
});
