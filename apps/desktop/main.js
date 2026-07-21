const { app, BrowserWindow, dialog, shell, ipcMain, safeStorage, session } = require('electron');
const crypto = require('crypto');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const net = require('net');
const http = require('http');

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('high-dpi-support', '1');

const apiToken = crypto.randomUUID();
let apiPort = 3001;

ipcMain.on('get-api-token', (event) => {
  event.returnValue = apiToken;
});

ipcMain.on('get-api-port', (event) => {
  event.returnValue = apiPort;
});

const isDev = !app.isPackaged;

let mainWindow = null;
let apiProcess = null;
let securityHeadersInstalled = false;

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

function checkApiHealth(port) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startTime > 15000) {
        clearInterval(interval);
        reject(new Error(`Timeout de 15 segundos aguardando resposta da API na porta ${port}`));
        return;
      }

      const req = http.get(`http://127.0.0.1:${port}/api/health`, { headers: { 'x-api-token': apiToken } }, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(port);
        }
      });
      req.on('error', () => {});
      req.end();
    }, 500);
  });
}

function getOrCreateSecretKey() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('A proteção de credenciais do Windows não está disponível neste perfil.');
  }
  const keyPath = path.join(app.getPath('userData'), 'local-secrets.key');
  if (fs.existsSync(keyPath)) {
    return safeStorage.decryptString(fs.readFileSync(keyPath));
  }
  const key = crypto.randomBytes(32).toString('base64');
  const encrypted = safeStorage.encryptString(key);
  const temporaryPath = `${keyPath}.pending`;
  fs.writeFileSync(temporaryPath, encrypted, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporaryPath, keyPath);
  return key;
}

function installSecurityHeaders() {
  if (securityHeadersInstalled || isDev) return;
  securityHeadersInstalled = true;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders || {}) };
    responseHeaders['Content-Security-Policy'] = [
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    ];
    responseHeaders['X-Content-Type-Options'] = ['nosniff'];
    responseHeaders['Referrer-Policy'] = ['no-referrer'];
    callback({ responseHeaders });
  });
}

async function startApiServer() {
  const port = await findFreePort(3001);
  apiPort = port;

  return new Promise((resolve, reject) => {
    let serverScript;

    if (isDev) {
      console.log(`[Electron] Dev mode - checking API health on port ${port}...`);
      checkApiHealth(port).then(resolve).catch((err) => {
        console.warn('[Electron] Health check failed in dev mode, using preferred port:', err.message);
        resolve(port);
      });
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

    console.log(`[Electron] Starting API server from: ${serverScript} on port ${port}`);

    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      GEOGESTOR_DB_PATH: dbPath,
      GEOGESTOR_WEB_DIST: path.join(process.resourcesPath, 'web'),
      GEOGESTOR_API_TOKEN: apiToken,
      GEOGESTOR_SECRET_KEY: secretKey,
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

    apiProcess.stdout.on('data', (data) => {
      console.log(`[API] ${data.toString()}`);
    });

    apiProcess.stderr.on('data', (data) => {
      console.error(`[API Error] ${data}`);
    });

    apiProcess.on('error', (err) => {
      console.error('[Electron] Failed to start API:', err);
      reject(err);
    });

    apiProcess.on('exit', (code) => {
      console.log(`[Electron] API process exited with code ${code}`);
      apiProcess = null;
    });

    checkApiHealth(port)
      .then((p) => resolve(p))
      .catch((err) => {
        console.error('[Electron] Health check failed:', err);
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

function stopApiServer() {
  if (!apiProcess) return;
  console.log('[Electron] Stopping API server...');
  try {
    apiProcess.kill('SIGTERM');
  } catch {}
  apiProcess = null;
}

function createWindow(port) {
  installSecurityHeaders();
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
    mainWindow.maximize();
    mainWindow.show();
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
}

app.whenReady().then(async () => {
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
  stopApiServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopApiServer();
});
