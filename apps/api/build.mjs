import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');
await esbuild.build({
  entryPoints: [path.join(__dirname, 'src/server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(__dirname, 'dist/server.js'),
  external: [
    // Native Node modules that can't be bundled
    'better-sqlite3',
    'fsevents',
  ],
  loader: {
    '.node': 'copy',
  },
  nodePaths: [
    // Allow esbuild to resolve workspace packages from the monorepo root
    path.join(monorepoRoot, 'node_modules'),
    path.join(monorepoRoot, 'node_modules', '.pnpm', 'node_modules'),
  ],
  alias: {
    // Map workspace package to its source
    '@geogestor/database': path.join(monorepoRoot, 'packages/database/src/index.ts'),
  },
  sourcemap: true,
});

console.log('✓ API build complete → dist/server.js');

// Copy native bindings to dist/node_modules so they are available at runtime
try {
  const pnpmStorePath = path.join(monorepoRoot, 'node_modules', '.pnpm');
  const dirs = fs.readdirSync(pnpmStorePath);
  const msvcDirName = dirs.find(d => d.startsWith('@libsql+win32-x64-msvc'));
  
  if (msvcDirName) {
    const msvcDir = path.join(pnpmStorePath, msvcDirName, 'node_modules', '@libsql', 'win32-x64-msvc');
    const destDir = path.join(__dirname, 'dist', 'node_modules', '@libsql', 'win32-x64-msvc');
    const nativeDestDir = path.join(__dirname, 'dist', 'native_modules', '@libsql', 'win32-x64-msvc');
    
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    if (!fs.existsSync(nativeDestDir)) {
      fs.mkdirSync(nativeDestDir, { recursive: true });
    }
    
    fs.copyFileSync(path.join(msvcDir, 'package.json'), path.join(destDir, 'package.json'));
    fs.copyFileSync(path.join(msvcDir, 'index.node'), path.join(destDir, 'index.node'));
    fs.copyFileSync(path.join(msvcDir, 'package.json'), path.join(nativeDestDir, 'package.json'));
    fs.copyFileSync(path.join(msvcDir, 'index.node'), path.join(nativeDestDir, 'index.node'));
    console.log('✓ Native bindings copied to dist/node_modules and dist/native_modules');
  } else {
    console.warn('⚠️ Native bindings directory not found in .pnpm store');
  }
} catch (e) {
  console.error('Failed to copy native bindings:', e.message);
}
