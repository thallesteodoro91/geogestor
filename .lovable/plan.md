
## Bug 1 — Reset de Senha

**Causa raiz:** `resetPasswordForEmail` redireciona para `/auth?type=recovery`, mas o `useEffect` em `Auth.tsx` chama `handlePostLoginRedirect()` assim que detecta qualquer sessão (incluindo a sessão temporária de recovery criada pelo Supabase ao processar o link). Resultado: o usuário é jogado direto para `/` (ou para a conta que já estava logada), sem nunca ver a tela para digitar nova senha. Não existe rota dedicada `/reset-password`.

### Mudanças

1. **Criar `src/pages/ResetPassword.tsx`** (rota pública, fora do `ProtectedRoute`):
   - Detecta `type=recovery` no hash/query da URL.
   - Processa o token usando `supabase.auth.exchangeCodeForSession` (fluxo PKCE moderno) com fallback para `verifyOtp({ type: 'recovery', token_hash })` quando vier `token_hash` no link clássico.
   - Antes de processar o token: se já houver sessão de outro usuário, faz `supabase.auth.signOut({ scope: 'local' })` para não contaminar o reset.
   - Mostra formulário com **Nova senha** + **Confirmar senha** (validação mínima 6 chars + match).
   - Em sucesso: `updateUser({ password })`, depois `signOut()` e redireciona para `/auth` com toast: *"Senha redefinida com sucesso. Faça login novamente."*
   - Em token inválido/expirado: estado de erro com mensagem *"Link expirado ou inválido. Solicite uma nova redefinição."* e botão para voltar ao login.
   - NÃO depende de usuário estar logado nem usa `ProtectedRoute`.

2. **Editar `src/App.tsx`**: adicionar `<Route path="/reset-password" element={<ResetPassword />} />` (público).

3. **Editar `src/pages/Auth.tsx`**:
   - Em `handleForgotPassword`: trocar `redirectTo` para `${window.location.origin}/reset-password`.
   - No `useEffect` de auto-redirect: ignorar a sessão se a URL contiver `type=recovery` (defesa em profundidade, caso o usuário caia aqui acidentalmente).
   - Toast pós-reset (quando vier com `?reset=success`): mostrar mensagem de sucesso.

4. **Atualizar `src/components/settings/AccountTab.tsx`**: mesmo `redirectTo` apontando para `/reset-password`.

## Bug 2 — Login com Google

**Diagnóstico:** O fluxo usa `lovable.auth.signInWithOAuth("google", ...)` que está correto para Cloud-managed. O erro do "usuário principal" provavelmente é: a conta foi criada originalmente por email/senha; ao tentar Google com o mesmo email, o Supabase rejeita por padrão (identity linking desabilitado), retornando algo como *"User already registered"* ou um erro de conflito de identidade. Isso quebra o sign-in sem mensagem útil.

### Mudanças

1. **Habilitar manual linking** no Supabase Auth (via `configure_auth` se exposto, senão documentar): permitir que provedores OAuth se vinculem a usuários existentes com o mesmo email verificado. *Nota: na Lovable Cloud isso é controlado pelo flag `MAILER_AUTOCONFIRM`/identity linking — vou aplicar via migração de config ou orientar setting.*

2. **Tratamento de erro em `handleGoogleSignIn`** (`Auth.tsx`):
   - Capturar erro específico `identity_already_exists` / `email_exists` e mostrar:
     *"Este email já tem conta com senha. Faça login com email e senha, depois vincule o Google em Configurações."*
   - Outros erros: manter mensagem genérica mais descritiva (`error.message` quando seguro).

3. **Validar configuração OAuth** (sem mudança de código se já correto):
   - `redirect_uri: window.location.origin` ✓ (já usa o broker `~oauth`).
   - Conferir que `GOOGLE_CLIENT_ID`/`SECRET` estão presentes (já listados em secrets).
   - Não há duplicação, pois usamos OAuth managed; a checagem de "mesma conta" passa pelo identity linking acima.

4. **NÃO** alterar dados existentes — o linking preserva o `auth.users.id` original, então `tenant_members`, `profiles` e tudo mais permanecem intactos.

## Arquivos

- **Criar:** `src/pages/ResetPassword.tsx`
- **Editar:** `src/App.tsx`, `src/pages/Auth.tsx`, `src/components/settings/AccountTab.tsx`

## Testes manuais (lista para validar após implementação)

- Reset: deslogado / logado em outra conta / conta nova / link expirado → todos devem cair em `/reset-password` e permitir trocar a senha (ou mostrar erro claro).
- Google: novo usuário / usuário existente com mesmo email (após habilitar linking) / logout-login → preservar dados do tenant principal.
