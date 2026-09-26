# Comandos e resultados — Sessão 05: Projetos

Executado em `C:\Users\Thalles\Documents\Codex\2026-06-22\a\work\Geogestor`, em 11/09/2026.

| Comando/verificação | Resultado final |
|---|---|
| Testes API focados preexistentes de listagem, visão geral, especializações e contexto financeiro | 4/4 aprovados na linha de base |
| Teste de regressão `apps/api/src/session05-projects.integration.test.ts` | Vermelho antes da correção (cliente inativo retornava 201); 1/1 aprovado depois, ~9,65 s |
| Testes API focados: S05, list overview, specialized, financial polish e relationship integrity | 5/5 arquivos aprovados |
| Testes web focados: formulário, apresentação do detalhe e índice financeiro | 11/11 aprovados |
| `pnpm run test:api` | 162/162 aprovados, ~103,9 s. A primeira execução expôs uma expectativa antiga em `orcamentos.integration.test.ts`; o teste foi alinhado à nova proteção de decisão prematura e a suíte integral passou no reteste. |
| `pnpm run test:web` | 171/171 aprovados, 0 falhas |
| `pnpm run test:electron` | 18/18 aprovados |
| `node scripts/run-commercial-e2e.mjs tests/e2e/session05-projects.spec.ts` | 4/4 aprovados em 1,0 min (inclui configuração isolada); runner removeu o ambiente do sucesso |
| `pnpm run lint` | aprovado, 0 erros |
| `pnpm run typecheck` | web `tsc -b` e API `tsc --noEmit` aprovados |
| `pnpm run build` | contratos, database, API, web e desktop aprovados; instalador `GeoGestor Setup 1.0.4.exe` reconstruído e assinado |
| `node scripts/smoke-packaged-api.mjs` | BLOQUEADO após validar as rotas operacionais vazias, inclusive `/api/projetos`; falhou na expectativa externa de log da configuração inicial |
| `Get-FileHash -Algorithm SHA256 data\geogestor.db` | antes/depois: `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471` |

## Cobertura E2E S05

1. Rota canônica, alias `/operacional`, query inválida, detalhe inválido, vazio, erro controlado e recuperação.
2. Lista, grade, busca, paginação, estatísticas determinísticas, Axe e overflow.
3. Detalhe, fallback de aba, tarefa atrasada, conclusão por teclado, upload PDF, contexto financeiro e exclusão de despesa cancelada do total.
4. Setup inicial isolado exigido pelo runner.

## Isolamento e limpeza

- Prefixo de dados: `QA-AUDIT-S05-20260911-`.
- O runner usou `GEOGESTOR_E2E_ROOT` próprio e removeu a execução aprovada.
- Treze diretórios de tentativas falhas criados durante esta sessão foram identificados e removidos.
- Diretórios antigos de outras datas/sessões em `scratch/commercial-e2e` foram preservados por não pertencerem a esta execução.
- O smoke empacotado usou `mkdtemp` no diretório temporário do sistema e removeu banco/pasta no bloco `finally`, inclusive na falha.
