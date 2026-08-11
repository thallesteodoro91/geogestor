const { app, BrowserWindow, Notification, dialog, shell, ipcMain, safeStorage, session } = require('electron');
const crypto = require('crypto');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const net = require('net');
const { performance } = require('perf_hooks');

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('high-dpi-support', '1');

const apiToken = crypto.randomUUID();
let apiPort = 3001;
let localSessionToken = '';
const startupStartedAt = performance.now();
const reportedStartupMilestones = new Set();

ipcMain.on('get-api-token', (event) => {
  event.returnValue = apiToken;
});

ipcMain.on('get-api-port', (event) => {
  event.returnValue = apiPort;
});

ipcMain.on('set-local-session-token', (_event, token) => {
  localSessionToken = typeof token === 'string' && token.length <= 256 ? token : '';
});

const isDev = !app.isPackaged;

let mainWindow = null;
let apiProcess = null;
let securityHeadersInstalled = false;
let isQuitting = false;
let restoreRestartInProgress = false;
let apiRestartHistory = [];
let apiRestartTimer = null;
let shutdownPromise = null;
let shutdownCompleted = false;
let shutdownBackupFailure = null;
const runtimeSensitiveValues = new Set();
const shownDeadlineAlertIds = new Set();

function reportStartupMilestone(name) {
  if (reportedStartupMilestones.has(name)) return;
  reportedStartupMilestones.add(name);
  const elapsedMs = Math.round((performance.now() - startupStartedAt) * 100) / 100;
  console.log(`[Startup] ${name} +${elapsedMs}ms`);
}

ipcMain.on('startup-milestone', (_event, name) => {
  if (name === 'first-route-usable') {
    reportStartupMilestone(name);
  }
});

ipcMain.handle('show-deadline-notification', async (_event, payload) => {
  if (!payload || typeof payload !== 'object' || !Notification?.isSupported?.()) return false;
  const id = typeof payload.id === 'string' ? payload.id.slice(0, 100) : '';
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 120) : 'Prazo no GeoGestor';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 300) : '';
  const link = typeof payload.link === 'string' && payload.link.startsWith('/') ? payload.link.slice(0, 500) : '/';
  if (!id || shownDeadlineAlertIds.has(id)) return false;
  shownDeadlineAlertIds.add(id);
  if (shownDeadlineAlertIds.size > 500) shownDeadlineAlertIds.delete(shownDeadlineAlertIds.values().next().value);
  const notification = new Notification({ title, body, silent: false });
  notification.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('open-deadline-alert', link);
  });
  notification.show();
  return true;
});

ipcMain.handle('select-backup-bundle', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione um backup completo do GeoGestor',
    defaultPath: path.join(app.getPath('userData'), 'backups'),
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0] || null;
});

ipcMain.handle('select-data-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione a pasta de documentos do GeoGestor',
    defaultPath: app.getPath('documents'),
    buttonLabel: 'Selecionar pasta',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0] || null;
});

ipcMain.handle('select-backup-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione a pasta de backups do GeoGestor',
    defaultPath: path.join(app.getPath('userData'), 'backups'),
    buttonLabel: 'Usar como destino',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0] || null;
});

ipcMain.handle('open-backup-directory', async (_event, targetDirectory) => {
  if (typeof targetDirectory !== 'string' || targetDirectory.length > 4096 || !path.isAbsolute(targetDirectory)) {
    throw new Error('A pasta de backup informada é inválida.');
  }
  const resolved = path.resolve(targetDirectory);
  const stats = await fs.promises.stat(resolved);
  if (!stats.isDirectory()) throw new Error('A pasta de backup não está disponível.');
  const errorMessage = await shell.openPath(resolved);
  if (errorMessage) throw new Error(errorMessage);
});

ipcMain.handle('get-backup-recovery-status', async () => {
  const recovery = getOrCreateBackupRecoveryKey();
  return { configured: true, confirmed: recovery.confirmed, keyId: recovery.keyId };
});

