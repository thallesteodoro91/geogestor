# Arquivos alterados pela Sessão 13

O worktree continha muitas alterações de sessões anteriores. A lista abaixo atribui apenas mudanças realizadas nesta auditoria; nenhum arquivo alheio foi revertido.

## Produção

| Arquivo | Motivo |
|---|---|
| `packages/contracts/src/auxiliary-catalogs.ts` | schemas estritos, normalização, limites e coerção legada determinística |
| `packages/contracts/src/properties.ts` | contrato completo, UF, identificação mínima, coordenadas e PATCH não vazio |
| `packages/database/src/schema.ts` | colunas normalizadas da propriedade |
| `apps/api/src/routes/operational-data.routes.ts` | contratos de configuração, migração, CRUD, busca, opções, vínculos e auditoria |
| `apps/api/src/services/runtime-migrations/v16-property-integrity.ts` | migração v16, conflitos e índices únicos parciais |
| `apps/api/src/services/runtime-migrations.service.ts` | inclusão da v16 e ledger |
| `apps/api/src/services/runtime-migrations/v7-operational-integrity.ts` | reutilização por matrícula normalizada |
| `apps/api/src/services/backup.service.ts` | schema máximo compatível 16 |
| `apps/api/src/services/full-spreadsheet-import.service.ts` | normalização e `NULL` para identificadores ausentes |
| `apps/web/src/services/auxiliaryCatalogs.ts` | banco autoritativo, coerção legada e cache best-effort |
| `apps/web/src/pages/Cadastros.tsx` | zero centavos e subcategorias normalizadas |
| `apps/web/src/pages/Orcamentos/BudgetEditor.tsx` | aplicação de sugestão zero em item vazio |
| `apps/web/src/pages/Propriedades.tsx` | detalhe por ID, invalidação e campo UF |
| `apps/web/src/pages/propertyForm.ts` | payload e mensagens coerentes para UF/identificação |

## Testes

| Arquivo | Motivo |
|---|---|
| `apps/api/src/session13-catalog-properties.integration.test.ts` | matriz integrada de catálogo, CRUD, duplicidade, paginação, opções, dependências e auditoria |
| `apps/api/src/runtime-migrations-v16.integration.test.ts` | migração legada, conflitos, idempotência e integridade |
| `apps/web/src/services/auxiliaryCatalogs.test.ts` | legado, cache indisponível e duplicidade normalizada |
| `apps/web/src/pages/propertyForm.test.ts` | UF, identificação e coordenadas |
| `tests/e2e/cadastros-properties.spec.ts` | fluxos reais, URL, consumidores, modais, foco, reflow e Axe |
| `apps/api/src/operational-data.integration.test.ts` | contrato de UF/schema 16 |
| `apps/api/src/runtime-migrations-fast-path.integration.test.ts` | versão 16 no fast path |
| `apps/api/src/runtime-migrations-safety.integration.test.ts` | versão 16 na segurança |
| `apps/api/src/runtime-migrations-v11.integration.test.ts` | ledger agora com 16 entradas |
| `apps/api/src/runtime-migrations-v3.integration.test.ts` | upgrade até versão 16 |
| `apps/api/src/drizzle-journal-bootstrap.integration.test.ts` | expectativa de schema atualizada |
| `apps/api/src/strategic-planning.integration.test.ts` | regressão da versão runtime atual |

## Documentação

Todos os arquivos sob `docs/auditorias/2026-09-15-cadastros-propriedades/` foram criados nesta sessão.
