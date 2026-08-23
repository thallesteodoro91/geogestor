export type BackupProviderStatus = {
  adapter: 'synchronized-folder';
  availability: 'available' | 'not_configured' | 'unavailable';
  authentication: 'not_required' | 'required' | 'authenticated';
  upload: 'not_observable' | 'idle' | 'uploading' | 'failed';
  confirmation: 'unavailable' | 'pending' | 'confirmed' | 'failed';
  remoteId: string | null;
  remoteHash: string | null;
  confirmedAt: string | null;
  capabilities: {
    versioning: 'supported' | 'unsupported' | 'unknown';
    immutability: 'supported' | 'unsupported' | 'unknown';
    providerRestore: 'supported' | 'unsupported' | 'unknown';
  };
  error: string | null;
  message: string;
};

export interface BackupProviderAdapter {
  readonly id: BackupProviderStatus['adapter'];
  inspect(destinationDirectory: string | null): Promise<BackupProviderStatus>;
}

export class SynchronizedFolderBackupAdapter implements BackupProviderAdapter {
  readonly id = 'synchronized-folder' as const;

  async inspect(destinationDirectory: string | null): Promise<BackupProviderStatus> {
    const configured = Boolean(destinationDirectory?.trim());
    return {
      adapter: this.id,
      availability: configured ? 'available' : 'not_configured',
      authentication: 'not_required',
      upload: 'not_observable',
      confirmation: 'unavailable',
      remoteId: null,
      remoteHash: null,
      confirmedAt: null,
      capabilities: { versioning: 'unknown', immutability: 'unknown', providerRestore: 'unknown' },
      error: null,
      message: configured
        ? 'Destino separado configurado; a sincronização remota não pode ser confirmada pelo GeoGestor.'
        : 'Escolha uma pasta externa, de rede ou sincronizada para manter uma cópia fora do armazenamento local do aplicativo.'
    };
  }
}

export class BackupProviderService {
  private static adapter: BackupProviderAdapter = new SynchronizedFolderBackupAdapter();

  static inspect(destinationDirectory: string | null) {
    return this.adapter.inspect(destinationDirectory);
  }

  static setAdapterForTests(adapter: BackupProviderAdapter | null) {
    this.adapter = adapter || new SynchronizedFolderBackupAdapter();
  }
}