ipcMain.handle('confirm-backup-recovery', async () => {
  const recovery = getOrCreateBackupRecoveryKey();
  setBackupRecoveryConfirmed(true);
  return { configured: true, confirmed: true, keyId: recovery.keyId };
});

ipcMain.handle('save-backup-recovery-kit', async (_event, kit) => {
  if (!kit || typeof kit !== 'object' || kit.format !== 'GeoGestor-Recovery-Kit' || kit.version !== 1) {
    throw new Error('O kit de recuperação informado é inválido.');
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar kit de recuperação do GeoGestor',
    defaultPath: path.join(app.getPath('documents'), `GeoGestor-Recovery-Kit-${new Date().toISOString().slice(0, 10)}.json`),
    filters: [{ name: 'Kit de recuperação do GeoGestor', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return null;
  await fs.promises.writeFile(result.filePath, `${JSON.stringify(kit, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return result.filePath;
});

async function openDiagnosticsFolder(dependencies = {}) {
  const userDataPath = dependencies.userDataPath || app.getPath('userData');
  const diagnosticsPath = path.join(userDataPath, 'diagnostics');
  const mkdir = dependencies.mkdir || fs.promises.mkdir;
  const openPath = dependencies.openPath || ((target) => shell.openPath(target));
  try {
    await mkdir(diagnosticsPath, { recursive: true });
    const errorMessage = await openPath(diagnosticsPath);
    if (errorMessage) return { success: false, error: 'O Windows não conseguiu abrir a pasta de diagnósticos.' };
    return { success: true, path: diagnosticsPath };
  } catch {
    return { success: false, error: 'Não foi possível preparar ou abrir a pasta de diagnósticos.' };
  }
}

ipcMain.handle('open-diagnostics-folder', () => openDiagnosticsFolder());

function writeApiProcessLog(level, data) {
  try {
    const logPath = path.join(app.getPath('userData'), 'api-process.log');
    const sanitized = [...runtimeSensitiveValues].reduce(
      (value, secret) => value.split(secret).join('[REDACTED_SECRET]'),
      String(data).trim()
    );
    const line = `[${new Date().toISOString()}] [${level}] ${sanitized}\n`;
    fs.appendFileSync(logPath, line, { encoding: 'utf8' });
  } catch (error) {
    console.error('[Electron] Não foi possível registrar o log da API:', error);
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

function findFreePort(preferredPort = 3001) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      const dynamicServer = net.createServer();
      dynamicServer.unref();
      dynamicServer.on('error', () => resolve(3001));
      dynamicServer.listen(0, '127.0.0.1', () => {
        const address = dynamicServer.address();
        const port = address && typeof address === 'object' ? address.port : 3001;
        dynamicServer.close(() => resolve(port));
      });
    });
    server.listen(preferredPort, '127.0.0.1', () => {
      server.close(() => resolve(preferredPort));
    });
  });
}

function waitForTcpServer(port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let retryTimer = null;

    const attemptConnection = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.setTimeout(500);
      socket.once('connect', () => {
        if (retryTimer) clearTimeout(retryTimer);
        socket.destroy();
        resolve(port);
      });
      const retry = () => {
        socket.destroy();
        if (performance.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timeout de ${Math.round(timeoutMs / 1000)} segundos aguardando a API na porta ${port}`));
          return;
        }
        retryTimer = setTimeout(attemptConnection, 100);
      };
      socket.once('error', retry);
      socket.once('timeout', retry);
    };

    attemptConnection();
  });
}

