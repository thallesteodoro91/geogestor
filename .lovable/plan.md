

## Simplificacao do SaaS: Conta Admin Ilimitada + Plano Unico

---

### Contexto Atual

- Existem 5 planos no banco: **Trial**, **Owner**, **Completo Mensal**, **Completo Semestral**, **Completo Anual**
- Novos tenants recebem automaticamente o plano Trial (7 dias) via funcao `create_tenant_for_user`
- A conta admin (tenant "teste") ja usa o plano Owner com limites altos e expiracao em 2099
- O `ProtectedRoute` bloqueia acesso quando o trial expira, mas nao distingue o plano Owner

### Mudancas Planejadas

#### 1. Garantir que conta Owner nunca seja bloqueada

Alterar `ProtectedRoute.tsx` para ignorar verificacao de expiracao quando o plano e "owner":

```
if (subscription?.plan?.slug === 'owner') -> pular verificacao
```

Alterar `usePlanLimits.ts` para retornar limites ilimitados quando `planSlug === 'owner'`, garantindo que nenhum toast de limite apareca.

#### 2. Simplificar para 1 plano de cliente

Manter apenas **2 planos** no banco:
- **Owner** (slug: `owner`) -- para a conta admin, sem limites
- **Completo** (slug: `completo`) -- plano unico para clientes, com todas as funcionalidades

Acoes no banco de dados:
- Remover planos: `trial`, `completo-semestral`, `completo-anual`
- Renomear `completo-mensal` para `completo` (atualizar slug e nome)
- Migrar o tenant "SkyGeo" (atualmente em Trial expirado) para o plano Completo

#### 3. Atualizar funcao de onboarding

Alterar a funcao `create_tenant_for_user` no banco para atribuir o plano **Completo** (ao inves de Trial) a novos tenants, com status `trialing` e 7 dias de trial. Assim novos clientes ja entram no plano correto com periodo de avaliacao.

#### 4. Atualizar interface

- `PlanInfoCard.tsx`: Remover logica de "Trial" badge, simplificar para mostrar "Completo" ou "Owner"
- `SubscriptionExpiredScreen.tsx`: Ajustar texto para referenciar o plano unico
- `usePlanLimits.ts`: Adicionar verificacao `isOwner` para bypass de limites

---

### Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/components/ProtectedRoute.tsx` | Bypass de expiracao para plano Owner |
| `src/hooks/usePlanLimits.ts` | Limites ilimitados para Owner |
| `src/components/plan/PlanInfoCard.tsx` | Simplificar exibicao para 1 plano |
| `src/components/plan/SubscriptionExpiredScreen.tsx` | Ajustar texto |
| Migracao SQL | Remover planos extras, renomear completo-mensal, atualizar `create_tenant_for_user` |

