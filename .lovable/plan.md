
# Importação resiliente: zero perda de progresso

## Diagnóstico
`src/components/import/UniversalImporter.tsx` é o único modal do fluxo (SmartImporter é wrapper). O `DialogContent` já bloqueia `onPointerDownOutside`, `onInteractOutside` e `onEscapeKeyDown` — porém:

- O botão **X** nativo do `DialogContent` ainda fecha o modal e chama `handleClose(false)`, que faz `reset()` imediato (linha 91–94) → perda total de progresso.
- `Cancelar` no rodapé idem.
- Nenhuma persistência: trocar de aba não fecha, mas qualquer refresh ou navegação acidental zera tudo.
- Não há prompt de "retomar importação" ao reabrir.

Escopo: alterações **apenas** em `UniversalImporter.tsx` (+ um pequeno helper de storage). Nenhum outro modal do sistema é afetado.

## Plano

### 1. Confirmação ao sair com progresso
- Considerar que há "progresso" quando `step !== "upload"` **e** `step !== "result"` (ou seja: `validate` ou `importing`).
- Interceptar `onOpenChange(false)` e o clique no X:
  - Customizar o `DialogContent` para esconder o `X` padrão (`[&>button]:hidden`) e renderizar nosso próprio botão de fechar no header — assim controlamos 100% do fluxo de saída.
  - Se houver progresso → abrir um `AlertDialog` interno com:
    - Título: "Sair da importação?"
    - Mensagem: "Você tem uma importação em andamento. Se sair agora, o progresso será perdido."
    - Botões: **Continuar importação** (cancela) / **Sair mesmo assim** (confirma → limpa storage → `reset()` → fecha).
  - Sem progresso → fecha direto.
- `step === "importing"`: bloquear totalmente o fechamento (já existe parcialmente; reforçar — o X fica desabilitado e o AlertDialog não abre, apenas um toast "Aguarde a importação terminar").

### 2. Persistência de progresso (sessionStorage)
Criar `src/lib/etl/importDraft.ts` com helpers tipados:
```ts
saveDraft(draft), loadDraft(), clearDraft(), hasDraft()
```
Chave única por tenant: `geogestor:importDraft:v1:<tenantId>`. Armazena:
- `step` (`validate` apenas — `upload`/`importing`/`result` não fazem sentido persistir)
- `fileName`
- `headers`
- `rows` (limitado: se > 5.000 linhas, persistir apenas as primeiras 5.000 e marcar `truncated: true`; alertar o usuário no resume)
- `matches`
- `overrides`
- `savedAt` (ISO)

Hooks no `UniversalImporter`:
- Após `parseFile` concluir e ir para `validate` → `saveDraft(...)`.
- Em todo `setOverrides` → `saveDraft(...)` (debounced 300 ms via `useEffect` sobre `overrides`).
- Em sucesso do `runImport` (`step === "result"`) → `clearDraft()`.
- Em "Sair mesmo assim" → `clearDraft()`.
- No `reset()` chamado pela conclusão normal → `clearDraft()`.

### 3. Retomar importação ao reabrir
- No `useEffect([open])`, quando `open === true` **e** `step === "upload"` **e** `hasDraft()`:
  - Abrir um `AlertDialog`: "Encontramos uma importação em andamento de **{fileName}** ({headers.length} colunas, {rows.length} linhas, salva em {savedAt}). Deseja continuar de onde parou?"
  - Botões: **Continuar de onde parei** (restaura headers/rows/matches/overrides, vai para `validate`) / **Começar nova importação** (`clearDraft()` + permanece em `upload`).
- Se a planilha original tinha sido truncada na persistência, mostrar aviso amarelo no topo do painel de validação: "Algumas linhas não foram preservadas. Reenvie a planilha para validar todas."

### 4. Sem timeouts / sem reset automático
Auditar o componente para garantir que nenhum `setTimeout`/`setInterval` faça reset. (Confirmado: hoje não há — manter assim e adicionar comentário explicando.)

### 5. UX / acessibilidade
- O AlertDialog de saída tem foco no botão "Continuar importação" (ação segura).
- Botão custom de fechar com `aria-label="Fechar importação"`.
- Durante `importing`: X desabilitado com tooltip "Aguarde a importação terminar".

### 6. Testes
Adicionar `src/components/import/UniversalImporter.exitGuard.test.tsx` (vitest + testing-library):
- Confirma que clicar X em `validate` abre o AlertDialog e **não** fecha.
- Clicar "Sair mesmo assim" fecha e limpa storage.
- `saveDraft`/`loadDraft`/`clearDraft` round-trip (`importDraft.test.ts`).

## Arquivos
**Novos**
- `src/lib/etl/importDraft.ts`
- `src/lib/etl/importDraft.test.ts`
- `src/components/import/UniversalImporter.exitGuard.test.tsx`

**Editados**
- `src/components/import/UniversalImporter.tsx`

## Fora do escopo
- Outros modais do sistema (permanecem com comportamento padrão).
- Sincronização entre abas (sessionStorage é por aba, suficiente para o caso de uso).
- Persistir o `Step === "importing"` (operação em curso, não deve ser interrompível por reload).