function waitForManagedApiReady(child, port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error(`Timeout de ${Math.round(timeoutMs / 1000)} segundos aguardando a inicialização da API na porta ${port}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(port);
    };
    const onMessage = (message) => {
      if (message === 'ready') finish();
    };
    const onError = (error) => {
      finish(new Error(`Falha ao iniciar o processo da API: ${error.message}`));
    };
    const onExit = (code, signal) => {
      const detail = signal ? `sinal ${signal}` : `código ${code ?? 'desconhecido'}`;
      finish(new Error(`A API encerrou antes de ficar pronta (${detail}).`));
    };

    child.on('message', onMessage);
    child.on('error', onError);
    child.on('exit', onExit);
  });
}

function getOrCreateSecretKey() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('A proteção de credenciais do Windows não está disponível neste perfil.');
  }
  const userDataPath = app.getPath('userData');
  const keyPath = path.join(userDataPath, 'local-secrets-key.v2.json');
  const legacyPath = path.join(userDataPath, 'local-secrets.key');
  if (fs.existsSync(keyPath)) {
    const envelope = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    if (envelope.version !== 2 || envelope.protection !== 'electron-safeStorage' || typeof envelope.ciphertext !== 'string') {
      throw new Error('O cofre local de credenciais está em um formato incompatível.');
    }
    const key = safeStorage.decryptString(Buffer.from(envelope.ciphertext, 'base64'));
    const decoded = Buffer.from(key, 'base64');
    const valid = decoded.length === 32 && decoded.toString('base64') === key;
    decoded.fill(0);
    if (!valid || databaseKeyId(key) !== envelope.keyId) throw new Error('O cofre local de credenciais não pôde ser validado neste perfil do Windows.');
    return key;
  }

  let key = null;
  if (fs.existsSync(legacyPath)) {
    const legacy = fs.readFileSync(legacyPath);
    try {
      const candidate = safeStorage.decryptString(legacy);
      const decoded = Buffer.from(candidate, 'base64');
      if (decoded.length === 32 && decoded.toString('base64') === candidate) key = candidate;
      decoded.fill(0);
    } catch {
      const candidate = legacy.toString('utf8').trim();
      const decoded = Buffer.from(candidate, 'base64');
      if (decoded.length === 32 && decoded.toString('base64') === candidate) key = candidate;
      decoded.fill(0);
    }
    if (!key) {
      const candidate = legacy.toString('utf8').trim();
      const decoded = Buffer.from(candidate, 'base64');
      if (decoded.length === 32 && decoded.toString('base64') === candidate) key = candidate;
      decoded.fill(0);
    }
  }
  key ||= crypto.randomBytes(32).toString('base64');
  const encrypted = safeStorage.encryptString(key);
  const envelope = {
    version: 2,
    protection: 'electron-safeStorage',
    provider: process.platform === 'win32' ? 'Windows DPAPI' : 'operating-system-keychain',
    scope: 'current-os-user',
    keyId: databaseKeyId(key),
    createdAt: new Date().toISOString(),
    ciphertext: encrypted.toString('base64')
  };
  const temporaryPath = `${keyPath}.pending`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(envelope)}\n`, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporaryPath, keyPath);
  const verified = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  if (safeStorage.decryptString(Buffer.from(verified.ciphertext, 'base64')) !== key) {
    throw new Error('A migração do cofre local não pôde ser confirmada; o valor anterior foi preservado.');
  }
  if (fs.existsSync(legacyPath)) fs.rmSync(legacyPath, { force: true });
  return key;
}

function databaseKeyId(key) {
  return crypto.createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16);
}

