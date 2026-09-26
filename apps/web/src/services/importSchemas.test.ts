import assert from 'node:assert/strict';
import test from 'node:test';
import { parseImportSchemas, parseStoredImportSchemas } from './importSchemas';

test('cache de esquemas corrompido degrada para lista vazia sem derrubar a rota', () => {
  assert.deepEqual(parseImportSchemas('{json-inválido'), []);
  assert.deepEqual(parseImportSchemas('{"id":"objeto-em-vez-de-lista"}'), []);
});

test('mantém apenas esquemas estruturalmente válidos', () => {
  const valid = { id: '1', name: 'Clientes', entity: 'clientes', mapping: { Nome: 'nome' }, date: '2026-09-17T00:00:00.000Z' };
  assert.deepEqual(parseImportSchemas(JSON.stringify([valid, { ...valid, id: 2 }, null])), [valid]);
});

test('interpreta o valor autoritativo do SQLite mesmo com cache ausente ou inválido', () => {
  const stored = { id: 'db-1', name: 'Contatos', entity: 'contatos', mapping: { Nome: 'nome' }, date: '2026-09-25T00:00:00.000Z' };
  assert.deepEqual(parseStoredImportSchemas([stored]), [stored]);
  assert.deepEqual(parseStoredImportSchemas('{json-inválido'), []);
  assert.deepEqual(parseStoredImportSchemas(undefined), []);
});
