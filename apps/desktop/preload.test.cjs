const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPreload() {
  const source = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
  const syncCalls = [];
  const sentMessages = [];
  const listeners = new Map();
  let exposedApi;

  const ipcRenderer = {
    sendSync(channel) {
      syncCalls.push(channel);
      if (channel === 'get-api-token') return 'synthetic-token';
      if (channel === 'get-api-port') return 4321;
      throw new Error(`Unexpected sync channel: ${channel}`);
    },
    invoke: async () => null,
    send(channel, value) {
      sentMessages.push([channel, value]);
    },
    on(channel, listener) { listeners.set(channel, listener); },
    removeListener(channel, listener) { if (listeners.get(channel) === listener) listeners.delete(channel); }
  };

  vm.runInNewContext(source, {
    require(moduleName) {
      assert.equal(moduleName, 'electron');
      return {
        contextBridge: {
          exposeInMainWorld(name, api) {
            assert.equal(name, 'electronAPI');
            exposedApi = api;
          }
        },
        ipcRenderer
      };
    },
    Set
  }, { filename: 'preload.js' });

  return { api: exposedApi, syncCalls, sentMessages, listeners };
}

test('preload lê porta e token uma única vez durante a inicialização', () => {
  const { api, syncCalls } = loadPreload();

  assert.equal(api.getApiToken(), 'synthetic-token');
  assert.equal(api.getApiToken(), 'synthetic-token');
  assert.equal(api.getApiPort(), 4321);
  assert.equal(api.getApiPort(), 4321);
  assert.deepEqual(syncCalls, ['get-api-token', 'get-api-port']);
});

test('preload envia somente milestones de startup permitidos', () => {
  const { api, sentMessages } = loadPreload();

  api.reportStartupMilestone('first-route-usable');
  api.reportStartupMilestone('token=must-not-be-forwarded');

  assert.deepEqual(sentMessages, [['startup-milestone', 'first-route-usable']]);
});

test('preload encaminha a sessão local sem persistir senha ou token em armazenamento web', () => {
  const { api, sentMessages } = loadPreload();

  api.setLocalSessionToken('session-token');
  api.setLocalSessionToken('');

  assert.deepEqual(sentMessages, [
    ['set-local-session-token', 'session-token'],
    ['set-local-session-token', '']
  ]);
});

test('preload expõe a abertura da pasta de backup somente via IPC', async () => {
  const { api } = loadPreload();
  assert.equal(typeof api.openBackupDirectory, 'function');
  assert.equal(await api.openBackupDirectory('C:\\Backups\\GeoGestor'), null);
});

test('preload expõe a abertura segura da pasta de diagnósticos somente via IPC', async () => {
  const { api } = loadPreload();
  assert.equal(typeof api.openDiagnosticsFolder, 'function');
  assert.equal(await api.openDiagnosticsFolder(), null);
});

test('preload entrega e remove o estado de backup durante o encerramento', () => {
  const { api, listeners } = loadPreload();
  let received = null;
  const unsubscribe = api.onShutdownBackupStatus((payload) => { received = payload; });
  listeners.get('shutdown-backup-status')({}, { running: true, message: 'Salvando…' });
  assert.deepEqual(received, { running: true, message: 'Salvando…' });
  unsubscribe();
  assert.equal(listeners.has('shutdown-backup-status'), false);
});
