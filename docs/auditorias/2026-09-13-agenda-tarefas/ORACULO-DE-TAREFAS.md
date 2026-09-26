# Oráculo de tarefas

Este documento separa fatos persistidos de inferências visuais.

## Regras canônicas

| Tema | Regra esperada |
|---|---|
| Identidade | `id` UUID; exclusão é lógica por `deletedAt`. |
| Vínculo | Tarefa exige projeto ou cliente. Projeto determina seu cliente; combinação cruzada é inválida. |
| Status válidos | `A Fazer`, `Em Progresso`, `Concluído`. Valores históricos desconhecidos continuam visíveis como legado, sem conversão silenciosa. |
| Prioridades válidas | `Baixa`, `Média`, `Alta`. Valor histórico desconhecido aparece como legado e usa apresentação visual neutra. |
| Prazo | Data civil `AAAA-MM-DD`, real; vazio significa sem prazo. Não há conversão UTC para exibição. |
| Busca | Substring sem distinção de caixa/acentos em título, descrição, projeto e cliente. |
| Paginação | Página mínima 1, limite 1–100, ordenação por criação decrescente e ID crescente para desempate. |
| Totais | `total` e `statusTotals` abrangem todo o conjunto filtrado; `items` abrange somente a página. |
| Progresso | `concluídas / total`, arredondado para inteiro na apresentação. Status legado entra no total, mas não em concluídas. |
| Conclusão | Mudança para `Concluído` cria evento de jornada uma vez por transição efetiva; repetição idempotente não deve duplicar efeito. |
| Reabertura | Retorno para `A Fazer` preserva a tarefa e produz auditoria de atualização. |
| Exclusão | Registro deixa listagens, calendário, dashboard e alertas; histórico de auditoria permanece. |

## Massa determinística principal

- 101 tarefas de volume no Projeto São José.
- Distribuição: 34 `A Fazer`, 34 `Em Progresso`, 33 `Concluído`.
- 1 tarefa de status/prioridade legados no mesmo projeto.
- 1 tarefa direta do Cliente Açores, sem projeto.
- Total global inicial: 103 tarefas.
- Projeto São José: 102 tarefas, 33 concluídas, progresso 32%, 100 itens na primeira página.
- Busca `memorial descritivo`: 1 resultado.
- Busca `sao jose`: 102 resultados.
- Página global 1: 100 itens; página 2: 3 itens.

## Cenários de reconciliação

1. Criar tarefa ligada ao Projeto B: deve herdar Cliente B e aparecer imediatamente no quadro.
2. Concluir: cartão passa para `Concluído`, auditoria registra antes/depois e jornada recebe evento.
3. Reabrir: cartão retorna a `A Fazer`; registro continua único.
4. Excluir: confirmação cancelada não altera nada; confirmação aceita remove das leituras ativas.
5. Tarefa direta: aparece no cliente e no quadro, mas não em projeto algum.
6. Tarefa com prazo hoje: aparece no calendário do dia, no período do dashboard e em alertas `task/today`.
7. Resposta PATCH 500: interface restaura o status anterior e comunica a reversão.
8. Resposta antiga: não pode substituir estado proveniente de requisição mais nova.

## Valores extremos

- Título: 1–180 caracteres após trim.
- Descrição: até 2.000 caracteres.
- Categoria: até 100 caracteres.
- Busca: até 200 caracteres.
- Página: inteiro positivo.
- Limite: inteiro entre 1 e 100.
- Intervalo: início ≤ fim.
- HTML/script em texto é renderizado como texto inerte pelo React; não é interpretado como marcação.
