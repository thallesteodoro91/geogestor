export class ApiError extends Error {
  public status: number;
  public payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

let localSessionToken = '';
let lastConnectionLogAt = 0;

export function setLocalSessionToken(token: string) {
  localSessionToken = token;
  window.electronAPI?.setLocalSessionToken?.(token);
}

export function clearLocalSessionToken() {
  localSessionToken = '';
  window.electronAPI?.setLocalSessionToken?.('');
}

export function hasLocalSessionToken() {
  return Boolean(localSessionToken);
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.electronAPI?.getApiPort) {
    const port = window.electronAPI.getApiPort();

    // No app empacotado, o Fastify serve a interface e a API na mesma porta.
    // Usar a mesma origem evita preflight CORS em métodos como DELETE e os
    // erros genéricos "Failed to fetch" devolvidos pelo Chromium.
    if (
      (window.location.protocol === 'http:' || window.location.protocol === 'https:')
      && window.location.port === String(port)
    ) {
      return window.location.origin;
    }

    return `http://127.0.0.1:${port}`;
  }
  const configuredUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
  if (configuredUrl) return configuredUrl;
  return 'http://127.0.0.1:3001';
}

export function getDownloadUrl(filePath: string): string {
  return `${getBaseUrl()}/api/arquivos/download?path=${encodeURIComponent(filePath)}`;
}

export function getPreviewUrl(filePath: string): string {
  return `${getBaseUrl()}/api/arquivos/preview?path=${encodeURIComponent(filePath)}`;
}

export function getAuthenticatedAssetUrl(pathname: string): string {
  const url = new URL(pathname, getBaseUrl());
  const token = window.electronAPI?.getApiToken?.();
  if (token) url.searchParams.set('token', token);
  if (localSessionToken) url.searchParams.set('session', localSessionToken);
  return url.toString().replace(/%7B/gi, '{').replace(/%7D/gi, '}');
}

function getAuthHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders || {});
  if (typeof window !== 'undefined' && window.electronAPI?.getApiToken) {
    const token = window.electronAPI.getApiToken();
    if (token && !headers.has('x-api-token')) {
      headers.set('x-api-token', token);
    }
  }
  if (localSessionToken && !headers.has('x-local-session')) {
    headers.set('x-local-session', localSessionToken);
  }
  return headers;
}

function resolveApiUrl(inputUrl: string): string {
  const legacyLocalApi = /^http:\/\/(?:localhost|127\.0\.0\.1):3001(?=\/api(?:\/|$))/;
  const normalizedUrl = inputUrl.replace(legacyLocalApi, '');
  return normalizedUrl.startsWith('/api') ? `${getBaseUrl()}${normalizedUrl}` : normalizedUrl;
}

