import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectHeaderRowIndex,
  selectBestWorkbookSheet,
  uniqueSpreadsheetHeaders,
  validateSpreadsheetDimensions,
  validateSpreadsheetFile
} from './fullMigration';

test('identifica o cabeçalho mesmo quando a planilha começa com título e observações', () => {
  const rows = [
    ['Relatório comercial — julho'],
    ['Gerado pelo cliente em seu modelo próprio'],
    [],
    ['Contratante', 'Nome do serviço', 'Vlr faturado', 'Dt faturamento'],
    ['Empresa Exemplo', 'Levantamento RTK', 4500, '01/07/2026']
  ];

  assert.equal(detectHeaderRowIndex(rows), 3);
});

test('preserva colunas sem título e títulos repetidos sem sobrescrever dados', () => {
  assert.deepEqual(
    uniqueSpreadsheetHeaders(['Cliente', 'Valor', 'Valor', '']),
    ['Cliente', 'Valor', 'Valor (2)', 'Coluna 4 (sem título)']
  );
});

test('seleciona a aba com a tabela mais completa', () => {
  const selected = selectBestWorkbookSheet([
    { sheet: 'Instruções', data: [['Como preencher esta pasta de trabalho']] },
    {
      sheet: 'Base de dados',
      data: [
        ['Cliente', 'Projeto', 'Valor faturado', 'Data do faturamento'],
        ['Cliente A', 'Projeto A', 1000, '2026-07-01']
      ]
    }
  ]);

  assert.equal(selected?.sheet, 'Base de dados');
});

test('aceita CSV e XLSX e rejeita formato ou arquivo acima do limite antes da leitura', () => {
  assert.equal(validateSpreadsheetFile('clientes.csv', 1_000), null);
  assert.equal(validateSpreadsheetFile('clientes.xlsx', 1_000), null);
  assert.match(validateSpreadsheetFile('clientes.xls', 1_000) ?? '', /Formato não suportado/);
  assert.match(validateSpreadsheetFile('clientes.xlsx', 20 * 1024 * 1024 + 1) ?? '', /limite é 20 MB/);
});

test('recusa quantidade de linhas ou colunas acima do limite com orientação', () => {
  assert.match(validateSpreadsheetDimensions(20_001, 10) ?? '', /Divida o arquivo em lotes menores/);
  assert.match(validateSpreadsheetDimensions(10, 301) ?? '', /Remova colunas desnecessárias/);
  assert.equal(validateSpreadsheetDimensions(20_000, 300), null);
});
