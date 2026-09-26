# Matriz de cobertura — Sessão 08

Legenda: **APROVADO** = conforme na primeira verificação; **APROVADO APÓS CORREÇÃO** = defeito corrigido e retestado; **BLOQUEADO** = dependência externa/manual indisponível; **REPROVADO** = falha material remanescente; **NÃO SE APLICA** = fora do produto.

## A. Entradas, rotas e persistência

| ID | Item | Status | Evidência |
|---|---|---|---|
| A01 | Entrada pelo menu Agenda | APROVADO | E2E/build produção. |
| A02 | Rota direta `/calendario` | APROVADO | E2E. |
| A03 | Recarregamento da rota | APROVADO | E2E após seed. |
| A04 | Prioridade `data` sobre `mes` | APROVADO APÓS CORREÇÃO | URL canônica. |
| A05 | URL com mês inválido | APROVADO APÓS CORREÇÃO | `2024-13` removido. |
| A06 | URL com data inexistente | APROVADO APÓS CORREÇÃO | `2024-02-30` removido. |
| A07 | Filtro de tipo inválido na URL | APROVADO APÓS CORREÇÃO | canonicalizado. |
| A08 | Filtro de status inválido na URL | APROVADO APÓS CORREÇÃO | canonicalizado. |
| A09 | Mês/dia no histórico | APROVADO APÓS CORREÇÃO | PageUp + Voltar. |
| A10 | Filtros sem histórico por caractere | APROVADO APÓS CORREÇÃO | escrita com `replace`. |
| A11 | Retorno do detalhe preserva contexto | APROVADO APÓS CORREÇÃO | volta a 29/02. |
| A12 | ID/tipo adulterado no detalhe | APROVADO APÓS CORREÇÃO | estado de não encontrado. |

## B. Modelo temporal e grade

| ID | Item | Status | Evidência |
|---|---|---|---|
| B01 | Domingo como primeira coluna | APROVADO | grade E2E. |
| B02 | Cabeçalhos DOM–SÁB | APROVADO | inspeção visual/semântica. |
| B03 | Fevereiro bissexto 2024 | APROVADO | 35 células. |
| B04 | Mês de 4 semanas | APROVADO | fevereiro/2026, 28 células. |
| B05 | Mês de 5 semanas | APROVADO | fevereiro/2024, 35 células. |
| B06 | Mês de 6 semanas | APROVADO | agosto/2026, 42 células. |
| B07 | Dia atual distinto do selecionado | APROVADO | estilos/ARIA revisados. |
| B08 | Transição 31/01 → fevereiro | APROVADO APÓS CORREÇÃO | clamp em 29/02. |
| B09 | PageUp/PageDown preserva dia possível | APROVADO APÓS CORREÇÃO | teclado E2E. |
| B10 | Datas civis sem conversão UTC | APROVADO APÓS CORREÇÃO | parser/formatter local. |
| B11 | Data inexistente na API | APROVADO APÓS CORREÇÃO | HTTP 400. |
| B12 | Intervalo invertido | APROVADO APÓS CORREÇÃO | HTTP 400. |
| B13 | Hora 00:00 | APROVADO APÓS CORREÇÃO | ordem e persistência. |
| B14 | Hora 23:59 | APROVADO APÓS CORREÇÃO | ordem e URL Google. |
| B15 | Dia inteiro sem hora | APROVADO APÓS CORREÇÃO | depois dos horários. |
| B16 | Ordem total em empates | APROVADO APÓS CORREÇÃO | tipo/título/ID. |

## C. CRUD de compromissos

| ID | Item | Status | Evidência |
|---|---|---|---|
| C01 | Abrir modal | APROVADO | E2E. |
| C02 | Fechar sem gravar | APROVADO | revisão do fluxo. |
| C03 | Aviso de formulário sujo | APROVADO | `beforeunload`. |
| C04 | Título obrigatório/foco | APROVADO | E2E. |
| C05 | Normalização `930` → `09:30` | APROVADO | E2E. |
| C06 | Dia inteiro desabilita hora | APROVADO | controle dedicado. |
| C07 | Tipos permitidos | APROVADO | sete tipos semânticos. |
| C08 | Payload estrito/campos extras | APROVADO APÓS CORREÇÃO | HTTP 400. |
| C09 | Limites de texto | APROVADO APÓS CORREÇÃO | Zod. |
| C10 | Tipo adulterado | APROVADO APÓS CORREÇÃO | HTTP 400. |
| C11 | UUID inválido | APROVADO APÓS CORREÇÃO | HTTP 400. |
| C12 | Cliente removido | APROVADO APÓS CORREÇÃO | recusado. |
| C13 | Projeto removido | APROVADO APÓS CORREÇÃO | recusado. |
| C14 | Cliente/projeto cruzados | APROVADO APÓS CORREÇÃO | recusado. |
| C15 | Auditoria/jornada atômicas | APROVADO APÓS CORREÇÃO | integração DB. |
| C16 | HTML em descrição fica inerte | APROVADO APÓS CORREÇÃO | texto literal em E2E. |

## D. Regras por origem e reconciliação

| ID | Item | Status | Evidência |
|---|---|---|---|
| D01 | Projeto com início e entrega | APROVADO | dois eventos. |
| D02 | Projeto só com início | APROVADO | um evento. |
| D03 | Projeto só com entrega | APROVADO | um evento. |
| D04 | Projeto sem datas | APROVADO | nenhum evento. |
| D05 | Tarefa sem prazo | APROVADO | nenhum evento. |
| D06 | Projeto removido não aparece | APROVADO APÓS CORREÇÃO | filtro `deletedAt`. |
| D07 | Tarefa removida não aparece | APROVADO APÓS CORREÇÃO | filtro `deletedAt`. |
| D08 | Compromisso removido não aparece | APROVADO APÓS CORREÇÃO | filtro `deletedAt`. |
| D09 | Cliente efetivo vem do projeto | APROVADO APÓS CORREÇÃO | `COALESCE`/integridade. |
| D10 | Sem duplicação por JOIN | APROVADO APÓS CORREÇÃO | uma linha por ID. |
| D11 | Três fontes sem corte 500 | APROVADO APÓS CORREÇÃO | 505 compromissos. |
| D12 | Detalhe de tarefa por ID | APROVADO APÓS CORREÇÃO | endpoint dedicado. |

