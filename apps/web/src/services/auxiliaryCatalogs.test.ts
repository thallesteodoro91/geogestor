import assert from 'node:assert/strict';
import test from 'node:test';
import { ExpenseCatalogSchema, ServiceCatalogSchema } from '@geogestor/contracts/src/auxiliary-catalogs';
import { parseExpenseCatalog, parseServiceCatalog, saveServiceCatalog } from './auxiliaryCatalogs';
import { apiClient } from './apiClient';

test('converte catálogos legados em registros estruturados', () => {
  const services = parseServiceCatalog(['Topografia', 'Georreferenciamento']);
  const expenses = parseExpenseCatalog(['Combustível', 'Cartório']);
  assert.equal(services?.[0]?.nome, 'Topografia');
  assert.equal(services?.[0]?.valorSugerido, 0);
  assert.equal(services?.[0]?.ativo, true);
  assert.equal(expenses?.[1]?.categoria, 'Cartório');
  assert.equal(expenses?.[1]?.ativo, true);
});

test('sucesso no SQLite não é reportado como falha quando o cache local fica indisponível', async () => {
  const originalPut = apiClient.put;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let persisted = false;
  apiClient.put = async () => {
    persisted = true;
    return { updated: ['geogestor_tipos_servico'] } as never;
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem: () => { throw new Error('quota indisponível'); } }
  });
  try {
    const result = await saveServiceCatalog([
      { id: 'zero', nome: 'Serviço sem valor sugerido', categoria: 'Serviços', valorSugerido: 0, ativo: true }
    ]);
    assert.equal(persisted, true);
    assert.equal(result[0]?.valorSugerido, 0);
  } finally {
    apiClient.put = originalPut;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('rejeita cache malformado e duplicidades sem diferenciar acentos ou caixa', () => {
  assert.equal(parseServiceCatalog({ invalid: true }), null);
  assert.equal(parseExpenseCatalog('não é um catálogo'), null);
  assert.equal(ServiceCatalogSchema.safeParse([
    { id: 'a', nome: 'Retificação de área', categoria: 'Regularização', valorSugerido: 100, ativo: true },
    { id: 'b', nome: 'retificacao de AREA', categoria: 'Outro', valorSugerido: 200, ativo: true }
  ]).success, false);
  assert.equal(ExpenseCatalogSchema.safeParse([
    { id: 'a', categoria: 'Cartório', descricao: 'Taxas', ativo: true },
    { id: 'b', categoria: 'cartorio', descricao: 'Outras taxas', ativo: true }
  ]).success, false);
  assert.equal(ExpenseCatalogSchema.safeParse([
    {
      id: 'a',
      categoria: 'Campo',
      descricao: 'Custos de campo',
      subcategorias: ['Alimentação', '  alimentacao  '],
      ativo: true
    }
  ]).success, false);
});
