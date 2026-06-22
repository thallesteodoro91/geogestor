
# Plano — Rodada 1 do Audit GeoGestor (22/06/2026)

Foco: os 7 bloqueadores antes de cliente pagante. Achados "não bloqueadores" ficam para a Rodada 2.

## 1. Corrigir RPC `get_financial_dashboard_metrics` (receita realizada vs pipeline)

Migração SQL substituindo a função:
- `receita_total` → `SUM(receita_realizada)` (mesma semântica de `vw_kpis_financeiros`).
- Adicionar `receita_pipeline` = `SUM(receita_esperada) FILTER (WHERE orcamento_convertido = false)`.
- `lucro_por_cliente` → usar `lucro_realizado` (ou `receita_realizada - custo_real` agregado), não `lucro_esperado`.
- `margem_por_servico` segue usando `receita_servico`/`custo_servico` (já é realizado).
- Manter assinatura JSON para não quebrar `useDashboardMetrics` e telas consumidoras.

## 2. Proteger `trial-expiry-reminder` com `CRON_SECRET`

Já existe pattern em `simulate-expiry`. Editar `supabase/functions/trial-expiry-reminder/index.ts`:
- Validar header `x-cron-secret` contra `Deno.env.get("CRON_SECRET")` antes de qualquer query/envio. 401 se inválido.
- (Nota: a entrada de contexto resumida diz que isso já foi feito numa rodada anterior — vou conferir o arquivo e só agir se ainda estiver desprotegido.)

## 3. Enforcement server-side dos limites de plano (clientes/propriedades)

Nova migração:
- Função `public.check_resource_limit(p_tenant_id uuid, p_resource text)` SECURITY DEFINER que conta linhas em `dim_cliente`/`dim_propriedade` e compara com `subscription_plans.max_clients`/`max_properties`.
- Triggers `BEFORE INSERT` em `dim_cliente` e `dim_propriedade` chamando essa função e dando `RAISE EXCEPTION 'plan_limit_exceeded:<resource>'` quando estourar.
- Frontend (`ClienteDialog`, `PropriedadeDialog`, `UniversalImporter`) já mostra UX amigável; adicionar catch do erro `plan_limit_exceeded:*` traduzindo para toast.

## 4. Pipeline de qualidade verde

- Adicionar script `"test": "vitest run"` em `package.json`.
- Resolver peer dep: downgrade de `date-fns` para `^3.6.0` (compatível com `react-day-picker@8`) — alternativa menos invasiva que trocar o picker. `bun add date-fns@^3.6.0` regenera lockfile.
- Corrigir os 2 testes quebrados em `src/components/dashboard/KPICard.test.tsx` (atualizar expectativas para `text-success`/`bg-success/10` e `bg-muted/30`, refletindo o componente atual).
- Lint: 328 erros é fora do escopo de "rodada curta"; **não vou zerar lint nesta rodada**. Vou apenas garantir que `tsc` e build passem. Sinalizo isso explicitamente para você decidir se quer uma sub-rodada só para lint.

## 5. Vulnerabilidade `xlsx`

`xlsx` da SheetJS no npm tem CVEs sem patch. Substituir por **`exceljs`** (mantido, sem CVEs ativos) nos pontos do importador (`SmartImporter`, `UniversalImporter`, helpers em `src/lib/etl/*`).
- Manter API interna (`parseWorkbook(file): Row[][]`) para minimizar mudança nas telas.
- Adicionar limites: tamanho máx do arquivo (ex.: 10 MB) e número máx de linhas (ex.: 50k) antes do parse.

## 6. Bug do `id_propriedade` em `fato_servico` no importador

Em `UniversalImporter.tsx`, replicar a mesma correção do insert de orçamento no insert de `fato_servico`: quando `r.id_propriedade` for um ID temporário do `relationResolver`, substituir pelo ID real recém-criado em `dim_propriedade` (mesmo lookup map já usado para orçamentos).

## 7. (Já feito) Verificação dupla de itens da rodada anterior

Antes de mexer, vou conferir o estado atual de:
- `trial-expiry-reminder` (item 2) — pelo histórico já tem CRON_SECRET.
- RLS / outros itens marcados como concluídos nas mensagens anteriores.
Só edito o que ainda estiver pendente.

## Arquivos previstos

- `supabase/migrations/<nova>.sql` — RPC corrigida + triggers de limite.
- `supabase/functions/trial-expiry-reminder/index.ts` — se ainda sem guarda.
- `src/components/import/UniversalImporter.tsx` — fix `id_propriedade` + integração `exceljs`.
- `src/components/import/SmartImporter.tsx` e `src/lib/etl/*` — troca `xlsx` → `exceljs`.
- `src/components/cadastros/ClienteDialog.tsx`, `PropriedadeDialog.tsx` — tratar erro `plan_limit_exceeded`.
- `src/components/dashboard/KPICard.test.tsx` — atualizar 2 asserts.
- `package.json` — script `test`, troca `xlsx`→`exceljs`, ajuste `date-fns`.

## Fora de escopo desta rodada (Rodada 2 do audit)

- Zerar 328 erros de lint.
- Padronizar CORS em todas as Edge Functions.
- Sincronização total `plan_id`/`price_id` Stripe.
- Code-splitting / chunks grandes.
- Renomear `vite_react_shadcn_ts` no `package.json`.
- E2E autenticado.

## Pontos para confirmar antes de implementar

1. **`date-fns` downgrade** para v3: alguns lugares podem usar APIs novas da v4. Se preferir manter v4, alternativa é trocar `react-day-picker` para v9 (mais invasivo no UI do calendário). Posso ir de downgrade por padrão; ok?
2. **Trigger de limite**: bloquear `INSERT` direto é o correto, mas isso também bloqueia o seeder/importador legítimo se o tenant estourar. Confirma que importação acima do limite deve falhar item-a-item com erro claro?
3. **`xlsx` → `exceljs`**: muda a forma de leitura (API assíncrona baseada em streams). Vou encapsular para minimizar diff, mas é uma troca real de lib. Pode prosseguir?
