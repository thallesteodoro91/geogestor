# Mapa do pipeline observado

> **Atualização de 25/09/2026:** o parser CSV agora transporta a linha física de origem; UI e API passam `sourceRowNumbers` nos dois modos. A migração completa consulta o ledger legado na prévia e novamente dentro da transação de commit, retornando HTTP 409 até revisão. Ver [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md).

## Simples

`ImportacaoDados.tsx` → Papa Parse ou `read-excel-file/browser` → `fullMigration.ts` (seleção de cabeçalho/aba e limites; escolha manual obrigatória se houver indício de cabeçalho parcial) → mapeamento e revisão → rotas `/api/clientes/lote`, `/api/projetos/lote` ou `/api/contatos/lote` com `Idempotency-Key` → `import_runs` e `import_rows` → consumidor. Projetos usam prévia de associação e decisão manual antes da gravação. O E2E desta rodada cobriu nome, documento e telefone de Cliente, nome e referência de Projeto e nome/e-mail de Contatos; não comprovou todos os campos.

## Completa

`ImportacaoDados.tsx` → leitura do arquivo e escolha manual da linha se ambígua → SHA-256 no navegador → JSON com cabeçalhos, linhas, aba e `fileHash` → `POST /api/importacoes/migracao-completa/preview` (25 MiB) → digest do payload/mapeamento, `previewId` com TTL no SQLite → confirmação 202 de uso único → `FullImportWorkerService` → `commitFullSpreadsheetImport` em transação → ledger, entidades, auditoria e finalização de pastas → `import_runs`, `import_rows` e consumidores.

O frontend limita arquivo a 20 MiB e a migração a 20.000 linhas e 300 colunas. O servidor limita JSON a 25 MiB, linhas a 20.000, colunas a 300, cabeçalho/chave a 300 caracteres e célula textual a 20.000 caracteres. A importação simples limita lote a 500 no fluxo. Esses limites foram localizados e parcialmente exercitados; não equivalem a ensaio de borda completo.

O arquivo original não é enviado à API completa: `fileHash` é uma declaração do navegador, sem prova independente dos bytes no servidor. O worker usa o mesmo valor que a prévia para o ledger. Desde esta rodada, o servidor também calcula uma impressão digital canônica dos cabeçalhos e linhas, independente do nome da aba; os dois ledgers são reservados na mesma transação. Isso protege novas importações contra replay de conteúdo idêntico com hash declarado diferente. Ledgers antigos só possuem o hash bruto declarado.

Principais arquivos: `apps/web/src/pages/Importacao/{ImportacaoDados,fullMigration,simpleImport,projectImport}.ts(x)`, `apps/api/src/routes/importacoes.routes.ts`, `apps/api/src/services/{import-run,full-import-worker,full-spreadsheet-import}.service.ts` e rotas de lote das três entidades.
