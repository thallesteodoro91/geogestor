# Matriz das fontes automáticas

| Código / tipo | Regra canônica e consulta real | População e período | Numerador / denominador | Resultado | Unidade / atualização / rota | Situação |
|---|---|---|---:|---:|---|---|
| `financeiro_resultado_caixa` / financeiro | Soma recebimentos ativos não estornados menos despesas ativas, pagas e não canceladas/estornadas | Datas dentro de `2026-01-01…2026-12-31`; recebimento 10.000 centavos e despesa 4.000; despesa pendente 900.000 excluída | 10.000−4.000 / n.a. | 6.000 centavos → **R$ 60,00** | unidade canônica `BRL`, exibida como R$; maior `updatedAt` incluído `2026-07-15T12:00:00.000Z`; `/financeiro` | APROVADO APÓS CORREÇÃO |
| `crm_taxa_conversao` / CRM | Ganhas ÷ encerradas como ganhas/perdidas | Encerramento no ciclo; ganha e perdida incluídas; negociação excluída | 1 / 2 | **50%** | `%`; atualização real da população; `/crm` | APROVADO APÓS CORREÇÃO |
| `projetos_taxa_conclusao` / Projetos | Concluídos ÷ todos os projetos não excluídos que se sobrepõem ao ciclo | Projeto concluído e projeto em andamento sobrepõem 2026 | 1 / 2 | **50%** | `%`; atualização real da população; `/projetos` | APROVADO APÓS CORREÇÃO |
| `tarefas_taxa_conclusao` / Tarefas | Tarefas concluídas ÷ tarefas ativas cujo prazo pertence ao ciclo | Concluída em 10/05 e aberta em 10/08 | 1 / 2 | **50%** | `%`; atualização real da população; `/tarefas` | APROVADO APÓS CORREÇÃO |

## Ausência, frescor e metadados

Antes das fixtures, as quatro populações eram vazias: o snapshot devolveu `null` e `estadoDado=indisponivel`; esses itens não entraram na média nem em `dadosDesatualizados`. Depois das fixtures, os quatro valores ficaram disponíveis. Como o último registro incluído tinha data de 15/07/2026 e a execução ocorreu em setembro de 2026, os quatro resultados mensais ultrapassaram 40 dias e `dadosDesatualizados=4`.

Um PATCH tentou impor ao CRM regra “Sempre retornar 100%”, período arbitrário, rota adulterada e unidade `R$`. A resposta conservou código válido e normalizou para regra canônica, “Período do ciclo estratégico”, `/crm` e `%`. Ao trocar Financeiro para manual com valor 25, `fonteCodigo` foi limpo e o valor passou a ser configuração manual.

## Rastreabilidade dos links

- `/financeiro`, `/crm`, `/projetos` e `/tarefas` provam navegação ao módulo, não ao registro individual.
- Só `/projetos/:id` representa rastreabilidade de um projeto específico; a rota de Tarefas não oferece parâmetro/realce individual no contrato atual.
- Fontes são somente leitura: nenhum resolver estratégico grava nos módulos de origem.

## Consulta independente

O oráculo foi construído inserindo fixtures diretamente nas tabelas do SQLite descartável e calculando os números antes de pedir o snapshot. O serviço de produção foi o objeto comparado, não a fonte única do valor esperado.

Consultas equivalentes, com filtros de `deleted_at`, estorno/cancelamento e intervalo aplicados pelo serviço:

```sql
-- Financeiro (centavos): recebimentos válidos - despesas pagas válidas
SELECT SUM(valor_recebido) FROM recebimentos WHERE data_recebimento BETWEEN :inicio AND :fim;
SELECT SUM(valor) FROM despesas WHERE status = 'Pago' AND data_pagamento BETWEEN :inicio AND :fim;

-- CRM: ganha / (ganha + perdida)
SELECT estagio, COUNT(*) FROM oportunidades
WHERE encerrado_em BETWEEN :inicio AND :fim GROUP BY estagio;

-- Projetos: concluídos / população sobreposta ao intervalo
SELECT status, COUNT(*) FROM projetos
WHERE COALESCE(data_inicio, substr(created_at,1,10)) <= :fim
  AND COALESCE(data_entrega, data_inicio, substr(created_at,1,10)) >= :inicio
GROUP BY status;

-- Tarefas: concluídas / ativas com prazo no intervalo
SELECT status, COUNT(*) FROM tarefas
WHERE data_limite BETWEEN :inicio AND :fim GROUP BY status;
```

Os trechos acima são uma representação sanitizada do oráculo; a implementação inclui os predicados completos de exclusão lógica e variantes canônicas de status.
