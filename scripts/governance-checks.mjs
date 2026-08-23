import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_EXTENSIONS = new Set(['.cjs', '.css', '.js', '.json', '.mjs', '.ts', '.tsx']);
const ASSET_EXTENSIONS = new Set(['.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const FORBIDDEN_PRODUCTION_TERMS = ['Gestão financeira 360'];
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'out', 'release', 'scratch', 'temp-lovable', 'work', 'data', '.git']);

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function walk(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (IGNORED_DIRECTORIES.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target, predicate) : predicate(target) ? [target] : [];
  });
}

function relative(root, target) {
  return path.relative(root, target).replaceAll('\\', '/');
}

function locations(source, needle) {
  return source.split(/\r?\n/).flatMap((line, index) => line.includes(needle) ? [{ line: index + 1, text: line.trim() }] : []);
}

function checkVersions(root, blocking) {
  const canonical = readJson(path.join(root, 'package.json')).version;
  const compared = [
    ['API', readJson(path.join(root, 'apps', 'api', 'package.json')).version],
    ['desktop', readJson(path.join(root, 'apps', 'desktop', 'package.json')).version]
  ];
  const helpSource = fs.readFileSync(path.join(root, 'apps', 'web', 'src', 'pages', 'Ajuda', 'helpContent.ts'), 'utf8');
  compared.push(['Ajuda', helpSource.match(/const minimumVersion = ['"]([^'"]+)['"]/)?.[1]]);
  for (const [label, version] of compared) {
    if (version !== canonical) blocking.push(`Versão divergente em ${label}: ${version || 'ausente'}; esperado ${canonical}.`);
  }
  return canonical;
}

function checkForbiddenTerms(root, blocking) {
  const sourceRoot = path.join(root, 'apps', 'web', 'src');
  const files = walk(sourceRoot, (target) => SOURCE_EXTENSIONS.has(path.extname(target)) && !/\.(?:test|spec)\.[^.]+$/i.test(target));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const term of FORBIDDEN_PRODUCTION_TERMS) {
      for (const match of locations(source, term)) blocking.push(`Nomenclatura obsoleta em ${relative(root, file)}:${match.line}: ${term}`);
    }
  }
}