function getOrCreateDatabaseEncryptionKey() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('O Windows DPAPI não está disponível para proteger a chave do banco de dados.');
  }
  const keyPath = path.join(app.getPath('userData'), 'database-key.v1.json');
  if (fs.existsSync(keyPath)) {
    const envelope = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    if (envelope.version !== 1 || envelope.protection !== 'electron-safeStorage' || typeof envelope.ciphertext !== 'string') {
      throw new Error('O arquivo protegido da chave do banco está em formato incompatível.');
    }
    const key = safeStorage.decryptString(Buffer.from(envelope.ciphertext, 'base64'));
    const decoded = Buffer.from(key, 'base64');
    const valid = decoded.length === 32 && decoded.toString('base64') === key;
    decoded.fill(0);
    if (!valid || databaseKeyId(key) !== envelope.keyId) {
      throw new Error('A chave protegida do banco não pôde ser validada neste perfil do Windows.');
    }
    return key;
  }
  const key = crypto.randomBytes(32).toString('base64');
  const encrypted = safeStorage.encryptString(key);
  const envelope = {
    version: 1,
    protection: 'electron-safeStorage',
    scope: 'current-windows-user',
    keyId: databaseKeyId(key),
    createdAt: new Date().toISOString(),
    ciphertext: encrypted.toString('base64')
  };
  const temporaryPath = `${keyPath}.pending`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(envelope)}\n`, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporaryPath, keyPath);
  return key;
}

function getOrCreateBackupRecoveryKey() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('O armazenamento seguro do sistema não está disponível para proteger a recuperação de emergência.');
  }
  const keyPath = path.join(app.getPath('userData'), 'backup-recovery-key.v1.json');
  if (fs.existsSync(keyPath)) {
    const envelope = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    if (envelope.version !== 1 || envelope.protection !== 'electron-safeStorage' || typeof envelope.ciphertext !== 'string') {
      throw new Error('A configuração da recuperação de emergência está em formato incompatível.');
    }
    const key = safeStorage.decryptString(Buffer.from(envelope.ciphertext, 'base64'));
    const decoded = Buffer.from(key, 'base64');
    const valid = decoded.length === 32 && decoded.toString('base64') === key;
    decoded.fill(0);
    if (!valid || databaseKeyId(key) !== envelope.keyId) {
      throw new Error('A chave de recuperação não pôde ser validada neste perfil do sistema.');
    }
    return { key, keyId: envelope.keyId, confirmed: envelope.confirmed === true };
  }
  const key = crypto.randomBytes(32).toString('base64');
  const envelope = {
    version: 1,
    protection: 'electron-safeStorage',
    scope: 'current-os-user',
    keyId: databaseKeyId(key),
    createdAt: new Date().toISOString(),
    confirmed: false,
    ciphertext: safeStorage.encryptString(key).toString('base64')
  };
  const temporaryPath = `${keyPath}.pending`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(envelope)}\n`, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporaryPath, keyPath);
  return { key, keyId: envelope.keyId, confirmed: false };
}

function setBackupRecoveryConfirmed(confirmed) {
  const keyPath = path.join(app.getPath('userData'), 'backup-recovery-key.v1.json');
  const recovery = getOrCreateBackupRecoveryKey();
  const envelope = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const updated = { ...envelope, confirmed: Boolean(confirmed), confirmedAt: confirmed ? new Date().toISOString() : null };
  const temporaryPath = `${keyPath}.pending-${crypto.randomUUID()}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(updated)}\n`, { flag: 'wx', mode: 0o600 });
  fs.copyFileSync(temporaryPath, keyPath);
  fs.rmSync(temporaryPath, { force: true });
  return { keyId: recovery.keyId, confirmed: Boolean(confirmed) };
}

function installSecurityHeaders() {
  if (securityHeadersInstalled) return;
  securityHeadersInstalled = true;

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://127.0.0.1:*/*'] },
    (details, callback) => {
      try {
        const target = new URL(details.url);
        if (target.hostname === '127.0.0.1' && target.port === String(apiPort)) {
          const existingHeader = Object.keys(details.requestHeaders)
            .find((header) => header.toLowerCase() === 'x-api-token');
          details.requestHeaders[existingHeader || 'x-api-token'] = apiToken;
          if (localSessionToken) {
            const sessionHeader = Object.keys(details.requestHeaders)
              .find((header) => header.toLowerCase() === 'x-local-session');
            details.requestHeaders[sessionHeader || 'x-local-session'] = localSessionToken;
          }
        }
      } catch {
        // Keep invalid URLs untouched.
      }
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  if (isDev) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders || {}) };
    responseHeaders['Content-Security-Policy'] = [
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    ];
    responseHeaders['X-Content-Type-Options'] = ['nosniff'];
    responseHeaders['Referrer-Policy'] = ['no-referrer'];
    callback({ responseHeaders });
  });
}

