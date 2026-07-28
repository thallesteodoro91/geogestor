import fs from 'node:fs/promises';
import path from 'node:path';

function comparable(value: string) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertContained(candidate: string, root: string) {
  const relative = path.relative(comparable(root), comparable(candidate));
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error('Acesso negado fora do diretório raiz');
}

async function resolveThroughExistingAncestor(candidate: string) {
  let current = path.resolve(candidate);
  const missingSegments: string[] = [];

  while (true) {
    try {
      const physicalAncestor = await fs.realpath(current);
      return path.resolve(physicalAncestor, ...missingSegments);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missingSegments.unshift(path.basename(current));
      current = parent;
    }
  }
}

export function assertLexicalPathInsideRoot(candidate: string, root: string) {
  assertContained(path.resolve(candidate), path.resolve(root));
}

export async function ensurePathInsideRoot(
  candidate: string,
  root: string,
  options: { mustExist?: boolean } = {}
) {
  assertLexicalPathInsideRoot(candidate, root);
  const physicalRoot = await fs.realpath(path.resolve(root));
  const physicalCandidate = options.mustExist
    ? await fs.realpath(path.resolve(candidate))
    : await resolveThroughExistingAncestor(candidate);
  assertContained(physicalCandidate, physicalRoot);
  return physicalCandidate;
}
