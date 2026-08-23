import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCycloneDxDocument, parsePnpmIntegrityMap } from './sbom.mjs';

const sri = 'sha512-dGVzdGU=';
const lockfile = `packages:\n\n  'fastify@5.8.5':\n    resolution: {integrity: ${sri}}\n\n  'pino@9.0.0':\n    resolution: {integrity: sha512-cGlubw==}\n`;

test('interpreta integridade declarada pelo lockfile sem inventar metadados', () => {
  const parsed = parsePnpmIntegrityMap(lockfile);
  assert.equal(parsed.get('fastify@5.8.5'), sri);
  assert.equal(parsed.has('ausente@1.0.0'), false);
});

test('gera CycloneDX com transitivos, origem, licenças e consumidores por workspace', () => {
  const rootDir = 'C:\\fixture\\geogestor';
  const pino = {
    from: 'pino', version: '9.0.0', resolved: 'https://registry.npmjs.org/pino/-/pino-9.0.0.tgz',
    path: `${rootDir}\\node_modules\\pino`, packageMetadata: { name: 'pino', version: '9.0.0' },
  };
  const fastify = {
    from: 'fastify', version: '5.8.5', resolved: 'https://registry.npmjs.org/fastify/-/fastify-5.8.5.tgz',
    path: `${rootDir}\\node_modules\\fastify`, packageMetadata: {
      name: 'fastify', version: '5.8.5', license: 'MIT', repository: 'https://github.com/fastify/fastify.git',
    },
    dependencies: { pino },
  };
  const inventory = [
    { name: 'geogestor', version: '1.0.0', path: rootDir, private: true },
    { name: 'api', version: '1.0.0', path: `${rootDir}\\apps\\api`, dependencies: { fastify } },
    { name: 'web', version: '0.0.0', path: `${rootDir}\\apps\\web`, private: true, dependencies: { fastify } },
  ];

  const result = buildCycloneDxDocument({
    inventory, lockfileText: lockfile, rootDir,
    generatedAt: '2026-08-13T00:00:00.000Z', serialNumber: 'urn:uuid:00000000-0000-4000-8000-000000000000',
  });
  const fastifyComponent = result.components.find((component) => component.name === 'fastify');
  const pinoComponent = result.components.find((component) => component.name === 'pino');

  assert.equal(result.bomFormat, 'CycloneDX');
  assert.equal(result.specVersion, '1.6');
  assert.deepEqual(fastifyComponent.licenses, [{ license: { id: 'MIT' } }]);
  assert.equal(fastifyComponent.hashes[0].alg, 'SHA-512');
  assert.equal(fastifyComponent.externalReferences.some((entry) => entry.type === 'distribution'), true);
  assert.equal(fastifyComponent.properties.find((entry) => entry.name === 'geogestor:workspace-consumers').value, 'apps/api,apps/web');
  assert.equal(fastifyComponent.properties.find((entry) => entry.name === 'geogestor:direct-consumers').value, 'apps/api,apps/web');
  assert.equal(pinoComponent.properties.find((entry) => entry.name === 'geogestor:direct-consumers').value, '');
  assert.equal('licenses' in pinoComponent, false);
  assert.equal(result.dependencies.some((entry) => entry.ref === fastifyComponent['bom-ref'] && entry.dependsOn.includes(pinoComponent['bom-ref'])), true);
});
