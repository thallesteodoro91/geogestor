# Matriz de cobertura

Situações permitidas: `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` e `NÃO APLICÁVEL`.

| ID | Aba/entidade | Controle ou regra | Camadas e oráculo | Situação | Evidência/achado |
|---|---|---|---|---|---|
| COV-01 | Visão | Entrada, ciclo vazio, ação contextual e snapshot | UI → `GET /ciclos/:id` → SQLite | APROVADO | E2E principal; integração vazia |
| COV-02 | Objetivos | Pilar, objetivo, resultado, fórmula e filtro | UI/API/schema/serviço | APROVADO APÓS CORREÇÃO | E2E; S12-08/09/16/18 |
| COV-03 | Iniciativas | Criação, vínculo, progresso, prazo e marco | UI/API/SQLite | APROVADO APÓS CORREÇÃO | E2E; S12-13/14 |
| COV-04 | Revisões | Check-in, decisão, risco e timeline | UI/API/snapshot/auditoria | APROVADO APÓS CORREÇÃO | E2E; S12-01…07 |
| COV-05 | URL | Aba ausente/vazia/inválida/duplicada e filtro/UUID inválidos | `Planejamento.tsx`; URL real | APROVADO APÓS CORREÇÃO | E2E; S12-20 |
| COV-06 | Tabs | Clique, ArrowRight, `aria-selected` e painel | Playwright + árvore ARIA | APROVADO | E2E |
| COV-07 | Ciclo | Criar/editar/selecionar/ativar e ordenação | POST/PATCH/GET + snapshot | APROVADO APÓS CORREÇÃO | Integração; S12-10/17 |
| COV-08 | Ciclo | Ativação exclusiva sob requisições concorrentes | SQLite transacional multiprocesso | BLOQUEADO | Não houve ensaio multiprocesso |
| COV-09 | Pilar | Criar/editar; ordem; bloqueio com objetivo ativo | UI/API/SQLite | APROVADO | E2E + integração |
| COV-10 | Objetivo | Criar/editar/PATCH parcial; status/prioridade | UI/API/SQLite/auditoria | APROVADO | E2E + integração |
| COV-11 | Resultado | Criar/editar; manual/automático; ausência/zero | UI/API/oráculos | APROVADO APÓS CORREÇÃO | S12-06/07/23 |
| COV-12 | Iniciativa | Criar/editar; orçamento e origem ativa | UI/API/SQLite | APROVADO | E2E + integração |
| COV-13 | Check-in | Criar/editar; próxima revisão e snapshot | API/transação/snapshot | APROVADO APÓS CORREÇÃO | S12-01/02 |
| COV-14 | Decisão | Criar/editar/concluir/reabrir | UI/API/snapshot | APROVADO | Integração e E2E |
| COV-15 | Risco | Criar/editar e relações no mesmo ciclo | UI/API/SQLite | APROVADO APÓS CORREÇÃO | S12-12 |
| COV-16 | Oito entidades | Abertura, preenchimento e submissão de criação | UI real + API real + SQLite isolado | APROVADO | 8/8 no E2E |
| COV-17 | Oito entidades | PATCH e campos omitidos | API e schemas estritos | APROVADO APÓS CORREÇÃO | 8/8 tipos no teste focado; S12-09 |
| COV-18 | Oito entidades | Cancelar exclusão e confirmar exclusão pela UI | Confirmações e persistência | BLOQUEADO | Cancelamento de formulário comprovado; exclusões UI não exauridas |
| COV-19 | Exclusão lógica | Ciclo, iniciativa e check-in | API/SQLite tabela a tabela | APROVADO APÓS CORREÇÃO | S12-03/04/05 |
| COV-20 | Exclusão lógica | Pilar vazio, objetivo, KR, decisão e risco | API/SQLite tabela a tabela | BLOQUEADO | Código revisado; caminhos destrutivos não executados integralmente |
| COV-21 | Fórmulas | Aumentar/reduzir/manter, médias e null | Oráculo independente | APROVADO | 50%, 50%, 100%; indisponível excluído |
| COV-22 | Fórmulas | Todos os limites: clamp, igual, negativo, decimal, NaN/infinito | Contrato/API | BLOQUEADO | Famílias cobertas; matriz completa de bordas não foi executada |
| COV-23 | Fontes | Financeiro, CRM, Projetos e Tarefas | Inserções diretas + consulta de snapshot | APROVADO APÓS CORREÇÃO | 60 BRL; 50%; 50%; 50%; S12-06/07/24 |
| COV-24 | Fontes | Alteração operacional concorrente durante leitura | Leitura transacional | BLOQUEADO | Read transaction implementada; interleaving não forçado |
| COV-25 | Governança | Dois snapshots, imutabilidade e tendência disponível | JSON histórico + snapshot | APROVADO APÓS CORREÇÃO | S12-01/21 |
| COV-26 | Governança | Todos os contadores de transição e JSON legado inválido | Snapshots sintéticos | BLOQUEADO | Comparação básica comprovada; matriz integral não executada |
| COV-27 | Auditoria | INSERT/UPDATE e rollback quando log falha | `audit_logs` + failure injector | APROVADO APÓS CORREÇÃO | Zero resíduo e 500 sanitizado; S12-02/11 |
| COV-28 | Filtros | +30/+31, empate determinístico, filtro irrelevante | Unit tests + URL E2E | APROVADO APÓS CORREÇÃO | S12-16/17/18 |
| COV-29 | Performance | 80 objetivos + 320 KRs | Snapshot real; teto 3 s | APROVADO APÓS CORREÇÃO | 67,1 ms no reteste final; S12-15 |
| COV-30 | Acessibilidade | Axe WCAG 2.2 A/AA nos estados capturados | Revisões claro e Objetivos escuro | APROVADO | 0 violações nos dois estados finais |
| COV-31 | Acessibilidade | Axe em quatro abas, todos modais/vazios/loading/erro | Navegador real | BLOQUEADO | Cobertura parcial, sem alegação de totalidade |
| COV-32 | Acessibilidade | Leitor de tela real, alto contraste, zoom 200% | Tecnologia assistiva/SO | BLOQUEADO | Não operado |
| COV-33 | Responsividade | Desktop 1440 e móvel 390, claro/escuro | Capturas; `scrollWidth<=innerWidth` | APROVADO | Evidências 01–03 |
| COV-34 | Produto | Cenários/projeções/gráficos/exportação/importação | Funcionalidade inexistente | NÃO APLICÁVEL | Fora do produto atual |
| COV-35 | Produto | Duplicação/restauração/drag-and-drop | Funcionalidade inexistente | NÃO APLICÁVEL | Ordem numérica vigente |
| COV-36 | Produto | PDF/impressão/CSV/XLSX | Funcionalidade inexistente | NÃO APLICÁVEL | Sem implementação autorizada |
| COV-37 | Plataforma | Publicação/manifesto de release | Verificador de candidato | NÃO APLICÁVEL | Fora do escopo; bloqueio herdado reconfirmado |
| COV-38 | Ajuda | Reauditoria integral do conteúdo | Sessão 15 | NÃO APLICÁVEL | Somente divergência direta seria registrada |

