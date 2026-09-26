# Comandos e resultados reproduzíveis

> **Reteste final:** comandos e resultados exatos adicionais, incluindo 25/25 E2E de importação, 3/3 API de confiabilidade mais 1/1 API de reconciliação por linha, 2/2 configuração/cadastro, 1/1 backup/restauração, SHA-256 das fixtures e cenários não executados, estão em [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md). O banco padrão manteve 2.449.408 bytes e mtime UTC `2026-09-23 21:03:10` após os ensaios.

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

## Reteste de 25/09

| Execução | Resultado |
|---|---|
| `node scripts/run-commercial-e2e.mjs tests/e2e/importacao-associacao-manual.spec.ts --grep 'homônimos\|corrompido\|fora das 20'` | 4/4 em 1,2 minuto; XLSX corrompido, linha 21, associação manual e cache de esquemas inválido; banco/perfil autoremovidos |
| Testes web completos | 210/210 passaram após correção de esquemas |
| Testes API relevantes | 9/9 passaram; 409 para ledger legado e limites exatos incluídos |
| Typecheck web/API; lint web; build web E2E | Passaram; lint API anterior passou com 78 avisos sem erro |
| SHA-256 das seis fixtures novas | Hashes e tamanhos em [INVENTARIO-DE-ARQUIVOS.md](INVENTARIO-DE-ARQUIVOS.md) |
| Inspeção final de `data/geogestor.db` | 2.449.408 bytes; mtime UTC `2026-09-23T21:03:10.8920636Z`, igual à linha de base |
| `node scripts/run-commercial-e2e.mjs tests/e2e/importacao-associacao-manual.spec.ts --grep 'esquema salvo no SQLite\|cache de esquemas corrompido'` | 2/2 em 51,1 s; esquema persistido no SQLite e exibido após recarga com cache ausente/corrompido; banco/perfil autoremovidos |
| `pnpm --filter web typecheck` e `pnpm --filter web lint` após correção dos esquemas | Saída 0 |
| `pnpm --filter api typecheck` após validação de nomes/chaves | Saída 0 |
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/import-backend-reliability.integration.test.ts` após validação | 1/1 em 10,0 s; path traversal e chaves reservadas receberam 400; saída 0 |
| `pnpm --filter api lint` após validação | Saída 0; 78 avisos preexistentes, nenhum erro |
| `GEOGESTOR_RUN_PRIVATE_WORKBOOK_TEST=1` com `apps/api/src/full-spreadsheet-import.integration.test.ts` | 1/1 em 6,5 s; importação apenas em banco descartável; 64 colunas, 73 linhas e 10 agregados conferidos |

A primeira tentativa de associação manual falhou por fixture sem telefone obrigatório; a fixture foi corrigida e o teste final passou. Dois diretórios próprios de E2E interrompido/falho foram removidos após verificação do caminho absoluto dentro de `scratch/commercial-e2e`. Os resíduos de outras tarefas não foram tocados.

A primeira tentativa do E2E de persistência de esquemas parou na tela de bloqueio após `page.goto`. O teste foi ajustado para desbloquear o aplicativo como usuário real; a execução final passou. A evidência falha intermediária é sintética e pode ser removida após o registro.

Diretório: raiz `a/work/Geogestor`; Node 24.17.0, pnpm 11.8.0. Todos os testes mutáveis usaram o banco descartável definido pelo próprio teste ou executor E2E.

| Comando | Resultado final |
|---|---|
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/import-backend-reliability.integration.test.ts` com `NODE_ENV=test` | 1/1; 4,53 s no último ensaio, com replay alterado e HTTP 400 para 301 colunas, 20.001 linhas e célula de 20.001 caracteres; saída 0 |
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/full-spreadsheet-import.integration.test.ts` com opt-in privado ausente | 1/1 ramo sintético; 4,58 s; saída 0 |
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/project-import-association.integration.test.ts` | 1/1; 3,17 s; saída 0; banco descartável próprio removido por caminho verificado |
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/project-import-client-resolution.test.ts` | 5/5; 0,26 s; saída 0 |
| `apps/api/node_modules/.bin/tsx.cmd --test --test-force-exit apps/api/src/simple-import-result.test.ts` | 2/2; 0,23 s; saída 0 |
| `apps/api/node_modules/.bin/tsx.cmd --test apps/web/src/pages/Importacao/fullMigration.test.ts apps/web/src/pages/Importacao/simpleImport.test.ts apps/web/src/pages/Importacao/projectImport.test.ts apps/web/src/services/importSchemas.test.ts` | 13/13; 0,28 s no último ensaio; saída 0 |
| `pnpm --filter api typecheck` | saída 0 |
| `pnpm --filter api lint` | saída 0 após correção de estilo no teste; 78 avisos sem erro, majoritariamente preexistentes |
| `pnpm --filter web typecheck` | saída 0 |
| `pnpm --filter web lint` | saída 0 |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "CSV sintético percorre"` | 1/1 final; 12,6 s Playwright; saída 0; build web aprovado; run isolado autoremovido |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "sintético"` | 2/2 CSV e XLSX; 23,5 s Playwright; saída 0; build web aprovado; run isolado autoremovido |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "sintétic"` | 3/3 finais (CSV simples, XLSX simples, migração completa CSV); 35,2 s Playwright; saída 0; run isolado autoremovido |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "migração completa sintética"` | 1/1 após ampliação das asserções SQLite; 14,3 s Playwright; saída 0; run isolado autoremovido |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "migração completa sintética"` | 1/1 após impressão digital independente da aba; 13,7 s Playwright; saída 0; run isolado autoremovido |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "cliente e projeto associado"` | 1/1 após corrigir busca de nome com números; 13,0 s Playwright; saída 0; `cliente_id` conferido |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "sintétic"` | 4/4 finais (Contatos CSV/XLSX, Cliente + Projeto CSV, migração completa CSV); 47,5 s Playwright; saída 0; run isolado autoremovido |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "sintétic\|cabeçalho ambíguo"` | 6/6 finais, incluindo seleção manual em Contatos e prévia completa; 1,0 min Playwright; saída 0; run isolado autoremovido |
| `node scripts/run-commercial-e2e.mjs importacao-associacao-manual.spec.ts --grep "sintétic\|cabeçalho ambíguo"` | 7/7 finais, com CSV e XLSX ambíguos e prévia completa; 1,0 min Playwright; saída 0; run isolado autoremovido |
| `python evidencias/oraculo_independente.py` com Python do runtime do Codex | 1 linha; orçamento/faturamento 210.000, despesa 35.000 centavos; saída 0 |
| `git diff --check` nos arquivos de código alterados | saída 0; apenas avisos de conversão LF/CRLF |

Tentativas E2E anteriores: falhas de teste por clique sobre checkbox estilizado, rota antiga `/contatos`, seletor textual duplicado e expectativa `completed` quando o run corretamente terminou `completed_with_warnings`. Na sequência Cliente + Projeto, a primeira fixture não tinha documento obrigatório; corrigida. A navegação para a mesma rota não reiniciava o estado; o teste passou a usar `Nova importação`. A prévia real expôs IMP-A06, corrigido e retestado. Uma primeira geração da fixture ampla com cabeçalho ambíguo produziu uma linha só; o arquivo foi refeito com LF e hash recalculado. Os diretórios falhos próprios foram removidos após registrar as causas.

Saída sanitizada do último run completo (reteste com item, parcelas, recebimentos e snapshot): `runId=891f47f4-3bb9-4b7a-8262-578668f2fdde`, `clientId=3bd15363-462c-481d-98b7-111b41e8364a`, `propertyId=f46481bf-a72d-4c1d-8395-d0158fe2efea`, `projectId=ccbf9126-bfd7-4d08-ad0c-7b91af10c98c`, `budgetId=b8dbc9de-fcc1-4d75-94ed-aafa93291651`, `billingId=63e4b426-4bf7-4da6-a2a7-862ce40ea9a4`, `expenseId=6c3dee00-5fd5-4422-bafb-77b8a0b65323`. Na mesma execução, importação simples criou `clientId=4e5968b2-af15-400c-a7c9-4d3216dae3f7` e `projectId=b78637b6-5181-47b6-96b7-43c36ffc7979`. Todos pertenciam ao banco E2E autoremovido.

O ramo que lê workbook privado em `full-spreadsheet-import.integration.test.ts` permaneceu desabilitado. A suíte completa, Electron, axe e limites volumétricos não foram executados nesta rodada.
