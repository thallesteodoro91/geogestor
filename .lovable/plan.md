
## Correcoes no Dialog de Editar Cliente (3 problemas)

### Problema 1: Aviso de limite do plano persistente
O sistema continua mostrando alertas de "limite atingido" mesmo apos criar o plano Owner. A solucao definitiva e remover completamente as verificacoes de plano dos dialogs de cliente, conforme solicitado.

### Problema 2: Label "anotacoes" e scroll cortado
O `ClienteDialog.tsx` (usado na pagina de detalhes do cliente) tem `overflow-y-auto` no `DialogContent`, mas o conteudo pode ficar cortado. O `ClientePropriedadeUnificadoDialog.tsx` (usado no Cadastros) ja tem o label "Observacoes" correto, mas o placeholder diz "Anotacoes sobre o cliente..." -- sera corrigido.

### Problema 3: Aba "Propriedades" desabilitada ao editar
No `ClientePropriedadeUnificadoDialog.tsx`, a aba Propriedades tem `disabled={isEditing}` (linha 297), impedindo o acesso ao editar. Sera habilitada e, em vez de bloquear, mostrara as propriedades existentes do cliente para consulta.

---

### Mudancas por arquivo

#### `src/components/cadastros/ClientePropriedadeUnificadoDialog.tsx`
- **Remover** imports de `usePlanLimits`, `useResourceCounts`, `PlanLimitAlert`
- **Remover** variaveis `isAtClientLimit`, `isAtPropertyLimit` e toda logica de limite
- **Remover** o bloco `{isAtClientLimit && <PlanLimitAlert .../>}` e `{isAtPropertyLimit && <PlanLimitAlert .../>}`
- **Remover** `disabled={isAtClientLimit}` do botao Salvar e `disabled={isAtPropertyLimit}` do botao Adicionar Propriedade
- **Remover** verificacao de limite no `onSubmit`
- **Habilitar aba Propriedades**: remover `disabled={isEditing}` do `TabsTrigger`
- **Carregar propriedades ao editar**: no `useEffect` quando `cliente` existe, buscar propriedades do banco (`dim_propriedade` filtrado por `id_cliente`) e popular o estado `propriedades`
- **Corrigir placeholder**: trocar "Anotacoes sobre o cliente..." por "Observacoes sobre o cliente..."

#### `src/components/cadastros/ClienteDialog.tsx`
- **Remover** imports de `usePlanLimits`, `useResourceCounts`, `PlanLimitAlert`
- **Remover** variaveis `canAddClient`, `planLoading`, `clientsCount`
- **Remover** `{!isEditing && <PlanLimitAlert .../>}`
- **Remover** verificacao de limite no `onSubmit`
- **Remover** `disabled={!isEditing && !canAddClient}` do botao Salvar
- **Trocar** label de "Observacoes" (ja correto) -- manter, mas corrigir placeholder "Observacoes sobre o cliente..."

#### `src/hooks/usePlanLimits.ts`
- Manter o arquivo sem alteracoes (outros componentes podem usa-lo)

### Detalhes tecnicos para a aba Propriedades no modo edicao

Ao abrir o dialog em modo edicao, o `useEffect` fara uma query:
```text
supabase.from('dim_propriedade')
  .select('*')
  .eq('id_cliente', cliente.id_cliente)
```

As propriedades existentes serao exibidas nos mesmos cards de formulario, permitindo visualizacao e edicao. O botao "Adicionar Propriedade" tambem ficara disponivel para vincular novas propriedades.

Ao salvar em modo edicao:
- Propriedades existentes (com `id`) serao atualizadas via `upsert`
- Propriedades novas (sem `id`) serao inseridas
