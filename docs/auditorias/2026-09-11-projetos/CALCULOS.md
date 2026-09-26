# Memória de cálculos — Sessão 05: Projetos

Todos os valores abaixo vieram de uma massa determinística `QA-AUDIT-S05-20260911-*`, criada em banco temporário pelo runner E2E. Nenhum dado do banco real foi usado ou alterado.

## Estatísticas operacionais

Massa: 15 projetos.

| Grupo | Quantidade | Regra independente |
|---|---:|---|
| Concluídos | 3 | status `Finalizado` |
| Em andamento, no prazo | 4 | status operacional aberto e entrega futura |
| Atrasados | 3 | status aberto e entrega anterior à data corrente |
| Outros | 5 | planejamento, análise, suspensão, cancelamento e espera do cliente |
| Total | 15 | 3 + 4 + 3 + 5 |

Produtividade:

```text
3 concluídos ÷ 15 projetos × 100 = 20%
```

Tempo médio de entrega dos três concluídos:

```text
(10 dias + 20 dias + 30 dias) ÷ 3 = 20 dias
```

Valor médio dos projetos com orçamento aprovado:

```text
(R$ 100,00 + R$ 200,00) ÷ 2 = R$ 150,00
```

Os resultados exibidos foram 15, 20 dias, 20% e R$ 150,00, iguais aos cálculos independentes.

## Contexto financeiro do projeto principal

| Grandeza | Dados | Resultado esperado e exibido |
|---|---|---:|
| Orçado/contratado | orçamento aprovado | R$ 100,00 |
| Faturado | nota emitida | R$ 70,00 |
| Recebido | baixa parcial | R$ 30,00 |
| Saldo aberto | R$ 100,00 − R$ 30,00 | R$ 70,00 |
| Custo previsto | orçamento | R$ 40,00 |
| Custo ativo | despesa paga | R$ 25,00 |
| Custo cancelado | despesa com `cancelada_em` | R$ 5,00, excluído |
| Custo realizado | somente custo ativo | R$ 25,00 |
| Desvio de custo | R$ 25,00 − R$ 40,00 | −R$ 15,00 |
| Consumo | R$ 25,00 ÷ R$ 40,00 × 100 | 62,5% |

O achado S05-F09 foi reproduzido porque o cartão local somava R$ 25,00 + R$ 5,00 = R$ 30,00. Depois da correção, o cartão e a API convergem em R$ 25,00.

## Limites temporais da decisão financeira

A regra retestada cancela apenas parcelas simultaneamente:

```text
sem cancelamento prévio
AND não pagas
AND data_vencimento > data local de hoje
```

Assim, parcela futura em aberto é elegível; parcela vencida, vencendo hoje, paga ou parcialmente paga é preservada. Uma repetição exatamente igual da decisão retorna o resultado já registrado, sem criar novo evento.

## Desempenho

O teste de visão geral existente executou uma massa de 1.000 projetos com limite P95 de 200 ms. Na execução focada desta sessão, a listagem ficou aproximadamente entre 1,7 e 2,6 ms e o resumo em cerca de 25 ms, bem abaixo do orçamento do teste. São medições locais de regressão, não benchmark de produção.
