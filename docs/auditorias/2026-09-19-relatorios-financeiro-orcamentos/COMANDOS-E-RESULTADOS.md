# Comandos e resultados

Diretório de execução: `C:\Users\Thalles\Documents\Codex\2026-06-22\a\work\Geogestor`.

| Comando | Resultado |
|---|---|
| `node apps/api/node_modules/tsx/dist/cli.mjs --test apps/web/src/pages/Orcamentos/budgetQuality.test.ts apps/web/src/pages/Relatorios/reportDocuments.test.ts` | 13/13 aprovados |
| `node apps/api/node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 apps/api/src/financeiro-reports.test.ts apps/api/src/session11-reports.integration.test.ts apps/api/src/orcamentos-domain.test.ts apps/api/src/orcamentos.integration.test.ts` | 17/17 aprovados; volume 1.500, 14,1 ms, +0,2 MiB |
| `node scripts/run-commercial-e2e.mjs tests/e2e/session11-reports.spec.ts` | 2/2 aprovados; três PDFs reais |
| `node scripts/run-commercial-e2e.mjs tests/e2e/session04-budgets.spec.ts` | 4/4 aprovados; dois PDFs reais |
| `tsx tests/e2e/generate_long_budget_pdf.ts <destino> emitido 100` | PDF real de 16 páginas |
| `tsx tests/e2e/generate_long_budget_pdf.ts <destino> rascunho 100` | PDF real de 16 páginas |
| `python scripts/audit-documents-oracle.py .../oraculo-independente.json` | orçamento e relatórios aprovados |
| `python scripts/audit-documents-pdfs.py .../evidencias` | 7 PDFs, 45 páginas, todos os controles aprovados |
| `python scripts/audit-pdf-contact-sheets.py .../evidencias` | 13 folhas de contato produzidas |
| `pnpm run test:web` | 203/203 aprovados |
| `pnpm run test:api` | 192/192 aprovados em 165.151 ms |
| `pnpm run test:electron` | 18/18 aprovados |
| `pnpm run lint` | aprovado |
| `pnpm run typecheck` | aprovado |
| `pnpm run build` | contratos, banco, API, web e instalador Windows 1.0.4 aprovados |
| `git diff --check` | aprovado; apenas avisos preexistentes de conversão LF/CRLF |

## Observações de execução

Os testes E2E usaram a variável `GEOGESTOR_E2E_EVIDENCE_ROOT` para preservar evidências fora da raiz efêmera. O executor removeu a raiz temporária após cada suíte. A saída extensa do servidor contém respostas 4xx/5xx sintéticas esperadas pelos testes negativos; o processo terminou com código 0 e 192 testes aprovados.

