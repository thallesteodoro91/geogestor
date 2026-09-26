# Índice de evidências

## Interface integrada

| Evidência | Conteúdo |
|---|---|
| [01-lista-vazia.png](./evidencias/01-lista-vazia.png) | Estado vazio global e estrutura da listagem. |
| [02-lista-erro-recuperavel.png](./evidencias/02-lista-erro-recuperavel.png) | Falha controlada, causa e ação “Tentar novamente”. |
| [03-lista-filtrada-calculos.png](./evidencias/03-lista-filtrada-calculos.png) | Busca, sete filtros ativos, tabela, total e análise comercial. |
| [04-detalhes-rascunho.png](./evidencias/04-detalhes-rascunho.png) | Detalhes do rascunho, ações e demonstrativo financeiro. |
| [05-aprovacao-parcelas.png](./evidencias/05-aprovacao-parcelas.png) | Confirmação visual da aprovação e parcelas geradas. |
| [06-revisao-aprovada-1440-escuro.png](./evidencias/06-revisao-aprovada-1440-escuro.png) | Versão 2 aprovada, tema escuro, margem e contas a receber. |

## PDFs do cenário conhecido

- [Rascunho — ORC v1](./evidencias/pdfs/rascunho-Orcamento_v1_QA-AUDIT-S04-20260910-Cliente_Principal.pdf)
- [Emitido/aprovado — ORC-2026-0001 v1](./evidencias/pdfs/emitido-ORC-2026-0001_v1_QA-AUDIT-S04-20260910-Cliente_Principal.pdf)

Ambos têm três páginas. O rascunho contém `RASCUNHO — NÃO ENVIAR`; o emitido não. O texto extraído confirmou total R$ 287,83, serviço R$ 147,52, taxa total R$ 35,00, ajustes globais, cinco tributos e condições 33,33%/33,33%/33,34%. Notas internas e conta financeira não aparecem.

## PDFs de estresse

- [Emitido, 34 itens e 8 páginas](./evidencias/pdf-longo/ORC-2026-TESTE-LONGO_v3_Cliente_de_Validacao_PDF_Conteudo_Extenso.pdf)
- [Relatório estrutural emitido](./evidencias/pdf-longo/render/report.json)
- [Página 1 emitida](./evidencias/pdf-longo/render/page-01.png)
- [Página 8 emitida](./evidencias/pdf-longo/render/page-08.png)
- [Rascunho, 34 itens e 8 páginas](./evidencias/pdf-longo-rascunho/ORC-2026-TESTE-LONGO_v3_Cliente_de_Validacao_PDF_Conteudo_Extenso.pdf)
- [Relatório estrutural rascunho](./evidencias/pdf-longo-rascunho/render/report.json)
- [Página 4 rascunho](./evidencias/pdf-longo-rascunho/render/page-04.png)

O inspetor verificou A4 em todas as páginas, rodapés numerados, texto extraível, cabeçalho repetido quando a tabela continua, opcionais sem título órfão, marca-d’água em todas as páginas do rascunho e ausência dos marcadores internos de notas, custos e conta.

## Evidência automatizada

- `tests/e2e/session04-budgets.spec.ts`: jornada real com frontend, API e SQLite isolado.
- `apps/api/src/orcamentos.integration.test.ts`: ciclo de API, financeiro, CRM, projeto, revisão e rollback.
- `apps/api/src/orcamentos-domain.test.ts`: cálculos e invariantes de parcelas.
- `apps/web/src/pages/Orcamentos/budgetForm.test.ts`: round-trip do formulário.
- `tests/e2e/inspect_budget_pdf.py`: inspeção e renderização dos PDFs longos.

## Higiene

Os screenshots e PDFs não contêm dados reais. O prefixo é `QA-AUDIT-S04-20260910-`. A conta financeira e as notas internas foram deliberadamente marcadas no fixture para confirmar sua ausência no documento do cliente.

