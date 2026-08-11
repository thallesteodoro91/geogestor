import assert from 'node:assert/strict';
import test from 'node:test';
import { ExpenseCatalogSchema, ServiceCatalogSchema } from '@geogestor/contracts/src/auxiliary-catalogs';
import { parseExpenseCatalog, parseServiceCatalog } from './auxiliaryCatalogs';

test('converte catálogos legados em registros estruturados', () => {
  const services = parseServiceCatalog(['Topografia', 'Georreferenciamento']);
  const expenses = parseExpenseCatalog(['Combustível', 'Cartório']);
  assert.equal(services?.[0]?.nome, 'Topografia');
  assert.equal(services?.[0]?.valorSugerido, 0);
  assert.equal(services?.[0]?.ativo, true);
  assert.equal(expenses?.[1]?.categoria, 'Cartório');
  assert.equal(expenses?.[1]?.ativo, true);
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
});
