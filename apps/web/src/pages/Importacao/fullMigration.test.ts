import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  detectHeaderRowIndex,
  headerOutsideDetectionWindow,
  parseCsvWithSourceRows,
  readValidatedSpreadsheet,
  requiresManualHeaderSelection,
  selectBestWorkbookSheet,
  uniqueSpreadsheetHeaders,
  validateSpreadsheetDimensions,
  validateSpreadsheetCells,
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
  assert.equal(requiresManualHeaderSelection(rows, 3), false);
});

test('recusa encoding inválido, conteúdo incompatível, ZIP truncado/protegido e expansão declarada', async () => {
  const fixture = readFileSync(path.resolve('docs/auditorias/2026-09-23-importacao-planilhas/evidencias/contato-sintetico.xlsx'));
  const workbook = (bytes: Uint8Array, name = 'teste.xlsx') => new File([new Uint8Array(bytes)], name);
  assert.equal(await readValidatedSpreadsheet(workbook(fixture)), null);
  await assert.rejects(readValidatedSpreadsheet(new File([new Uint8Array([0x4e, 0x6f, 0x6d, 0x65, 0x0a, 0xff])], 'teste.csv')), /UTF-8/);
  await assert.rejects(readValidatedSpreadsheet(workbook(fixture, 'teste.csv')), /extensão CSV/);
  await assert.rejects(readValidatedSpreadsheet(workbook(Buffer.from('Nome\nTeste'), 'teste.xlsx')), /não corresponde/);
  await assert.rejects(readValidatedSpreadsheet(workbook(fixture.subarray(0, fixture.length - 5))), /ZIP/);

  const directory = fixture.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(directory > 0);
  const encrypted = Buffer.from(fixture);
  encrypted.writeUInt16LE(encrypted.readUInt16LE(directory + 8) | 1, directory + 8);
  await assert.rejects(readValidatedSpreadsheet(workbook(encrypted)), /protegido/);
  const expanded = Buffer.from(fixture);
  expanded.writeUInt32LE(65 * 1024 * 1024, directory + 24);
  await assert.rejects(readValidatedSpreadsheet(workbook(expanded)), /limite de expansão/);
});

test('preserva a linha física com BOM, linha vazia e campo CSV multilinha', () => {
  const parsed = parseCsvWithSourceRows('\uFEFFA,B\r\n\r\n"x\r\ny",2\r\nz,3');
  assert.deepEqual(parsed.sourceRowNumbers, [1, 2, 3, 5]);
  assert.deepEqual(parsed.rows[2], ['x\r\ny', '2']);
});

test('lê separador ponto e vírgula e aspas escapadas sem avaliar texto de fórmula', () => {
  const parsed = parseCsvWithSourceRows('Nome;Observações\nQA-IMPORT-TESTE;"texto ""citado""\ne =SUM(1;2)"');
  assert.deepEqual(parsed.sourceRowNumbers, [1, 2]);
  assert.deepEqual(parsed.rows[1], ['QA-IMPORT-TESTE', 'texto "citado"\ne =SUM(1;2)']);
});

test('exige seleção manual quando linha parcialmente preenchida pode ser cabeçalho', () => {
  const rows = [
    ['Cliente', 'Projeto', '', 'Valor'],
    ['Cliente A', 'Projeto A', 'Propriedade A', '1000']
  ];
  assert.equal(detectHeaderRowIndex(rows), 1);
  assert.equal(requiresManualHeaderSelection(rows, 1), true);
});

test('exige seleção manual para títulos duplicados ou vazios em qualquer linha candidata', () => {
  const duplicated = [['Cliente', 'Valor', 'Valor'], ['QA-IMPORT-TESTE', '100', '200']];
  assert.equal(requiresManualHeaderSelection(duplicated, detectHeaderRowIndex(duplicated)), true);
  const empty = [['Cliente', '', 'Valor'], ['QA-IMPORT-TESTE', 'Projeto', '100']];
  assert.equal(requiresManualHeaderSelection(empty, detectHeaderRowIndex(empty)), true);
  assert.equal(requiresManualHeaderSelection([['Cliente', 'Projeto'], ['A', 'B']], 0), false);
});

test('identifica cabeçalhos nas linhas 1, 2, 6 e 20 sem tomar títulos isolados por dados', () => {
  for (const line of [1, 2, 6, 20]) {
    const rows = [
      ...Array.from({ length: line - 1 }, (_, index) => [`Título ${index + 1}`]),
      ['Cliente', 'Projeto', 'Valor'],
      ['QA-IMPORT-TESTE', 'Serviço', 100]
    ];
    assert.equal(detectHeaderRowIndex(rows), line - 1);
    assert.equal(requiresManualHeaderSelection(rows, line - 1), false);
  }
});

test('sinaliza tabela fora da janela de 20 linhas sem escolher título como cabeçalho', () => {
  const rows = [...Array.from({ length: 20 }, (_, index) => [`Título ${index + 1}`]), ['Cliente', 'Projeto'], ['A', 'B']];
  assert.equal(headerOutsideDetectionWindow(rows), true);
  assert.equal(headerOutsideDetectionWindow([['Cliente', 'Projeto'], ['A', 'B']]), false);
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
  assert.equal(validateSpreadsheetFile('clientes.csv', 20 * 1024 * 1024), null);
  assert.match(validateSpreadsheetFile('clientes.xls', 1_000) ?? '', /Formato não suportado/);
  assert.match(validateSpreadsheetFile('clientes.xlsx', 20 * 1024 * 1024 + 1) ?? '', /limite é 20 MB/);
});

test('recusa quantidade de linhas ou colunas acima do limite com orientação', () => {
  assert.match(validateSpreadsheetDimensions(20_001, 10) ?? '', /Divida o arquivo em lotes menores/);
  assert.match(validateSpreadsheetDimensions(10, 301) ?? '', /Remova colunas desnecessárias/);
  assert.equal(validateSpreadsheetDimensions(20_000, 300), null);
  assert.equal(validateSpreadsheetDimensions(19_999, 299), null);
});

test('recusa célula grande antes de formar a prévia', () => {
  assert.equal(validateSpreadsheetCells([['Nome'], ['a'.repeat(20_000)]]), null);
  assert.match(validateSpreadsheetCells([['Nome'], ['a'.repeat(20_001)]]) ?? '', /20.000 caracteres/);
});
