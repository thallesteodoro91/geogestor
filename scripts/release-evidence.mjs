import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { describeArtifact } from './release-integrity.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'apps', 'desktop', 'dist');
const desktopPackage = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'desktop', 'package.json'), 'utf8'));
fs.mkdirSync(distDir, { recursive: true });

const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const listCommand = `${packageManager} --config.verify-deps-before-run=false list --recursive --prod --depth Infinity --json`;
const listed = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', listCommand], {
  cwd: rootDir,
  encoding: 'utf8',
  shell: false,
  maxBuffer: 50 * 1024 * 1024
});
if (listed.status !== 0) throw new Error(listed.stderr || 'Falha ao gerar inventário de dependências.');
const components = JSON.parse(listed.stdout);
fs.writeFileSync(path.join(distDir, 'sbom.json'), `${JSON.stringify({
  bomFormat: 'GeoGestor dependency inventory',
  specVersion: '1.0',
  generatedAt: new Date().toISOString(),
  components
}, null, 2)}\n`);

const artifacts = fs.readdirSync(distDir)
  .filter((name) => name === `GeoGestor Setup ${desktopPackage.version}.exe`)
  .map((name) => describeArtifact(path.join(distDir, name)));
fs.writeFileSync(path.join(distDir, 'artifact-hashes.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  artifacts
}, null, 2)}\n`);
console.log(`Evidências geradas para ${artifacts.length} artefato(s).`);
