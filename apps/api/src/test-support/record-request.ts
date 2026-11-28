import type { FastifyInstance, InjectOptions } from 'fastify';
import { mutationRecordPath } from '@geogestor/contracts/src/record-concurrency';

// Ordinary domain tests act on a freshly read record, just like an editor.
// Concurrency tests bypass this fixture and deliberately reuse frozen versions.
export async function injectWithRecordVersion(server: FastifyInstance, input: InjectOptions) {
  const url = typeof input.url === 'string' ? input.url : '';
  const method = String(input.method || 'GET').toUpperCase();
  const headers = { ...(input.headers || {}) } as Record<string, string>;
  if (['PATCH', 'PUT', 'DELETE'].includes(method)) {
    const recordPath = mutationRecordPath(url.split('?')[0]);
    if (recordPath && !headers['x-record-version']) {
      const current = await server.inject({ method: 'GET', url: `/api/edicao/atual?path=${encodeURIComponent(recordPath)}`, headers });
      if (current.statusCode === 200 && current.json<{ updatedAt?: string }>().updatedAt) headers['x-record-version'] = current.json<{ updatedAt: string }>().updatedAt;
    }
    if (/^\/api\/dados-operacionais\/propriedades\/[0-9a-f-]+$/i.test(url) && !headers['if-match']) {
      const current = await server.inject({ method: 'GET', url, headers });
      if (current.statusCode === 200) headers['if-match'] = current.json<{ editToken: string }>().editToken;
    }
    if (url === '/api/dados-operacionais/configuracoes-operacionais' && input.payload && typeof input.payload === 'object' && !Buffer.isBuffer(input.payload)) {
      const payload = input.payload as Record<string, unknown>;
      if (payload.values && typeof payload.values === 'object' && !payload.expectedValues) {
        const current = await server.inject({ method: 'GET', url, headers });
        if (current.statusCode === 200) {
          const values = current.json<Record<string, unknown>>();
          input = { ...input, payload: { ...payload, expectedValues: Object.fromEntries(Object.keys(payload.values).map((key) => [key, values[key] ?? null])) } };
        }
      }
    }
  }
  return server.inject({ ...input, headers });
}
