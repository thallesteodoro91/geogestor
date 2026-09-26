# Cálculos independentes e conciliação

Todos os valores monetários abaixo foram calculados com inteiros em centavos antes da execução. A expectativa não importou `calculateBudget`.

## Itens faturáveis

| Item | Fórmula independente | Esperado | API | SQLite | UI/PDF |
|---|---|---:|---:|---:|---:|
| Serviço GNSS | `round(1,5 × 10.001) − 1.000 + round(15.002 × 5%)` | 14.752 | 14.752 | agregado | R$ 147,52 |
| Despesa cobrada | `2 × 2.500 − 10% + 100` | 4.600 | 4.600 | agregado | R$ 46,00 |
| Taxa cartorial | `1 × 2.000` | 2.000 | 2.000 | agregado | R$ 20,00 |
| Item opcional | cotado em 5.000; excluído do total | 0 | 0 | excluído | R$ 50,00, separado |
| Custo reembolsável cobrado | valor conhecido | 3.000 | 3.000 | agregado | R$ 30,00 |
| Taxa repassada cobrada | valor conhecido | 1.500 | 1.500 | agregado | incluída em R$ 35,00 |

## Subtotais, ajustes e total

| Grandeza | Fórmula | Esperado | API | SQLite | UI/PDF |
|---|---|---:|---:|---:|---:|
| Serviços | item de serviço | 14.752 | 14.752 | 14.752 | R$ 147,52 |
| Despesas | 4.600 + 3.000 | 7.600 | 7.600 | 7.600 | linhas conciliadas |
| Taxas | 2.000 + 1.500 | 3.500 | 3.500 | 3.500 | R$ 35,00 |
| Faturável bruto | 14.752 + 7.600 + 3.500 | 25.852 | conciliado | conciliado | R$ 258,52 |
| Desconto global | fixo | −852 | −852 | persistido | −R$ 8,52 |
| Acréscimo global | 10% × 25.852 | +2.585 | +2.585 | persistido | +R$ 25,85 |
| Total antes de impostos por fora | 25.852 − 852 + 2.585 | 27.585 | conciliado | conciliado | conciliado |
| Impostos por fora | 632 + 70 + 276 + 220 | 1.198 | 1.198 | conciliado | R$ 11,98 |
| **Total** | 27.585 + 1.198 | **28.783** | **28.783** | **28.783** | **R$ 287,83** |

## Base tributável e impostos

| Etapa/tributo | Fórmula independente | Esperado | Produção |
|---|---|---:|---:|
| Base tributável bruta | 14.752 + 2.000 + 3.000 | 19.752 | 19.752 |
| Rateio tributável do desconto | `round(852 × 19.752 / 25.852)` | −651 | −651 |
| Rateio tributável do acréscimo | `round(2.585 × 19.752 / 25.852)` | +1.975 | +1.975 |
| Base tributável ajustada | 19.752 − 651 + 1.975 | 21.076 | 21.076 |
| Serviços ajustados | rateio específico do componente | 15.741 | 15.741 |
| ISS incluso 5% | `round(15.741 × 5 / 105)` | 750 | 750 |
| PIS por fora 3%, cumulativo | `round(21.076 × 3%)` | 632 | 632 |
| TR por fora 2% sobre taxas | `round(3.500 × 2%)` | 70 | 70 |
| TT por fora 1% sobre total pré-imposto | `round(27.585 × 1%)` | 276 | 276 |
| AC 1% sobre base cumulativa + ajuste 3 | `round((21.076 + 632) × 1%) + 3` | 220 | 220 |
| **Impostos previstos** | 750 + 632 + 70 + 276 + 220 | **1.948** | **1.948** |

## Resultado econômico

| Métrica | Esperado | API | SQLite | UI |
|---|---:|---:|---:|---:|
| Custo estimado | 12.500 | 12.500 | 12.500 | R$ 125,00 |
| Honorários líquidos | 14.991 | 14.991 | persistido | R$ 149,91 |
| Receita considerada | 21.085 | 21.085 | derivada | conciliada |
| Lucro estimado | 12.335 | 12.335 | 12.335 | R$ 123,35 |
| Margem | `12.335 / 21.085` | 5.850 pb | 5.850 pb | 58,50% |
| Markup | `12.335 / 12.500` | 9.868 pb | 9.868 pb | 98,68% |

## Parcelas

| Parcela | Percentual | Cálculo | Esperado/API/SQLite/UI |
|---|---:|---|---:|
| 1 | 33,33% | arredondamento em centavos | 9.593 |
| 2 | 33,33% | arredondamento em centavos | 9.593 |
| 3 | 33,34% | absorve o resíduo determinístico | 9.597 |
| **Soma** | **100%** | `9.593 + 9.593 + 9.597` | **28.783** |

Nenhuma parcela foi registrada como recebida na aprovação. As três nasceram `Pendente`, com `valor_pago = 0`, e a tabela `recebimentos` permaneceu vazia nesse cenário.

