
# Plano: Configurar GeoGestor como PWA Instalavel

## Visao Geral

Transformar o GeoGestor em um Progressive Web App (PWA) instalavel, permitindo que usuarios em campo instalem o app diretamente do navegador no celular, com acesso rapido pela tela inicial, carregamento offline e experiencia nativa.

## Etapas de Implementacao

### 1. Instalar dependencia `vite-plugin-pwa`

Adicionar o pacote `vite-plugin-pwa` ao projeto.

### 2. Configurar `vite.config.ts`

Adicionar o plugin `VitePWA` com as seguintes configuracoes:
- **registerType**: `autoUpdate` (atualiza o service worker automaticamente)
- **manifest**: Nome "GeoGestor", cores baseadas na paleta do design system (primary purple `#7c3aed`), icones PWA
- **workbox**: Estrategias de cache para assets estaticos e fontes Google

### 3. Criar icones PWA

Adicionar na pasta `public/`:
- `pwa-192x192.png` - Icone 192x192 (gerado via SVG inline)
- `pwa-512x512.png` - Icone 512x512
- `apple-touch-icon-180x180.png` - Icone para iOS

Como nao temos icones personalizados, criaremos um SVG simples com as iniciais "GG" (GeoGestor) usando as cores do design system, e o plugin gerara os icones necessarios.

### 4. Atualizar `index.html`

Adicionar meta tags essenciais para PWA:
- `<meta name="theme-color" content="#7c3aed">`
- `<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`

### 5. Criar componente `PWAPrompt.tsx`

Componente que aparece como banner fixo no rodape em dispositivos moveis:
- Detecta se o app ja esta instalado (via `display-mode: standalone`)
- Captura o evento `beforeinstallprompt` do navegador
- Exibe botao "Adicionar a Tela Inicial" com icone e texto explicativo
- Botao de fechar/dispensar (salva preferencia no localStorage)
- Design consistente com o design system (cores primary purple)
- Automaticamente oculto em desktop e quando ja instalado

### 6. Integrar `PWAPrompt` no `App.tsx`

Adicionar o componente `PWAPrompt` dentro do layout principal para que apareca em todas as paginas.

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `package.json` | Modificar | Adicionar `vite-plugin-pwa` |
| `vite.config.ts` | Modificar | Configurar plugin VitePWA com manifest |
| `index.html` | Modificar | Meta tags PWA (theme-color, apple-touch-icon) |
| `public/pwa-icon.svg` | Criar | Icone SVG base do GeoGestor |
| `public/pwa-192x192.png` | Criar | Icone PWA 192x192 |
| `public/pwa-512x512.png` | Criar | Icone PWA 512x512 |
| `public/apple-touch-icon-180x180.png` | Criar | Icone Apple Touch |
| `src/components/pwa/PWAPrompt.tsx` | Criar | Banner de instalacao mobile |
| `src/App.tsx` | Modificar | Incluir PWAPrompt |

---

## Detalhes Tecnicos

### Configuracao do vite-plugin-pwa

```typescript
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'pwa-icon.svg'],
  manifest: {
    name: 'GeoGestor - Gestao e Performance',
    short_name: 'GeoGestor',
    description: 'Sistema de gestao para topografia',
    theme_color: '#7c3aed',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com/,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-stylesheets' }
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com/,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } }
      }
    ]
  }
})
```

### PWAPrompt - Logica Principal

```typescript
// Captura o evento beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  setDeferredPrompt(e);
  setShowPrompt(true);
});

// Verifica se ja esta instalado
const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

// Verifica se usuario dispensou
const isDismissed = localStorage.getItem('pwa-prompt-dismissed');
```

### Design do Banner

- Posicao fixa no rodape (`fixed bottom-0`)
- Fundo com gradiente primary
- Texto branco com icone de download
- Botao "Instalar" e botao "X" para fechar
- Animacao de entrada suave (slide-up)
- Visivel apenas em mobile (hidden em `md:` breakpoint)

---

## Resultado Esperado

- App instalavel diretamente do navegador mobile
- Icone do GeoGestor na tela inicial do celular
- Carregamento mais rapido com cache de assets
- Banner discreto sugerindo instalacao para usuarios mobile
- Experiencia fullscreen sem barra do navegador apos instalacao
