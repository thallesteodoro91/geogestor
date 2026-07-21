import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OpportunityPayloadSchema,
  OpportunityStageSchema,
  OpportunityTransitionSchema,
  opportunityStageProbability
} from '@geogestor/contracts';

test('contrato usa somente os cinco estágios canônicos', () => {
  assert.equal(OpportunityStageSchema.safeParse('Prospectado').success, true);
  assert.equal(OpportunityStageSchema.safeParse('Prospect').success, false);
  assert.equal(OpportunityStageSchema.safeParse('Qualificação').success, false);
});

test('perda exige motivo e ganho aceita observação opcional', () => {
  assert.equal(OpportunityTransitionSchema.safeParse({ estagio: 'Perdido' }).success, false);
  assert.equal(OpportunityTransitionSchema.safeParse({ estagio: 'Perdido', motivo: 'Cliente adiou o investimento' }).success, true);
  assert.equal(OpportunityTransitionSchema.safeParse({ estagio: 'Ganho' }).success, true);
});

test('payload rejeita valor negativo e probabilidade fora do intervalo', () => {
  const base = { clienteId: 'cliente-1', titulo: 'Levantamento topográfico' };
  assert.equal(OpportunityPayloadSchema.safeParse({ ...base, valorEstimado: -1 }).success, false);
  assert.equal(OpportunityPayloadSchema.safeParse({ ...base, probabilidadePontosBase: 10_001 }).success, false);
  assert.equal(OpportunityPayloadSchema.safeParse({ ...base, valorEstimado: 100_000, probabilidadePontosBase: 6_500 }).success, true);
});

test('oportunidade aceita cliente ou lead, mas exige um vínculo comercial', () => {
  const business = { titulo: 'Levantamento planialtimétrico' };
  assert.equal(OpportunityPayloadSchema.safeParse({ ...business, clienteId: 'cliente-1' }).success, true);
  assert.equal(OpportunityPayloadSchema.safeParse({ ...business, leadId: 'lead-1' }).success, true);
  assert.equal(OpportunityPayloadSchema.safeParse(business).success, false);
  assert.equal(OpportunityPayloadSchema.safeParse({ ...business, clienteId: 'cliente-1', leadId: 'lead-1' }).success, false);
  assert.equal(OpportunityPayloadSchema.safeParse({ ...business, leadId: 'lead-1', orcamentoId: 'orcamento-1' }).success, false);
});

test('probabilidades padrão acompanham a maturidade do funil', () => {
  assert.equal(opportunityStageProbability('Prospectado'), 1_000);
  assert.equal(opportunityStageProbability('Contato'), 3_000);
  assert.equal(opportunityStageProbability('Proposta'), 6_500);
  assert.equal(opportunityStageProbability('Ganho'), 10_000);
  assert.equal(opportunityStageProbability('Perdido'), 0);
});
