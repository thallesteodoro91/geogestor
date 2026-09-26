# Matriz de cobertura — Sessão 09

Legenda: **APROVADO** = exercitado automaticamente; **APROVADO POR INSPEÇÃO** = contrato/código verificado e coberto indiretamente; **NÃO EXECUTADO** = limitação explícita, sem inferência de aprovação; **FORA DO ESCOPO** = não pertence ao contrato desta sessão.

## A. Inventário e contratos

| ID | Item | Status | Evidência/observação |
|---|---|---|---|
| A01 | Rotas do frontend e deep links de tarefa | APROVADO | `/tarefas?tarefaId=…` no E2E. |
| A02 | Chamadas frontend→API | APROVADO POR INSPEÇÃO | `apiClient`/`apiFetch`, tipos e build. |
| A03 | `GET /api/tarefas` legado | APROVADO | 101+ sem truncamento. |
| A04 | `GET /api/tarefas?mode=page` | APROVADO | Página, limite, totais e status. |
| A05 | `POST /api/tarefas` | APROVADO | API + interface. |
| A06 | `PATCH /api/tarefas/:id` | APROVADO | Edição e transições. |
| A07 | `DELETE /api/tarefas/:id` | APROVADO | Soft delete e repetição 404. |
| A08 | `GET /api/tarefas/calendar` | APROVADO | Intervalo de hoje. |
| A09 | CRUD de modelos | APROVADO | API e interface. |
| A10 | Aplicação por ID e chave legada | APROVADO | Ambos os endpoints. |
| A11 | Schema/tabelas/índices/migração v15 | APROVADO | Suíte API 184/184. |
| A12 | Integração projeto/cliente | APROVADO | E2E e teste shared-records. |
| A13 | Integração dashboard/calendário/alertas | APROVADO | E2E com mesma tarefa. |
| A14 | Auditoria e jornada | APROVADO | Consultas diretas no teste focado. |
| A15 | Importação/exportação específica de tarefas | FORA DO ESCOPO | Módulo não oferece esse fluxo. |

## B. Kanban e tarefas

| ID | Item | Status | Evidência/observação |
|---|---|---|---|
| B01 | Estado inicial de carregamento | APROVADO POR INSPEÇÃO | Estado dedicado e `aria-live`. |
| B02 | Sucesso com dados | APROVADO | Massa 103 registros. |
| B03 | Zero dados reais | APROVADO POR INSPEÇÃO | Copy/CTA distintos no componente. |
| B04 | Zero resultados por filtro | APROVADO | Busca composta retorna 1 e estados filtrados. |
| B05 | Erro de leitura e tentativa novamente | APROVADO POR INSPEÇÃO | Dados anteriores preservados e botão retry. |
| B06 | Colunas A Fazer/Em Progresso/Concluído | APROVADO | Contagens por página e por conjunto. |
| B07 | Coluna vazia | APROVADO POR INSPEÇÃO | Dropzone mantém altura e mensagem própria. |
| B08 | Card curto | APROVADO | Massa de volume. |
| B09 | Card longo | APROVADO | Descrição com HTML literal/emoji; clamp e quebra. |
| B10 | Associação a projeto/cliente | APROVADO | Projeto B, cliente direto e herança. |
| B11 | Tarefa sem prazo | APROVADO | 98+ itens da massa. |
| B12 | Tarefa vencida | APROVADO | Badge textual “Atrasada”. |
| B13 | Tarefa para hoje | APROVADO | Calendário e alertas. |
| B14 | Tarefa futura | APROVADO | API e fonte de alertas. |
| B15 | Prioridades Baixa/Média/Alta | APROVADO | Distribuição determinística. |
| B16 | Prioridade legada | APROVADO | `Urgente` explicitamente sinalizada. |
| B17 | Status legado | APROVADO | `Aguardando terceiro` recuperado em A Fazer. |
| B18 | Criação por interface | APROVADO | Tarefa aparece imediatamente na página 1. |
| B19 | Validação de título vazio | APROVADO | 400 na API; required no formulário. |
| B20 | Limite de título/descrição/categoria | APROVADO | Schemas e casos negativos. |
| B21 | Unicode, emoji e HTML literal | APROVADO | Texto inerte renderizado. |
| B22 | Cliente inexistente/inativo | APROVADO | Sem escrita; 400. |
| B23 | Projeto inexistente/excluído | APROVADO | Sem escrita; 400/404. |
| B24 | Vínculo cliente/projeto cruzado | APROVADO | Rejeitado. |
| B25 | Tarefa direta a cliente | APROVADO | Preservada sem projeto. |
| B26 | Editar título/descrição/prioridade/prazo | APROVADO | API focada e UI de edição. |
| B27 | Editar tarefa direta sem escolher projeto | APROVADO | Vínculo preservado; mensagem explícita. |
| B28 | Alterar associação para projeto | APROVADO | `resolveClientProjectLink` recompõe cliente. |
| B29 | Cancelar criação com rascunho | APROVADO | Descartar/continuar editando no E2E. |
| B30 | Fechar edição intacta | APROVADO | Escape sem falso alerta. |
| B31 | Proteção ao navegar com rascunho | APROVADO POR INSPEÇÃO | `beforeunload` condicionado a dirty state. |
| B32 | A Fazer→Em Progresso→Concluído→A Fazer | APROVADO | Teste API. |
| B33 | Concluir e reabrir por controles acessíveis | APROVADO | E2E. |
| B34 | Outras combinações de status válidos | APROVADO POR INSPEÇÃO | Backend valida destino, não restringe origem. |
| B35 | Arrastar com mouse | NÃO EXECUTADO | Exige sessão exploratória com dispositivo apontador. |
| B36 | Arrastar com touch | NÃO EXECUTADO | Ambiente de desktop sem touch. |
| B37 | Rollback otimista em falha 500 | APROVADO | Falha sintética no E2E. |
| B38 | Resposta antiga não vence mudança nova | APROVADO POR INSPEÇÃO | Versão monotônica por tarefa e listagem. |
| B39 | Clique duplo/reenvio de formulário | APROVADO POR INSPEÇÃO | Botão desabilitado durante envio. |
| B40 | Excluir: cancelar | APROVADO | Registro permanece. |
| B41 | Excluir: confirmar | APROVADO | Some das leituras ativas. |
| B42 | Excluir novamente | APROVADO | 404, sem segunda auditoria. |
| B43 | Auditoria INSERT/UPDATE/DELETE | APROVADO | Contagem/ações no banco isolado. |
| B44 | Jornada na criação/conclusão | APROVADO | Eventos consultados no teste focado. |
| B45 | Duplicidade manual de título | APROVADO POR INSPEÇÃO | Permitida por domínio; identidade é UUID. |

