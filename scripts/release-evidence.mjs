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

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const inventoryName = 'dependency-inventory.csv';
const inventory = [['Nome', 'Versão', 'Licença'], ...sbom.components.map((component) => [
  component.group ? `${component.group}/${component.name}` : component.name,
  component.version,
  component.licenses?.map((item) => item.expression || item.license?.id || item.license?.name).filter(Boolean).join('; ') || 'Não identificada no pacote instalado'
])];
fs.writeFileSync(path.join(distDir, inventoryName), `\uFEFF${inventory.map((row) => row.map(csvCell).join(',')).join('\n')}\n`);
const notesName = `NOTAS-DE-VERSAO-v${commercialVersion}.md`;
const notesSource = path.join(rootDir, 'docs', notesName);
const distributionNames = [expectedInstallerName, 'sbom.cdx.json', 'sbom.json', inventoryName];
if (!fs.existsSync(notesSource)) throw new Error('Notas da versão corrente ausentes.');
fs.copyFileSync(notesSource, path.join(distDir, notesName)); distributionNames.push(notesName);
for (const optional of [`${expectedInstallerName}.blockmap`, 'latest.yml']) {
  if (fs.existsSync(path.join(distDir, optional))) distributionNames.push(optional);
}
const provenanceName = 'build-provenance.json';
fs.writeFileSync(path.join(distDir, provenanceName), `${JSON.stringify({
  version: desktopPackage.version, commit: releaseMetadata.commit, dirty: releaseMetadata.dirty,
  releaseRunId: releaseMetadata.releaseRunId, generatedAt: new Date().toISOString(),
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  procedure: 'scripts/build.mjs → release-evidence.mjs → smoke-packaged-api.mjs → release-verify.mjs --package',
  signing: 'Authenticode ausente; risco aceito conforme ADR do projeto',
  dependencyComponents: sbom.components.length,
  dependenciesWithoutLicense: sbom.components.filter((component) => !component.licenses?.length).length
}, null, 2)}\n`);
distributionNames.push(provenanceName);
const artifacts = distributionNames.map((name) => describeArtifact(path.join(distDir, name)));
fs.writeFileSync(path.join(distDir, 'artifact-hashes.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  version: desktopPackage.version,
  commit: releaseMetadata.commit,
  releaseRunId: releaseMetadata.releaseRunId,
  artifacts
}, null, 2)}\n`);
console.log(`Evidências geradas para ${artifacts.length} artefato(s).`);
