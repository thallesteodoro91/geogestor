import assert from 'node:assert/strict';
import test from 'node:test';

test('downloads e previews não expõem o token efêmero na URL', async () => {
  let tokenReads = 0;
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        getApiPort: () => 4321,
        getApiToken: () => {
          tokenReads += 1;
          return 'synthetic-token';
        }
      },
      location: {
        protocol: 'http:',
        port: '4321',
        origin: 'http://127.0.0.1:4321'
      }
    }
  });
  const { getDownloadUrl, getPreviewUrl } = await import('./apiClient');

  assert.equal(
    getDownloadUrl('Clientes/Exemplo/arquivo.pdf'),
    'http://127.0.0.1:4321/api/arquivos/download?path=Clientes%2FExemplo%2Farquivo.pdf'
  );
  assert.equal(
    getPreviewUrl('Clientes/Exemplo/imagem.png'),
    'http://127.0.0.1:4321/api/arquivos/preview?path=Clientes%2FExemplo%2Fimagem.png'
  );
  assert.equal(tokenReads, 0);
});

test('apiClient aplica autenticação uma única vez por requisição', async () => {
  let tokenReads = 0;
  let capturedHeaders: Headers | undefined;
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        getApiPort: () => 4321,
        getApiToken: () => {
          tokenReads += 1;
          return 'synthetic-token';
        }
      },
      location: {
        protocol: 'http:',
        port: '4321',
        origin: 'http://127.0.0.1:4321'
      }
    },
    fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });
  const { apiClient } = await import('./apiClient');

  assert.deepEqual(await apiClient.get('/api/example'), { ok: true });
  assert.equal(tokenReads, 1);
  assert.equal(capturedHeaders?.get('x-api-token'), 'synthetic-token');
});

test('apiClient sinaliza indisponibilidade sem devolver dados vazios ou zeros', async () => {
  let unavailableEvents = 0;
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        getApiPort: () => 4321,
        getApiToken: () => 'synthetic-token'
      },
      location: {
        protocol: 'http:',
        port: '4321',
        origin: 'http://127.0.0.1:4321'
      },
      dispatchEvent: (event: Event) => {
        if (event.type === 'geogestor:api-unavailable') unavailableEvents += 1;
        return true;
      }
    },
    fetch: async () => {
      throw new TypeError('fetch failed');
    }
  });
  const { ApiError, apiClient } = await import('./apiClient');

  await assert.rejects(
    apiClient.get('/api/clientes', { timeoutMs: 50 }),
    (error: unknown) => error instanceof ApiError
      && error.status === 0
      && error.message === 'Não foi possível conectar ao serviço local do GeoGestor.'
  );
  assert.equal(unavailableEvents, 1);
});
