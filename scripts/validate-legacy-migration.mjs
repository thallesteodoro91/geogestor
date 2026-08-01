import crypto from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const sourceArgument = valueAfter('--source');
const simulatedVersion = valueAfter('--simulate-version');
if (!sourceArgument) {
  console.error('Uso: pnpm migration:validate-copy -- --source "C:\\caminho\\geogestor.db"');
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, '..');
const source = path.resolve(sourceArgument);
const sourceStats = await fs.stat(source);
if (!sourceStats.isFile()) throw new Error('A origem precisa ser um arquivo de banco SQLite.');
const scratchRoot = path.join(root, 'scratch');
await fs.mkdir(scratchRoot, { recursive: true });
const work = await fs.mkdtemp(path.join(scratchRoot, 'legacy-migration-validation-'));
const copy = path.join(work, 'geogestor-copy.db');
if (source === copy) throw new Error('Origem e destino não podem ser o mesmo arquivo.');
const available = await fs.statfs(work).then((stats) => Number(stats.bavail) * Number(stats.bsize));
if (available < sourceStats.size * 3) throw new Error('Espaço insuficiente para copiar, migrar e validar o banco.');
const hash = async (file) => {
  const digest = crypto.createHash('sha256');
  const handle = await fs.open(file, 'r');
  try { for await (const chunk of handle.createReadStream()) digest.update(chunk); } finally { await handle.close(); }
  return digest.digest('hex');
};
const sourceHash = await hash(source);
await fs.copyFile(source, copy, constants.COPYFILE_EXCL);
const copyHashBefore = await hash(copy);
if (sourceHash !== copyHashBefore) throw new Error('A cópia não possui o mesmo SHA-256 da origem.');
const workerReport = path.join(work, 'worker-report.json');
const command = process.execPath;
const tsxCli = path.join(root, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const exitCode = await new Promise((resolve, reject) => {
  const workerArgs = [tsxCli, 'apps/api/src/migration-copy-worker.ts', '--copy', copy, '--report', workerReport];
  if (simulatedVersion) workerArgs.push('--simulate-version', simulatedVersion);
  const child = spawn(command, workerArgs, {
    cwd: root, stdio: 'inherit', windowsHide: true
  });
  child.on('error', reject);
  child.on('exit', (code) => resolve(code ?? 1));
});
const workerExists = await fs.access(workerReport).then(() => true).catch(() => false);
if (!workerExists) {
  throw new Error(`A migração da cópia falhou antes de gerar o relatório (código ${exitCode}). A origem permaneceu inalterada.`);
}
const worker = JSON.parse(await fs.readFile(workerReport, 'utf8'));
const final = {
  formatVersion: 1,
  source: { path: source, bytes: sourceStats.size, sha256: sourceHash, openedReadOnly: true },
  copy: { path: copy, bytesBefore: sourceStats.size, sha256Before: copyHashBefore, sha256After: await hash(copy) },
  safety: { sourceReplaced: false, samePathBlocked: true, availableBytesBefore: available },
  simulation: simulatedVersion ? { requestedVersion: Number(simulatedVersion), sourceWasNotModified: true } : null,
  ...worker
};
const finalReport = path.join(work, 'migration-validation-report.json');
await fs.writeFile(finalReport, `${JSON.stringify(final, null, 2)}\n`, 'utf8');
console.log(`Relatório: ${finalReport}`);
console.log(`Resultado: ${exitCode === 0 && final.successful ? 'APROVADO' : 'REPROVADO'}`);
process.exitCode = exitCode === 0 && final.successful ? 0 : 2;
