import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/geist-sans/index.css'
import './index.css'
import App from './App.tsx'

// Declarar a interface global para expor o objeto exposto pelo preload.js do Electron
declare global {
  interface Window {
    electronAPI?: {
      getApiToken: () => string;
      getApiPort?: () => number;
      setLocalSessionToken?: (token: string) => void;
      selectBackupBundle?: () => Promise<{ bundlePath: string; authorization: string; expiresAt: string } | null>;
      selectBackupRecoveryKit?: () => Promise<{ kit: Record<string, unknown>; fileName: string } | null>;
      selectDataDirectory?: () => Promise<string | null>;
      selectBackupDirectory?: () => Promise<string | null>;
      openBackupDirectory?: (directory: string) => Promise<void>;
        getBackupRecoveryStatus?: () => Promise<{ configured: boolean; confirmed: boolean; confirmedAt: string | null; keyId: string }>;
        confirmBackupRecovery?: (expectedKeyId: string) => Promise<{ configured: boolean; confirmed: boolean; confirmedAt: string | null; keyId: string }>;
      saveBackupRecoveryKit?: (kit: unknown) => Promise<string | null>;
      onShutdownBackupStatus?: (callback: (payload: { running: boolean; message: string; processedFiles?: number; processedBytes?: number; totalFiles?: number; totalBytes?: number }) => void) => () => void;
      openDiagnosticsFolder?: () => Promise<{ success: true; path: string } | { success: false; error: string }>;
      showDeadlineNotification?: (payload: { id: string; title: string; body: string; link: string }) => Promise<boolean>;
      onOpenDeadlineAlert?: (callback: (link: string) => void) => () => void;
      reportStartupMilestone?: (milestone: 'first-route-usable') => void;
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
