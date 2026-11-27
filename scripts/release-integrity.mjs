import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function describeArtifact(filePath) {
  const content = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    bytes: content.length,
    sha256: crypto.createHash('sha256').update(content).digest('hex')
  };
}

export function verifyArtifactHashes(distDirectory, expected = {}) {
  const errors = [];
  const manifestPath = path.join(distDirectory, 'artifact-hashes.json');
  if (!fs.existsSync(manifestPath)) return ['Manifesto artifact-hashes.json ausente.'];

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return ['Manifesto artifact-hashes.json inválido.'];
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    return ['Manifesto de hashes não contém artefatos.'];
  }

  if (expected.version && manifest.version !== expected.version) errors.push('Versão do manifesto divergente do pacote.');
  if (expected.commit && manifest.commit !== expected.commit) errors.push('Commit do manifesto divergente do pacote.');
  if (expected.releaseRunId && manifest.releaseRunId !== expected.releaseRunId) {
    errors.push('Execução do manifesto divergente do pacote.');
  }

  const installers = fs.readdirSync(distDirectory)
    .filter((name) => /^GeoGestor Setup .+\.exe$/i.test(name))
    .sort();
  if (installers.length === 0) errors.push('Instalador final não encontrado para validar o manifesto de hashes.');

  for (const installer of installers) {
    const expected = manifest.artifacts.find((entry) => entry?.name === installer);
    if (!expected) {
      errors.push(`Instalador ausente no manifesto de hashes: ${installer}`);
      continue;
    }
  }

  const seen = new Set();
  for (const entry of manifest.artifacts) {
    if (!entry?.name || /[\\/]/.test(entry.name) || entry.name === '.' || entry.name === '..'
      || seen.has(entry.name) || !fs.existsSync(path.join(distDirectory, entry.name))
      || !fs.statSync(path.join(distDirectory, entry.name)).isFile()) {
      errors.push(`Artefato obsoleto ou ausente registrado no manifesto: ${entry?.name || '<sem nome>'}`);
      continue;
    }
    seen.add(entry.name);
    const actual = describeArtifact(path.join(distDirectory, entry.name));
    if (Number(entry.bytes) !== actual.bytes) errors.push(`Tamanho divergente do manifesto: ${entry.name}`);
    if (String(entry.sha256).toLowerCase() !== actual.sha256) errors.push(`SHA-256 divergente do manifesto: ${entry.name}`);
  }
  return errors;
}