## Totais

- `APROVADO`: 10
- `APROVADO APÓS CORREÇÃO`: 15
- `REPROVADO`: 0
- `BLOQUEADO`: 8
- `NÃO APLICÁVEL`: 5
- Total: 38 itens.

Os oito bloqueios são lacunas de campanha/ambiente, não resultados aprovados por inferência. Nenhum deles invalida uma correção comprovada, mas impedem o status sem ressalvas.

## Mapeamento técnico resumido

| Grupo | Frontend/helper | Endpoint/schema | Serviço/tabela | Fixture/oráculo |
|---|---|---|---|---|
| Ciclos | `Planejamento.tsx`, modal | `/api/planejamento/ciclos`; `cycle*Schema` | `strategic-planning.service`; `ciclos_estrategicos` | ciclos 2026/2027/2029 |
| Objetivos/KRs | `ObjectivesTab`, `planningFilters` | `/objetivos`, `/resultados-chave` | objetivos/resultados | manual 50; reduzir 50; manter 100 |
| Fontes | detalhe de fórmula/modal | `/opcoes`, snapshot | resolvers de fontes | 60 BRL e três taxas de 50% |
| Iniciativas | `InitiativesTab`, modal | `/iniciativas` | `iniciativas_estrategicas` | progresso 25→40 e marco |
| Governança | `ReviewsTab`, `OverviewTab` | `/checkins`, `/decisoes`, `/riscos` | check-ins/snapshots/decisões/riscos | revisões 30/07 e 15/08 |
| Evidência UI | página e modal | API real do harness | SQLite isolado | prefixos `Ciclo E2E`, `Responsável` |
