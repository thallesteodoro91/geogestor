import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentalProgressPayloadSchema, isEnvironmentalWorkCompleted, environmentalRecordedAtTime } from '@geogestor/contracts/src/environmental';
import { demandReturn, environmentalProjectLink, environmentalReturn } from './environmentalNavigation';

test('retorno preserva filtros ambientais e rejeita endereços externos', () => {
  const origin = '/ambiental?tab=ambiental&q=CAR&status=Conclu%C3%ADdo&page=3';
  const detail = `/ambiental/12345678-1234-1234-1234-123456789abc?${new URLSearchParams({ retorno: origin })}`;
  const link = new URL(environmentalProjectLink('project', detail, 'anexar'), 'http://local.test');
  assert.equal(link.searchParams.get('retorno'), detail);
  assert.equal(demandReturn(link.searchParams.get('retorno')), detail);
  assert.equal(environmentalReturn(origin), origin);
  for (const input of ['https://external.test', '//external.test/ambiental', '/ambiental/../projetos']) assert.equal(environmentalReturn(input), '/ambiental');
  assert.equal(demandReturn('//external.test'), null);
});

test('contrato de andamento rejeita espaços, datas irreais e excessos, e normaliza o conteúdo', () => {
  const input = { titulo: ' Registro ', descricao: ' Evidência ', categoria: ' Campo ', data: '2022-08-08' };
  assert.equal(EnvironmentalProgressPayloadSchema.parse(input).titulo, 'Registro');
  for (const field of ['titulo', 'descricao', 'categoria']) assert.equal(EnvironmentalProgressPayloadSchema.safeParse({ ...input, [field]: ' \t ' }).success, false);
  assert.equal(EnvironmentalProgressPayloadSchema.safeParse({ ...input, data: '2026-02-30' }).success, false);
  for (const status of ['Concluído', 'Concluido', 'Finalizado']) assert.equal(isEnvironmentalWorkCompleted(status), true);
  assert.equal(isEnvironmentalWorkCompleted(null), false);
  assert.equal(environmentalRecordedAtTime('2026-10-12 04:00:00'), Date.parse('2026-10-12T04:00:00Z'));
});
