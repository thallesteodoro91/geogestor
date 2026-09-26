import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_COMPANY_TEMPLATE,
  isValidCpfOrCnpj,
  normalizeCompanyTemplate,
  parseCompanyTemplateForSave,
  saveCompanyTemplate
} from './companyTemplate';

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

test('leitura tolerante preserva campos válidos e recupera somente valores inválidos', () => {
  const template = normalizeCompanyTemplate({ razao: 'SkyGeo preservada', email: 'inválido', cor: 'red' });
  assert.equal(template.razao, 'SkyGeo preservada');
  assert.equal(template.email, DEFAULT_COMPANY_TEMPLATE.email);
  assert.equal(template.cor, DEFAULT_COMPANY_TEMPLATE.cor);
});

test('validação estrita rejeita dados inválidos sem convertê-los no modelo padrão', () => {
  const invalid = { ...DEFAULT_COMPANY_TEMPLATE, email: 'email-inválido' };
  assert.throws(() => parseCompanyTemplateForSave(invalid), /Informe um e-mail válido/);
  assert.throws(() => saveCompanyTemplate(invalid), /Informe um e-mail válido/);
  assert.equal(invalid.email, 'email-inválido');
});

test('validação estrita respeita os limites dos campos do formulário', () => {
  assert.throws(
    () => parseCompanyTemplateForSave({ ...DEFAULT_COMPANY_TEMPLATE, razao: 'S'.repeat(201) }),
    /Use no máximo 200 caracteres/
  );
  assert.throws(
    () => parseCompanyTemplateForSave({ ...DEFAULT_COMPANY_TEMPLATE, termos: 'T'.repeat(10_001) }),
    /Use no máximo 10.000 caracteres/
  );
});

test('CPF e CNPJ aceitam documentos oficiais válidos e rejeitam dígitos inválidos', () => {
  assert.equal(isValidCpfOrCnpj('529.982.247-25'), true);
  assert.equal(isValidCpfOrCnpj('04.252.011/0001-10'), true);
  assert.equal(isValidCpfOrCnpj('111.111.111-11'), false);
  assert.equal(isValidCpfOrCnpj('00.000.000/0001-00'), false);
});
