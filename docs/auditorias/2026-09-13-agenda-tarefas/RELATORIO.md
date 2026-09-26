# Auditoria full-stack — Sessão 09: Agenda — Tarefas

Data: 13/09/2026  
Repositório: GeoGestor desktop 1.0.4  
Escopo: `/tarefas`, modelos de checklist, projeto, cliente, calendário, dashboard, alertas e auditoria  
Veredito: **APROVADA COM RESSALVAS DE COBERTURA MANUAL**

## Resumo executivo

A sessão encontrou e corrigiu 15 defeitos, incluindo três riscos materiais: truncamento silencioso acima de 100 tarefas, aplicação de modelo sem atomicidade integral e respostas concorrentes capazes de sobrescrever estado mais recente. Após as correções, as suítes automatizadas ficaram verdes e o banco real permaneceu intocado.

O produto agora pagina explicitamente o quadro, apresenta totais globais por status, preserva registros legados sem fazê-los desaparecer, busca por título/descrição/projeto/cliente sem depender de acentos, valida vínculos e payloads no servidor, aplica modelos em uma transação única e protege a interface contra rollback ou resposta fora de ordem.

As ressalvas não representam defeitos materiais conhecidos. São casos que exigiriam instrumentação ou validação manual adicional: gesto real de arrastar por mouse/touch, inspeção com leitor de tela real e teste de concorrência multiusuário fora do processo isolado.

## Baseline e segurança dos dados

- Branch: `main`.
- Commit de referência: `a16551a8b63e73f42d826297df893488e5ab88ca`.
- Árvore já estava amplamente modificada por sessões anteriores; alterações alheias foram preservadas.
- Banco real: `data/geogestor.db`.
- Tamanho antes/depois: 1.990.656 bytes.
- Última modificação antes/depois: 30/08/2026 14:12:58.
- SHA-256 antes/depois: `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`.
- Todos os testes destrutivos usaram bancos temporários em `scratch/`.
- Prefixo sintético: `QA-AUDIT-S09-20260913-`.

## Resultado por camada

| Camada | Resultado |
|---|---|
| API de tarefas | Contrato estrito; vínculo cliente/projeto validado; paginação e totais globais; busca composta; auditoria transacional |
| Kanban | Estados de carga/erro/vazio; paginação; legado explícito; deep link com foco; descarte de rascunho; rollback otimista protegido |
| Modelos | CRUD, cópia inativa, limite de 100 etapas, descarte protegido, aplicação idempotente e histórico preservado |
| Projeto | Progresso calculado sobre o conjunto integral, com indicação das 100 tarefas exibidas |
| Cliente | Tarefa direta e tarefa de projeto aparecem sem duplicação; vínculo direto é comunicado na edição |
| Calendário/dashboard/alertas | Tarefa criada aparece no intervalo civil correto, na métrica e no alerta correspondente |
| Acessibilidade | Axe WCAG 2 A/AA, 2.1 e 2.2 sem violações nas três jornadas; foco visível e rótulos explícitos |
| Empacotado | Build Windows e smoke da API empacotada aprovados |

A matriz registra 137 itens: 104 aprovados automaticamente, 24 aprovados por inspeção, 7 não executados com justificativa e 2 fora do escopo. Nenhum item foi deixado sem status.

## Principais correções

1. `GET /api/tarefas` mantém compatibilidade legada sem limite oculto e oferece `mode=page`, `page`, `limit`, `total`, `totalPages` e `statusTotals`.
2. Ordenação determinística e timestamps ISO impedem que uma tarefa recém-criada seja enviada para uma página posterior por comparação textual inconsistente.
3. Busca passou a abranger título, descrição, projeto e cliente, com normalização de acentos e caixa.
4. Datas civis reais, enumerações, UUIDs, limites, campos extras e PATCH vazio são rejeitados com 400.
5. Cliente inexistente/inativo, projeto inexistente e vínculo cliente/projeto cruzado são rejeitados antes da escrita.
6. Aplicação de modelo, tarefas, auditorias, registro da aplicação e jornada do cliente passaram a compartilhar uma transação.
7. Duplicidade de etapa usa título normalizado e é idempotente em reaplicações.
8. Requisições de listagem e mudanças de status receberam controle de versão; resposta antiga não vence a mais nova.
9. Deep link busca a tarefa por ID independentemente dos filtros, move o foco, mantém o destaque por tempo perceptível e limpa somente o parâmetro transitório.
10. Estados e prioridades legados recebem apresentação neutra e aviso explícito.
11. Alertas de tarefa deixaram de truncar silenciosamente a fonte em 500 linhas.
12. Formulários de tarefa e modelo protegem rascunhos realmente alterados, sem alerta quando nada mudou.
13. Contrastes limítrofes, semântica das colunas, texto de atraso e foco dos cartões foram corrigidos.
14. O resumo do projeto usa os totais globais, não apenas a primeira página.
15. Filtro com apenas data final exclui tarefas sem prazo, em vez de tratá-las como anteriores ao limite.

## Evidências e artefatos

- [Matriz de cobertura](./MATRIZ-DE-COBERTURA.md)
- [Achados](./ACHADOS.md)
- [Oráculo de tarefas](./ORACULO-DE-TAREFAS.md)
- [Protocolo de modelos](./PROTOCOLO-MODELOS-CHECKLIST.md)
- [Comandos e resultados](./COMANDOS-E-RESULTADOS.md)
- [Evidências visuais](./evidencias/README.md)

## Riscos residuais e próximos passos

- Validar o arrastar-e-soltar com mouse e touch em uma sessão exploratória; transições equivalentes foram validadas pela API e pelos controles acessíveis de concluir/reabrir.
- Executar uma sessão curta com NVDA para confirmar a experiência auditiva do DnD; Axe e navegação semântica não substituem leitor de tela real.
- Se filtros de tarefas forem considerados estado compartilhável, persistir busca, projeto, prioridade, datas e página na URL. Hoje somente o deep link da tarefa possui contrato de URL.
- Considerar virtualização se o produto vier a exibir mais de 100 cartões simultaneamente. A solução atual pagina em 100 e não congela no volume auditado.

Não há P0, P1 ou P2 conhecido em aberto dentro do fluxo automatizado auditado.
