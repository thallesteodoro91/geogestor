import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyProjectForm,
  projectFormToPayload,
  resolveProjectFormCopy,
  validateProjectForm
} from './projectForm';

test('inicia uma nova demanda no contexto Ambiental e usa terminologia contextual', () => {
  const form = createEmptyProjectForm('ambiental', 'cliente-ambiental');
  const copy = resolveProjectFormCopy('ambiental', form.tipo);

  assert.equal(form.tipo, 'Ambiental');
  assert.equal(form.clienteId, 'cliente-ambiental');
  assert.equal(copy.createTitle, 'Nova demanda ambiental');
  assert.equal(copy.nameLabel, 'Nome da demanda');
  assert.equal(copy.typeLabel, 'Tipo de demanda ambiental');
  assert.match(copy.namePlaceholder, /Regularização ambiental/);
  assert.doesNotMatch(copy.namePlaceholder, /altimétrico|planialtimétrico/i);
  assert.equal(copy.createSuccess, 'Demanda ambiental criada com sucesso.');
});

test('mantém os exemplos topográficos somente no contexto normal de projeto', () => {
  const copy = resolveProjectFormCopy('projeto');

  assert.equal(copy.createTitle, 'Novo projeto');
  assert.match(copy.namePlaceholder, /planialtimétrico/i);
});

test('preserva tipo e campos ambientais no payload compartilhado de projeto', () => {
  const form = {
    ...createEmptyProjectForm('ambiental', 'cliente-1'),
    nome: 'Regularização ambiental — Fazenda Boa Vista',
    descricao: 'Diagnóstico e regularização da propriedade.',
    orgaoAmbiental: 'IMA',
    tipoDemanda: 'Regularização',
    protocolo: 'IMA-2026-001'
  };

  const payload = projectFormToPayload(form);

  assert.equal(payload.nome, form.nome);
  assert.equal(payload.tipo, 'Ambiental');
  assert.equal(payload.orgaoAmbiental, 'IMA');
  assert.equal(payload.tipoDemanda, 'Regularização');
  assert.equal(payload.protocolo, 'IMA-2026-001');
});

test('resolve textos de perícia e licenciamento sem condicionais na apresentação', () => {
  assert.equal(resolveProjectFormCopy('ambiental', 'Perícia').createTitle, 'Nova perícia');
  assert.equal(resolveProjectFormCopy('ambiental', 'Licenciamento').createTitle, 'Novo processo de licenciamento');
});

test('normaliza metros quadrados e exige coordenadas em conjunto', () => {
  const form = {
    ...createEmptyProjectForm('projeto', '11111111-1111-4111-8111-111111111111'),
    nome: 'Projeto de área conhecida',
    tipo: 'Rural',
    area: '12.500,00',
    areaUnit: 'm2' as const,
    latitude: '-27,59'
  };

  const result = validateProjectForm(form);
  assert.equal(result.payload.areaHa, 1.25);
  assert.equal(result.payload.latitude, -27.59);
  assert.equal(result.valid, false);
  assert.equal(result.errors.longitude, 'Informe a longitude junto com a latitude');
});

test('licenciamento exige emissão e rejeita vencimento anterior', () => {
  const form = {
    ...createEmptyProjectForm('projeto', '11111111-1111-4111-8111-111111111111'),
    nome: 'Licença de operação',
    tipo: 'Licenciamento',
    tipoLicenca: 'LO',
    numeroLicenca: 'LO 123/2026',
    orgaoAmbiental: 'IMA',
    dataVencimentoLicenca: '2026-09-10'
  };

  const missingIssueDate = validateProjectForm(form);
  assert.equal(missingIssueDate.valid, false);
  assert.equal(missingIssueDate.errors.dataEmissao, 'Informe a data de emissão');

  const reversedDates = validateProjectForm({ ...form, dataEmissao: '2026-09-11' });
  assert.equal(reversedDates.valid, false);
  assert.match(reversedDates.errors.dataVencimentoLicenca || '', /posterior|igual/);
});
