

## Plano: Melhorias no Menu de Notificações e Verificação de Alertas

### 1. Mover botão "Limpar" para o canto inferior direito

Atualmente o botão "Limpar" fica no header junto com "Marcar todas". Será movido para um rodapé fixo no final do dropdown, posicionado à direita.

**Arquivo:** `src/components/layout/NotificationsMenu.tsx`
- Remover o botão "Limpar" do `DropdownMenuLabel` (linhas 127-140)
- Adicionar um rodapé após o `ScrollArea` com o botão "Limpar" alinhado à direita usando `flex justify-end`

### 2. Melhorar visibilidade dos itens no hover

O `DropdownMenuItem` usa `hover:bg-accent` (linha 153), mas os textos usam `text-muted-foreground` que pode ficar ilegível sobre o fundo de hover.

**Arquivo:** `src/components/layout/NotificationsMenu.tsx`
- Adicionar classes de hover nos textos da notificação para garantir contraste:
  - Mensagem: `group-hover:text-accent-foreground`
  - Timestamp: `group-hover:text-accent-foreground/70`
- O título já usa `text-foreground` ou `text-destructive`, que têm bom contraste

### 3. Verificação da lógica de alertas de pagamento

Analisei a função `verificar_pagamentos_pendentes()` no banco:

- **Pagamentos próximos**: Cria alerta quando faltam **3 dias ou menos** para vencer. Não duplica se já existe notificação do tipo `pagamento` para o mesmo orçamento **no mesmo dia**.
- **Pagamentos vencidos**: Cria alerta quando já passou a data. Não duplica se já existe notificação do tipo `vencido` nos **últimos 3 dias**, nem se foi descartada nos últimos 3 dias.

**Resumo da frequência**: Um alerta de "vencido" reaparece a cada **3 dias** enquanto o pagamento não for quitado. Isso está funcional e correto.

A verificação é disparada:
- 1x por sessão (controlada via `sessionStorage`, máximo 1x por hora)
- Via chamada `supabase.rpc('verificar_pagamentos_pendentes')` no hook `useNotifications`

**Nenhuma correção necessária** na lógica de alertas — está funcionando conforme esperado.

### Resumo das alterações

| Arquivo | Mudança |
|---------|---------|
| `NotificationsMenu.tsx` | Mover "Limpar" para rodapé inferior direito |
| `NotificationsMenu.tsx` | Melhorar contraste do texto no hover das notificações |

