

## Corrigir Assinatura do Dono do SaaS

### Problema Raiz
A correção de codigo anterior esta correta, mas os dados no banco de dados estao errados. Seu tenant esta associado ao plano "Completo" com status "trialing" expirado, quando deveria estar no plano "Owner" com status "active".

### Solucao
Executar uma migracao SQL para atualizar o registro da assinatura do seu tenant:

1. Alterar o `plan_id` para apontar para o plano "Owner" (`a49be20d-8285-4c02-946a-b42250ba1c9f`)
2. Alterar o `status` de "trialing" para "active"
3. Remover a data de expiracao (`current_period_end` = null) -- plano Owner nao expira

### Detalhes Tecnicos

**Migracao SQL a ser executada:**
```sql
UPDATE tenant_subscriptions
SET 
  plan_id = 'a49be20d-8285-4c02-946a-b42250ba1c9f',
  status = 'active',
  current_period_end = NULL,
  updated_at = NOW()
WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
```

Isso resolve o problema de forma definitiva -- nenhuma alteracao de codigo necessaria, apenas a correcao dos dados.