function hardcodedNavigationInLine(line) {
  return /(?:navigate\(\s*|\b(?:to|href|path)=\s*)[{'"`\s]*\/(?!\/|api\/)/.test(line);
}

function normalizeNavigationContent(line) {
  const compact = line.trim().replace(/\s+/g, ' ');
  const navigate = compact.match(/navigate\(\s*([`'"])(.*?)\1/);
  if (navigate) return `navigate:${navigate[2]}`;
  const property = compact.match(/\b(to|href|path)=\s*(?:{\s*)?([`'"])(.*?)\2/);
  if (property) return `${property[1]}:${property[3]}`;
  return compact;
}

export function collectHardcodedNavigation(root = projectRoot) {
  const sourceRoot = path.join(root, 'apps', 'web', 'src');
  const files = walk(sourceRoot, (target) => SOURCE_EXTENSIONS.has(path.extname(target)) && !/\.(?:test|spec)\.[^.]+$/i.test(target));
  return files.flatMap((file) => fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line, index) => (
    hardcodedNavigationInLine(line)
      ? [{ file: relative(root, file), line: index + 1, content: normalizeNavigationContent(line) }]
      : []
  )));
}

function navigationCounts(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const key = `${entry.file}\0${entry.content}`;
    counts.set(key, { file: entry.file, content: entry.content, count: (counts.get(key)?.count || 0) + (entry.count || 1) });
  }
  return counts;
}

function checkHardcodedNavigationBaseline(root, blocking) {
  const baselinePath = path.join(root, 'governance', 'hardcoded-navigation-baseline.json');
  const currentEntries = collectHardcodedNavigation(root);
  const current = navigationCounts(currentEntries);
  let baseline;
  try {
    baseline = readJson(baselinePath);
  } catch (error) {
    blocking.push(`Baseline de links internos ausente ou inválida: ${error.message}`);
    return { baselineTotal: 0, currentTotal: currentEntries.length, removed: [], added: [...current.values()], increased: [] };
  }

  if (baseline.schema !== 1 || !Array.isArray(baseline.entries) || !baseline.changePolicy || !Array.isArray(baseline.revisions) || !baseline.revisions.length) {
    blocking.push('Baseline de links internos inválida: schema, política, revisões e entries são obrigatórios.');
  }
  const baselineCounts = new Map();
  for (const [index, entry] of (baseline.entries || []).entries()) {
    if (!entry || typeof entry.file !== 'string' || typeof entry.content !== 'string' || !Number.isInteger(entry.count) || entry.count < 1) {
      blocking.push(`Entrada inválida na baseline de links internos: índice ${index}.`);
      continue;
    }
    const normalized = normalizeNavigationContent(entry.content);
    if (normalized !== entry.content) blocking.push(`Conteúdo não normalizado na baseline: ${entry.file}.`);
    const key = `${entry.file}\0${entry.content}`;
    if (baselineCounts.has(key)) blocking.push(`Entrada duplicada na baseline de links internos: ${entry.file}.`);
    baselineCounts.set(key, entry);
  }
  const latestRevision = baseline.revisions?.at(-1);
  const declaredTotal = [...baselineCounts.values()].reduce((sum, entry) => sum + entry.count, 0);
  if (!latestRevision?.date || !latestRevision?.justification || latestRevision.total !== declaredTotal) {
    blocking.push('A revisão mais recente da baseline deve possuir data, justificativa explícita e total correspondente.');
  }

  const added = [...current.entries()].filter(([key]) => !baselineCounts.has(key)).map(([, entry]) => entry);
  const increased = [...current.entries()].filter(([key, entry]) => baselineCounts.has(key) && entry.count > baselineCounts.get(key).count)
    .map(([key, entry]) => ({ ...entry, baselineCount: baselineCounts.get(key).count, key }));
  const removed = [...baselineCounts.entries()].flatMap(([key, entry]) => {
    const currentCount = current.get(key)?.count || 0;
    return currentCount < entry.count ? [{ ...entry, currentCount, removed: entry.count - currentCount }] : [];
  });
  for (const entry of added) blocking.push(`Novo link interno literal fora da baseline: ${entry.file}: ${entry.content.slice(0, 180)}`);
  for (const entry of increased) blocking.push(`Link interno literal aumentou de ${entry.baselineCount} para ${entry.count}: ${entry.file}: ${entry.content.slice(0, 180)}`);
  return { baselineTotal: declaredTotal, currentTotal: currentEntries.length, removed, added, increased };
}

function checkCompatibilityRegistry(root, blocking) {
  const registry = readJson(path.join(root, 'governance', 'compatibility-registry.json'));
  const required = ['id', 'kind', 'legacy', 'canonical', 'status', 'risk', 'minimumVersion', 'consumers', 'tests', 'removalCondition'];
  const ids = new Set();
  for (const entry of registry.entries || []) {
    for (const field of required) if (!(field in entry)) blocking.push(`Registro de compatibilidade ${entry.id || '<sem id>'} não possui ${field}.`);
    if (ids.has(entry.id)) blocking.push(`ID de compatibilidade duplicado: ${entry.id}.`);
    ids.add(entry.id);
    if (!/^\d+\.\d+\.\d+$/.test(entry.minimumVersion || '')) blocking.push(`Versão mínima inválida em ${entry.id}.`);
    if (!entry.tests?.length) blocking.push(`Registro de compatibilidade sem teste associado: ${entry.id}.`);
  }
  return registry.entries?.length || 0;
}

function checkTrackedArtifacts(root, blocking) {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', shell: false });
  if (result.status !== 0) {
    blocking.push('Não foi possível verificar artefatos rastreados pelo Git.');
    return;
  }
  const unsafe = result.stdout.split('\0').filter(Boolean).filter((name) => (
    /(^|\/)(?:scratch|temp-lovable|work|data|test-results|playwright-report)(\/|$)/i.test(name)
    || /\.(?:db(?:-[^/]*)?|sqlite3?|log|trace\.zip|dmp|exe)$/i.test(name)
    || (/(^|\/)\.env(?:\.|$)/i.test(name) && !/\.env\.(?:example|sample)$/i.test(name))
  ));
  unsafe.forEach((name) => blocking.push(`Artefato temporário ou sensível rastreado: ${name}`));
}

function sha256(target) {
  return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
}

function assetDiagnostics(root) {
  const assetsRoot = path.join(root, 'apps', 'web', 'src', 'assets');
  const assets = walk(assetsRoot, (target) => ASSET_EXTENSIONS.has(path.extname(target).toLowerCase()));
  const sourceFiles = walk(path.join(root, 'apps', 'web', 'src'), (target) => SOURCE_EXTENSIONS.has(path.extname(target)) && !target.startsWith(assetsRoot));
  const corpus = sourceFiles.map((target) => fs.readFileSync(target, 'utf8')).join('\n');
  const hashes = new Map();
  const entries = assets.map((target) => {
    const hash = sha256(target);
    const group = hashes.get(hash) || [];
    group.push(relative(root, target));
    hashes.set(hash, group);
    const name = path.basename(target);
    return { file: relative(root, target), classification: corpus.includes(name) ? 'used' : 'inconclusive', hash };
  });
  return {
    total: entries.length,
    used: entries.filter((entry) => entry.classification === 'used').length,
    inconclusive: entries.filter((entry) => entry.classification === 'inconclusive').map((entry) => entry.file),
    duplicateGroups: [...hashes.values()].filter((group) => group.length > 1)
  };
}

function normalizedLineSet(target) {
  const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length >= 20 && !line.startsWith('import '));
  return new Set(lines);
}

function endpointRole(file, line) {
  if (/\.(?:test|spec)\.tsx?$/i.test(file)) return 'test';
  if (file.startsWith('apps/web/')) return 'frontend-call';
  if (file.startsWith('apps/api/') && (/\b(?:app|router|server)\.(?:get|post|put|patch|delete)\s*\(/.test(line) || /\b(?:app|server)\.register\(.+\bprefix\s*:/.test(line))) return 'backend-definition';
  if (file.startsWith('apps/api/')) return 'backend-reference';
  return 'other';
}

function normalizeEndpoint(endpoint) {
  return endpoint.replace(/\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?=\/|$)/gi, '/:id').replace(/\/$/, '/:dynamic');
}

function duplicationDiagnostics(root, compatibilityRegistry) {
  const allFiles = walk(path.join(root, 'apps'), (target) => /\.(?:ts|tsx)$/.test(target));
  const files = allFiles.filter((target) => !/\.(?:test|spec)\.tsx?$/.test(target));
  const exact = new Map();
  files.forEach((target) => {
    const hash = sha256(target);
    exact.set(hash, [...(exact.get(hash) || []), relative(root, target)]);
  });
  const candidates = files.map((target) => ({ target, lines: normalizedLineSet(target) })).filter((entry) => entry.lines.size >= 60);
  const near = [];
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const a = candidates[left];
      const b = candidates[right];
      const intersection = [...a.lines].filter((line) => b.lines.has(line)).length;
      const similarity = intersection / Math.max(a.lines.size, b.lines.size);
      if (similarity >= 0.9) near.push({ files: [relative(root, a.target), relative(root, b.target)], similarity: Number(similarity.toFixed(3)) });
    }
  }
  const compatibleEndpoints = new Set((compatibilityRegistry.entries || []).flatMap((entry) => [entry.legacy, entry.canonical]).filter((value) => typeof value === 'string' && value.startsWith('/api/')));
  const apiLiterals = new Map();
  allFiles.forEach((target) => {
    const file = relative(root, target);
    const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/['"`](\/api\/[a-z0-9_./:-]+)/gi)) {
        const endpoint = match[1];
        const normalized = normalizeEndpoint(endpoint);
        const occurrence = { file, line: index + 1, endpoint, role: endpointRole(file, line), dynamic: normalized !== endpoint };
        apiLiterals.set(normalized, [...(apiLiterals.get(normalized) || []), occurrence]);
      }
    });
  });
  const repeatedApiLiterals = [...apiLiterals.entries()]
    .filter(([, occurrences]) => occurrences.length > 1)
    .map(([endpoint, occurrences]) => {
      const roles = Object.fromEntries([...new Set(occurrences.map((item) => item.role))].sort().map((role) => [role, occurrences.filter((item) => item.role === role).length]));
      const files = [...new Set(occurrences.map((item) => item.file))];
      const compatibility = occurrences.some((item) => compatibleEndpoints.has(item.endpoint));
      const roleNames = Object.keys(roles);
      const classification = compatibility
        ? 'compatibility'
        : roleNames.every((role) => role === 'test')
          ? 'test-only'
          : roles['frontend-call'] && roles['backend-definition']
            ? 'cross-layer-contract'
            : roles['frontend-call'] && roleNames.every((role) => role === 'frontend-call' || role === 'test')
              ? 'frontend-repetition'
              : roleNames.every((role) => role === 'backend-definition' || role === 'backend-reference' || role === 'test')
                ? 'backend-repetition'
                : 'cross-layer-reference';
      const candidateForReview = !compatibility && (roles['frontend-call'] || 0) > 1;
      return { endpoint, occurrences: occurrences.length, files, roles, dynamic: occurrences.some((item) => item.dynamic), classification, candidateForReview };
    })
    .sort((left, right) => right.occurrences - left.occurrences);
  return {
    exactGroups: [...exact.values()].filter((group) => group.length > 1),
    near,
    repeatedApiLiterals,
    endpointSummary: {
      totalRepeatedPatterns: repeatedApiLiterals.length,
      productionRepeatedPatterns: repeatedApiLiterals.filter((item) => item.occurrences - (item.roles.test || 0) > 1).length,
      byClassification: Object.fromEntries([...new Set(repeatedApiLiterals.map((item) => item.classification))].sort().map((classification) => [classification, repeatedApiLiterals.filter((item) => item.classification === classification).length])),
      reviewCandidates: repeatedApiLiterals.filter((item) => item.candidateForReview).slice(0, 20)
    }
  };
}

