import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');
const outputDir = path.join(__dirname, 'dist');
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
await esbuild.build({
  entryPoints: {
    server: path.join(__dirname, 'src/server.ts'),
    'database-security-worker': path.join(__dirname, 'src/database-security-worker.ts'),
    'backup-restore-worker': path.join(__dirname, 'src/backup-restore-worker.ts')
  },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outdir: outputDir,
  external: [
    // Native Node modules that can't be bundled
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
  sourcemap: false,
});

fs.writeFileSync(path.join(outputDir, 'release-metadata.json'), `${JSON.stringify({
  version: process.env.GEOGESTOR_BUILD_VERSION || process.env.npm_package_version || 'unknown',
  commit: process.env.GEOGESTOR_BUILD_COMMIT || 'unknown',
  dirty: process.env.GEOGESTOR_BUILD_DIRTY === 'true',
  releaseRunId: process.env.GEOGESTOR_RELEASE_RUN_ID || null,
  builtAt: new Date().toISOString(),
  runtime: process.version
}, null, 2)}\n`);

console.log('✓ API build complete → dist/server.js');

// Copy native bindings to dist/node_modules so they are available at runtime.
// This binding is mandatory on the supported Windows target, so a partial build must fail.
const pnpmStorePath = path.join(monorepoRoot, 'node_modules', '.pnpm');
const dirs = fs.readdirSync(pnpmStorePath);
const msvcDirName = dirs.find((directory) => directory.startsWith('@libsql+win32-x64-msvc'));
if (!msvcDirName) {
  throw new Error('Binding nativo obrigatório @libsql/win32-x64-msvc não foi encontrado na instalação congelada.');
}

const msvcDir = path.join(pnpmStorePath, msvcDirName, 'node_modules', '@libsql', 'win32-x64-msvc');
const sourceFiles = ['package.json', 'index.node'];
for (const sourceFile of sourceFiles) {
  const sourcePath = path.join(msvcDir, sourceFile);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error(`Binding nativo obrigatório incompleto: ${sourceFile} não foi encontrado.`);
  }
}

const destinations = [
  path.join(outputDir, 'node_modules', '@libsql', 'win32-x64-msvc'),
  path.join(outputDir, 'native_modules', '@libsql', 'win32-x64-msvc')
];
for (const destination of destinations) {
  fs.mkdirSync(destination, { recursive: true });
  for (const sourceFile of sourceFiles) {
    fs.copyFileSync(path.join(msvcDir, sourceFile), path.join(destination, sourceFile));
  }
}
console.log('✓ Native bindings copied to dist/node_modules and dist/native_modules');
