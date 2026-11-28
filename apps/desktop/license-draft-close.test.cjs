const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const test = require('node:test');

function load() {
  const handlers = new Map();
  const records = [];
  let decision = 0;
  const mainFrame = {};
  const sender = { mainFrame };
  const app = Object.assign(new EventEmitter(), {
    commandLine: { appendSwitch() {} }, isPackaged: true,
    requestSingleInstanceLock: () => true, whenReady: () => new Promise(() => {})
  });
  const filename = path.join(__dirname, 'main.js');
  const context = { __dirname, console, process, setTimeout, clearTimeout, URL,
    require(name) {
      if (name === 'electron') return {
        app, BrowserWindow: {}, ipcMain: { on(channel, callback) { handlers.set(channel, callback); }, handle() {} },
        dialog: { showMessageBoxSync(_window, options) { records.push(options); return decision; } },
        shell: {}, session: {}, safeStorage: {}
      };
      return require(name);
    }
  };
  vm.createContext(context);
  vm.runInContext(`${fs.readFileSync(filename, 'utf8')}
    mainWindow = { webContents: __sender }; globalThis.__guard = { canCloseLicenseDrafts, get started() { return isQuitting; } };`,
    Object.assign(context, { __sender: sender }), { filename });
  return {
    records, guard: context.__guard,
    set(state, event = { sender, senderFrame: mainFrame }) { handlers.get('set-license-draft-state')(event, state); },
    decide(value) { decision = value; },
    quit() { app.emit('before-quit', { preventDefault() {} }); }
  };
}

test('cancelar o fechamento mantém o servidor disponível; descarte exige escolha explícita', () => {
  const desktop = load();
  desktop.set({ id: 'license', dirty: true, saving: false });
  desktop.quit();
  assert.equal(desktop.guard.started, false);
  assert.equal(desktop.records[0].defaultId, 0);
  assert.equal(desktop.records[0].cancelId, 0);
  desktop.decide(1);
  assert.equal(desktop.guard.canCloseLicenseDrafts(), true);
});

test('salvamento em curso impede fechamento mesmo com resposta de descarte', () => {
  const desktop = load();
  desktop.set({ id: 'condition', dirty: true, saving: true });
  desktop.decide(1);
  desktop.quit();
  assert.equal(desktop.guard.started, false);
  assert.equal(desktop.guard.canCloseLicenseDrafts(), false);
  assert.equal(desktop.records[0].title, 'Salvamento em andamento');
  desktop.set({ id: 'condition', dirty: false, saving: false });
  assert.equal(desktop.guard.canCloseLicenseDrafts(), true);
});

test('somente a janela principal pode atualizar a proteção; editores são independentes', () => {
  const desktop = load();
  desktop.set({ id: 'invalid', dirty: true, saving: false }, { sender: {}, senderFrame: {} });
  desktop.set({ id: 'malformed', dirty: 'yes', saving: false });
  assert.equal(desktop.guard.canCloseLicenseDrafts(), true);
  desktop.set({ id: 'license', dirty: true, saving: false });
  desktop.set({ id: 'condition', dirty: true, saving: false });
  desktop.set({ id: 'license', dirty: false, saving: false });
  assert.equal(desktop.guard.canCloseLicenseDrafts(), false);
  desktop.set({ id: 'condition', dirty: false, saving: false });
  assert.equal(desktop.guard.canCloseLicenseDrafts(), true);
});