async function startApiServer() {
  reportStartupMilestone('api-start-requested');
  const port = isDev
    ? Number(process.env.GEOGESTOR_API_PORT) || 3001
    : await findFreePort(3001);
  apiPort = port;

  return new Promise((resolve, reject) => {
    let serverScript;

    if (isDev) {
      console.log(`[Electron] Dev mode - waiting for API listener on port ${port}...`);
      waitForTcpServer(port).then((readyPort) => {
        reportStartupMilestone('api-ready');
        resolve(readyPort);
      }).catch(reject);
      return;
    }

    const resourcesPath = process.resourcesPath;
    serverScript = path.join(resourcesPath, 'api', 'server.js');
    const dbPath = path.join(app.getPath('userData'), 'geogestor.db');

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (!fs.existsSync(dbPath)) {
      fs.closeSync(fs.openSync(dbPath, 'a'));
      console.log('[Electron] Created an empty database in the user data directory');
    }
    const secretKey = getOrCreateSecretKey();
    const databaseEncryptionKey = getOrCreateDatabaseEncryptionKey();
    const backupRecovery = getOrCreateBackupRecoveryKey();
    runtimeSensitiveValues.add(secretKey);
    runtimeSensitiveValues.add(databaseEncryptionKey);
    runtimeSensitiveValues.add(backupRecovery.key);

    console.log(`[Electron] Starting API server from: ${serverScript} on port ${port}`);

    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      GEOGESTOR_DB_PATH: dbPath,
      GEOGESTOR_WEB_DIST: path.join(process.resourcesPath, 'web'),
      GEOGESTOR_API_TOKEN: apiToken,
      GEOGESTOR_SECRET_KEY: secretKey,
      GEOGESTOR_DB_ENCRYPTION_KEY: databaseEncryptionKey,
      GEOGESTOR_BACKUP_RECOVERY_KEY: backupRecovery.key,
      GEOGESTOR_BACKUP_RECOVERY_CONFIRMED: backupRecovery.confirmed ? '1' : '0',
      GEOGESTOR_DATABASE_WORKER: path.join(process.resourcesPath, 'api', 'database-security-worker.js'),
      GEOGESTOR_BACKUP_RESTORE_WORKER: path.join(process.resourcesPath, 'api', 'backup-restore-worker.js'),
      GEOGESTOR_DESKTOP_MANAGED: '1',
      NODE_PATH: [
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'),
        path.join(process.resourcesPath, 'api', 'node_modules'),
        path.join(process.resourcesPath, 'api', 'native_modules')
      ].join(path.delimiter),
    };

    apiProcess = fork(serverScript, [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    reportStartupMilestone('api-process-forked');

    apiProcess.stdout.on('data', (data) => {
      console.log(`[API] ${data.toString()}`);
      writeApiProcessLog('INFO', data);
    });

    apiProcess.stderr.on('data', (data) => {
      console.error(`[API Error] ${data}`);
      writeApiProcessLog('ERROR', data);
    });

    apiProcess.on('error', (err) => {
      console.error('[Electron] API process error:', err);
    });

    apiProcess.on('message', (message) => {
      if (isQuitting && message && message.type === 'shutdown-backup-failed') {
        shutdownBackupFailure = typeof message.message === 'string' ? message.message : 'O backup de encerramento falhou.';
        return;
      }
      if (!isQuitting || !message || message.type !== 'shutdown-backup-progress') return;
      const progress = message.progress || {};
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shutdown-backup-status', {
          running: true,
          message: typeof progress.stage === 'string' ? progress.stage : 'Salvando antes de fechar…',
          processedFiles: Number(progress.processedFiles || 0),
          processedBytes: Number(progress.processedBytes || 0),
          totalFiles: Number(progress.totalFiles || 0),
          totalBytes: Number(progress.totalBytes || 0)
        });
      }
    });

    apiProcess.on('exit', (code) => {
      console.log(`[Electron] API process exited with code ${code}`);
      apiProcess = null;
      if (!isQuitting && (code === 75 || code === 76)) {
        void restartAfterRestore(code);
      } else if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
        scheduleApiRecovery(code);
      }
    });

    waitForManagedApiReady(apiProcess, port)
      .then((readyPort) => {
        reportStartupMilestone('api-ready');
        resolve(readyPort);
      })
      .catch((err) => {
        console.error('[Electron] API readiness failed:', err);
        if (apiProcess) {
          try {
            apiProcess.kill('SIGTERM');
          } catch {}
          apiProcess = null;
        }
        reject(err);
      });
  });
}

