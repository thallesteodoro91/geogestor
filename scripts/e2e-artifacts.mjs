import fs from 'node:fs';
import path from 'node:path';

export const E2E_RUN_MARKER = '.geogestor-e2e-run.json';
const MARKER_SCHEMA = 1;

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function assertNoSymbolicLinks(target, stopAt) {
  let current = target;
  while (isInside(stopAt, current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Caminho E2E recusado por conter link simbólico: ${current}`);
    }
    current = path.dirname(current);
  }
  if (fs.existsSync(stopAt) && fs.lstatSync(stopAt).isSymbolicLink()) {
    throw new Error(`Caminho E2E recusado por conter link simbólico: ${stopAt}`);
  }
}

export function assertManagedE2eRunPath(allowedRoot, runDirectory) {
  if (!allowedRoot || !runDirectory) throw new Error('Raiz e diretório E2E são obrigatórios.');
  const root = path.resolve(allowedRoot);
  const target = path.resolve(runDirectory);
  if (!isInside(root, target)) throw new Error(`Diretório fora da raiz E2E permitida: ${target}`);
  if (!/^run-[a-z0-9-]+$/i.test(path.basename(target))) {
    throw new Error(`Nome de execução E2E inválido: ${path.basename(target)}`);
  }
  assertNoSymbolicLinks(target, root);
  return { root, target };
}

export function initializeManagedE2eRun(allowedRoot, runDirectory, metadata = {}) {
  const { target } = assertManagedE2eRunPath(allowedRoot, runDirectory);
  fs.mkdirSync(target, { recursive: true });
  const marker = {
    schema: MARKER_SCHEMA,
    kind: 'geogestor-commercial-e2e',
    runId: path.basename(target),
    createdAt: new Date().toISOString(),
    pid: process.pid,
    ...metadata
  };
  fs.writeFileSync(path.join(target, E2E_RUN_MARKER), `${JSON.stringify(marker, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return marker;
}

function readOwnedMarker(allowedRoot, runDirectory) {
  const { target } = assertManagedE2eRunPath(allowedRoot, runDirectory);
  const markerPath = path.join(target, E2E_RUN_MARKER);
  if (!fs.existsSync(markerPath) || fs.lstatSync(markerPath).isSymbolicLink()) {
    throw new Error(`Execução sem marcador de propriedade válido: ${target}`);
  }
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  if (marker.schema !== MARKER_SCHEMA || marker.kind !== 'geogestor-commercial-e2e' || marker.runId !== path.basename(target)) {
    throw new Error(`Marcador de propriedade E2E inválido: ${markerPath}`);
  }
  return { marker, markerPath, target };
}

export function preserveFailedE2eRun(allowedRoot, runDirectory, error) {
  const { marker, target } = readOwnedMarker(allowedRoot, runDirectory);
  const summary = {
    ...marker,
    status: 'failed',
    completedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error || 'Falha não especificada')
  };
  fs.writeFileSync(path.join(target, 'failure-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return summary;
}

export function removeSuccessfulE2eRun(allowedRoot, runDirectory) {
  const { target } = readOwnedMarker(allowedRoot, runDirectory);
  fs.rmSync(target, { recursive: true, force: false });
  return target;
}

export function previewManagedE2eCleanup(allowedRoot) {
  const root = path.resolve(allowedRoot);
  if (!fs.existsSync(root)) return { root, candidates: [], skipped: [] };
  const candidates = [];
  const skipped = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!/^run-[a-z0-9-]+$/i.test(entry.name)) continue;
    const target = path.join(root, entry.name);
    try {
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('não é um diretório físico regular');
      const { marker } = readOwnedMarker(root, target);
      candidates.push({
        runId: marker.runId,
        createdAt: marker.createdAt,
        status: fs.existsSync(path.join(target, 'failure-summary.json')) ? 'failed-evidence' : 'owned-artifact'
      });
    } catch (error) {
      skipped.push({ runId: entry.name, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { root, candidates, skipped };
}
