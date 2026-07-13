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

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
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
  return 'http://127.0.0.1:3001';
}

export function getDownloadUrl(filePath: string): string {
  const baseUrl = getBaseUrl();
  let token = '';
  if (typeof window !== 'undefined' && window.electronAPI?.getApiToken) {
    token = window.electronAPI.getApiToken() || '';
  }
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  return `${baseUrl}/api/arquivos/download?path=${encodeURIComponent(filePath)}${tokenParam}`;
}

export function getPreviewUrl(filePath: string): string {
  const baseUrl = getBaseUrl();
  let token = '';
  if (typeof window !== 'undefined' && window.electronAPI?.getApiToken) {
    token = window.electronAPI.getApiToken() || '';
  }
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  return `${baseUrl}/api/arquivos/preview?path=${encodeURIComponent(filePath)}${tokenParam}`;
}

function getAuthHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders || {});
  if (typeof window !== 'undefined' && window.electronAPI?.getApiToken) {
    const token = window.electronAPI.getApiToken();
    if (token && !headers.has('x-api-token')) {
      headers.set('x-api-token', token);
    }
  }
  return headers;
}

function resolveApiUrl(inputUrl: string): string {
  const legacyLocalApi = /^http:\/\/(?:localhost|127\.0\.0\.1):3001(?=\/api(?:\/|$))/;
  const normalizedUrl = inputUrl.replace(legacyLocalApi, '');
  return normalizedUrl.startsWith('/api') ? `${getBaseUrl()}${normalizedUrl}` : normalizedUrl;
}

/**
 * Compatibility layer for screens that still need the native Response object.
 * It preserves each caller's response handling while resolving Electron's dynamic API port.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const inputUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const url = resolveApiUrl(inputUrl);
  const headers = getAuthHeaders(init?.headers || (input instanceof Request ? input.headers : undefined));
  const options = { ...init, headers };

  if (input instanceof Request) {
    return fetch(new Request(url, input), options);
  }

  return fetch(url, options);
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
    } else if (response.status === 401 || response.status === 403) {
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

    const baseUrl = getBaseUrl();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    fetchOptions.headers = getAuthHeaders(fetchOptions.headers);
    fetchOptions.signal = controller.signal;

    try {
      const response = await apiFetch(url, fetchOptions);
      clearTimeout(id);
      return await handleResponse<T>(response);
    } catch (error: unknown) {
      clearTimeout(id);
      console.error('[API_CLIENT_ERROR]', { url, method: fetchOptions.method, error });
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('A requisição demorou muito tempo e foi cancelada (Timeout).', 408);
      }
      const message = error instanceof Error ? error.message : 'Falha na conexão de rede local.';
      throw new ApiError(`Erro de conexão: ${message} (URL: ${url})`, 0);
    }
  },

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return apiClient.request<T>(endpoint, { ...options, method: 'GET' });
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