function notifyAlertsAfterMutation(url: string, method: string, response: Response) {
  if (!response.ok || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return;
  const pathname = new URL(url).pathname;
  if (!pathname.startsWith('/api/') || pathname.startsWith('/api/alertas')) return;
  window.dispatchEvent(new CustomEvent('geogestor:alerts-invalidated', {
    detail: { method: method.toUpperCase(), pathname }
  }));
}

/**
 * Compatibility layer for screens that still need the native Response object.
 * It preserves each caller's response handling while resolving Electron's dynamic API port.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const inputUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const url = resolveApiUrl(inputUrl);
  const headers = getAuthHeaders(init?.headers || (input instanceof Request ? input.headers : undefined));
  const options = { ...init, headers };
  const method = (options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

  if (input instanceof Request) {
    const response = await fetch(new Request(url, input), options);
    notifyAlertsAfterMutation(url, method, response);
    return response;
  }

  const response = await fetch(url, options);
  notifyAlertsAfterMutation(url, method, response);
  return response;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'Ocorreu um erro na comunicação com o servidor local.';
    let payload: unknown;

    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        payload = await response.json();
        if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
          errorMessage = payload.message;
        } else if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
          errorMessage = payload.error;
        }
      } else {
        const text = await response.text();
        if (text) errorMessage = text;
      }
    } catch {
      /* ignora falha ao ler corpo do erro */
    }

    if (response.status === 400) {
      errorMessage = `Dados inválidos: ${errorMessage}`;
    } else if (
      (response.status === 401 || response.status === 403)
      && !(payload && typeof payload === 'object' && 'code' in payload)
    ) {
      errorMessage = 'Acesso negado pela segurança local do sistema.';
    } else if (response.status === 404) {
      errorMessage = 'O registro ou arquivo solicitado não foi encontrado.';
    } else if (response.status >= 500) {
      errorMessage = `Erro interno do servidor local (${response.status}): ${errorMessage}`;
    }

    throw new ApiError(errorMessage, response.status, payload);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export const apiClient = {
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = 15000, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const upstreamSignal = fetchOptions.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
    if (upstreamSignal?.aborted) abortFromUpstream();
    else upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });

    const baseUrl = getBaseUrl();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    fetchOptions.signal = controller.signal;

    try {
      const response = await apiFetch(url, fetchOptions);
      clearTimeout(id);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
      const result = await handleResponse<T>(response);
      const method = (fetchOptions.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const pathname = new URL(url).pathname;
        const completeRequired = /(?:arquivos|upload|anexos|diretorio-arquivos)/i.test(pathname)
          || (typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData);
        window.dispatchEvent(new CustomEvent('geogestor:backup-invalidated', {
          detail: { scope: completeRequired ? 'complete' : 'database', pathname }
        }));
      }
      return result;
    } catch (error: unknown) {
      clearTimeout(id);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
      if (error instanceof ApiError) {
        if (error.status === 423) {
          clearLocalSessionToken();
          window.dispatchEvent(new CustomEvent('geogestor:session-locked'));
        }
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        window.dispatchEvent(new CustomEvent('geogestor:api-unavailable'));
        throw new ApiError('Não foi possível conectar ao serviço local do GeoGestor no tempo esperado.', 0, {
          endpoint: new URL(url).pathname,
          reason: 'Tempo limite de conexão excedido.'
        });
      }
      const now = Date.now();
      if (now - lastConnectionLogAt > 10_000) {
        console.warn('[API_UNAVAILABLE]', {
          endpoint: new URL(url).pathname,
          reason: error instanceof Error ? error.message : 'network-error'
        });
        lastConnectionLogAt = now;
      }
      window.dispatchEvent(new CustomEvent('geogestor:api-unavailable'));
      throw new ApiError('Não foi possível conectar ao serviço local do GeoGestor.', 0, {
        endpoint: new URL(url).pathname,
        reason: error instanceof Error ? error.message : 'Falha na conexão de rede local.'
      });
    }
  },

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return apiClient.request<T>(endpoint, { ...options, method: 'GET' });
  },

  /**
   * Carrega explicitamente todas as pÃ¡ginas de um endpoint paginado. O total
   * informado pelo backend encerra a coleta e ids repetidos nunca sÃ£o
   * adicionados duas vezes.
   */
  async getAllPages<T extends { id?: string }>(endpoint: string, options?: RequestOptions): Promise<T[]> {
    const pageSize = 100;
    const collected: T[] = [];
    const seen = new Set<string>();
    let page = 1;
    while (true) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await apiClient.get<PaginatedResponse<T>>(
        `${endpoint}${separator}mode=page&page=${page}&limit=${pageSize}`,
        options,
      );
      for (const item of response.items) {
        const key = item.id || `page-${page}-index-${collected.length}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(item);
      }
      if (page >= response.totalPages) break;
      page += 1;
    }
    return collected;
  },

  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const isFormData = body instanceof FormData;
    const headers = new Headers(options?.headers || {});
    if (!isFormData && body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers,
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  },

  async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const isFormData = body instanceof FormData;
    const headers = new Headers(options?.headers || {});
    if (!isFormData && body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      headers,
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  },

  async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const isFormData = body instanceof FormData;
    const headers = new Headers(options?.headers || {});
    if (!isFormData && body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return apiClient.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      headers,
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  },

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return apiClient.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
};
