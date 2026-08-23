import { apiClient } from './apiClient';

type FolderApiClient = {
  get: (endpoint: string) => Promise<unknown>;
  post: (endpoint: string, body?: unknown) => Promise<unknown>;
};
type ProjectFilesResponse = { files?: unknown[]; path?: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function openManagedFolder(folderPath: string, client: FolderApiClient = apiClient) {
  if (!folderPath.trim()) {
    throw new Error('A pasta do projeto ainda não está disponível. Tente novamente em instantes.');
  }
  return client.post('/api/arquivos/open-folder', { path: folderPath });
}

export async function openProjectFolder(projectId: string, client: FolderApiClient = apiClient) {
  if (!UUID_PATTERN.test(projectId)) {
    throw new Error('Não foi possível identificar um projeto válido para abrir a pasta.');
  }
  const projectFiles = await client.get(`/api/arquivos/projeto/${encodeURIComponent(projectId)}`) as ProjectFilesResponse;
  return openManagedFolder(projectFiles.path || '', client);
}
