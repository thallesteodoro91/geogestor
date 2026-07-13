import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./apps/web/dist/', import.meta.url));
const port = Number(process.env.PORT || 5173);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolvePath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const requested = normalize(join(root, pathname));
  if (!requested.startsWith(root)) return join(root, 'index.html');
  if (existsSync(requested) && statSync(requested).isFile()) return requested;
  return join(root, 'index.html');
}

const server = http.createServer((request, response) => {
  const filePath = resolvePath(request.url || '/');
  const type = contentTypes[extname(filePath)] || 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': type });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`GeoGestor local server running at http://localhost:${port}/`);
});