function scheduleApiRecovery(exitCode) {
  if (apiRestartTimer || isQuitting || restoreRestartInProgress) return;
  const attemptNumber = registerApiRecoveryAttempt();
  if (attemptNumber === null) {
    writeApiProcessLog('FATAL', `Recuperação automática interrompida após 3 tentativas. Último código: ${exitCode ?? 'desconhecido'}.`);
    return;
  }
  const delayMs = Math.min(5000, attemptNumber * 1000);
  writeApiProcessLog('WARN', `API interrompida. Tentativa controlada ${attemptNumber}/3 em ${delayMs} ms.`);
  apiRestartTimer = setTimeout(async () => {
    apiRestartTimer = null;
    try {
      const port = await startApiServer();
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.loadURL(`http://127.0.0.1:${port}`);
      }
      writeApiProcessLog('INFO', 'Conexão com a API local recuperada.');
    } catch (error) {
      writeApiProcessLog('ERROR', error instanceof Error ? error.message : String(error));
      scheduleApiRecovery('startup-failed');
    }
  }, delayMs);
}

function registerApiRecoveryAttempt(now = Date.now()) {
  apiRestartHistory = apiRestartHistory.filter((timestamp) => timestamp > now - 5 * 60 * 1000);
  if (apiRestartHistory.length >= 3) {
    return null;
  }
  apiRestartHistory.push(now);
  return apiRestartHistory.length;
}

async function restartAfterRestore(exitCode) {
  if (restoreRestartInProgress) return;
  restoreRestartInProgress = true;
  try {
    const port = await startApiServer();
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(`http://127.0.0.1:${port}`);
    }
    const resultPath = path.join(app.getPath('userData'), 'last-restore-result.json');
    let detail = exitCode === 75
      ? 'O backup foi restaurado e o GeoGestor foi reiniciado.'
      : 'A restauração falhou. O GeoGestor recuperou o banco anterior quando possível.';
    try {
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      if (typeof result.message === 'string') detail = result.message;
    } catch {}
    await dialog.showMessageBox(mainWindow, {
      type: exitCode === 75 ? 'info' : 'error',
      title: exitCode === 75 ? 'Restauração concluída' : 'Restauração não concluída',
      message: detail
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox('Erro ao reiniciar o GeoGestor', message);
  } finally {
    restoreRestartInProgress = false;
  }
}

function stopApiServerGracefully(timeoutMs = 5 * 60 * 1000) {
  if (!apiProcess) return Promise.resolve({ graceful: true, reason: 'not-managed' });
  const child = apiProcess;
  console.log('[Electron] Stopping API server and waiting for shutdown backup...');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      writeApiProcessLog('ERROR', `A API não encerrou em ${timeoutMs} ms; finalização forçada.`);
      try {
        child.kill();
      } catch {}
      finish({ graceful: false, reason: 'timeout' });
    }, timeoutMs);

    child.once('exit', (code) => finish({ graceful: true, reason: `exit-${code}` }));
    child.once('error', (error) => finish({ graceful: false, reason: error.message }));
    try {
      child.kill('SIGTERM');
    } catch (error) {
      finish({ graceful: false, reason: error instanceof Error ? error.message : String(error) });
    }
  });
}

