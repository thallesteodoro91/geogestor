# Plano: Correções Google Login + ART no Orçamento

## Parte 1 — Login Google

### Diagnóstico
O código já usa `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` corretamente (padrão Lovable Cloud Managed OAuth). Os secrets `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` estão presentes. O fluxo OAuth atual está tecnicamente correto — o ponto de falha mais provável é:

1. **Ambiente de preview** (`id-preview--…lovable.app`) — o proxy de fetch da preview interfere em chamadas para `/auth/v1/token`, gerando "Failed to fetch" silencioso no callback. Esse caso já é tratado em produção (URL publicada `geogestor.lovable.app` funciona).
2. **Falta de tratamento do callback** quando o usuário retorna com `error=...` ou `error_description=...` na URL (ex: provider_email_needs_verification, server_error).
3. **Identidades não vinculadas automaticamente** quando o email já existe via senha — hoje mostramos toast mas não há fluxo de vinculação.
4. **Sessão pendurada** — após erro de OAuth, eventual sessão parcial não é limpa, mantendo o usuário em loop.

### Mudanças

**`src/pages/Auth.tsx`**
- Adicionar `useEffect` que detecta `error`, `error_code`, `error_description` no `window.location.hash`/`search` ao montar. Limpar a URL (`history.replaceState`) e exibir toast claro mapeado:
  - `provider_email_needs_verification` → "Verifique seu email no Google antes de continuar."
  - `server_error` / `unexpected_failure` → "Erro temporário no provedor. Tente novamente."
  - `access_denied` → "Login cancelado."
  - genérico → mostra `error_description`.
- Adicionar `console.error("[google-oauth]", …)` com o objeto bruto para debug técnico.
- Em `handleGoogleSignIn`: antes da chamada, fazer `await supabase.auth.signOut({ scope: "local" })` para evitar conflito com sessão antiga. Log de início do fluxo.
- Após o `signInWithOAuth` retornar com erro `email_exists` / `identity_already_exists`: mostrar toast com ação "Fazer login com senha" que pré-preenche email e leva à aba Login.

**Lovable Cloud Auth (manual, fora do código)**
- Documentar na resposta final que para **vincular automaticamente** identidade Google a usuário existente, o admin precisa habilitar **Manual Linking** em Cloud → Users → Auth Settings → Identities. Não é configurável via código.
- Após login Google bem-sucedido o fluxo já cai em `handlePostLoginRedirect` → `/` (Dashboard 360). Sem mudança necessária.

**Testes manuais (no plano, não automatizados):**
- Usuário novo via Google, usuário existente com mesma conta Google, usuário só email/senha tenta Google (toast claro), logout + relogin, callback com `error_description`.

### Por que não mexer em mais nada
Não vamos: alterar `redirect_uri`, modificar `window.fetch`, adicionar CORS, mexer em `src/integrations/lovable/`, ou reconfigurar provedor. Esses são anti-padrões conhecidos nesse contexto (vide stack-overflow do projeto).

---

## Parte 2 — ART no Orçamento

Reaproveitar o padrão existente do "Marco" (toggle + valor que compõe total mas com tratamento próprio). Diferença chave: **Marco aparece no resumo financeiro interno como linha; ART também aparece no resumo interno, mas no PDF final entregue ao cliente NÃO aparece como item separado** — soma silenciosa no total.

### Schema (migration)
Adicionar 2 colunas em `fato_orcamento`:
- `incluir_art boolean default false`
- `valor_art numeric default 0`

Sem trigger, sem alteração de RLS (já cobre a tabela). Atualizar `src/integrations/supabase/types.ts` é automático.

### Backend tipo
**`src/modules/finance/services/orcamento.service.ts`** — adicionar `incluir_art?: boolean | null` e `valor_art?: number | null` na interface `Orcamento`.

### Wizard de Orçamento
**`src/components/orcamento/OrcamentoWizard.tsx`**
- Adicionar ao defaultValues / reset: `incluir_art`, `valor_art`.
- `watch` desses dois campos.
- Em `calcularTotais()`: somar `valorArt = watchedIncluirArt ? toNum(watchedValorArt) : 0` à `receitaEsperada` ANTES do cálculo de imposto (ART entra na base tributável — consistente com a regra "Serviços + ART + Impostos - Descontos = Total").
  - Fórmula: `receitaEsperada = (receitaBruta - descontoTotal) + valorArt`
  - Imposto incide sobre `receitaEsperada` (já é o comportamento atual).
- Renderizar nova seção na UI próxima ao bloco "Marco":
  - `Switch` "Incluir ART (Anotação de Responsabilidade Técnica)"
  - Quando ativo: input numérico de valor (R$), aceita formato BR (já há helper de parsing — usar mesmo padrão dos outros campos numéricos do wizard).
  - Validação: se ligado, `valor_art > 0` (Zod inline ou check no submit).
- No resumo financeiro do modal (área do passo final / `Calcular totais`): adicionar linha "ART" com o valor, apenas quando incluído. Esse resumo é **interno**, não é o PDF.
- No submit (`onSubmit`): persistir `incluir_art`, `valor_art` (zerado se desligado), e garantir que `receita_esperada` salva já inclui ART.

### Edição
O carregamento de orçamento existente (linha 187 do wizard) precisa hidratar `incluir_art` / `valor_art` a partir do registro.

### PDF / Proposta
**`src/lib/pdfTemplateGenerator.ts`** e **`src/lib/pdfReportGenerator.ts`**
- ART **não** entra na tabela de itens da proposta.
- Total final (`receita_esperada`) já contém ART (somado no wizard antes de salvar) → o PDF naturalmente mostra o total correto sem mudança.
- **Auditar** os dois geradores para garantir que nenhum loop adiciona ART como linha. Se houver agregação por item (`fato_orcamento_itens`), confirmar que ART não é inserido como item — só fica na coluna `valor_art` do orçamento mestre.
- Nenhuma alteração visual no template é necessária; apenas garantir não-discriminação.

### KPIs / Dashboards
Como `receita_esperada` no banco já contém o valor da ART, todas as KPIs/dashboards (`get_financial_dashboard_metrics`, `vw_kpis_financeiros`, etc.) refletem automaticamente sem alteração de SQL.

### Categoria "ART" pré-existente
Verificar via `supabase--read_query` se há categoria de serviço/despesa "ART" cadastrada. Caso exista, **não criar duplicata** — apenas documentar que o valor agora vive em coluna própria do orçamento (não como item de serviço nem despesa). A categoria pode permanecer para fins de relatórios futuros sem conflito.

### Validações
- Submit bloqueia se `incluir_art && (!valor_art || valor_art <= 0)` com toast "Informe um valor de ART maior que zero".
- Parse aceita "150,00", "R$ 150,00", "150.00" — usar mesmo parser numérico utilizado por `valor_unitario`/`marco_valor_unitario`.

---

## Arquivos alterados
- `src/pages/Auth.tsx`
- `src/components/orcamento/OrcamentoWizard.tsx`
- `src/modules/finance/services/orcamento.service.ts`
- migration: adicionar `incluir_art` + `valor_art` em `fato_orcamento`
- (auditoria, possível ajuste mínimo) `src/lib/pdfTemplateGenerator.ts`, `src/lib/pdfReportGenerator.ts`

## Fora do escopo
- Vinculação automática de identidade Google (depende de toggle em Cloud Auth Settings — manual).
- Mudanças em RLS / triggers.
- Alteração de KPIs SQL (cobertura via `receita_esperada` já consolidada).
