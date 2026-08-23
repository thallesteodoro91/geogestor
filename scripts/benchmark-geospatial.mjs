import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromApi = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const tsxCli = requireFromApi.resolve('tsx/cli');

if (!process.env.GEOGESTOR_BENCHMARK_CHILD) {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, [tsxCli, fileURLToPath(import.meta.url)], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, GEOGESTOR_BENCHMARK_CHILD: '1' }
  });
  process.exit(result.status ?? 1);
}

const { buildDisplayCollections, countVertices } = await import('../apps/api/src/services/geospatial/visualization-cache.service.ts');
const features = 1_000;
const verticesPerFeature = 500;
const collection = {
  type: 'FeatureCollection',
  features: Array.from({ length: features }, (_, featureIndex) => ({
    type: 'Feature',
    properties: { id: featureIndex },
    geometry: {
      type: 'LineString',
      coordinates: Array.from({ length: verticesPerFeature }, (_, vertexIndex) => [
        -48.7 + vertexIndex * 0.000001,
        -27.7 + featureIndex * 0.000001 + Math.sin(vertexIndex / 10) * 0.00001
      ])
    }
  }))
};
const before = process.memoryUsage().heapUsed;
const started = performance.now();
const vertexCount = countVertices(collection);
const result = buildDisplayCollections(collection, vertexCount);
const durationMs = performance.now() - started;
const after = process.memoryUsage().heapUsed;
process.stdout.write(`${JSON.stringify({ features, vertexCount, durationMs: Number(durationMs.toFixed(2)), approximateHeapDeltaBytes: after - before, displayVertices: Object.fromEntries(Object.entries(result.levels).map(([level, value]) => [level, countVertices(value)])) }, null, 2)}\n`);
