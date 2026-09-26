import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeVertexImport } from './topographyImport';

test('detecta cabeçalho, delimitador e colunas geográficas antes da importação', () => {
  const preview = analyzeVertexImport(
    'Código;Longitude;Latitude\nV1;-48,548220;-27,594870\nV2;-48,547000;-27,594000',
    'geografica',
    { delimiter: 'auto', decimalSeparator: 'auto', hasHeader: true },
  );
  assert.equal(preview.delimiter, ';');
  assert.equal(preview.firstCoordinateColumn, 2);
  assert.equal(preview.secondCoordinateColumn, 1);
  assert.deepEqual(preview.validVertices[0], { lat: -27.59487, lng: -48.54822 });
  assert.equal(preview.errors.length, 0);
});

test('mantém linhas inválidas visíveis e importa somente as coordenadas válidas', () => {
  const preview = analyzeVertexImport(
    'X\tY\n742003.21\t6945275.21\ntexto\t6945000',
    'projetada',
    { delimiter: 'auto', decimalSeparator: '.', hasHeader: true },
  );
  assert.equal(preview.validVertices.length, 1);
  assert.equal(preview.rows.length, 2);
  assert.match(preview.rows[1].error ?? '', /numéricas/);
});

test('marca duplicidades sem remover a primeira ocorrência válida', () => {
  const preview = analyzeVertexImport(
    'Latitude;Longitude\n-27,5;-48,5\n-27,5;-48,5',
    'geografica',
    { delimiter: ';', decimalSeparator: ',', hasHeader: true },
  );
  assert.equal(preview.validVertices.length, 1);
  assert.match(preview.rows[1].error ?? '', /duplicado/);
});

test('rejeita arquivo vazio, colunas iguais e ambiguidade de vírgula', () => {
  assert.throws(() => analyzeVertexImport('', 'geografica', { delimiter: 'auto', decimalSeparator: 'auto', hasHeader: false }), /vazio/i);
  assert.throws(() => analyzeVertexImport('Latitude;Longitude\n-27;-48', 'geografica', { delimiter: ';', decimalSeparator: '.', hasHeader: true, firstCoordinateColumn: 0, secondCoordinateColumn: 0 }), /colunas diferentes/i);
  assert.throws(() => analyzeVertexImport('-27,5,-48,5', 'geografica', { delimiter: 'auto', decimalSeparator: 'auto', hasHeader: false }), /ambígu/i);
});

test('interpreta campos delimitados com aspas e delimitador dentro do texto', () => {
  const preview = analyzeVertexImport(
    'Código;Descrição;Latitude;Longitude\n"V;1";"Marco; inicial";-27,5;-48,5',
    'geografica',
    { delimiter: ';', decimalSeparator: ',', hasHeader: true },
  );
  assert.equal(preview.validVertices.length, 1);
  assert.deepEqual(preview.rows[0].raw.slice(0, 2), ['V;1', 'Marco; inicial']);
});

test('aceita exatamente 10.000 linhas e limita pré-condições logo acima da borda', () => {
  const exactlyTenThousand = Array.from({ length: 10_000 }, (_, index) => `${index};${index + 1}`).join('\n');
  const startedAt = performance.now();
  const preview = analyzeVertexImport(exactlyTenThousand, 'projetada', {
    delimiter: ';', decimalSeparator: '.', hasHeader: false,
  });
  assert.equal(preview.totalLines, 10_000);
  assert.equal(preview.validVertices.length, 10_000);
  assert.ok(performance.now() - startedAt < 2_000, '10.000 linhas devem ser analisadas sem bloqueio prolongado');

  assert.throws(() => analyzeVertexImport(`${exactlyTenThousand}\n10000;10001`, 'projetada', {
    delimiter: ';', decimalSeparator: '.', hasHeader: false,
  }), /10\.000 linhas/);
  assert.doesNotThrow(() => analyzeVertexImport(Array.from({ length: 50 }, (_, index) => String(index)).join(';'), 'projetada', {
    delimiter: ';', decimalSeparator: '.', hasHeader: false,
  }));
  assert.throws(() => analyzeVertexImport(Array.from({ length: 51 }, (_, index) => String(index)).join(';'), 'projetada', {
    delimiter: ';', decimalSeparator: '.', hasHeader: false,
  }), /50 colunas/);
});

test('aplica limite de 2 MB em bytes UTF-8, inclusive com conteúdo multibyte', () => {
  const atLimit = `0;1\n${'á'.repeat(999_997)}`;
  assert.ok(new TextEncoder().encode(atLimit).length <= 2_000_000);
  assert.doesNotThrow(() => analyzeVertexImport(atLimit, 'projetada', {
    delimiter: ';', decimalSeparator: '.', hasHeader: false,
  }));
  assert.throws(() => analyzeVertexImport(`${atLimit}áá`, 'projetada', {
    delimiter: ';', decimalSeparator: '.', hasHeader: false,
  }), /2 MB/);
});
