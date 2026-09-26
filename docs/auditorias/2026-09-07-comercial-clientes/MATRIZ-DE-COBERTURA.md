# Matriz de cobertura — Sessão 02

Legenda: **APROVADO**, **CORRIGIDO**, **BLOQUEADO**, **NÃO APLICÁVEL**.

| ID | Rota/área | Controle ou fluxo | Frontend | API / persistência / FS | Cenários | Situação | Evidência |
|---|---|---|---|---|---|---|---|
| C02-01 | `/clientes` | Acesso por menu e URL | `ListagemClientes` | `GET /api/clientes` | menu, direto, reload | APROVADO | E2E 3/3 |
| C02-02 | `/clientes` | Reflow da navegação, busca e filtros | `ModuleNavigation` + listagem | — | 1120 px, sem overflow | CORRIGIDO | `01`, `02`; S02-F10 |
| C02-03 | `/clientes` | Lista realmente vazia | empty state | `clientes=0` | zero | APROVADO | `01-clientes-vazio.png` |
| C02-04 | `/clientes` | Busca sem resultados | filtered empty state | `GET /api/clientes?q=` | zero filtrado | CORRIGIDO | E2E; S02-F08 |
| C02-05 | `/clientes` | Cabeçalho, contador e navegação local | `PageHeader` | total paginado | zero/32 | APROVADO | `01`, `02` |
| C02-06 | modal | Abrir/cancelar sem alterações | formulário de cliente | nenhuma gravação | cancelamento | APROVADO | E2E focado 2/2 |
| C02-07 | modal | Recusar/confirmar descarte de rascunho | dirty guard | nenhuma gravação | negativo/positivo | APROVADO | E2E focado 2/2 |
| C02-08 | modal | Obrigatórios e foco no primeiro erro | `ClienteFormFields` | validação local/servidor | vazio/inválido | APROVADO | E2E + web 168/168 |
| C02-09 | modal | CPF, telefone, CEP, UF, espaços e acentos | campos/máscaras | `POST /api/clientes` | válido/inválido/normalização | APROVADO | E2E + API |
| C02-10 | modal | Todos os grupos PF | cadastro, contato, endereço, origem, perfis, notas | `clientes` | opcionais/checkbox/select/textarea | APROVADO | E2E |
| C02-11 | modal/lista | Salvar e feedback | mutation + toast | `POST /api/clientes`; AuditLog | sucesso | APROVADO | E2E |
| C02-12 | lista/DB | Persistência após recarga | query list | `clientes` | reload | APROVADO | consulta libSQL |
| C02-13 | editar | Editar nome/status e recarregar | modal de edição | `PATCH /api/clientes/:id` | positivo/404 | APROVADO | E2E + API |
| C02-14 | editar/arquivos | Atualizar caminhos após renomear | cache React Query | outbox/pasta do cliente | rename | CORRIGIDO | E2E; S02-F05 |
| C02-15 | `/clientes` | Pesquisa por nome | searchbox | `GET /api/clientes?q=` | encontrado/inexistente | APROVADO | E2E |
| C02-16 | `/clientes` | Status/categoria/origem combinados | filtros | query paginada | positivo/zero | APROVADO | E2E |
| C02-17 | `/clientes` | Ordenação | select | `sortBy/sortOrder` | Z–A | APROVADO | E2E |
| C02-18 | `/clientes` | Paginação | controles anterior/próxima | `mode=page`, total/pages | 32 registros, 2 páginas | APROVADO | `02`; E2E |
| C02-19 | `/clientes?...` | Estado em URL | hooks de query | parâmetros API | reload/página/filtros | APROVADO | E2E |
| C02-20 | lista | Menu contextual | ações editar/excluir | GET/PATCH/DELETE | teclado/clique | APROVADO | E2E |
| C02-21 | `/clientes/:id` | Detalhe e deep link | `ClienteDetalhes` | `GET /api/clientes/:id/dashboard` | ativo/inexistente/excluído | APROVADO | `03`, `04` |
| C02-22 | detalhe | Todas as abas disponíveis | tabs secundárias | clientes/projetos/propriedades/orçamentos/arquivos | vazio/com dados | APROVADO | E2E |
| C02-23 | detalhe | Legibilidade de notas/form/mapa/toast | componentes de detalhe | — | claro/estado vazio/sucesso | CORRIGIDO | Axe + S02-F07 |
| C02-24 | detalhe | Anotações fixas | card de contato | `clientes.anotacoes` | acentos/quebra | APROVADO | `03`; consulta DB |
| C02-25 | histórico | Criar e validar interação | jornada/modal | histórico + AuditLog | válido, data impossível, vínculo estrangeiro | CORRIGIDO | integração API; S02-F03 |
| C02-26 | propriedades | Vínculo iniciado no cliente | aba/resumo | `propriedades.cliente_id` | uma propriedade | APROVADO | `03`; E2E |
| C02-27 | serviços/projetos | Vínculo iniciado no cliente | aba/resumo | `projetos.cliente_id` | um projeto | APROVADO | `03`; E2E + regressão Cadastros |
| C02-28 | orçamentos | Vínculo iniciado no cliente | aba/resumo | `orcamentos.cliente_id` | orçamento aprovado | APROVADO | `03`; E2E |
| C02-29 | visão geral | Tarefas e agenda relacionadas | resumos | `/api/tarefas`, `/api/compromissos` | vazio | APROVADO | `03`; E2E |
| C02-30 | mapa | Estado vazio, controles e resumo técnico | `ClienteMapaCard` | endpoints geoespaciais | sem levantamento/base | CORRIGIDO | `03`; S02-F07 |
| C02-31 | arquivos | Upload | aba Arquivos | upload + disco | PNG, acento, extensão maiúscula | APROVADO | E2E/API/FS |
| C02-32 | arquivos | Pré-visualização | diálogo + Blob URL | `GET /api/arquivos/preview` | autenticado/sem token URL/Escape | CORRIGIDO | E2E 200; S02-F04/F06 |
| C02-33 | arquivos | Download | ação de arquivo | `GET /api/arquivos/download` | autenticado | APROVADO | E2E 200 |
| C02-34 | arquivos | Excluir e confirmar remoção física | ação/confirm | `DELETE /api/arquivos` | positivo | APROVADO | E2E + `stat`/FS |
| C02-35 | excluir cliente | Bloquear dependências ativas | confirmação/lista | DELETE transacional | propriedade/projeto/orçamento ativos | CORRIGIDO | 409; S02-F01 |
| C02-36 | excluir cliente | Cascata controlada e acesso posterior | lista/detalhe | soft delete cliente/histórico + AuditLog | 204, 404, repetição | CORRIGIDO | integração + E2E; S02-F02 |
| C02-37 | excluir cliente | Texto da confirmação | `ConfirmDialog` | regra do endpoint | cancelamento/confirmar | CORRIGIDO | E2E; S02-F09 |
| C02-38 | ambiente QA | Isolamento de DB e arquivos | setup E2E | raiz `GEOGESTOR_E2E_ROOT` | criação/limpeza | CORRIGIDO | observação de infraestrutura; logs cleanup |
| C02-39 | segurança | Autenticação e confinamento de arquivo | `apiFetch` | token/header/path seguro | preview/download/path traversal geral | APROVADO | web 168 + API 157 |
| C02-40 | acessibilidade | Teclado, Escape, labels, foco, Axe | telas/modal/tabs | — | WCAG 2.2 A/AA automatizado | APROVADO | Axe sem violações |
| C02-41 | acessibilidade nativa | Leitor de tela real | aplicação Electron | — | Narrator/NVDA/JAWS | BLOQUEADO | ferramenta não disponível |
| C02-42 | responsividade ampla | Tema escuro, 360/768/1024/1440 e zoom 200% | Electron/web | — | matriz completa | BLOQUEADO | somente 1120 px comprovado |
| C02-43 | resiliência | Offline, lentidão, reconnect e concorrência | cliente/API | transações | falha/retry/dois escritores | BLOQUEADO | sem injetor controlado |
| C02-44 | arquivos hostis | Vazio, duplicado, longo e todos os MIME | upload/preview | FS/API | matriz destrutiva/limites | BLOQUEADO | parcial em regressão geral |
| C02-45 | módulos externos | CRUD completo de CRM/Projetos/Orçamentos/Propriedades | outros módulos | várias entidades | fora do vínculo iniciado no cliente | NÃO APLICÁVEL | limite explícito da sessão |

## Contagem

Há **45 linhas** na matriz: **29 APROVADO**, **11 CORRIGIDO**, **4 BLOQUEADO**, **1 NÃO APLICÁVEL** e **0 reprovados pendentes**.
