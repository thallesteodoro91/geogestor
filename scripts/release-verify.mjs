import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { verifyArtifactHashes } from './release-integrity.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopDist = path.join(rootDir, 'apps', 'desktop', 'dist');
const packageRoot = path.join(desktopDist, 'win-unpacked');
const mode = process.argv.includes('--source') ? 'source' : 'package';
const allowDirty = process.argv.includes('--allow-dirty');
const errors = [];
const evidence = { mode, checkedAt: new Date().toISOString(), files: 0, bytes: 0, errors };

function walk(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(fullPath));
    else output.push(fullPath);
  }
  return output;
}

if (mode === 'source') {
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: rootDir, encoding: 'utf8', shell: false });
  if (status.status !== 0) errors.push('Não foi possível consultar o estado do Git.');
  if (status.stdout.trim()) errors.push('O worktree não está limpo; um release comercial deve partir de commit/tag reproduzível.');
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8', shell: false });
  evidence.commit = commit.stdout.trim();
} else if (!fs.existsSync(packageRoot)) {
  errors.push(`Pacote descompactado não encontrado: ${packageRoot}`);
} else {
  const files = walk(packageRoot);
  evidence.files = files.length;
  evidence.bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
  const forbiddenExtensions = new Set(['.db', '.sqlite', '.sqlite3', '.map', '.log', '.env']);
  const forbiddenNames = /(?:^|[._-])(scratch|debug|temp|backup)(?:[._-]|$)/i;
  const textExtensions = new Set(['.js', '.cjs', '.mjs', '.json', '.html', '.css', '.txt', '.xml', '.yml', '.yaml']);
  const escapedProfile = (process.env.USERPROFILE || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const contentPatterns = [
    ...(escapedProfile ? [{ label: 'caminho local do usuário que executou o build', regex: new RegExp(escapedProfile, 'i') }] : []),
    { label: 'CPF formatado', regex: /\b(?!000\.000\.000-00)\d{3}\.\d{3}\.\d{3}-\d{2}\b/ },
    { label: 'CNPJ formatado', regex: /\b(?!00\.000\.000\/000[01]-00)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/ },
    { label: 'chave privada', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { label: 'segredo OAuth materializado', regex: /"(?:client_secret|refresh_token|access_token)"\s*:\s*"(?!\[REDACTED\]|enc:v1:|<)[^"\s]{12,}"/i }
  ];

  for (const file of files) {
    const relative = path.relative(packageRoot, file);
    const ext = path.extname(file).toLowerCase();
    if (forbiddenExtensions.has(ext)) errors.push(`Artefato proibido: ${relative}`);
    if (forbiddenNames.test(path.basename(file))) errors.push(`Nome de artefato proibido: ${relative}`);
    if (textExtensions.has(ext) && fs.statSync(file).size <= 50 * 1024 * 1024) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of contentPatterns) {
        if (pattern.regex.test(content)) errors.push(`${pattern.label}: ${relative}`);
      }
    }
  }

  const metadataPath = path.join(packageRoot, 'resources', 'api', 'release-metadata.json');
  if (!fs.existsSync(metadataPath)) errors.push('Metadado técnico do release ausente.');
  else {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    evidence.commit = metadata.commit;
    evidence.dirty = metadata.dirty;
    if (!metadata.commit || metadata.commit === 'unknown') errors.push('Commit do pacote não identificado.');
    if (metadata.dirty && !allowDirty) errors.push('O pacote foi gerado a partir de worktree sujo; gere o release final a partir de commit/tag limpo.');
  }
  errors.push(...verifyArtifactHashes(desktopDist));
}

fs.mkdirSync(desktopDist, { recursive: true });
const evidencePath = path.join(desktopDist, 'release-verification.json');
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Release gate aprovado (${evidence.files} arquivos, ${evidence.bytes} bytes).`);
