# Melhorias não implementadas

| Melhoria | Benefício | Esforço | Risco | Decisão de produto? |
|---|---|---|---|---|
| Paginar/buscar projetos e tarefas em `/opcoes` | Evita payload grande em bases extensas | Médio | Médio: muda contrato e UX do seletor | Sim |
| Teste multiprocesso de ativação/check-ins | Evidência de concorrência real | Médio | Baixo para produto; alto custo de harness | Não para teste, sim se exigir mudança de lock |
| Campanha de lock SQLite/leitura durante escrita | Prova de recuperação sob contenção | Médio | Pode exigir política de retry | Sim se alterar timeout/comportamento |
| Matriz completa de tendências | Cobre todas as transições de IDs/status | Médio | Baixo | Não |
| Importador de snapshots legados corrompidos | Recuperação controlada | Alto | Alto: pode inventar dados | Sim |
| Rota individual para tarefa vinculada | Rastreabilidade até o registro | Médio | Muda produto de Tarefas | Sim |
| Testes com leitor de tela, alto contraste e zoom 200% | Confiança WCAG além do Axe | Médio | Baixo | Não |
| Paginação/virtualização de listas estratégicas | Escalabilidade visual | Alto | Médio: altera navegação e URL | Sim |

Não foram implementados cenários, projeções, gráficos, PDF/impressão, CSV/XLSX, importação, duplicação, restauração ou drag-and-drop. Essas funcionalidades não existem no produto atual e exigem aprovação expressa.