## C. Busca, filtros, paginação e deep links

| ID | Item | Status | Evidência/observação |
|---|---|---|---|
| C01 | Busca por título | APROVADO | API focada. |
| C02 | Busca por descrição | APROVADO | `memorial descritivo`. |
| C03 | Busca por projeto | APROVADO | `sao jose`. |
| C04 | Busca por cliente | APROVADO | `acores`. |
| C05 | Busca sem acento/caixa | APROVADO | Normalização SQL/JS. |
| C06 | Espaços e termo vazio | APROVADO | Trim e fallback para conjunto total. |
| C07 | Filtro por projeto | APROVADO | 102 itens no projeto principal. |
| C08 | Filtro por prioridade | APROVADO | API focada. |
| C09 | Filtro por início/fim | APROVADO | Datas inclusivas. |
| C10 | Intervalo invertido na UI | APROVADO POR INSPEÇÃO | Mensagem acionável antes da chamada. |
| C11 | Intervalo invertido na API | APROVADO | 400. |
| C12 | Data impossível | APROVADO | 400. |
| C13 | Combinação de busca e filtros | APROVADO | Predicado único no servidor. |
| C14 | Limpar filtros | APROVADO POR INSPEÇÃO | Reseta busca, projeto, prioridade, datas e página. |
| C15 | Página decimal/zero/negativa | APROVADO | 400. |
| C16 | Limite decimal/zero/>100 | APROVADO | 400. |
| C17 | Ordenação determinística | APROVADO | `createdAt desc, id asc`; timestamp ISO. |
| C18 | 101+ tarefas sem congelar/truncar | APROVADO | 103 itens, página 100+3. |
| C19 | Total por status global | APROVADO | `statusTotals`, inclusive `outros`. |
| C20 | Contagem exibida vs. total | APROVADO | Copy “100 exibidas · 103 no conjunto”. |
| C21 | Deep link para item da página 2 | APROVADO | Busca por ID independente da página. |
| C22 | Deep link sob filtros ocultadores | APROVADO | Filtros ignorados/resetados. |
| C23 | Foco/destaque/canonicalização | APROVADO | Foco no article; parâmetro removido após 2,4 s. |
| C24 | Deep link inexistente | APROVADO POR INSPEÇÃO | Toast e remoção do parâmetro transitório. |
| C25 | Persistência de filtros na URL | NÃO EXECUTADO | Não há contrato atual; registrado como melhoria. |
| C26 | Resposta fora de ordem na busca | APROVADO POR INSPEÇÃO | Request version invalida resposta anterior. |

## D. Modelos de checklist

