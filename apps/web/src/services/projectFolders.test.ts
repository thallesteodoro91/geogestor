import assert from 'node:assert/strict';
import test from 'node:test';
import { openManagedFolder, openProjectFolder } from './projectFolders';

test('abre a pasta resolvida pelo backend usando a operação protegida', async () => {
  const calls: Array<{ method: string; endpoint: string; body?: unknown }> = [];
  const client = {
    get: async (endpoint: string) => {
      calls.push({ method: 'GET', endpoint });
      return { files: [], path: 'C:\\GeoGestor\\dados\\Cliente\\Projeto' };
    },
    post: async (endpoint: string, body?: unknown) => {
      calls.push({ method: 'POST', endpoint, body });
      return { success: true };
    }
  };

  await openProjectFolder('123e4567-e89b-42d3-a456-426614174000', client);

  assert.deepEqual(calls, [
    { method: 'GET', endpoint: '/api/arquivos/projeto/123e4567-e89b-42d3-a456-426614174000' },
    { method: 'POST', endpoint: '/api/arquivos/open-folder', body: { path: 'C:\\GeoGestor\\dados\\Cliente\\Projeto' } }
  ]);
});

test('rejeita projeto inválido antes de consultar a API', async () => {
  const client = {
    get: async () => { throw new Error('não deveria consultar'); },
    post: async () => ({ success: true })
  };
  await assert.rejects(() => openProjectFolder('../fora', client), /projeto válido/);
});

test('não tenta abrir uma pasta ainda não resolvida', async () => {
  let posted = false;
  const client = {
    get: async () => ({ files: [], path: '' }),
    post: async () => { posted = true; return { success: true }; }
  };
  await assert.rejects(() => openProjectFolder('123e4567-e89b-42d3-a456-426614174000', client), /ainda não está disponível/);
  assert.equal(posted, false);
  await assert.rejects(() => openManagedFolder('  ', client), /ainda não está disponível/);
});
