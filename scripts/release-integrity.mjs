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

export function verifyArtifactHashes(distDirectory) {
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
    const actual = describeArtifact(path.join(distDirectory, installer));
    if (Number(expected.bytes) !== actual.bytes) errors.push(`Tamanho divergente do manifesto: ${installer}`);
    if (String(expected.sha256).toLowerCase() !== actual.sha256) errors.push(`SHA-256 divergente do manifesto: ${installer}`);
  }

  for (const entry of manifest.artifacts) {
    if (!entry?.name || !installers.includes(entry.name)) {
      errors.push(`Artefato obsoleto ou ausente registrado no manifesto: ${entry?.name || '<sem nome>'}`);
    }
  }
  return errors;
}
