# Matriz de cobertura — Sessão 01, revalidação de 23/09/2026

Esta matriz descreve somente a evidência da execução atual. O inventário foi confrontado com a [matriz original](../2026-09-07-visao-geral/MATRIZ-DE-COBERTURA.md). `E2E` significa Playwright com API e SQLite isolados; `API` significa testes de integração com SQLite isolado; `UNIT` significa testes de filtros e datas.

| ID | Página/controle e ação esperada | Frontend | API / persistência | Cenários | Situação e evidência |
|---|---|---|---|---|---|
| NAV-01 | `/` por URL direta carrega a Visão Geral | `SetupGate`, `Dashboard` | `GET /api/auth/status`, `GET /api/dashboard/overview` | bloqueado/desbloqueado | APROVADO — E2E, 23/09 |
| NAV-02 | Desbloqueio libera a interface após HTTP 200 | `DesbloqueioLocal`, `App` | `POST /api/auth/unlock` | positivo e cache prévio | APROVADO — E2E, 23/09 |
| NAV-03 | Recarga preserva rota/filtros e exige novo desbloqueio local | roteador e filtros | sessão em memória | reload/deep link | BLOQUEADO — recarga exercitada; exigência de novo desbloqueio não afirmada |
| NAV-04 | Link da Visão Geral abre `/tarefas` com busca | `Link` de vencimento | `GET /api/tarefas` | atrasada/pendente | APROVADO — E2E, 23/09 |
| NAV-05 | Limpar remove a busca recebida no deep link | filtros de Tarefas | consulta paginada | filtro ativo | APROVADO — E2E, 23/09 |
| DASH-01 | Painel vazio apresenta estados intencionais | `Dashboard` | overview/relatório sem dados | zero dados | APROVADO — E2E, 23/09 |
| DASH-02 | Painel populado não pisca nem fica em loading infinito | `Dashboard`, skeletons | overview/relatório | dados parciais | BLOQUEADO — carregamento final exercitado; ausência de piscada não medida |
| DASH-03 | Período predefinido calcula datas locais | seletor de período | query `from/to` | mês atual | APROVADO — E2E + UNIT, 23/09 |
| DASH-04 | Período personalizado persiste na URL e após reload | datas e `searchParams` | query `from/to` | limite válido | APROVADO — E2E + UNIT, 23/09 |
| DASH-05 | Intervalo invertido informa erro acessível | `DatePickerField` | requisição evitada | negativo | APROVADO — erro acessível e nenhuma requisição invertida, E2E final |
| DASH-06 | Fluxo de caixa calcula recebimentos, pagamentos e saldo | `AreaChart` | `GET /api/relatorios/geral` | 100/40/60 | APROVADO — E2E, 23/09 |
| DASH-07 | Moeda, eixos e arredondamento usam pt-BR | `Intl.NumberFormat` | centavos no contrato | zero e valores | BLOQUEADO — locale corrigido e retestado; eixos/arredondamento completos não recalculados |
| DASH-08 | Tooltip do fluxo apresenta ambas as séries | `RichTooltip` | dados mensais | ponto único | APROVADO — E2E, 23/09 |
| DASH-09 | “Ver composição” abre cálculo e fecha com Escape | `KpiTransparency` | dados filtrados | teclado | APROVADO — E2E, 23/09 |
| DASH-10 | Indicador Clientes mostra somente registros válidos | `MetricCard` | overview / `clientes` | um cliente | APROVADO — E2E, 23/09 |
| DASH-11 | Indicador Projetos usa o total definido | `MetricCard` | overview / `projetos` | ativo + concluído | APROVADO — E2E, 23/09 |
| DASH-12 | Área sob gestão exclui projeto fora do escopo ativo | `MetricCard` | `projetos.area_ha` | 123,45 + 500 | APROVADO — E2E, 23/09 |
| DASH-13 | Eficiência acompanha conclusão de tarefas | `MetricCard` | `tarefas.status` | 1/4, 2/5 | APROVADO — E2E, 23/09 |
| DASH-14 | Próximos vencimentos ordena, inclui limite e exclui concluída | lista de links | overview / `tarefas` | atrasada/futura/limite | BLOQUEADO — atraso e limite visíveis; ordem da lista não afirmada |
| DASH-15 | Taxa de conclusão trata zero e calcula percentuais | barra/alternativa textual | overview / `tarefas` | 0 e 1/4 | APROVADO — E2E, 23/09 |
| DASH-16 | Distribuição alterna carteira atual e todos | gráfico de rosca | overview / `projetos` | ativo/histórico | APROVADO — E2E, 23/09 |
| DASH-17 | Agrupamento macro/unitário e tipo persistem na URL | filtros do gráfico | overview | categorias/status | APROVADO — escopo, agrupamento e tipo na URL, E2E final |
| DASH-18 | Tooltip e alternativa textual da distribuição coincidem | `DynamicTooltip`, lista `sr-only` | agregação de projetos | 1 projeto/100% | APROVADO — tooltip e lista textual 1 (100%), E2E final |
| DASH-19 | Offline, latência artificial e reconexão durante carregamento | `ApiAvailability` | API interrompida | lento/offline | BLOQUEADO — sem injeção offline/lentidão |
| DASH-20 | Alertas carregam e filtro “Vencidos” remove futuro | `UnifiedNotificationCenter` | `GET /api/alertas` | atrasada/pendente | APROVADO — E2E, 23/09 |
| TASK-01 | Quadro lista as quatro tarefas sintéticas | `Tarefas` | `GET /api/tarefas` | parcial/status | APROVADO — quatro tarefas visíveis no quadro, E2E final |
| TASK-02 | Nova tarefa exige título e impede envio repetido | modal/formulário | `POST /api/tarefas` | vazio/submitting | BLOQUEADO — título requerido na UI/API; dupla submissão não exercitada |
| TASK-03 | Criação persiste projeto, prioridade, data e descrição | modal completo | `POST /api/tarefas` / `tarefas` | acentos/opcionais | APROVADO — campos de projeto, prioridade, data e descrição no SQLite, E2E final |
| TASK-04 | Fechar rascunho alerta sobre perda; cancelar mantém modal | modal | sem escrita | cancelamento | APROVADO — E2E, 23/09 |
| TASK-05 | Editar altera tarefa existente | modal de edição | `PATCH /api/tarefas/:id` | título | APROVADO — E2E, 23/09 |
| TASK-06 | Edição permanece após recarga | quadro | `tarefas` | persistência | APROVADO — E2E, 23/09 |
| TASK-07 | Data local não retrocede por fuso horário | formatador local | `data_limite` | UTC-3 | APROVADO — E2E + UNIT, 23/09 |
| TASK-08 | Falha de status desfaz otimista e informa correção | cartão | `PATCH` sintético 500 | erro | APROVADO — E2E, 23/09 |
| TASK-09 | Concluir atualiza botão, quadro e painel | cartão | `PATCH`, overview | mutação | APROVADO — E2E, 23/09 |
| TASK-10 | Reabrir atualiza botão e painel | cartão | `PATCH`, overview | mutação inversa | APROVADO — reabertura refletida no painel 1/5 (20%), E2E final |
| TASK-11 | Cancelar exclusão mantém exatamente a tarefa | `ConfirmDialog` | sem escrita | destrutivo cancelado | APROVADO — E2E, 23/09 |
| TASK-12 | Confirmar exclusão usa nome/ID sintético e remove da API | `ConfirmDialog` | `DELETE /api/tarefas/:id` | destrutivo confirmado | APROVADO — nome e UUID exatos conferidos antes da exclusão, E2E final |
| TASK-13 | Exclusão lógica grava `deleted_at` e corrige contagem | lista/painel | `tarefas.deleted_at` | reload/API | APROVADO — SQLite, API, recarga e painel após exclusão, E2E final |
| TASK-14 | Arraste usa botão nativo com nome acessível | handle de arraste | `PATCH` de status | teclado/ponteiro | BLOQUEADO — arraste por teclado/ponteiro não exercitado |
| BE-01 | Overview responde contrato e valores coerentes | consumidor Dashboard | `GET /api/dashboard/overview` | vazio/populado | APROVADO — API + E2E, 23/09 |
| BE-02 | Listagem omite registros excluídos | consumidor Tarefas | `GET /api/tarefas` | ativo/excluído | APROVADO — API + E2E, 23/09 |
| BE-03 | POST rejeita título branco, status/prioridade inválidos e data impossível | formulário/API | `POST /api/tarefas` | inválidos | APROVADO — API + E2E, 23/09 |
| BE-04 | POST normaliza espaços e rejeita projeto excluído | formulário/API | `POST /api/tarefas` | normalização/FK lógica | APROVADO — API + E2E, 23/09 |
| BE-05 | PATCH valida contrato e ID inexistente/excluído | edição/status | `PATCH /api/tarefas/:id` | 400/404 | APROVADO — PATCH inválido, ID inexistente e excluído, API final |
| BE-06 | DELETE em ID ativo/excluído respeita 200/404 | confirmação | `DELETE /api/tarefas/:id` | positivo/repetido | APROVADO — API + E2E, 23/09 |
| BE-07 | Mais de 100 datas vazias não ocultam vencimento real | lista de vencimentos | query overview | limite/NULL/vazio | APROVADO — API + E2E, 23/09 |
| BE-08 | Mutações invalidam caches de painel, alertas e auditoria | React Query + hook API | overview/relatório/alertas | criar/editar/status/excluir | BLOQUEADO — painel e auditoria após mutação; alertas após mutação sem asserção |
| BE-09 | Respostas 423 preservam CORS e a hidratação espera desbloqueio | `SetupGate` | hook CORS/auth | reload bloqueado | BLOQUEADO — desbloqueio após recarga exercitado; CORS 423 não inspecionado |
| BE-10 | Duas alterações simultâneas na mesma tarefa não perdem atualização | UI/API | `PATCH /api/tarefas/:id` | concorrência real | BLOQUEADO — sem escrita concorrente sobre a mesma tarefa |
| A11Y-01 | Axe WCAG 2.2 A/AA no painel vazio | Dashboard | — | claro/vazio | APROVADO — Axe/teclado E2E, 23/09 |
| A11Y-02 | Axe WCAG 2.2 A/AA no painel populado claro/escuro | Dashboard | — | temas | APROVADO — Axe/teclado E2E, 23/09 |
| A11Y-03 | Axe WCAG 2.2 A/AA no quadro de tarefas | Tarefas | — | populado | APROVADO — Axe/teclado E2E, 23/09 |
| A11Y-04 | Títulos, labels, ícones e atualizações têm semântica/nome | páginas/componentes | — | leitura acessível | BLOQUEADO — Axe passou; anúncios aria-live e todos os nomes não auditados |
| A11Y-05 | Foco e Escape funcionam em modal, composição e menu móvel | modal/sidebar | — | teclado | BLOQUEADO — foco inicial/retorno e Escape passaram; contenção de foco não comprovada |
| A11Y-06 | Contraste de textos, barras e estados atende AA automatizado | tokens/classes | — | claro/escuro | APROVADO — Axe/teclado E2E, 23/09 |
| A11Y-07 | 360 px não cria rolagem horizontal e drawer fecha com Escape | layout responsivo | — | reflow móvel | APROVADO — Axe/teclado E2E, 23/09 |
| A11Y-08 | Leitor de tela real anuncia gráficos, modal e mudanças | árvore acessível | — | NVDA/JAWS | BLOQUEADO — leitor de tela real indisponível |
| A11Y-09 | Zoom nativo 200% e viewports 768/1024/1440 | layout | — | reflow ampliado | BLOQUEADO — 360/768/1024/1440 sem overflow; zoom nativo 200% não executado |
| NA-01 | Upload/download/arquivos | — | — | não existe no escopo | NÃO APLICÁVEL — recurso ausente nas rotas desta sessão |
| NA-02 | Mapas, camadas, CRS e geometria | — | — | não existe no escopo | NÃO APLICÁVEL — recurso ausente nas rotas desta sessão |
| NA-03 | Importação/exportação | — | — | não existe no escopo | NÃO APLICÁVEL — recurso ausente nas rotas desta sessão |
| NA-04 | Paginação visível do quadro de tarefas | — | API pagina internamente | não há controle na UI do escopo | NÃO APLICÁVEL — recurso ausente nas rotas desta sessão |

## Contagem

- APROVADO: 44
- REPROVADO corrigido nesta rodada: 1 achado (DASH-07, com eixos ainda bloqueados)
- REPROVADO pendente: 0
- BLOQUEADO: 14
- NÃO APLICÁVEL: 4
- Total: 62
