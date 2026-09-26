# Caderno de oráculos independentes

O oráculo foi implementado em `scripts/audit-documents-oracle.py` usando somente `Decimal`, inteiros e regras descritas no fixture. Ele não importa código do produto. A saída integral está em `evidencias/banco/oraculo-independente.json`.

## Orçamento determinístico

| Métrica | Esperado | Obtido |
|---|---:|---:|
| Serviços | R$ 147,52 | R$ 147,52 |
| Despesas | R$ 76,00 | R$ 76,00 |
| Taxas/repasses | R$ 35,00 | R$ 35,00 |
| Subtotal faturável | R$ 258,52 | R$ 258,52 |
| Desconto global | R$ 8,52 | R$ 8,52 |
| Acréscimo global | R$ 25,85 | R$ 25,85 |
| Base tributável ajustada | R$ 210,76 | R$ 210,76 |
| ISS incluso | R$ 7,50 | R$ 7,50 |
| PIS externo | R$ 6,32 | R$ 6,32 |
| Tributo sobre taxas | R$ 0,70 | R$ 0,70 |
| Tributo sobre total | R$ 2,76 | R$ 2,76 |
| Adicional cumulativo | R$ 2,20 | R$ 2,20 |
| Impostos totais | R$ 19,48 | R$ 19,48 |
| Total | R$ 287,83 | R$ 287,83 |
| Custo estimado | R$ 125,00 | R$ 125,00 |
| Honorários líquidos | R$ 149,91 | R$ 149,91 |
| Lucro estimado | R$ 123,35 | R$ 123,35 |
| Margem | 58,50% | 58,50% |
| Markup | 98,68% | 98,68% |
| Parcelas | 95,93 + 95,93 + 95,97 | 95,93 + 95,93 + 95,97 |

Invariantes aprovados: soma das parcelas igual ao total; opcionais fora do investimento; tributos externos incluídos uma única vez; custos próprios não expostos no PDF; residual absorvido na última parcela.

## Relatórios determinísticos

| Métrica | Esperado | Obtido |
|---|---:|---:|
| Contratado | R$ 100,00 | R$ 100,00 |
| Recebido | R$ 40,00 | R$ 40,00 |
| Pendente/vencido | R$ 60,00 | R$ 60,00 |
| Despesas pagas | R$ 54,00 | R$ 54,00 |
| Caixa | −R$ 14,00 | −R$ 14,00 |
| Impostos previstos | R$ 10,00 | R$ 10,00 |
| Conversão | 1/5 = 20% | 1/5 = 20% |
| Projetos | 18 total / 16 ativos | 18 total / 16 ativos |
| Prazos | 13 vencidos / 2 próximos | 13 vencidos / 2 próximos |
| Área ativa conhecida | 27,5 ha em 15 projetos | 27,5 ha em 15 projetos |

## Reconciliação em quatro camadas

1. O banco isolado recebeu os valores brutos conhecidos.
2. A API retornou os agregados acima.
3. A interface exibiu os mesmos valores e alertas.
4. O texto dos PDFs e os documentos renderizados preservaram os mesmos resultados.

