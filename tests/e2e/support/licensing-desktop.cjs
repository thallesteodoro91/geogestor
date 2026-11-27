// Run the production window/quit handlers against a real Electron window and the
// managed E2E API. OS dialog responses are deterministic; no user data is opened.
const electron = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');

const root = process.env.GEOGESTOR_E2E_ROOT;
if (!root || !/^run-[a-z0-9-]+$/i.test(path.basename(root))) throw new Error('Managed E2E root required');
process.on('uncaughtException', error => {
  fs.writeFileSync(path.join(root, 'native-harness-error.log'), error.stack || String(error));
  electron.app.exit(1);
});
fs.mkdirSync(path.join(root, 'electron-user-data'), { recursive: true });
electron.app.setPath('userData', path.join(root, 'electron-user-data'));
electron.app.on('window-all-closed', () => {});
const mainPath = path.resolve('apps/desktop/main.js');
const records = [];
let response = 0;
let hooks;
const app = Object.assign(new EventEmitter(), {
  commandLine: { appendSwitch() {} }, isPackaged: false,
  requestSingleInstanceLock: () => true,
  getVersion: () => 'E2E', getPath: name => electron.app.getPath(name),
  whenReady: () => new Promise(() => {}),
  quit() {
    let prevented = false;
    app.emit('before-quit', { preventDefault() { prevented = true; } });
    if (!prevented) hooks.window?.close();
  }
});
class TestWindow extends electron.BrowserWindow {
  constructor(options) {
    super(process.env.GEOGESTOR_E2E_OFFSCREEN === '1'
      ? { ...options, webPreferences: { ...options.webPreferences, offscreen: true } }
      : options);
    this.webContents.openDevTools = () => {};
    const send = this.webContents.send.bind(this.webContents);
    this.webContents.send = (channel, ...args) => {
      // The harness has no managed API process: record the backup status without
      // bridging a native WebFrameMain between VM realms.
      if (channel === 'shutdown-backup-status') { records.push({ channel, payload: args[0] }); return; }
      send(channel, ...args);
    };
  }
  loadURL() { return super.loadURL(`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}/ambiental?tab=licenciamento`); }
  show() {}
  maximize() {}
}
const context = {
  __dirname: path.dirname(mainPath), console, process, URL, setTimeout, clearTimeout,
  require(name) {
    if (name === 'electron') return {
      ...electron, app, BrowserWindow: TestWindow,
      dialog: { ...electron.dialog, showMessageBoxSync(_window, options) { records.push(options); return response; } }
    };
    return createRequire(mainPath)(name);
  }
};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync(mainPath, 'utf8')}
globalThis.__hooks = {
  createWindow, get window() { return mainWindow; },
  get states() { return [...licenseDraftStates.values()]; },
  get shutdownStarted() { return isQuitting; }, get shutdownCompleted() { return shutdownCompleted; }
}; apiPort = Number(process.env.GEOGESTOR_E2E_API_PORT);`, context, { filename: mainPath });
hooks = context.__hooks;
globalThis.__licensingDesktopTest = {
  records, setResponse(value) { response = value; },
  get states() { return hooks.states; },
  get shutdownStarted() { return hooks.shutdownStarted; },
  get shutdownCompleted() { return hooks.shutdownCompleted; },
  close() { hooks.window.close(); }, quit() { app.quit(); }
};
electron.app.whenReady().then(() => {
  hooks.createWindow(Number(process.env.GEOGESTOR_E2E_API_PORT));
  // The fixture remains hidden and does not open detached developer tools.
  hooks.window.webContents.closeDevTools();
});
