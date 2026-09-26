# Reconciliação financeira — Sessão 07

## Oráculo sintético

Todos os valores abaixo foram gravados como inteiros em centavos num banco descartável. A data de referência foi 12/09/2026 no fuso `America/Sao_Paulo`.

### Receita

| Origem | Cálculo | Centavos |
|---|---|---:|
| Orçamento pago, sem parcelas | contrato e caixa direto | 500.000 |
| Orçamento aprovado parcelado | contrato | 300.000 |
| Parcela paga | principal recebido | 100.000 |
| Parcela parcial | principal 40.000 + juros 2.000 | 42.000 |
| **Receita contratada** | 500.000 + 300.000 | **800.000** |
| **Receita recebida** | 500.000 + 100.000 + 42.000 | **642.000** |
| **Receita pendente** | parcela futura 100.000 − principal 40.000 | **60.000** |
| **Receita atrasada** | parcela vencida sem baixa | **100.000** |

### Despesa

| Origem | Situação | Centavos |
|---|---|---:|
| Software | paga | 50.000 |
| Taxas | paga | 20.000 |
| Combustível | vencida, persistida como Pendente | 30.000 |
| Alimentação | futura | 10.000 |
| **Despesas lançadas** | soma das quatro ativas | **110.000** |
| **Despesas pagas** | 50.000 + 20.000 | **70.000** |
| **Despesas abertas** | 30.000 + 10.000 | **40.000** |
| **Despesas atrasadas** | Combustível | **30.000** |

### Resultado

`resultadoCaixa = receitaRecebida − despesasPagas = 642.000 − 70.000 = 572.000 centavos`.

`resultadoCompetencia = receitaContratada − despesasLancadas = 800.000 − 110.000 = 690.000 centavos`.

## Sentinelas de exclusão

Foram criadas sentinelas de valor alto para tornar visível qualquer vazamento no consolidado:

| Registro | Valor | Motivo da exclusão |
|---|---:|---|
| Orçamento rejeitado | 9.900.000 ¢ | status fora da receita contratada |
| Parcela cancelada | 8.800.000 ¢ | `cancelada_em` preenchido |
| Recebimento estornado | 7.000.000 ¢ | `estornado_em` preenchido |
| Despesa cancelada | 6.000.000 ¢ | `cancelada_em` preenchido |
| Despesa estornada | 5.000.000 ¢ | `estornada_em` preenchido |
| Despesa excluída | 4.000.000 ¢ | `deleted_at` preenchido |

Nenhuma sentinela apareceu nos KPIs, séries, alertas ou contagens.

## Fechamento entre camadas

| Campo | Oráculo | API JSON | UI pt-BR | CSV |
|---|---:|---:|---:|---:|
| Receita contratada | 800.000 ¢ | 800.000 ¢ | R$ 8.000,00 | não exportado |
| Receita recebida | 642.000 ¢ | 642.000 ¢ | R$ 6.420,00 | 6420,00 |
| Receita pendente | 60.000 ¢ | 60.000 ¢ | R$ 600,00 | não exportado |
| Receita atrasada | 100.000 ¢ | 100.000 ¢ | R$ 1.000,00 | não exportado |
| Despesas lançadas | 110.000 ¢ | 110.000 ¢ | R$ 1.100,00 | não exportado |
| Despesas pagas | 70.000 ¢ | 70.000 ¢ | R$ 700,00 | 700,00 |
| Despesas vencidas | 30.000 ¢ | 30.000 ¢ | R$ 300,00 | não exportado |
| Resultado de caixa | 572.000 ¢ | 572.000 ¢ | R$ 5.720,00 | 5720,00 |
| Resultado de competência | 690.000 ¢ | 690.000 ¢ | R$ 6.900,00 | não exportado |

O CSV foi verificado com BOM UTF-8, separador `;`, cabeçalho estável e linha de setembro. A resposta integral da API e o arquivo exportado estão em `evidencias/`.
