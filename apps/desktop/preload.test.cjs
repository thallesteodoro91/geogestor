const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPreload() {
  const source = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
  const syncCalls = [];
  const sentMessages = [];
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
    }
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

  return { api: exposedApi, syncCalls, sentMessages };
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
