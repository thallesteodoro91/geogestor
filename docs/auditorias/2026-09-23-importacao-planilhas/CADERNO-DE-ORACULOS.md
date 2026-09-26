# Caderno de oráculos independentes

> **Atualização de 25/09/2026:** as duas linhas das fixtures CSV/XLSX novas são calculadas por [oraculo_multilinha.py](evidencias/oraculo_multilinha.py). Orçamento e faturamento: 483.000 centavos cada; despesa: 80.500; receita histórica: 460.000; custo histórico: 276.000. Diferença 0 centavos nas métricas confrontadas; totais históricos continuam snapshot. Ver [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md).

| Cenário | Origem independente | Esperado | Observado |
|---|---|---|---|
| CSV Contato | Fixture UTF-8 sem BOM, SHA-256 no inventário | 1 linha de dados, 1 contato, 0 valor financeiro | Resultado de sucesso e lead visível no E2E 1/1 |
| XLSX Contato | Workbook gerado com abas `Instruções` e `Contatos`; cabeçalho na linha 2 da segunda aba | 1 linha de dados, 1 contato, 0 valor financeiro | Resultado de sucesso e lead visível no E2E 1/1 |
| Cabeçalho parcial em Contatos | CSV com `Nome,,Email` e primeira linha de dados totalmente preenchida | Nenhuma prévia antes da escolha; linha 1 escolhida; 1 contato | E2E real importou 1 lead; foco inicial no seletor de linha |
| Cabeçalho parcial em XLSX | Workbook com `Nome`, célula vazia e `Email` na linha 1 | Escolha manual obrigatória; 1 contato após confirmação | E2E real importou 1 lead e conferiu no CRM |
| Cabeçalho parcial na migração completa | CSV amplo com coluna extra sem título | Nenhuma prévia antes da escolha; linha 1 escolhida; prévia de 1 registro | E2E real 1/1, sem confirmação ou mutação financeira |
| CSV Cliente + Projeto | Duas fixtures independentes; CPF sintético válido, telefone com DDD e nome de cliente com números | 1 cliente ativo, 1 projeto vinculado ao seu ID, dois runs `completed` | SQLite confirmou `clientId=4e5968b2-af15-400c-a7c9-4d3216dae3f7` e `projectId=b78637b6-5181-47b6-96b7-43c36ffc7979`; E2E real 1/1 |
| CSV de erros | Prefixos sintéticos `=`, `+`, `-`, `@` | Nenhuma célula inicia com fórmula executável | Prefixo de apóstrofo em todos os quatro casos |
| Reimportação renomeada | Mesmas linhas e mesmo `fileHash`, nome diferente | `already_imported` | Integração 1/1 |
| Reimportação com hash forjado | Mesmas linhas, nome, aba e hash declarados diferentes | `already_imported` e nenhum novo ledger | Prévia bloqueada e commit direto revertido |
| Erro interno | E-mail sintético na exceção | Histórico sem e-mail | Integração 1/1 |
| Cabeçalho com vazio | Primeira linha contém rótulos, segunda contém dados | Escolha humana da linha 1 antes da prévia | Índice automático 1 não foi usado; usuário escolheu linha 1 nos dois modos; achado corrigido no caso reproduzido |

## Migração completa de uma linha

O [oráculo independente](evidencias/oraculo_independente.py) lê a fixture CSV com `csv.DictReader` e `Decimal`, sem chamar funções do GeoGestor. SHA-256: `9ebbcf8b1d8c13038f2fddab80eb1563a6347ac50044a269ea4745f55307f3ca`.

| Métrica | Planilha normalizada | SQLite | Diferença |
|---|---:|---:|---:|
| Valor unitário × quantidade | 200.000 centavos | Item: 2 × 100.000 = 200.000; total do orçamento 210.000 | 0 no item |
| Imposto previsto | 10.000 centavos | Incorporado ao total do orçamento | 0 no total |
| Orçamento total | 210.000 centavos | 210.000 centavos | 0 |
| Faturamento/nota | 210.000 centavos | 210.000 centavos | 0 |
| Despesa | 35.000 centavos | 35.000 centavos | 0 |
| Receita histórica | 200.000 centavos | Snapshot informativo, sem lançamento | Não aplicável |
| Custo histórico | 120.000 centavos | Snapshot informativo, sem lançamento | Não aplicável |
| Despesa histórica | 35.000 centavos | Snapshot informativo, sem lançamento | Não aplicável |
| Receita realizada histórica | 0 centavos | Snapshot informativo, sem recebimento | Não aplicável |

O run final terminou `completed_with_warnings` porque a planilha contém indicadores históricos/avisos. A interface exibiu “Migração concluída e conciliada”; isso se refere às diferenças da tabela de reconciliação, não à ausência de avisos.

O oráculo acima cobre uma linha. Demais formatos, múltiplas linhas, competência/caixa, parcelas e consumidores financeiros permanecem sem conciliação integrada nesta rodada.
