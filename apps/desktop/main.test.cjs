const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadReadinessHelpers() {
  const mainPath = path.join(__dirname, 'main.js');
  const source = `${fs.readFileSync(mainPath, 'utf8')}
globalThis.__readinessHelpers = { waitForManagedApiReady, registerApiRecoveryAttempt, stopApiServerGracefully, openDiagnosticsFolder, setApiProcessForTest(child) { apiProcess = child; } };`;
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

function loadDatabaseKeyHelpers(userDataPath) {
  const mainPath = path.join(__dirname, 'main.js');
  const source = `${fs.readFileSync(mainPath, 'utf8')}
globalThis.__databaseKeyHelpers = { getOrCreateDatabaseEncryptionKey, databaseKeyId };`;
  let protectedValue = '';
  const app = {
    commandLine: { appendSwitch() {} },
    isPackaged: true,
    requestSingleInstanceLock: () => true,
    on() {},
    getPath: () => userDataPath,
    whenReady: () => new Promise(() => {})
  };
  const electron = {
    app,
    BrowserWindow: {},
    dialog: {},
    shell: {},
    ipcMain: { on() {}, handle() {} },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString(value) {
        protectedValue = value;
        return Buffer.from('DPAPI-SYNTHETIC-CIPHERTEXT');
      },
      decryptString() {
        return protectedValue;
      }
    },
    session: {}
  };
  const context = {
    __dirname,
    Buffer,
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
  return context.__databaseKeyHelpers;
}

function loadSecretKeyHelpers(userDataPath) {
  const mainPath = path.join(__dirname, 'main.js');
  const source = `${fs.readFileSync(mainPath, 'utf8')}
globalThis.__secretKeyHelpers = { getOrCreateSecretKey, databaseKeyId };`;
  let protectedValue = '';
  const app = {
    commandLine: { appendSwitch() {} },
    isPackaged: true,
    requestSingleInstanceLock: () => true,
    on() {},
    getPath: () => userDataPath,
    whenReady: () => new Promise(() => {})
  };
  const electron = {
    app,
    BrowserWindow: {},
    dialog: {},
    shell: {},
    ipcMain: { on() {}, handle() {} },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString(value) {
        protectedValue = value;
        return Buffer.from('DPAPI-SECRET-SYNTHETIC-CIPHERTEXT');
      },
      decryptString() {
        return protectedValue;
      }
    },
    session: {}
  };
  const context = {
    __dirname,
    Buffer,
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
  return context.__secretKeyHelpers;
}

function loadBackupRecoveryHelpers(userDataPath) {
  const mainPath = path.join(__dirname, 'main.js');
  const source = `${fs.readFileSync(mainPath, 'utf8')}
globalThis.__backupRecoveryHelpers = { getOrCreateBackupRecoveryKey, setBackupRecoveryConfirmed, writeJsonEnvelopeAtomicSync };`;
  let protectedValue = '';
  const app = {
    commandLine: { appendSwitch() {} },
    isPackaged: true,
    requestSingleInstanceLock: () => true,
    on() {},
    getPath: () => userDataPath,
    whenReady: () => new Promise(() => {})
  };
  const electron = {
    app,
    BrowserWindow: {},
    dialog: {},
    shell: {},
    ipcMain: { on() {}, handle() {} },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString(value) {
        protectedValue = value;
        return Buffer.from('DPAPI-RECOVERY-SYNTHETIC-CIPHERTEXT');
      },
      decryptString() {
        return protectedValue;
      }
    },
    session: {}
  };
  const context = {
    __dirname,
    Buffer,
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
  return context.__backupRecoveryHelpers;
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

test('encerramento envia SIGTERM e só conclui depois da confirmação de saída da API', async () => {
  const { stopApiServerGracefully, setApiProcessForTest } = loadReadinessHelpers();
  const child = new EventEmitter();
  child.kill = (signal) => {
    assert.equal(signal, 'SIGTERM');
    setImmediate(() => child.emit('exit', 0));
    return true;
  };
  setApiProcessForTest(child);
  const result = await stopApiServerGracefully(100);
  assert.equal(result.graceful, true);
  assert.equal(result.reason, 'exit-0');
});

test('diagnóstico cria e abre diretamente a pasta diagnostics', async () => {
  const { openDiagnosticsFolder } = loadReadinessHelpers();
  const calls = [];
  const result = await openDiagnosticsFolder({
    userDataPath: 'C:\\GeoGestor',
    mkdir: async (target, options) => calls.push(['mkdir', target, options]),
    openPath: async (target) => { calls.push(['openPath', target]); return ''; }
  });
  assert.equal(result.success, true);
  assert.equal(result.path, path.join('C:\\GeoGestor', 'diagnostics'));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['mkdir', path.join('C:\\GeoGestor', 'diagnostics'), { recursive: true }],
    ['openPath', path.join('C:\\GeoGestor', 'diagnostics')]
  ]);
});

