# Arquivos alterados nesta auditoria

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

## Complemento da continuação

- `apps/api/src/services/full-spreadsheet-import.service.ts` e `apps/api/src/routes/importacoes.routes.ts`: bloqueio 409 do ledger legado também no commit.
- `apps/api/src/services/simple-import-source-rows.service.ts`, rotas de Clientes/Projetos/Contatos, serviço de resultado e histórico: transporte do número físico de linha.
- `apps/web/src/pages/Importacao/fullMigration.ts`, `ImportacaoDados.tsx`, `simpleImport.ts`, `projectImport.ts`: CSV físico, escolha manual ampliada, invalidação de prévia e numeração de origem.
- `apps/api/src/import-backend-reliability.integration.test.ts`, `apps/web/src/pages/Importacao/fullMigration.test.ts`, `tests/e2e/importacao-associacao-manual.spec.ts`: regressões do legado, limites, parser, associação manual e arquivo corrompido.
- `apps/web/src/components/dropdownMigration.test.ts`: exceção testada para o seletor nativo de linha de cabeçalho, necessária para operação sem dependência de mouse.
- `apps/web/src/services/importSchemas.ts`, `EsquemasImportacao.tsx`, `ImportacaoDados.tsx`: leitura e acréscimo de esquemas a partir do SQLite, com cache local apenas como apoio. Teste unitário e E2E de recarga ampliados.
- `apps/api/src/routes/importacoes.routes.ts` e integração de confiabilidade: validação de nome simples CSV/XLSX e rejeição de chaves reservadas antes da prévia.
- `docs/auditorias/2026-09-23-importacao-planilhas/evidencias/`: seis fixtures adicionais, gerador XLSX/CSV e oráculo em centavos.
- Documentos desta pasta: revisão do legado e reteste com matriz, inventário, reconciliação, resultados e ressalvas atualizados.

| Arquivo | Motivo |
|---|---|
| `apps/api/src/services/full-import-worker.service.ts` | Preservar `fileHash` usado pela prévia na gravação do ledger. |
| `apps/api/src/services/full-spreadsheet-import.service.ts` | Reservar hash declarado e impressão digital dos dados na mesma transação. |
| `apps/api/src/routes/importacoes.routes.ts` | Registrar hash do arquivo no histórico, separadamente do digest do payload. |
| `apps/api/src/routes/projetos.routes.ts` | Buscar nomes com números na prévia de associação, seguindo a mesma regra do resolvedor. |
| `apps/api/src/services/import-run.service.ts` | Neutralizar fórmulas no CSV de erros e não persistir mensagem arbitrária de exceção. |
| `apps/web/src/pages/Importacao/fullMigration.ts` | Identificar indício de cabeçalho parcial sem escolher outra linha automaticamente. |
| `apps/web/src/pages/Importacao/ImportacaoDados.tsx` | Exigir seleção manual da linha ambígua antes da prévia, com controle rotulado e foco. |
| `apps/web/src/pages/Importacao/fullMigration.test.ts` | Regressão de cabeçalho parcial e título acima da tabela. |
| `apps/api/src/import-backend-reliability.integration.test.ts` | Regressões de renomeação, ledger, fórmulas e privacidade. |
| `apps/api/src/full-spreadsheet-import.integration.test.ts` | Exigir opt-in para acesso a workbook privado e nomear corretamente o ensaio sintético. |
| `tests/e2e/importacao-associacao-manual.spec.ts` | Percursos CSV/XLSX sintéticos com API real, vínculo cliente/projeto e consumidores. |
| `docs/auditorias/2026-09-23-importacao-planilhas/` | Relatório, oito fixtures CSV/XLSX, geradores e oráculo independente. |

Os demais arquivos modificados ou não rastreados na árvore eram preexistentes e foram preservados. Não houve commit, staging, push, instalação ou publicação.