function environmentDiagnostics(root) {
  const legacyRoot = path.join(root, 'temp-lovable');
  const legacyEnvironmentFiles = fs.existsSync(legacyRoot)
    ? fs.readdirSync(legacyRoot, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && /^\.env(?:\.|$)/i.test(entry.name)).map((entry) => entry.name)
    : [];
  return { legacyAreaPresent: fs.existsSync(legacyRoot), legacyEnvironmentFileCount: legacyEnvironmentFiles.length };
}

export function runGovernanceChecks(root = projectRoot) {
  const blocking = [];
  const warnings = [];
  const canonicalVersion = checkVersions(root, blocking);
  checkForbiddenTerms(root, blocking);
  const navigationBaseline = checkHardcodedNavigationBaseline(root, blocking);
  const compatibilityRegistry = readJson(path.join(root, 'governance', 'compatibility-registry.json'));
  const compatibilityEntries = checkCompatibilityRegistry(root, blocking);
  checkTrackedArtifacts(root, blocking);
  const hardcodedNavigation = collectHardcodedNavigation(root);
  const assets = assetDiagnostics(root);
  const duplications = duplicationDiagnostics(root, compatibilityRegistry);
  const environment = environmentDiagnostics(root);
  if (hardcodedNavigation.length) warnings.push(`${hardcodedNavigation.length} links internos literais permanecem como dívida gradual; a baseline impede novos casos mesmo com o Git limpo.`);
  if (navigationBaseline.removed.length) warnings.push(`${navigationBaseline.removed.reduce((sum, entry) => sum + entry.removed, 0)} links históricos foram removidos; considere reduzir a baseline em revisão justificada.`);
  if (assets.inconclusive.length) warnings.push(`${assets.inconclusive.length} recursos visuais sem consumidor comprovado; manter para decisão humana.`);
  if (assets.duplicateGroups.length) warnings.push(`${assets.duplicateGroups.length} grupos de recursos visuais possuem hash idêntico; revisar sem excluir automaticamente.`);
  if (duplications.exactGroups.length || duplications.near.length || duplications.repeatedApiLiterals.length) warnings.push('Foram encontrados candidatos de duplicação ou endpoints repetidos; o diagnóstico não faz consolidação automática.');
  if (environment.legacyAreaPresent) warnings.push(`Área histórica temp-lovable presente; ${environment.legacyEnvironmentFileCount} arquivo(s) de ambiente detectado(s) somente por nome. Confirmar uso e rotacionar credenciais externamente.`);
  return { blocking, warnings, diagnostics: { canonicalVersion, compatibilityEntries, hardcodedNavigation, navigationBaseline, assets, duplications, environment } };
}

