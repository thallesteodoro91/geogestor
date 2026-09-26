# Mapa de dados e origens

## Relatórios

| Saída | Origem persistida | Transformação principal | Exposição |
|---|---|---|---|
| Receita contratada | `orcamentos.valor_total`, status aprovado e competência | Soma no intervalo civil inclusivo | API `/api/relatorios/geral`, tela e PDFs financeiro/executivo |
| Receita recebida | `recebimentos.valor_recebido` e data da baixa | Soma das baixas no intervalo | API, tela e PDFs |
| Receita pendente/vencida | `parcelas.valor`, `valor_pago`, vencimento e status | Saldo principal; vencida quando saldo aberto e data anterior ao dia de referência | API, tela e PDFs |
| Despesas pagas | `despesas.valor`, pagamento e status | Soma apenas de pagamentos válidos no intervalo; agrupamento por categoria | API, tela e PDFs |
| Caixa | recebimentos menos despesas pagas | Subtração em centavos | API, tela e PDFs |
| Impostos previstos | `orcamentos.impostos_previstos` | Soma de propostas aprovadas no recorte | API, tela e PDFs |
| Conversão | `orcamentos.status` | aprovados ÷ decididos, sem rascunhos/emitidos | API, tela e PDFs |
| Projetos ativos/concluídos/cancelados | `projetos.status` | Mapeamento por situação canônica | API, tela e PDFs de projetos/executivo |
| Prazos | `projetos.data_entrega` | vencido, hoje, próximos 30 dias e posterior | API, agenda e PDFs |
| Área ativa | `projetos.area_ha` | Soma apenas de área conhecida em projetos ativos | API, tela e PDFs |
| Alertas | KPIs calculados | Regras determinísticas de vencimento, caixa, conversão e qualidade | API, tela e PDF executivo |

Implementação principal: `apps/api/src/routes/relatorios.routes.ts`, `apps/api/src/services/reports.service.ts`, `apps/web/src/pages/Relatorios/reportDocumentModel.ts` e `apps/web/src/pages/Relatorios/reportPdfGenerator.ts`.

## Propostas e orçamentos

| Saída | Origem/entrada | Regra |
|---|---|---|
| Itens faturáveis | itens não opcionais | quantidade × preço unitário, desconto e acréscimo por item |
| Serviços | componente `servico` | soma dos itens de serviço não opcionais |
| Despesas | componente `despesa` + custos reembolsáveis | soma sem incluir opcionais |
| Taxas | componente `taxa_repassada` + custos repassados | soma sem incluir opcionais |
| Ajustes globais | total faturável anterior | desconto/acréscimo fixo ou percentual com arredondamento em centavos |
| Base tributável | itens/custos tributáveis | rateio proporcional dos ajustes globais |
| Impostos | base configurada | incluso usa cálculo por dentro; externo aumenta o total; cumulativo aumenta a base posterior |
| Custo estimado | custos unitários + custos próprios/reembolsáveis/repassados | soma em centavos |
| Honorários líquidos | serviços ajustados menos tributos inclusos | não deduz novamente tributos externos |
| Lucro/margem/markup | receita própria e custos | cálculo inteiro com pontos-base |
| Parcelas | percentuais configurados | arredondamento por parcela e residual na última |
| Documento | orçamento + cliente + imóvel + template empresarial | snapshot versionado; notas internas e conta financeira não entram no PDF |

Implementação principal: `packages/contracts/src/budgets.ts`, `apps/api/src/routes/orcamentos.routes.ts`, `apps/api/src/services/orcamentos.service.ts`, `apps/web/src/pages/Orcamentos/budgetPdfGenerator.ts`.

## Período e fuso

As datas são civis (`AAAA-MM-DD`) e o relatório usa limites inclusivos. A emissão usa o dia civil de São Paulo. Entradas impossíveis e intervalo invertido são rejeitados antes da consulta. O cenário E2E fixou início e fim em 19/09/2026, evitando ambiguidade de virada de mês/ano.

