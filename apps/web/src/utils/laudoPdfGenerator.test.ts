import assert from 'node:assert/strict';
import test from 'node:test';
import { createLaudoPdfDefinition, formatLaudoDate, sanitizeLaudoFileName, type LaudoOptions } from './laudoPdfGenerator';

test('sanitizes forbidden Windows filename characters and trailing dots', () => {
  assert.equal(sanitizeLaudoFileName('QA: Área <Norte> / CAR? *  '), 'QA_Área_Norte_CAR');
  assert.equal(sanitizeLaudoFileName('...'), 'projeto');
});

const documentary: LaudoOptions = { projetoNome: 'CAR — propriedade de teste', clienteNome: 'Cliente fictício', tipoLaudo: 'acompanhamento', tipoDemanda: 'CAR', dataVistoria: '2026-10-12', tecnicoResponsavel: 'Responsável fictício', observacoes: '' };

test('client record does not present missing observations as a technical conclusion', () => {
  const document = createLaudoPdfDefinition(documentary, new Date('2026-10-12T02:00:00Z'));
  const definition = JSON.stringify(document);
  assert.match(definition, /Relatório de Acompanhamento Documental — CAR/);
  assert.match(definition, /A ausência de registro não indica inexistência de pendências/);
  assert.doesNotMatch(definition, /Laudo de Vistoria|PARECER TÉCNICO|Documentos considerados|Pendências e próximos passos/);
  assert.equal(typeof document.footer, 'function');
  if (typeof document.footer === 'function') assert.match(JSON.stringify(document.footer(1, 1, { width: 595, height: 842, orientation: 'portrait' })), /11\/10\/2026/); // Emission follows São Paulo, not UTC.
});

test('specific CAR title preserves the full project name in PDF metadata', () => {
  const project = 'Nome extenso da propriedade e identificação documental '.repeat(3);
  const definition = createLaudoPdfDefinition({ ...documentary, projetoNome: project, tipoDemanda: 'Cadastro Ambiental Rural (CAR)' });
  assert.equal(definition.info?.title, `Relatório de Acompanhamento Documental — CAR — ${project.trim()}`);
  const other = createLaudoPdfDefinition({ ...documentary, tipoDemanda: 'Acompanhamento de licença' });
  assert.equal(other.info?.title, 'Relatório de Acompanhamento Documental — CAR — propriedade de teste');
});

test('exports reviewed records and optional sections without declaring CAR approval', () => {
  const definition = JSON.stringify(createLaudoPdfDefinition({ ...documentary, situacaoTrabalho: 'Concluído', observacoes: 'Registro revisado pelo responsável.', documentosConsiderados: 'Documento de referência fictício.', proximosPassos: 'Encaminhamento informado pelo cliente.' }));
  for (const text of ['Registro revisado pelo responsável.', 'Documento de referência fictício.', 'Encaminhamento informado pelo cliente.', 'Situação do trabalho', 'Concluído']) assert.ok(definition.includes(text));
  assert.doesNotMatch(definition, /CAR aprovado|CAR regular|Nenhuma observação|inexistência de pendências/);
});

test('retains the selected technical document type and its reference date', () => {
  const definition = JSON.stringify(createLaudoPdfDefinition({ ...documentary, tipoLaudo: 'vistoria', observacoes: 'Constatação informada.' }));
  assert.match(definition, /Laudo de Vistoria Técnica/);
  assert.match(definition, /Data da vistoria/);
  assert.match(definition, /Constatação informada/);
  assert.doesNotMatch(definition, /Registros do acompanhamento|Situação do trabalho/);
});

test('formats date-only values without a UTC conversion', () => {
  assert.equal(formatLaudoDate('2026-09-11'), '11/09/2026');
  assert.equal(formatLaudoDate('legado'), 'legado');
});