function createWindow(port) {
  installSecurityHeaders();
  reportStartupMilestone('window-create-requested');
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 680,
    minWidth: 800,
    minHeight: 520,
    center: true,
    title: `GeoGestor v${app.getVersion()}`,
    backgroundColor: '#FAFAFA',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const url = isDev
    ? 'http://localhost:5173'
    : `http://127.0.0.1:${port}`;

  console.log(`[Electron] Loading: ${url}`);
  mainWindow.loadURL(url);
  reportStartupMilestone('window-load-requested');

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    const allowedOrigins = isDev
      ? ['http://localhost:5173', `http://localhost:${port}`]
      : [`http://127.0.0.1:${port}`];

    try {
      const target = new URL(targetUrl);
      if (allowedOrigins.includes(target.origin)) {
        return { action: 'allow' };
      }
    } catch {
      // Non-HTTP protocols are opened externally below.
    }

    try {
      const externalTarget = new URL(targetUrl);
      if (externalTarget.protocol === 'https:' || externalTarget.protocol === 'http:') {
        shell.openExternal(externalTarget.toString());
      }
    } catch {
      // Invalid or non-allowlisted URLs are ignored.
    }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    reportStartupMilestone('window-ready-to-show');
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.once('dom-ready', () => {
    reportStartupMilestone('window-dom-ready');
  });

  if (isDev || process.env.GEOGESTOR_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const allowedOrigins = isDev
      ? ['http://localhost:5173']
      : [`http://127.0.0.1:${port}`];

    try {
      const target = new URL(navigationUrl);
      if (!allowedOrigins.includes(target.origin)) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (process.platform !== 'darwin' && !shutdownCompleted) {
      event.preventDefault();
      app.quit();
    }
  });
}

app.whenReady().then(async () => {
  reportStartupMilestone('app-ready');
  try {
    const port = await startApiServer();
    createWindow(port);
  } catch (err) {
    console.error('[Electron] Fatal error starting app:', err);
    const message = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox(
      'Erro ao iniciar o GeoGestor',
      `Nao foi possivel iniciar o servidor interno.\n\n${message}`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(apiPort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (shutdownCompleted) return;
  event.preventDefault();
  if (shutdownPromise) return;
  isQuitting = true;
  if (apiRestartTimer) clearTimeout(apiRestartTimer);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shutdown-backup-status', {
      running: true,
      message: 'Salvando o backup de encerramento antes de fechar…'
    });
  }
  shutdownPromise = (async () => {
    while (true) {
      shutdownBackupFailure = null;
      const result = await stopApiServerGracefully();
      if (!result.graceful) shutdownBackupFailure ||= `Encerramento sem confirmação da API: ${result.reason}`;
      if (!shutdownBackupFailure) return true;
      const decision = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'O backup não foi concluído',
        message: shutdownBackupFailure,
        detail: 'Os dados originais foram preservados. Escolha como deseja continuar.',
        buttons: ['Tentar novamente', 'Voltar ao GeoGestor', 'Fechar sem backup'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (decision.response === 2) return true;
      const port = await startApiServer();
      if (mainWindow && !mainWindow.isDestroyed()) await mainWindow.loadURL(isDev ? 'http://localhost:5173' : `http://127.0.0.1:${port}`);
      if (decision.response === 1) {
        isQuitting = false;
        mainWindow?.webContents.send('shutdown-backup-status', { running: false, message: '' });
        return false;
      }
    }
  })().then((shouldClose) => {
    shutdownPromise = null;
    if (!shouldClose) return;
    shutdownCompleted = true;
    app.quit();
  });
});
