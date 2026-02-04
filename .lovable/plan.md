

# Plano: Sistema de Proteção contra Falhas (Error Boundary)

## Objetivo
Implementar um sistema robusto de captura de erros para a aplicação React, incluindo:
1. Error Boundary para erros de renderização
2. Global Error Handler para Promises não tratadas (falhas de rede, etc.)

## Arquitetura da Solução

### 1. Componente ErrorBoundary: `src/components/ui/error-boundary.tsx`

Componente React Class que implementa `componentDidCatch` e `getDerivedStateFromError`:

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }
  
  handleReload = () => {
    window.location.reload();
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}
```

### 2. Design da Tela de Erro

Layout visual amigável e profissional:

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                    ⚠️ (AlertTriangle)                       │
│                                                             │
│                   Algo deu errado                           │
│                                                             │
│     Ocorreu um erro inesperado. Por favor, tente           │
│     recarregar a página. Se o problema persistir,          │
│     entre em contato com o suporte.                         │
│                                                             │
│                  [  Tentar novamente  ]                     │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Elementos visuais:**
- Ícone `AlertTriangle` do Lucide React em cor destrutiva
- Título grande e claro
- Texto explicativo breve
- Botão primário "Tentar novamente" que recarrega a página
- Centralizado vertical e horizontalmente
- Suporta tema claro/escuro automaticamente

### 3. Global Error Handler: `src/lib/global-error-handler.ts`

Utilitário para capturar erros não tratados:

```typescript
import { toast } from "sonner";

export function setupGlobalErrorHandler() {
  // Capturar rejeições de Promise não tratadas
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[GlobalErrorHandler] Unhandled Promise rejection:', event.reason);
    
    // Mensagem genérica para o usuário
    toast.error("Erro de conexão", {
      description: "Não foi possível completar a operação. Verifique sua conexão e tente novamente.",
    });
    
    // Prevenir que o erro apareça no console duplicado
    event.preventDefault();
  });
  
  // Capturar erros JavaScript não tratados
  window.addEventListener('error', (event) => {
    // Ignorar erros de scripts externos (CORS)
    if (event.filename && !event.filename.includes(window.location.origin)) {
      return;
    }
    
    console.error('[GlobalErrorHandler] Uncaught error:', event.error);
    
    toast.error("Erro inesperado", {
      description: "Algo deu errado. Por favor, recarregue a página.",
    });
  });
}
```

### 4. Integração no main.tsx

Estrutura atualizada:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { setupGlobalErrorHandler } from "@/lib/global-error-handler";
import App from "./App.tsx";
import "./index.css";

// Inicializar handler global de erros
setupGlobalErrorHandler();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
```

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/ui/error-boundary.tsx` | **Criar** - Componente Error Boundary |
| `src/lib/global-error-handler.ts` | **Criar** - Handler global de erros |
| `src/main.tsx` | **Modificar** - Adicionar StrictMode e ErrorBoundary |

## Detalhes Tecnicos

### ErrorBoundary Props

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode; // Opcional: componente customizado de fallback
}
```

### Estilizacao do Fallback

Usando Tailwind CSS seguindo o design system:

```typescript
<div className="min-h-screen flex items-center justify-center bg-background">
  <div className="text-center space-y-6 p-8 max-w-md">
    <div className="flex justify-center">
      <AlertTriangle className="h-16 w-16 text-destructive" />
    </div>
    <h1 className="text-2xl font-heading font-bold text-foreground">
      Algo deu errado
    </h1>
    <p className="text-muted-foreground">
      Ocorreu um erro inesperado. Por favor, tente recarregar a pagina.
      Se o problema persistir, entre em contato com o suporte.
    </p>
    <Button onClick={handleReload} size="lg">
      Tentar novamente
    </Button>
  </div>
</div>
```

### Tipos de Erros Capturados

| Tipo | Handler | Acao |
|------|---------|------|
| Erro de renderizacao React | ErrorBoundary | Tela de erro com reload |
| Promise nao tratada | `unhandledrejection` | Toast de erro |
| Erro JavaScript global | `error` event | Toast de erro |
| Erro de rede (Supabase) | `unhandledrejection` | Toast de erro |

### Fluxo de Execucao

```text
1. Aplicacao inicia
           │
           ▼
2. setupGlobalErrorHandler() registra listeners
           │
           ▼
3. ErrorBoundary envolve <App />
           │
           ├─────────────────────────────────────────┐
           │                                         │
           ▼                                         ▼
4a. Erro de renderizacao                     4b. Erro de Promise/JS
    (React lifecycle)                            (async/await, fetch)
           │                                         │
           ▼                                         ▼
5a. getDerivedStateFromError()              5b. window event listener
    captura o erro                               captura o erro
           │                                         │
           ▼                                         ▼
6a. Renderiza ErrorFallback                 6b. Exibe Toast de erro
    com botao "Tentar novamente"                 via Sonner
```

## Beneficios

1. **UX Amigavel**: Usuario nao ve tela branca - sempre tem feedback visual
2. **Acao Clara**: Botao "Tentar novamente" oferece caminho de recuperacao
3. **Cobertura Completa**: Captura erros sincronos e assincronos
4. **Design Consistente**: Segue o design system da aplicacao
5. **Logging**: Erros sao logados no console para debug
6. **Nao Intrusivo**: Toasts para erros menores, tela completa so para falhas criticas

