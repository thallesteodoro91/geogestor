import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const cwd = dirname(fileURLToPath(import.meta.url));
const child = spawn('cmd.exe', ['/k', `"${process.execPath}" serve-web-dist.mjs`], {
  cwd,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
});

child.unref();
console.log(`Started GeoGestor local server with pid ${child.pid}`);