test('diagnóstico trata texto de erro devolvido por shell.openPath sem expor caminho', async () => {
  const { openDiagnosticsFolder } = loadReadinessHelpers();
  const result = await openDiagnosticsFolder({
    userDataPath: 'C:\\Users\\Pessoa\\GeoGestor',
    mkdir: async () => undefined,
    openPath: async () => 'Access denied: C:\\Users\\Pessoa\\GeoGestor\\diagnostics'
  });
  assert.equal(result.success, false);
  assert.equal(result.error, 'O Windows não conseguiu abrir a pasta de diagnósticos.');
  assert.equal(JSON.stringify(result).includes('Pessoa'), false);
});

test('chave do banco é aleatória, versionada e persistida somente pelo cofre do Windows', () => {
  const userDataPath = path.join(__dirname, '.test-database-key');
  fs.rmSync(userDataPath, { recursive: true, force: true });
  fs.mkdirSync(userDataPath, { recursive: true });
  try {
    const { getOrCreateDatabaseEncryptionKey, databaseKeyId } = loadDatabaseKeyHelpers(userDataPath);
    const first = getOrCreateDatabaseEncryptionKey();
    const envelopePath = path.join(userDataPath, 'database-key.v1.json');
    const envelopeText = fs.readFileSync(envelopePath, 'utf8');
    const envelope = JSON.parse(envelopeText);
    assert.equal(Buffer.from(first, 'base64').length, 32);
    assert.equal(envelope.version, 1);
    assert.equal(envelope.scope, 'current-windows-user');
    assert.equal(envelope.keyId, databaseKeyId(first));
    assert.equal(envelopeText.includes(first), false);
    assert.equal(getOrCreateDatabaseEncryptionKey(), first);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test('segredo local legado migra para envelope DPAPI sem manter texto puro', () => {
  const userDataPath = path.join(__dirname, '.test-secret-key');
  fs.rmSync(userDataPath, { recursive: true, force: true });
  fs.mkdirSync(userDataPath, { recursive: true });
  const legacyKey = Buffer.alloc(32, 91).toString('base64');
  fs.writeFileSync(path.join(userDataPath, 'local-secrets.key'), legacyKey, 'utf8');
  try {
    const { getOrCreateSecretKey, databaseKeyId } = loadSecretKeyHelpers(userDataPath);
    const migrated = getOrCreateSecretKey();
    const envelopePath = path.join(userDataPath, 'local-secrets-key.v2.json');
    const envelopeText = fs.readFileSync(envelopePath, 'utf8');
    const envelope = JSON.parse(envelopeText);
    assert.equal(migrated, legacyKey);
    assert.equal(envelope.version, 2);
    assert.equal(envelope.protection, 'electron-safeStorage');
    assert.equal(envelope.keyId, databaseKeyId(legacyKey));
    assert.equal(envelopeText.includes(legacyKey), false);
    assert.equal(fs.existsSync(path.join(userDataPath, 'local-secrets.key')), false);
    assert.equal(getOrCreateSecretKey(), legacyKey);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});

test('confirmaÃ§Ã£o do kit substitui envelope por rename atÃ´mico e limpa temporÃ¡rios', () => {
  const userDataPath = path.join(__dirname, '.test-backup-recovery-key');
  fs.rmSync(userDataPath, { recursive: true, force: true });
  fs.mkdirSync(userDataPath, { recursive: true });
  try {
    const helpers = loadBackupRecoveryHelpers(userDataPath);
    const created = helpers.getOrCreateBackupRecoveryKey();
    assert.equal(created.confirmed, false);
    const confirmed = helpers.setBackupRecoveryConfirmed(true);
    assert.equal(confirmed.confirmed, true);

    const envelopePath = path.join(userDataPath, 'backup-recovery-key.v1.json');
    const envelope = JSON.parse(fs.readFileSync(envelopePath, 'utf8'));
    assert.equal(envelope.confirmed, true);
    assert.equal(envelope.keyId, created.keyId);
    assert.equal(fs.readdirSync(userDataPath).some((name) => name.includes('.pending-')), false);

    const original = fs.readFileSync(envelopePath, 'utf8');
    assert.throws(() => helpers.writeJsonEnvelopeAtomicSync(
      envelopePath,
      { ...envelope, confirmed: false },
      () => { throw new Error('falha sintÃ©tica de validaÃ§Ã£o'); }
    ), /falha sintÃ©tica/);
    assert.equal(fs.readFileSync(envelopePath, 'utf8'), original);
    assert.equal(fs.readdirSync(userDataPath).some((name) => name.includes('.pending-')), false);
  } finally {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  }
});
