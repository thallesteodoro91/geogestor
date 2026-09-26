# Arquivos alterados nesta auditoria

## Produto e testes

| Arquivo | Alteração | Risco |
|---|---|---|
| `apps/web/src/pages/Orcamentos/budgetPdfGenerator.ts` | Download assíncrono passou a ser aguardado e a propagar falhas. | Baixo; coberto por unidade, E2E e build. |
| `apps/web/src/pages/Orcamentos/budgetQuality.test.ts` | Regressão para espera e rejeição do download. | Apenas teste. |
| `tests/e2e/session04-budgets.spec.ts` | Destino de evidências configurável. | Apenas infraestrutura de teste. |
| `tests/e2e/session11-reports.spec.ts` | Destino de evidências configurável. | Apenas infraestrutura de teste. |
| `tests/e2e/generate_long_budget_pdf.ts` | Cenário parametrizado até 100 itens, emitido/rascunho, com ajustes, tributos e sentinelas. | Apenas gerador de evidência. |

## Instrumentação de auditoria

| Arquivo | Finalidade |
|---|---|
| `scripts/audit-documents-oracle.py` | Recalcular cenários sem importar o produto. |
| `scripts/audit-documents-pdfs.py` | Abrir, extrair, inspecionar e renderizar PDFs; registrar hashes. |
| `scripts/audit-pdf-contact-sheets.py` | Montar folhas para inspeção visual integral. |

## Documentação e evidências

Foi criado o diretório `docs/auditorias/2026-09-19-relatorios-financeiro-orcamentos`, contendo o relatório, matriz, achados, mapas, oráculos, protocolo, segurança, comandos, backlog e a árvore `evidencias`.

O repositório já possuía numerosas alterações não relacionadas antes desta auditoria. Elas foram preservadas e não são atribuídas a este trabalho.

