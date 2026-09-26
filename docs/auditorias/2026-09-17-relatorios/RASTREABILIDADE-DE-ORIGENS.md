# Rastreabilidade de origens

| Informação | Origem persistida/regra | Endpoint/serviço | Consumidor na UI/documento |
| --- | --- | --- | --- |
| Período e comparação | `inicio`, `fim`, presets e intervalo anterior equivalente | `GET /api/relatorios/gerencial`; `report-period.ts` | `Relatorios.tsx`, cabeçalho e critérios dos PDFs |
| Contratado e impostos | orçamentos elegíveis e regras tributárias existentes | `report-query.service.ts` | Financeiro, Executivo, modelo documental |
| Recebido, pendente e vencido | parcelas + recebimentos válidos; datas de caixa/vencimento | `report-query.service.ts` | KPIs, alertas, critérios e tabelas |
| Despesas pagas | despesas pagas e não excluídas pela data de caixa | `report-query.service.ts` | KPI financeiro, caixa, gráfico e PDF |
| Categorias de despesa | mesma população de despesas pagas, agrupada por categoria | `report-query.service.ts` | `ExpenseCategoryChart.tsx`, Financeiro/Executivo |
| Projetos/status | projetos não excluídos; normalização de status | `report-query.service.ts` | `OperationalReport`, Executivo, PDF de Projetos |
| Área ativa | área positiva dos projetos ativos | `report-query.service.ts` | KPI/explicação operacional |
| Municípios | município dos projetos elegíveis | `report-query.service.ts` | distribuição operacional e documento |
| Agenda/prazos | vencimento de projeto ativo, hoje no fuso de São Paulo | `report-period.ts`, `report-query.service.ts` | agenda, alertas e PDF |
| Alertas gerenciais | saldos vencidos, caixa negativo, projetos atrasados/próximos e dados incompletos | `report-query.service.ts` | Executivo, links para módulos de origem e PDF |
| Composição/contagens | contagens específicas de orçamentos, parcelas, recebimentos, despesas e projetos | contrato `reports.ts` | transparência dos KPIs e estado vazio |
| Identidade da empresa | configuração da empresa; logo convertido de forma segura | modelo/gerador documental | cabeçalho dos três PDFs |
| Atualização após mutação | resposta bem-sucedida de POST/PATCH/PUT/DELETE | `apiClient.ts` → evento → `App.tsx` → React Query | nova consulta do relatório ativo |

## Fluxo de rastreabilidade

`SQLite temporário → consulta agregada transacional → contrato gerencial → componentes da rota /relatorios → modelo de documento → pdfmake → arquivo PDF`.

Os valores financeiros não são recalculados no navegador. A UI apenas formata os inteiros em centavos recebidos da API. Filtros de apresentação e limites visuais não modificam o total; quando ocultam parte da distribuição, a tela informa a quantidade adicional.

Topografia foi incluída como dado de controle negativo: sua criação não altera contratado, recebido, despesa, caixa, status, área ou prazos dos relatórios auditados.

