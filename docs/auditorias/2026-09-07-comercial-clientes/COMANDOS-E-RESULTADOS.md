# Comandos e resultados — Sessão 02

## Validações finais

| Comando | Resultado exato |
|---|---|
| `pnpm lint` | **PASS**, ESLint sem erros. |
| `pnpm --filter web typecheck` | **PASS**, TypeScript sem erros. |
| `pnpm --filter api typecheck` | **PASS**, TypeScript sem erros. |
| `pnpm test:web` | **168/168 PASS**, 0 falhas, 0 ignorados, 1,79 s. |
| `pnpm test:api` | **157/157 PASS**, 0 falhas, 105,02 s. |
| `pnpm test:electron` | **18/18 PASS**, 0 falhas, 0 ignorados, 0,46 s. |
| teste focado da integração de clientes | **3/3 PASS**, incluindo ciclo de vida novo. |
| `node scripts/run-commercial-e2e.mjs tests/e2e/session02-clients.spec.ts` | **3/3 PASS**, 55,7 s antes do reflow; **3/3 PASS**, 52,2 s após o reflow; resíduos próprios removidos. |
| `node scripts/run-commercial-e2e.mjs tests/e2e/session02-clients.spec.ts --grep "diretório, validações"` | **2/2 PASS**, 35,2 s; cancelamento limpo/sujo e descarte; resíduos próprios removidos. |
| regressão `commercial-critical.spec.ts` filtrada para cliente/projeto | **3/3 PASS**, 40,2 s. |
| regressão `cadastros-properties.spec.ts` filtrada para primeiro uso | **2/2 PASS**, 33,7 s. |

## Respostas e persistência verificadas

- `POST /api/clientes`: 201; cliente localizado no banco após reload.
- `PATCH /api/clientes/:id`: sucesso; nome/status persistidos e pasta movida.
- `POST /api/clientes/:id/historico`: 201 para caso válido; AuditLog presente.
- Histórico com data impossível: 400; sem escrita parcial.
- Histórico com projeto de outro cliente: 400; sem escrita parcial.
- `GET /api/arquivos/preview`: 200 via `apiFetch` autenticado; tentativa não autenticada observada em 423.
- `GET /api/arquivos/download`: 200 autenticado.
- `DELETE /api/arquivos`: 200; arquivo deixou de existir no disco.
- `DELETE /api/clientes/:id` com vínculos: 409 e lista dos vínculos.
- `DELETE /api/clientes/:id` após desativar vínculos: 204.
- GET/PATCH/histórico/DELETE repetido após exclusão: 404.
- Consulta direta paginada pelo nome sintético: total 1.
- Axe WCAG 2.2 A/AA: 0 violações nas telas exercitadas.
- Console do navegador na jornada principal: 0 erros coletados.
- Overflow horizontal: `scrollWidth <= clientWidth` em lista vazia, lista populada, detalhe e pós-exclusão.

## Limpeza

Execuções aprovadas removidas automaticamente pelo runner:

- `run-1788903543018-26052-2717ee7c-6759-40c3-a023-890e2d4a5712`
- `run-1788904091811-24400-cc28d56c-517f-478f-a1d0-d92370566cea`
- `run-1788904331659-2332-e555d0f9-291e-42bd-bf56-cd45aef12ac3`
- `run-1788904653778-28148-7c1af830-70d2-4901-b4ab-ea61e8ed83ae`

Resíduos de tentativas desta sessão removidos explicitamente e confirmados como inexistentes:

- `scratch/commercial-e2e/run-1788829883297-9068-c53adf6d-82bd-495f-8933-0ad5ecf64640`
- `scratch/commercial-e2e/run-1788830307201-27388-4c35c10e-651a-47d7-91d4-f7e686d7a3bc`
- `scratch/commercial-e2e/run-1788902367455-24664-81d1c462-e7d8-4ca5-9ae1-ee16bcaea5ae`
- `scratch/commercial-e2e/run-1788902533678-16204-4e198c2d-9ae9-4c56-8f5c-e57c43eb25ff`
- `scratch/commercial-e2e/run-1788902978524-28928-6508aa97-95c0-4e08-94f0-669339a733a6`
- `scratch/session02-client-12724`
- `scratch/session02-client-18892`
- `scratch/session02-client-47936`
- `scratch/session02-client-49908`

Para cada um dos nove alvos explícitos, `Test-Path -LiteralPath` retornou `False` após a remoção. Diretórios históricos não atribuídos a esta sessão foram preservados. O banco e a pasta padrão do usuário não foram alterados.

## Evidências preservadas

- `evidencias/01-clientes-vazio.png` — lista realmente vazia e barra responsiva.
- `evidencias/02-clientes-populado.png` — 32 resultados, tabela/cartões e paginação.
- `evidencias/03-cliente-detalhes.png` — nome editado, mapa vazio, vínculos, histórico e resumos.
- `evidencias/04-cliente-excluido.png` — rota direta após exclusão em estado 404 amigável.
