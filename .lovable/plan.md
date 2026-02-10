

## Plano Owner Ilimitado para o Administrador do SaaS

### Problema
O administrador/dono do SaaS esta sendo tratado como um cliente comum, sujeito aos limites do plano Trial (5 usuarios, 50 clientes, 25 propriedades, expira em 7 dias). Como dono da plataforma, ele precisa de acesso irrestrito.

### Solucao

Criar um plano "Owner" com limites altissimos e assinatura permanente via migracao SQL. Nenhuma mudanca de codigo e necessaria.

### Migracao SQL

1. **Criar plano "Owner"** na tabela `subscription_plans`:
   - `name`: "Owner"
   - `slug`: "owner"
   - `price_cents`: 0 (gratuito)
   - `interval`: "year"
   - `max_users`: 9999
   - `max_properties`: 99999
   - `max_clients`: 99999
   - `features`: todas habilitadas (incluindo `suporte_prioritario`)
   - `is_active`: true

2. **Atualizar a assinatura do tenant do usuario** (`3a7ebb04-00d0-4bc3-9e16-d212ec1b65cc`):
   - Trocar o `plan_id` para o novo plano Owner
   - Mudar `status` de "trialing" para "active"
   - Estender `current_period_end` para 2099-12-31 (efetivamente permanente)

### Detalhes Tecnicos

Sera uma unica migracao SQL com dois comandos:
- `INSERT INTO subscription_plans` para criar o plano Owner
- `UPDATE tenant_subscriptions` para vincular o tenant ao novo plano

Isso resolve o problema imediatamente sem nenhuma alteracao de codigo no frontend ou nos hooks de verificacao de limite, pois eles ja respeitam os valores do banco.

### Arquivos Modificados

| Tipo | Detalhe |
|------|---------|
| Migracao SQL | Criar plano Owner + atualizar assinatura do tenant |

Nenhum arquivo de codigo sera modificado.

