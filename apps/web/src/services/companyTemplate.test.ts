import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_COMPANY_TEMPLATE, normalizeCompanyTemplate } from './companyTemplate';

test('modelo legado é normalizado para o contrato versionado usado nos PDFs', () => {
  const template = normalizeCompanyTemplate({
    razao: 'SkyGeo',
    email: 'contato@skygeo.example',
    cor: '#2563eb'
  });
  assert.equal(template.version, 1);
  assert.equal(template.razao, 'SkyGeo');
  assert.equal(template.email, 'contato@skygeo.example');
  assert.equal(template.cor, '#2563eb');
  assert.equal(template.logo, '');
});

test('modelo inválido não contamina exportações e volta ao padrão seguro', () => {
  const template = normalizeCompanyTemplate({ email: 'inválido', cor: 'red' });
  assert.deepEqual(template, DEFAULT_COMPANY_TEMPLATE);
});