| ID | Item | Status | Evidência/observação |
|---|---|---|---|
| D01 | Listagem inicial/loading/erro/retry | APROVADO POR INSPEÇÃO | Estados separados no painel. |
| D02 | Criar modelo | APROVADO | UI com duas etapas. |
| D03 | Editar modelo | APROVADO | API e formulário compartilhado. |
| D04 | Duplicar modelo | APROVADO | Cópia inativa e independente. |
| D05 | Excluir modelo | APROVADO | Soft delete e confirmação. |
| D06 | Modelo sem etapas | APROVADO | 400. |
| D07 | Etapa vazia | APROVADO | 400. |
| D08 | Mais de 100 etapas | APROVADO POR INSPEÇÃO | UI bloqueia e API limita. |
| D09 | Campos extras | APROVADO | Modelo e etapa retornam 400. |
| D10 | Ordenar etapas | APROVADO POR INSPEÇÃO | Botões nativos acima/abaixo e ordem persistida. |
| D11 | Remover etapa | APROVADO POR INSPEÇÃO | Botão rotulado e mínimo de uma etapa. |
| D12 | Descartar rascunho do modelo | APROVADO | Escape/confirm no E2E. |
| D13 | Aplicar modelo ativo | APROVADO | 2 criadas. |
| D14 | Aplicar modelo inativo/excluído | APROVADO | 404. |
| D15 | Projeto inexistente | APROVADO | 404, sem efeito parcial. |
| D16 | Reaplicar modelo | APROVADO | 0 criadas/2 ignoradas. |
| D17 | Duplicidade com caixa/acento/espaço | APROVADO | Normalização testada. |
| D18 | Registro de cada aplicação | APROVADO | IDs distintos e contadores. |
| D19 | Auditoria das tarefas e aplicação | APROVADO | Entidades consultadas. |
| D20 | Atomicidade integral | APROVADO POR INSPEÇÃO | Uma transação; rollback obrigatório coberto pela suíte transacional. |
| D21 | Histórico após excluir modelo | APROVADO | Tarefas/aplicações permanecem. |
| D22 | Clique duplo em aplicar | APROVADO POR INSPEÇÃO | Idempotência de títulos elimina duplicação sequencial. |
| D23 | Aplicação simultânea multi-processo | NÃO EXECUTADO | Requer teste de concorrência externa dedicado. |

## E. Integrações e contagens

| ID | Item | Status | Evidência/observação |
|---|---|---|---|
| E01 | Projeto vazio | APROVADO | Recebe duas tarefas do modelo. |
| E02 | Projeto 102 tarefas | APROVADO | 33 concluídas, 32%, 100 exibidas. |
| E03 | Progresso não usa só a página | APROVADO | Total global explícito. |
| E04 | Cliente vê tarefa direta | APROVADO | E2E. |
| E05 | Cliente vê tarefa de projeto sem duplicar | APROVADO | shared-records. |
| E06 | Calendário usa data civil local | APROVADO | Tarefa de hoje encontrada. |
| E07 | Dashboard respeita intervalo | APROVADO | `taskCompletion.total ≥ 2`. |
| E08 | Alertas today incluem tarefa ativa | APROVADO | `sourceId` reconciliado. |
| E09 | Concluída sai do alerta ativo | APROVADO POR INSPEÇÃO | Predicado do serviço e suíte API. |
| E10 | Excluída sai das integrações | APROVADO | Soft delete filtrado em todas as fontes. |
| E11 | Mais de 500 tarefas nos alertas | APROVADO POR INSPEÇÃO | Teto removido; ordenação por prazo/ID. |
| E12 | Alertas profundos abrem a tarefa | APROVADO | Deep link E2E. |

## F. Acessibilidade, performance e robustez

| ID | Item | Status | Evidência/observação |
|---|---|---|---|
| F01 | Axe WCAG 2 A/AA, 2.1/2.2 | APROVADO | Zero violações em 3 jornadas. |
| F02 | Botões somente com ícone rotulados | APROVADO | Nomes de mover/concluir/editar/excluir. |
| F03 | Formulários com labels | APROVADO | Axe e seletores E2E por label. |
| F04 | Foco visível | APROVADO POR INSPEÇÃO | Rings `focus-visible`; card deep-linked focável. |
| F05 | Hierarquia de headings | APROVADO | H1 + H2 colunas + H3 cartões. |
| F06 | Informação de atraso não só por cor | APROVADO | Texto “Atrasada”. |
| F07 | Contagens e atualizações anunciadas | APROVADO POR INSPEÇÃO | `status`/`aria-live`. |
| F08 | Teclado em ações CRUD | APROVADO | Botões nativos, Escape e dialogs. |
| F09 | DnD com leitor de tela real | NÃO EXECUTADO | Requer NVDA/Jaws; Axe não substitui. |
| F10 | Zoom 200%/reflow manual | NÃO EXECUTADO | Não medido nesta rodada automatizada. |
| F11 | Desktop 1280×720 | APROVADO | Viewport padrão Playwright e screenshots full-page. |
| F12 | Desktop empacotado | APROVADO | Build + smoke. |
| F13 | 100 cards simultâneos | APROVADO | Navegação fluida no E2E. |
| F14 | 1.000+ cards simultâneos | FORA DO ESCOPO | UI pagina em 100; servidor mantém total. |
| F15 | Abort/timeout de rede real | NÃO EXECUTADO | Falha HTTP controlada cobriu rollback, não timeout físico. |
| F16 | Banco real preservado | APROVADO | Hash, tamanho e mtime idênticos. |

## Síntese

- Itens aprovados automaticamente: predominantes nos contratos críticos e jornadas de negócio.
- Itens aprovados por inspeção: comportamentos estruturais ou cobertos de forma indireta.
- Não executados: apenas validações manuais/de ambiente ou concorrência externa; nenhum foi declarado aprovado.
- Fora do escopo: importação/exportação de tarefas e renderização simultânea acima do limite paginado.
