

## Plano: Expandir configurações de notificações de alertas financeiros

### O que será feito

Expandir a seção "Notificações" na página de Configurações com controles claros e bem explicados para:
1. Quantos dias antes do vencimento os alertas começam a aparecer (opções: 7, 15, 30 dias)
2. A cada quantos dias os alertas de pagamentos vencidos reaparecem nas notificações

### Mudanças

**Arquivo: `src/pages/Configuracoes.tsx`** (linhas ~525-555)

Expandir o card de Notificações adicionando, abaixo do Switch de "Alertas de Pagamento":

- **Select "Antecedência dos alertas"** — opções 7, 15 e 30 dias, com descrição explicativa: "Defina com quantos dias de antecedência você deseja ser notificado sobre pagamentos próximos do vencimento."
  - Salva em `tenant.settings.alert_days_threshold`
  
- **Select "Frequência de alertas vencidos"** — opções 1, 3, 5 e 7 dias, com descrição: "Após o vencimento, defina a cada quantos dias o sistema irá lembrá-lo novamente sobre pagamentos em atraso."
  - Salva em `tenant.settings.overdue_alert_frequency_days`

Ambos os selects ficam condicionalmente visíveis (só aparecem quando alertas estão ativados). Cada alteração salva imediatamente no tenant settings via `supabase.update` e chama `refetchTenant()`.

Nota: Esses campos já existem no `TenantSettingsCard.tsx` (configurações da empresa). Vou removê-los de lá para evitar duplicação, mantendo apenas na seção de Notificações que é o local mais intuitivo.

