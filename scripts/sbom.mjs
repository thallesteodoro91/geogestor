import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parsePnpmIntegrityMap(lockfileText) {
  const integrityByPackage = new Map();
  let section = null;
  let currentPackage = null;
  for (const line of lockfileText.split(/\r?\n/)) {
    if (/^[a-zA-Z][^:]*:\s*$/.test(line)) {
      section = line.slice(0, -1);
      currentPackage = null;
      continue;
    }
    if (section !== 'packages') continue;
    const packageMatch = line.match(/^  (.+):\s*$/);
    if (packageMatch) {
      currentPackage = unquote(packageMatch[1]);
      continue;
    }
    const integrityMatch = line.match(/^    resolution:\s*\{[^}]*integrity:\s*([^,}]+)[^}]*\}/);
    if (currentPackage && integrityMatch) integrityByPackage.set(currentPackage, unquote(integrityMatch[1]));
  }
  return integrityByPackage;
}

function splitPackageName(name) {
  if (!name.startsWith('@')) return { name };
  const separator = name.indexOf('/');
  return separator === -1 ? { name } : { group: name.slice(0, separator), name: name.slice(separator + 1) };
}

function npmPurl(name, version) {
  const parts = splitPackageName(name);
  const qualifiedName = parts.group
    ? `${encodeURIComponent(parts.group)}/${encodeURIComponent(parts.name)}`
    : encodeURIComponent(parts.name);
  return `pkg:npm/${qualifiedName}@${encodeURIComponent(version)}`;
}

function normalizeRepository(repository) {
  const value = typeof repository === 'string' ? repository : repository?.url;
  if (!value) return null;
  return value.replace(/^git\+/, '').replace(/\.git$/, '');
}

function normalizeLicenses(license) {
  const values = Array.isArray(license) ? license : [license];
  return values.flatMap((entry) => {
    const value = typeof entry === 'string' ? entry : entry?.type;
    if (!value) return [];
    return /\s|\(|\)/.test(value)
      ? [{ expression: value }]
      : [{ license: { id: value } }];
  });
}

function sriHash(integrity) {
  const match = String(integrity || '').match(/^(sha256|sha384|sha512)-(.+)$/i);
  if (!match) return null;
  return {
    alg: match[1].toUpperCase().replace('SHA', 'SHA-'),
    content: Buffer.from(match[2], 'base64').toString('hex'),
  };
}

function readPackageMetadata(packagePath) {
  if (!packagePath) return {};
  const manifest = path.join(packagePath, 'package.json');
  if (!fs.existsSync(manifest)) return {};
  const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  return {
    name: parsed.name,
    version: parsed.version,
    license: parsed.license ?? parsed.licenses,
    repository: parsed.repository,
    homepage: parsed.homepage,
  };
}

