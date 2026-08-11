import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQualityExportUrl } from './qualityExport';

test('exportação CSV mantém os filtros ativos e codifica seus valores', () => {
  assert.equal(buildQualityExportUrl('', ''), '/api/sistema/qualidade-dados.csv');
  assert.equal(
    buildQualityExportUrl('Projetos rurais', 'warning'),
    '/api/sistema/qualidade-dados.csv?module=Projetos+rurais&severity=warning'
  );
});
