# Arquivos alterados pela Sessão 12

| Arquivo | Motivo |
|---|---|
| `packages/contracts/src/strategic-planning.ts` | Datas civis reais, objetos estritos, PATCH não vazio e regra de próxima revisão |
| `apps/api/src/routes/strategic-planning.routes.ts` | UUIDs de rota, distinção 400/404/500 e resposta segura |
| `apps/api/src/services/strategic-planning.service.ts` | Transações, soft deletes, fontes, frescor, consistência, relações, ordenação e desempenho |
| `apps/api/src/strategic-planning.integration.test.ts` | Oráculos, fontes, snapshots, rollback, integridade, volume e `PRAGMA foreign_keys` |
| `apps/web/src/pages/Planejamento.tsx` | URL canônica, erro de snapshot, data local e propagação de falha das opções |
| `apps/web/src/pages/Planejamento/StrategicPlanningFormModal.tsx` | Data local, bloqueio seguro de edição e feedback acessível de opções |
| `apps/web/src/pages/Planejamento/planningFilters.ts` | Fronteira +30/+31, filtros compatíveis e desempate determinístico |
| `apps/web/src/pages/Planejamento/planningFilters.test.ts` | Regressões de prazo e filtros não aplicáveis |
| `apps/web/src/utils/localDate.ts` | Chave de data civil em America/Sao_Paulo |
| `apps/web/src/utils/localDate.test.ts` | Regressão da virada UTC/São Paulo |
| `tests/e2e/strategic-planning-flow.spec.ts` | Fluxo real, Axe, capturas, URL, erro/retry, persistência e responsividade |
| `docs/auditorias/2026-09-14-planejamento/*` | Relatórios e evidências desta auditoria |

## Controle de escopo

O worktree tinha 244 entradas no inventário inicial. Esta lista é a atribuição deliberada da Sessão 12; alterações preexistentes em outros módulos continuam pertencendo ao usuário. Nenhum arquivo foi revertido, nenhum commit foi criado e nenhuma publicação foi tentada.
