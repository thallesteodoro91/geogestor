
# Plano: Adicionar Login com Google

## Visão Geral
Implementar autenticação via Google OAuth na página de login, permitindo que usuários façam login/cadastro com um clique usando suas contas Google.

## Etapas de Implementação

### 1. Configurar OAuth do Google
Usar a ferramenta `configure-social-auth` para:
- Gerar o módulo Lovable em `src/integrations/lovable/`
- Instalar o pacote `@lovable.dev/cloud-auth-js`
- Configurar o provedor Google OAuth

### 2. Modificar `src/pages/Auth.tsx`
Adicionar botão de login com Google:

```tsx
import { lovable } from "@/integrations/lovable/index";

// Função para login com Google
const handleGoogleSignIn = async () => {
  setLoading(true);
  try {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    
    if (error) {
      toast.error("Erro ao fazer login com Google");
    }
  } catch {
    toast.error("Erro ao conectar com Google");
  } finally {
    setLoading(false);
  }
};
```

### 3. Interface do Usuário
Adicionar botão de login com Google abaixo dos formulários de login/signup:

```tsx
<div className="relative my-4">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-background px-2 text-muted-foreground">
      ou continue com
    </span>
  </div>
</div>

<Button 
  type="button" 
  variant="outline" 
  className="w-full"
  onClick={handleGoogleSignIn}
  disabled={loading}
>
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    {/* Google icon SVG */}
  </svg>
  Continuar com Google
</Button>
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/integrations/lovable/` | Criar (automático) | Módulo gerado pela ferramenta configure-social-auth |
| `src/pages/Auth.tsx` | Modificar | Adicionar botão e função de login com Google |

---

## Resultado Esperado
- Botão "Continuar com Google" visível nas abas de Login e Criar Conta
- Usuários podem fazer login/cadastro com um clique usando conta Google
- Fluxo de redirecionamento OAuth funcional
- Integração com o sistema de autenticação existente
