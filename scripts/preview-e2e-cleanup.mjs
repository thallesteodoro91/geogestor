import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewManagedE2eCleanup } from './e2e-artifacts.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const e2eRoot = path.join(projectRoot, 'scratch', 'commercial-e2e');
const preview = previewManagedE2eCleanup(e2eRoot);

console.log('[prévia E2E] Nenhum arquivo foi removido.');
console.log(`[prévia E2E] ${preview.candidates.length} execução(ões) com propriedade comprovada poderiam ser avaliadas para limpeza:`);
preview.candidates.forEach((entry) => console.log(`- ${entry.runId} | ${entry.status} | ${entry.createdAt}`));
console.log(`[prévia E2E] ${preview.skipped.length} execução(ões) sem propriedade comprovada foram preservadas e omitidas da lista de limpeza.`);
