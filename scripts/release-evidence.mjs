import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describeArtifact } from './release-integrity.mjs';
import { generateCycloneDxSbom } from './sbom.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'apps', 'desktop', 'dist');
const desktopPackage = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'desktop', 'package.json'), 'utf8'));
fs.mkdirSync(distDir, { recursive: true });

const commercialVersion = desktopPackage.version.replace(/\.0$/, '');
const expectedInstallerName = `GeoGestor Setup ${commercialVersion}.exe`;
const installerPath = path.join(distDir, expectedInstallerName);
if (!fs.existsSync(installerPath)) {
  throw new Error(`Instalador esperado ausente: ${expectedInstallerName}. As evidências não serão geradas.`);
}

const metadataPath = path.join(distDir, 'win-unpacked', 'resources', 'api', 'release-metadata.json');
if (!fs.existsSync(metadataPath)) throw new Error('Metadado do pacote ausente; não é possível vincular as evidências ao build.');
const releaseMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const expectedRunId = process.env.GEOGESTOR_RELEASE_RUN_ID || null;
const releaseStartedAt = process.env.GEOGESTOR_RELEASE_STARTED_AT
  ? Date.parse(process.env.GEOGESTOR_RELEASE_STARTED_AT)
  : null;
if (releaseMetadata.version !== desktopPackage.version) {
  throw new Error(`Versão do pacote divergente: ${releaseMetadata.version} e ${desktopPackage.version}.`);
}
if (expectedRunId && releaseMetadata.releaseRunId !== expectedRunId) {
  throw new Error('O pacote não pertence à execução atual do release candidate.');
}
if (releaseStartedAt && fs.statSync(installerPath).mtimeMs < releaseStartedAt) {
  throw new Error('O instalador é anterior à execução atual do release candidate.');
}

const sbom = generateCycloneDxSbom(rootDir);
const sbomContent = `${JSON.stringify(sbom, null, 2)}\n`;
fs.writeFileSync(path.join(distDir, 'sbom.cdx.json'), sbomContent);
fs.writeFileSync(path.join(distDir, 'sbom.json'), sbomContent);

const artifacts = [describeArtifact(installerPath)];
fs.writeFileSync(path.join(distDir, 'artifact-hashes.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  version: desktopPackage.version,
  commit: releaseMetadata.commit,
  releaseRunId: releaseMetadata.releaseRunId,
  artifacts
}, null, 2)}\n`);
console.log(`Evidências geradas para ${artifacts.length} artefato(s).`);
