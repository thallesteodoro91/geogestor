# Achados corrigidos — Sessão 01

Todos os achados abaixo foram reproduzidos antes da correção e encerrados como **CORRIGIDO**. Evidência comum de reteste: `session01-dashboard-tasks.spec.ts`, `session01-dashboard-tasks.integration.test.ts`, suítes completas e capturas da pasta `evidencias/`.

## S01-01 — P1 — Frontend/autenticação — `/`

- Pré-condição e passos: aplicação bloqueada; informar a senha correta e aguardar `POST /api/auth/unlock` 200.
- Esperado: painel liberado imediatamente. Obtido: a tela permanecia bloqueada por até 5 s.
- Causa raiz: `loadAuthStatus` reutilizava o cache anterior após o desbloqueio.
- Arquivo/endpoint: `apps/web/src/App.tsx`; `POST /api/auth/unlock`, `GET /api/auth/status`.
- Correção: invalidar `authStatusCache` antes do refetch.
- Reteste: E2E desbloqueou e carregou o painel; **CORRIGIDO**.

## S01-02 — P1 — Backend/integridade — `/tarefas`

- Pré-condição e passos: enviar título em branco, status/prioridade fora do catálogo ou data impossível ao `POST/PATCH`.
- Esperado: 400 com contrato seguro. Obtido: valores semanticamente inválidos podiam chegar à persistência.
- Causa raiz: esquema permissivo sem trim, enum e validação real de calendário.
- Arquivo/endpoint: `apps/api/src/routes/tarefas.routes.ts`; `POST /api/tarefas`, `PATCH /api/tarefas/:id`.
- Correção: limites, trim, enums e refinamento AAAA-MM-DD com validação de calendário.
- Reteste: todos os payloads inválidos retornaram 400 e o título válido foi normalizado; **CORRIGIDO**.

## S01-03 — P2 — Backend/exclusão lógica — `/tarefas`

- Pré-condição e passos: excluir tarefa sintética e repetir PATCH/DELETE no mesmo ID.
- Esperado: registro excluído não pode ser alterado nem “excluído” novamente. Obtido: a condição não distinguia ativo de excluído.
- Causa raiz: mutações filtravam apenas por ID.
- Arquivo/endpoint: `apps/api/src/routes/tarefas.routes.ts`; `PATCH/DELETE /api/tarefas/:id`.
- Correção: exigir `deleted_at IS NULL`; 404 após exclusão.
- Reteste: primeira exclusão 200; PATCH e segundo DELETE 404; **CORRIGIDO**.

## S01-04 — P1 — Backend/cálculo — `/`

- Pré-condição e passos: inserir mais de 100 tarefas sem prazo antes de uma tarefa futura real e abrir o painel.
- Esperado: tarefa futura aparece nos próximos vencimentos. Obtido: o `LIMIT 100` era consumido por datas vazias.
- Causa raiz: filtro de data era aplicado depois da limitação e o status concluído não era normalizado de forma uniforme.
- Arquivo/endpoint: `apps/api/src/routes/dashboard.routes.ts`; `GET /api/dashboard/overview`.
- Correção: excluir datas nulas/vazias e concluídas na consulta antes da ordenação/limite.
- Reteste: teste com 101 registros vazios preserva o vencimento real e exclui sua versão concluída; **CORRIGIDO**.

## S01-05 — P1 — Frontend/cache — `/` ↔ `/tarefas`

- Pré-condição e passos: criar, concluir, reabrir ou excluir tarefa e retornar ao painel.
- Esperado: contagens e gráficos refletem a mutação sem recarga manual. Obtido: queries de painel/relatórios podiam ficar obsoletas.
- Causa raiz: invalidação restrita à lista de tarefas.
- Arquivo/endpoint: `apps/web/src/pages/Tarefas/Tarefas.tsx`, `apps/web/src/pages/Dashboard.tsx`; tarefas/overview/relatório/auditoria.
- Correção: invalidação coordenada e `refetchOnMount: always` nas leituras consolidadas.
- Reteste: 25% → 40% → 25% e 1/4 → 2/5 → 1/4 na interface real; **CORRIGIDO**.

## S01-06 — P2 — Frontend/CRUD — `/tarefas`

- Pré-condição e passos: localizar tarefa existente no quadro.
- Esperado: editar os campos suportados pela API. Obtido: não havia ação/formulário de edição no fluxo.
- Causa raiz: CRUD do backend estava disponível sem superfície equivalente no frontend.
- Arquivo/endpoint: `apps/web/src/pages/Tarefas/Tarefas.tsx`; `PATCH /api/tarefas/:id`.
- Correção: reutilizar o modal para edição, com título, descrição, projeto, prioridade, data e estado de envio.
- Reteste: título alterado e preservado após reload/consulta; **CORRIGIDO**.

## S01-07 — P1 — Frontend/consistência — `/tarefas`

- Pré-condição e passos: provocar 500 no PATCH de conclusão.
- Esperado: estado visual volta ao valor persistido e a pessoa é informada. Obtido: a atualização otimista podia permanecer incorreta.
- Causa raiz: resposta não OK não disparava restauração consistente.
- Arquivo/endpoint: `apps/web/src/pages/Tarefas/Tarefas.tsx`; `PATCH /api/tarefas/:id`.
- Correção: checagem de erro, snapshot e rollback, mensagem acionável.
- Reteste: 500 sintético restaurou “Concluir” e exibiu “A alteração foi desfeita”; **CORRIGIDO**.

