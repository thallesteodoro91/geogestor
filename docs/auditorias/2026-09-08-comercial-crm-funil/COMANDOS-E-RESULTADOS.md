# Comandos e resultados — Sessão 03

## Ambiente e isolamento

- Windows, Node `v24.17.0`, pnpm `11.8.0`, GeoGestor `1.0.4`, commit inicial `a16551a`, branch `main`.
- Frontend/API reais em portas loopback aleatórias; scheduler desativado no ambiente controlado.
- Cada run criou banco, arquivos, build e relatórios sob `scratch/commercial-e2e/run-<id>`.
- Banco real não tocado: `data/geogestor.db`, 1.990.656 bytes, `30/08/2026 14:12:58`, SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` antes e depois.
- Viewports: 360×800, 768×900, 1024×768 e 1440×900; temas claro e escuro.

## Teste vermelho

```text
POST /api/contatos {"nome":"   "} → 200 (esperado 400)
```

O resultado reproduziu `S03-F01` antes da alteração.

## Verificação final

```text
node scripts/run-commercial-e2e.mjs tests/e2e/session03-crm-funnel.spec.ts
3 passed (56.4s); exit 0

node apps/api/node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 --test-force-exit \
  apps/api/src/oportunidades-domain.test.ts \
  apps/api/src/oportunidades.integration.test.ts \
  apps/api/src/crm-migration.integration.test.ts \
  apps/api/src/session03-crm-funnel.integration.test.ts
tests 8; pass 8; fail 0; duration_ms 20654.3369; exit 0

pnpm --filter web typecheck
$ tsc -b; exit 0

pnpm --filter api typecheck
$ tsc --noEmit; exit 0

git diff --check -- <arquivos do escopo>
exit 0
```

## Regressão proporcional

```text
Sessão 01 isolada: teste do painel/ciclo integrado passou (mais setup: 2 passed).
Sessão 02 repetida em banco próprio: 3 passed (1.0m); exit 0.
```

A tentativa de combinar as Sessões 01 e 02 no mesmo banco falhou apenas porque a Sessão 02 exige linha de base vazia e encontrou o cliente criado pela Sessão 01. O run combinado foi descartado e não foi tratado como defeito.

## Contratos sanitizados exercitados

| Método/endpoint | Caso | Resultado final |
|---|---|---|
| GET contatos/analytics | vazio, filtro, paginação, agregado | 200; valores exatos |
| POST contatos | válido / inválido / duplicado | 201 / 400 / 409 |
| PUT contatos/:id | válido / ausente | 200 / 404 |
| DELETE contatos/:id | livre / vinculado / repetido | 200 / 409 / 404 |
| POST contatos/:id/converter | novo / match / repetido | 200; idempotência |
| GET oportunidades/analytics/options/:id | lista, detalhe, opções, métricas | 200 |
| POST oportunidades | cliente/lead válidos | 201 |
| POST/PATCH oportunidade | datas, pares, extras, limites | 400 quando inválido |
| PATCH transition | etapas, perda, reabertura, lead | 200 / 400 coerentes |
| PATCH reorder | estágio divergente/ID repetido | 400 |
| POST link-budget | mesmo/outro cliente | 200 / 400 |
| POST convert-project | primeira/repetida | 200; idempotência |
| DELETE oportunidade | primeira/repetida | 204 / 404 |

Payloads documentados omitem tokens, senha e PII reais. Os testes usaram `example.invalid` e prefixo `QA-AUDIT-S03-`.

## Banco isolado

- Nome/empresa sem bordas, e-mail minúsculo e telefone em dígitos.
- Conversão cria ou associa um cliente e uma oportunidade; repetição não duplica.
- Histórico contém criação, mudança, motivo e timestamp.
- Métricas finais conhecidas: pipeline aberto `1.000.000` centavos; ponderado `615.000`; uma perdida.
- Soft delete remove das listas ativas; DELETE repetido retorna 404.
- Auditoria cobre criação, edição, conversão, transição, reorder, orçamento, projeto e exclusão, sem PII ou `<script>`.

## Limpeza

- Runs finais S03 e S02 removidos automaticamente pelo harness.
- Removidos nominalmente 14 runs falhos desta auditoria e um run combinado inválido, após validação da raiz.
- Resultado: `RESTANTES_DA_SESSAO=0`; `RESIDUO_SMOKE_COMBINADO_PRESENTE=False`.
- Runs antigos/preexistentes foram preservados.
