# Comandos e resultados

| Comando | Resultado |
|---|---|
| `node apps/api/node_modules/tsx/dist/cli.mjs --test --test-force-exit apps/api/src/orcamentos-domain.test.ts apps/api/src/orcamentos.integration.test.ts` | 15 testes, 15 aprovados, 0 falhas. |
| `node --test --import tsx apps/web/src/pages/Orcamentos/budgetForm.test.ts` | 2 testes, 2 aprovados. |
| `node scripts/run-commercial-e2e.mjs tests/e2e/session04-budgets.spec.ts` | 4 testes Playwright aprovados em 1,1 min. Banco e perfil isolados removidos pelo harness. |
| `pnpm.cmd --filter web test` | 169 aprovados, 0 falhas, 2,147 s. |
| `pnpm.cmd --filter api test` | 161 aprovados, 0 falhas, 102,453 s. |
| `pnpm.cmd test:electron` | 18 aprovados, 0 falhas. |
| `pnpm.cmd typecheck` | web e API aprovados, exit 0. |
| `pnpm.cmd lint` | ESLint web aprovado, exit 0. |
| `pnpm.cmd desktop:build` | contratos, database, API, web e Electron aprovados; NSIS `GeoGestor Setup 1.0.4.exe` gerado, 89.954.927 bytes. |
| `node .../generate_long_budget_pdf.ts ... emitido` | PDF emitido gerado. |
| `node .../generate_long_budget_pdf.ts ... rascunho` | PDF rascunho gerado. |
| `python .../inspect_budget_pdf.py ... emitido` | exit 0; 8 páginas A4, rodapés/conteúdo aprovados. |
| `python .../inspect_budget_pdf.py ... rascunho` | exit 0; 8 páginas A4 e marca-d’água em todas. |
| `git diff --check -- <arquivos da sessão>` | aprovado; somente avisos de futura normalização LF/CRLF. |
| `pnpm.cmd release:smoke-package` | **bloqueado**: `/api/orcamentos` respondeu e iniciou vazio; depois o script falhou por não localizar o evento `INSERT/Configuração` em `/api/audit-logs`. |

## Ciclo vermelho/verde relevante

- A linha de base focada tinha domínio/API 12/12 e testes web de Orçamentos 15/15.
- Os novos testes de integridade de parcelas, ranges/contratos e opções de projeto produziram falhas antes das correções.
- Após as correções, o conjunto focado passou a 15/15, o teste de formulário a 2/2 e o E2E a 4/4.
- O E2E reproduziu o erro real de fontes no PDF e a corrupção potencial de escala do ajuste fixo; ambos foram corrigidos e reexecutados até o fluxo completo ficar verde.

## Empacotamento

- `apps/desktop/dist/win-unpacked/GeoGestor.exe`: 201.237.504 bytes.
- `apps/desktop/dist/GeoGestor Setup 1.0.4.exe`: 89.954.927 bytes.
- O executável e o instalador foram assinados pelo passo configurado no `electron-builder`.
