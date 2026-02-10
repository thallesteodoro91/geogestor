

## Correcao de Dois Problemas: Aviso de Limite Falso + Scroll das Observacoes

### Problema 1: Aviso de "Limite Atingido" Permanente

**Causa raiz identificada**: O hook `usePlanLimits.ts` retorna valores padrao quando o plano ainda nao foi carregado (`plan === null`). Esses valores padrao definem `isWithinLimit: () => false` e `isActive: false`, o que faz o sistema mostrar o alerta de limite atingido mesmo que o plano Owner esteja correto no banco de dados.

O banco de dados esta correto -- o plano Owner esta ativo com 99.999 clientes permitidos e 0 clientes cadastrados. O problema e puramente no frontend: durante o carregamento (ou se qualquer atraso ocorrer), o alerta aparece incorretamente.

**Solucao**: Modificar `usePlanLimits.ts` para considerar o estado de carregamento. Quando os dados ainda estao sendo carregados, os metodos `isWithinLimit` e `checkAndNotify` devem retornar `true` (permitir) em vez de `false` (bloquear), evitando falsos alertas.

Adicionalmente, modificar `ClientePropriedadeUnificadoDialog.tsx` para nao mostrar o alerta de limite enquanto os dados estiverem carregando.

### Problema 2: Area de Observacoes sem Scroll

**Causa raiz**: O `DialogContent` usa `max-h-[90vh] flex flex-col` e o `ScrollArea` usa `flex-1`, mas sem uma altura concreta calculada, o `ScrollArea` do Radix nao consegue determinar quando ativar a barra de rolagem. Isso faz com que o conteudo do formulario fique cortado na parte inferior, especialmente o campo de Observacoes.

**Solucao**: Adicionar `overflow-hidden` ao container e garantir que o `ScrollArea` tenha altura resolvida via `min-h-0` no container flex, alem de adicionar uma altura maxima explicita ao `ScrollArea`.

### Detalhes Tecnicos

#### Arquivo: `src/hooks/usePlanLimits.ts`

- Importar `isLoading` do `useTenant()` (ja disponivel no TenantContext)
- Exportar `isLoading` no retorno do hook
- Alterar os defaults quando `plan` e null:
  - `isWithinLimit: () => true` (permitir durante carregamento)
  - `checkAndNotify: () => true` (permitir durante carregamento)
  - `isActive: true` (assumir ativo durante carregamento)

#### Arquivo: `src/contexts/TenantContext.tsx`

- Nenhuma mudanca necessaria -- `isLoading` ja e exposto

#### Arquivo: `src/components/cadastros/ClientePropriedadeUnificadoDialog.tsx`

- Usar o `isLoading` do `usePlanLimits` para nao calcular `isAtClientLimit` enquanto carrega
- Corrigir o `ScrollArea`: trocar `className="flex-1 pr-4"` para `className="flex-1 min-h-0 max-h-[calc(90vh-220px)] pr-4"` para garantir que a barra de rolagem funcione
- Isso resolve tanto o scroll do conteudo quanto a visibilidade do campo de Observacoes

#### Arquivo: `src/components/cadastros/ClienteDialog.tsx`

- Mesma correcao de loading para `canAddClient`: considerar o estado de carregamento do plano

### Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/usePlanLimits.ts` | Exportar `isLoading`, defaults permissivos durante carregamento |
| `src/components/cadastros/ClientePropriedadeUnificadoDialog.tsx` | Considerar loading no alerta de limite + corrigir altura do ScrollArea |
| `src/components/cadastros/ClienteDialog.tsx` | Considerar loading no calculo de `canAddClient` |

