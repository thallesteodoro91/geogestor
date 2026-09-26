# Matriz da pesquisa global

| Tipo | Fonte | Regra de elegibilidade | Link profundo | Teste |
|---|---|---|---|---|
| Cliente | clientes | `deletedAt` nulo | `/clientes/:id` | ativo aparece; removido não aparece |
| Projeto | projetos + cliente | projeto e cliente ativos | `/projetos/:id` | ativo aparece; projeto/pai removido não aparece |
| Orçamento | orçamentos + cliente | orçamento e cliente ativos | `/orcamentos/:id/editar` | ativo aparece; removido/pai removido não aparece |
| Tarefa | tarefas + projeto | tarefa e projeto ativos | `/tarefas?tarefaId=:id` | ativa aparece; removida/pai removido não aparece |
| Compromisso | compromissos | `deletedAt` nulo | `/calendario/compromisso/:id` | ativo aparece; removido não aparece |
| Documento | arquivos + cliente | cliente ativo | `/clientes/:id?aba=documentos` | aparece apenas para cliente ativo |

## Contrato auditado

- Entrada mínima: dois caracteres; um caractere retorna lista vazia.
- Debounce no cliente: 180 ms.
- Limite por tipo: oito resultados.
- Limite agregado: 30 resultados.
- Ordenação: título e ID, determinística por tipo.
- Estados: inicial, carregando, vazio, erro com retentativa e resultados agrupados.
- Acesso: botão móvel/desktop, Ctrl/Meta+K, diálogo rotulado, foco inicial e retorno de foco.

## Resultado

O teste integrado `apps/api/src/session15-global-search.integration.test.ts` usa banco temporário e cobre os seis tipos, registros removidos, links exatos, entrada curta, volume e ordenação. Passou isoladamente e dentro da suíte API 190/190.

## Risco residual de desempenho

A implementação ainda materializa coleções amplas em memória antes do filtro final em parte do fluxo. O limite de resposta não prova custo de consulta sob alta cardinalidade. A correção recomendada é benchmark com massa sintética representativa e, se necessário, filtro/ordenação/limite no banco com índices documentados.
