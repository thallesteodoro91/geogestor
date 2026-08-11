export type OpenDiagnosticsResult = { success: true; path: string } | { success: false; error: string };

export async function requestOpenDiagnosticsFolder(
  openFolder: (() => Promise<OpenDiagnosticsResult>) | undefined
): Promise<OpenDiagnosticsResult> {
  if (!openFolder) return { success: false, error: 'A pasta de diagnósticos está disponível somente no aplicativo desktop.' };
  try {
    return await openFolder();
  } catch {
    return { success: false, error: 'Não foi possível abrir a pasta de diagnósticos.' };
  }
}

