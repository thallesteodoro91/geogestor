import { cloneDatabaseWithKeysSync, inspectProtectedDatabaseSync } from '@geogestor/database';

const [operation, sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath) {
  throw new Error('A origem da operação protegida é obrigatória.');
}

if (operation === 'validate') {
  const sourceKey = process.env.GEOGESTOR_DB_SOURCE_KEY;
  if (!sourceKey) throw new Error('A chave da validação protegida não foi fornecida.');
  inspectProtectedDatabaseSync(sourcePath, sourceKey);
} else if (operation === 'clone' && targetPath) {
  cloneDatabaseWithKeysSync(
    sourcePath,
    process.env.GEOGESTOR_DB_SOURCE_KEY,
    targetPath,
    process.env.GEOGESTOR_DB_TARGET_KEY
  );
} else {
  throw new Error('Operação protegida desconhecida.');
}
