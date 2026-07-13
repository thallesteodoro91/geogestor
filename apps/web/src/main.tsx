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
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