function printResult(result) {
  console.log(`[governança] versão canônica: ${result.diagnostics.canonicalVersion}`);
  console.log(`[governança] compatibilidade registrada: ${result.diagnostics.compatibilityEntries} itens de API/contrato`);
  console.log(`[governança] links internos: baseline ${result.diagnostics.navigationBaseline.baselineTotal}, atuais ${result.diagnostics.navigationBaseline.currentTotal}, removidos ${result.diagnostics.navigationBaseline.removed.reduce((sum, entry) => sum + entry.removed, 0)}, novos ${result.diagnostics.navigationBaseline.added.length}, aumentados ${result.diagnostics.navigationBaseline.increased.length}`);
  console.log(`[governança] recursos: ${result.diagnostics.assets.total} total, ${result.diagnostics.assets.used} usados, ${result.diagnostics.assets.inconclusive.length} inconclusivos`);
  console.log(`[governança] duplicações: ${result.diagnostics.duplications.exactGroups.length} exatas, ${result.diagnostics.duplications.near.length} similares, ${result.diagnostics.duplications.repeatedApiLiterals.length} endpoints repetidos (${result.diagnostics.duplications.endpointSummary.reviewCandidates.length} candidatos priorizados)`);
  console.log(`[governança] endpoints: ${result.diagnostics.duplications.endpointSummary.productionRepeatedPatterns} padrões repetidos em produção; categorias ${JSON.stringify(result.diagnostics.duplications.endpointSummary.byClassification)}`);
  result.warnings.forEach((warning) => console.warn(`[alerta] ${warning}`));
  result.blocking.forEach((failure) => console.error(`[bloqueio] ${failure}`));
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const result = runGovernanceChecks();
  printResult(result);
  process.exitCode = result.blocking.length ? 1 : 0;
}