## S01-08 — P2 — Frontend/data — `/tarefas`

- Pré-condição e passos: gravar `AAAA-MM-DD` e renderizar em fuso America/Sao_Paulo.
- Esperado: mesmo dia civil. Obtido: parse UTC podia exibir o dia anterior.
- Causa raiz: `new Date('AAAA-MM-DD')` interpreta meia-noite UTC.
- Arquivo: `apps/web/src/pages/Tarefas/Tarefas.tsx`.
- Correção: construir data local a partir de ano, mês e dia.
- Reteste: data exibida em pt-BR permaneceu no dia gravado após reload; **CORRIGIDO**.

## S01-09 — P2 — Frontend/listagem — `/tarefas`

- Pré-condição e passos: excluir tarefa numa lista filtrada/paginada.
- Esperado: item e total convergem e o painel é invalidado. Obtido: total e consumidores podiam manter valor anterior.
- Causa raiz: estado local removia o item sem reconciliar total e queries relacionadas.
- Arquivo: `apps/web/src/pages/Tarefas/Tarefas.tsx`.
- Correção: decrementar total com piso zero e invalidar consumidores.
- Reteste: tarefa some, busca API retorna total zero e painel volta a 1/4; **CORRIGIDO**.

## S01-10 — P2 — Frontend/formulário — `/tarefas`

- Pré-condição e passos: submeter criação/edição rapidamente.
- Esperado: um pedido, botão em loading e sem submissão duplicada. Obtido: não havia guarda uniforme.
- Causa raiz: ausência de estado compartilhado de submissão.
- Arquivo: `apps/web/src/pages/Tarefas/Tarefas.tsx`.
- Correção: estado `submitting`, botão desabilitado somente durante a requisição e feedback “Criando…”/“Salvando…”.
- Reteste: fluxo integrado completou uma única mutação por ação; **CORRIGIDO**.

## S01-11 — P2 — Frontend/acessibilidade — `/` e `/tarefas`

- Pré-condição e passos: inspecionar árvore acessível e navegar pelas ações dos cartões.
- Esperado: hierarquia de títulos, botões nomeados, links reais e nenhum controle interativo aninhado em `div role=button`. Obtido: nomes/níveis inconsistentes e o cartão inteiro recebia semântica de botão de arraste ao redor de botões filhos.
- Causa raiz: semântica adicionada incidentalmente pelo drag handle no contêiner e ações apenas visuais.
- Arquivos: `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/pages/Tarefas/Tarefas.tsx`.
- Correção: links de detalhamento, `aria-label`, ícones decorativos, `h3` e handle de arraste em botão nativo independente.
- Reteste: Axe nas duas rotas com zero violações e locators por nome acessível; **CORRIGIDO**.

## S01-12 — P1 — Frontend/WCAG — `/`

- Pré-condição e passos: executar Axe no painel claro populado.
- Esperado: WCAG 2.2 AA. Obtido: `aria-required` inválido em botão de date picker e contrastes entre 2,13:1 e 4,30:1 em textos/barras.
- Causa raiz: ARIA de input aplicada ao gatilho e tokens claros excessivamente luminosos com texto branco.
- Arquivos: `DatePickerField.tsx`, `Dashboard.tsx`, `index.css`.
- Correção: remover atributo não permitido, escurecer tokens claros e ajustar classes de texto por tema.
- Reteste: Axe vazio/populado claro/escuro e tarefas, zero violações; **CORRIGIDO**.

## S01-13 — P2 — Frontend/tema — todas as rotas autenticadas

- Pré-condição e passos: preferência salva “system” com sistema em tema claro; consultar o botão.
- Esperado: “Ativar modo escuro”. Obtido: “Ativar modo claro”.
- Causa raiz: label usava a preferência armazenada, não o tema efetivo.
- Arquivo: `apps/web/src/components/Layout.tsx`.
- Correção: estado reativo da preferência do sistema e label/ícone derivados do tema efetivo.
- Reteste: alternância clara→escura por nome acessível, Axe zero; **CORRIGIDO**.

## S01-14 — P2 — Integração/auth/CORS — recarga autenticada

- Pré-condição e passos: recarregar a página enquanto a sessão em memória está bloqueada.
- Esperado: somente o status público é consultado e qualquer 423 é CORS-legível. Obtido: hidratação protegida disparava antes da autenticação; respostas antecipadas não recebiam cabeçalhos CORS e poluíam o console.
- Causa raiz: hidratação operacional iniciada antes de `auth/status` e registro do CORS depois do hook de segurança.
- Arquivos/endpoints: `apps/web/src/App.tsx`, `apps/api/src/server.ts`; configurações operacionais e auth.
- Correção: hidratar apenas após setup/desbloqueio e registrar CORS antes do hook de acesso.
- Reteste: múltiplos reloads sem 423/CORS no console; suíte de autenticação e E2E aprovadas; **CORRIGIDO**.

## Contagem dos achados

- P0: 0
- P1: 6, todos corrigidos
- P2: 8, todos corrigidos
- P3: 0
- Pendentes: 0

