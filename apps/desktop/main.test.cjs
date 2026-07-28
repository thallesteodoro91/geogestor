const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadReadinessHelpers() {
  const mainPath = path.join(__dirname, 'main.js');
  const source = `${fs.readFileSync(mainPath, 'utf8')}
globalThis.__readinessHelpers = { waitForManagedApiReady, registerApiRecoveryAttempt };`;
  const ipcMain = { on() {}, handle() {} };
  const app = {
    commandLine: { appendSwitch() {} },
    isPackaged: true,
    requestSingleInstanceLock: () => true,
    on() {},
    whenReady: () => new Promise(() => {})
  };
  const electron = {
    app,
    BrowserWindow: {},
    dialog: {},
    shell: {},
    ipcMain,
    safeStorage: {},
    session: {}
  };
  const context = {
    __dirname,
    clearTimeout,
    console,
    globalThis: null,
    process,
    require(moduleName) {
      if (moduleName === 'electron') return electron;
      return require(moduleName);
    },
    setTimeout,
    URL
  };
  context.globalThis = context;

  vm.runInNewContext(source, context, { filename: mainPath });
  return context.__readinessHelpers;
}

test('readiness resolve somente após a mensagem IPC ready', async () => {
  const { waitForManagedApiReady } = loadReadinessHelpers();
  const child = new EventEmitter();
  const readiness = waitForManagedApiReady(child, 4567, 100);

  child.emit('message', 'not-ready');
  setImmediate(() => child.emit('message', 'ready'));

  assert.equal(await readiness, 4567);
  assert.equal(child.listenerCount('message'), 0);
  assert.equal(child.listenerCount('error'), 0);
  assert.equal(child.listenerCount('exit'), 0);
});

test('readiness falha imediatamente se a API encerrar antes de ficar pronta', async () => {
  const { waitForManagedApiReady } = loadReadinessHelpers();
  const child = new EventEmitter();
  const readiness = waitForManagedApiReady(child, 4567, 100);

  child.emit('exit', 1, null);

  await assert.rejects(readiness, /encerrou antes de ficar pronta.*código 1/);
});

test('readiness mantém timeout com mensagem acionável', async () => {
  const { waitForManagedApiReady } = loadReadinessHelpers();
  const child = new EventEmitter();

  await assert.rejects(
    waitForManagedApiReady(child, 4567, 5),
    /Timeout de 0 segundos aguardando a inicialização da API na porta 4567/
  );
});

test('supervisão limita reinicializações repetidas e libera nova tentativa após a janela', () => {
  const { registerApiRecoveryAttempt } = loadReadinessHelpers();
  const base = 1_000_000;

  assert.equal(registerApiRecoveryAttempt(base), 1);
  assert.equal(registerApiRecoveryAttempt(base + 1_000), 2);
  assert.equal(registerApiRecoveryAttempt(base + 2_000), 3);
  assert.equal(registerApiRecoveryAttempt(base + 3_000), null);
  assert.equal(registerApiRecoveryAttempt(base + 5 * 60 * 1000 + 2_001), 1);
});