function componentExternalReferences(dependency, metadata) {
  const references = [];
  if (/^https:\/\//.test(dependency.resolved || '')) {
    references.push({ type: 'distribution', url: dependency.resolved });
  }
  const repository = normalizeRepository(metadata.repository);
  if (/^https:\/\//.test(repository || '')) references.push({ type: 'vcs', url: repository });
  if (/^https:\/\//.test(metadata.homepage || '')) references.push({ type: 'website', url: metadata.homepage });
  return references;
}

function packageKey(name, version) {
  return `${name}@${version}`;
}

export function buildCycloneDxDocument({ inventory, lockfileText, rootDir, generatedAt, serialNumber }) {
  if (!Array.isArray(inventory) || inventory.length === 0) throw new Error('Inventário pnpm vazio.');
  const normalizedRoot = path.resolve(rootDir);
  const integrityByPackage = parsePnpmIntegrityMap(lockfileText);
  const workspacesByPath = new Map(inventory.map((workspace) => [path.resolve(workspace.path), workspace]));
  const rootWorkspace = workspacesByPath.get(normalizedRoot) || inventory[0];
  const componentRecords = new Map();
  const dependencyGraph = new Map();
  const workspaceRefs = new Map();

  const ensureGraphRef = (ref) => {
    if (!dependencyGraph.has(ref)) dependencyGraph.set(ref, new Set());
    return dependencyGraph.get(ref);
  };

  for (const workspace of inventory) {
    const workspacePath = path.resolve(workspace.path);
    if (workspacePath === normalizedRoot) continue;
    const relativePath = path.relative(normalizedRoot, workspacePath).replaceAll('\\', '/');
    const ref = `urn:geogestor:workspace:${encodeURIComponent(relativePath)}`;
    workspaceRefs.set(workspacePath, ref);
    const metadata = readPackageMetadata(workspacePath);
    const nameParts = splitPackageName(workspace.name || metadata.name || relativePath);
    const licenses = normalizeLicenses(metadata.license);
    componentRecords.set(ref, {
      type: 'application',
      'bom-ref': ref,
      ...(nameParts.group ? { group: nameParts.group } : {}),
      name: nameParts.name,
      version: workspace.version || metadata.version || '0.0.0',
      ...(licenses.length ? { licenses } : {}),
      properties: [
        { name: 'geogestor:workspace-path', value: relativePath },
        { name: 'geogestor:private', value: String(Boolean(workspace.private)) },
      ],
    });
    ensureGraphRef(ref);
  }

  function registerDependency(dependencyName, dependency, consumer, direct, parentRef) {
    const dependencyPath = dependency.path ? path.resolve(dependency.path) : null;
    const workspaceRef = dependencyPath ? workspaceRefs.get(dependencyPath) : null;
    let ref = workspaceRef;
    if (!ref) {
      const metadata = dependency.packageMetadata || readPackageMetadata(dependency.path);
      const name = metadata.name || dependency.from || dependencyName;
      const version = metadata.version || String(dependency.version || '').replace(/^link:.*/, '0.0.0');
      ref = npmPurl(name, version);
      let record = componentRecords.get(ref);
      if (!record) {
        const parts = splitPackageName(name);
        const licenses = normalizeLicenses(metadata.license);
        const hash = sriHash(integrityByPackage.get(packageKey(name, version)));
        const externalReferences = componentExternalReferences(dependency, metadata);
        record = {
          component: {
            type: 'library',
            'bom-ref': ref,
            ...(parts.group ? { group: parts.group } : {}),
            name: parts.name,
            version,
            purl: ref,
            scope: 'required',
            ...(licenses.length ? { licenses } : {}),
            ...(hash ? { hashes: [hash] } : {}),
            ...(externalReferences.length ? { externalReferences } : {}),
          },
          consumers: new Set(),
          directConsumers: new Set(),
        };
        componentRecords.set(ref, record);
      }
      record.consumers.add(consumer);
      if (direct) record.directConsumers.add(consumer);
    }

    ensureGraphRef(parentRef).add(ref);
    ensureGraphRef(ref);
    for (const [childName, child] of Object.entries(dependency.dependencies || {})) {
      registerDependency(childName, child, consumer, false, ref);
    }
  }

  for (const workspace of inventory) {
    const workspacePath = path.resolve(workspace.path);
    const consumer = path.relative(normalizedRoot, workspacePath).replaceAll('\\', '/') || '.';
    const parentRef = workspacePath === normalizedRoot
      ? `urn:geogestor:application:${rootWorkspace.name}@${rootWorkspace.version}`
      : workspaceRefs.get(workspacePath);
    ensureGraphRef(parentRef);
    for (const [dependencyName, dependency] of Object.entries(workspace.dependencies || {})) {
      registerDependency(dependencyName, dependency, consumer, true, parentRef);
    }
  }

  const components = [...componentRecords.values()].map((record) => {
    if (!record.component) return record;
    return {
      ...record.component,
      properties: [
        { name: 'geogestor:workspace-consumers', value: [...record.consumers].sort().join(',') },
        { name: 'geogestor:direct-consumers', value: [...record.directConsumers].sort().join(',') },
      ],
    };
  }).sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref']));

  const rootRef = `urn:geogestor:application:${rootWorkspace.name}@${rootWorkspace.version}`;
  const rootMetadata = readPackageMetadata(normalizedRoot);
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: serialNumber || `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: generatedAt || new Date().toISOString(),
      tools: { components: [{ type: 'application', name: 'GeoGestor SBOM generator', version: '1' }] },
      component: {
        type: 'application',
        'bom-ref': rootRef,
        name: rootWorkspace.name || rootMetadata.name || 'geogestor',
        version: rootWorkspace.version || rootMetadata.version,
      },
    },
    components,
    dependencies: [...dependencyGraph.entries()]
      .map(([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn].sort() }))
      .sort((left, right) => left.ref.localeCompare(right.ref)),
  };
}

export function generateCycloneDxSbom(rootDir) {
  const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const args = ['--config.verify-deps-before-run=false', 'list', '--recursive', '--prod', '--depth', 'Infinity', '--json'];
  const listed = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `${packageManager} ${args.join(' ')}`], {
      cwd: rootDir, encoding: 'utf8', shell: false, maxBuffer: 50 * 1024 * 1024,
    })
    : spawnSync(packageManager, args, {
      cwd: rootDir, encoding: 'utf8', shell: false, maxBuffer: 50 * 1024 * 1024,
    });
  if (listed.status !== 0) throw new Error(listed.stderr || listed.stdout || 'Falha ao gerar inventário de dependências.');
  return buildCycloneDxDocument({
    inventory: JSON.parse(listed.stdout),
    lockfileText: fs.readFileSync(path.join(rootDir, 'pnpm-lock.yaml'), 'utf8'),
    rootDir,
  });
}