## E. Filtros, erros e estados

| ID | Item | Status | Evidência |
|---|---|---|---|
| E01 | Busca por título | APROVADO | E2E. |
| E02 | Busca sem acento | APROVADO | `reuniao` encontra `Reunião`. |
| E03 | Busca por descrição/contexto | APROVADO | índice composto no cliente. |
| E04 | Filtro por tipo | APROVADO | opções reais. |
| E05 | Filtro por status | APROVADO | opções reais. |
| E06 | Contagem total/filtrada | APROVADO APÓS CORREÇÃO | 18 e 2/18. |
| E07 | Limpar filtros | APROVADO APÓS CORREÇÃO | restaura 18. |
| E08 | Estado vazio do dia | APROVADO APÓS CORREÇÃO | mensagem acionável. |
| E09 | Falha parcial de tarefas | APROVADO APÓS CORREÇÃO | projetos/compromissos preservados. |
| E10 | Retry da fonte falha | APROVADO APÓS CORREÇÃO | tarefa reaparece. |
| E11 | Cancelamento de consulta antiga | APROVADO APÓS CORREÇÃO | `AbortSignal` nas três fontes. |
| E12 | Loading anunciado | APROVADO APÓS CORREÇÃO | `aria-busy`/texto. |

## F. Google Agenda e OAuth

| ID | Item | Status | Evidência |
|---|---|---|---|
| F01 | URL template com título/descrição | APROVADO | parâmetros codificados. |
| F02 | URL template com cliente/projeto | APROVADO | descrição composta. |
| F03 | `state` aleatório, TTL e uso único | APROVADO | revisão de contrato. |
| F04 | Evento local com hora | APROVADO APÓS CORREÇÃO | mapper + E2E. |
| F05 | Evento local de dia inteiro | APROVADO APÓS CORREÇÃO | fim exclusivo. |
| F06 | Importação `dateTime` para São Paulo | APROVADO APÓS CORREÇÃO | teste de offset. |
| F07 | OAuth real/autorização | BLOQUEADO | sem conta QA. |
| F08 | Cancelamento/revogação real | BLOQUEADO | sem conta QA. |
| F09 | Access token expirado | BLOQUEADO | sem conta QA. |
| F10 | Refresh token inválido | BLOQUEADO | sem conta QA. |
| F11 | Falhas 401/403/429/5xx reais | BLOQUEADO | sem conta QA. |
| F12 | Conflito simultâneo local/remoto | BLOQUEADO | política não formalizada. |
| F13 | Exclusão bidirecional | BLOQUEADO | sem tombstone/protocolo. |
| F14 | Duplicidade em retry remoto | BLOQUEADO | requer calendário QA. |

## G. UX, responsividade e acessibilidade

| ID | Item | Status | Evidência |
|---|---|---|---|
| G01 | Hierarquia de headings | APROVADO | axe/revisão. |
| G02 | Botões por tipo correto | APROVADO | semântica nativa. |
| G03 | Labels e nomes acessíveis | APROVADO | axe/E2E. |
| G04 | Foco visível | APROVADO | classes canônicas. |
| G05 | Navegação por setas/Home/End/Page | APROVADO | handlers semânticos. |
| G06 | Mobile 360 px | APROVADO | sem overflow. |
| G07 | Tema escuro | APROVADO | captura/axe. |
| G08 | Layout 1120 px | APROVADO APÓS CORREÇÃO | breakpoint `xl`. |
| G09 | Movimento reduzido | APROVADO APÓS CORREÇÃO | spinner `motion-reduce`. |
| G10 | Leitor de tela real | BLOQUEADO | ambiente manual ausente. |
| G11 | Zoom nativo 200%/alto contraste | BLOQUEADO | ambiente manual ausente. |
| G12 | Matriz de dispositivos físicos | BLOQUEADO | ambiente manual ausente. |

## H. Desktop, volume e não regressão

| ID | Item | Status | Evidência |
|---|---|---|---|
| H01 | Testes API | APROVADO | 178/178. |
| H02 | Testes web | APROVADO | 182/182. |
| H03 | Testes Electron | APROVADO | 18/18. |
| H04 | E2E dedicado | APROVADO | 4/4. |
| H05 | Lint/typecheck/diff-check | APROVADO | todos verdes. |
| H06 | Build instalador | APROVADO | NSIS 1.0.4. |
| H07 | Smoke do pacote | APROVADO | banco cifrado/segredos. |
| H08 | Banco real inalterado | APROVADO | tamanho/hash preservados. |
| H09 | Concorrência multiprocesso SQLite | BLOQUEADO | lock observado no seed; retry só no runner. |
| H10 | Upgrade sobre instalação antiga | BLOQUEADO | cenário herdado não disponível. |

## Totais

| Resultado | Quantidade |
|---|---:|
| APROVADO | 45 |
| APROVADO APÓS CORREÇÃO | 46 |
| REPROVADO | 0 |
| BLOQUEADO | 13 |
| NÃO SE APLICA | 0 |
| **TOTAL** | **104** |

Os itens bloqueados não foram contados como aprovados. Os itens de integração Google real foram separados dos contratos e mapeamentos locais já verificáveis.

