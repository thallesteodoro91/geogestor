# Achados

Todos os 28 achados abaixo foram corrigidos e retestados. Contagem: P0 0, P1 7, P2 17, P3 4; abertos no escopo exercitado: 0.

| ID | Gravidade | Camada / entidade | Pré-condição e passos | Esperado × obtido antes | Causa raiz | Correção e reteste |
|---|---|---|---|---|---|---|
| S12-01 | P1 | Serviço / check-in e snapshot | Criar revisão, alterar KR e editar narrativa da revisão | Histórico imutável × snapshot era recapturado do estado ao vivo | PATCH chamava captura novamente | Edição não recaptura; JSON/progresso antes e depois permaneceram idênticos |
| S12-02 | P1 | Serviço / governança | Criar revisão com próxima data e decisão legada; forçar falha | Tudo ou nada × etapas tinham fronteira transacional incompleta | Operações correlatas não compartilhavam a mesma transação | Check-in, snapshot, decisão e ciclo usam uma transação; failure injector confirmou rollback |
| S12-03 | P1 | Serviço / exclusão de check-in | Excluir revisão com snapshot e decisão | Snapshot excluído e decisão preservada sem vínculo × relações lógicas podiam reaparecer | Dependência em FK física para soft delete | Snapshot recebe `deletedAt`; decisão recebe `checkinId=null`; integração aprovada |
| S12-04 | P1 | Serviço / exclusão de ciclo | Soft-delete de ciclo com descendentes | Nenhum descendente visível × filhos permaneciam ativos | Soft delete do pai não aciona `ON DELETE` | Atualização explícita de pilares, objetivos, KRs, iniciativas, check-ins, snapshots, decisões e riscos |
| S12-05 | P1 | Serviço / objetivo e iniciativa | Excluir dependente ligado a risco/check-in/decisão | Cascata/desvinculação coerente × referências lógicas quebradas | Política parcial de relacionamentos | Dependentes são soft-deletados e históricos/riscos são desvinculados na transação; iniciativa comprovada em SQLite |
| S12-06 | P1 | Fontes automáticas / resumo | Carregar fonte sem linhas e depois com fixtures antigas | Ausência ≠ atraso; atualização vem da origem × ausência era tratada como stale e leitura podia parecer “agora” | Estado e timestamp derivados da consulta, não da população | `null/indisponivel` não conta stale; maior `updatedAt` real é usado; 0→4 stale confirmado |
| S12-07 | P1 | Contrato/serviço / KR automático | PATCH de regra, período, rota e unidade adulterados | Metadados canônicos × payload podia persistir representação falsa | Confiança indevida em campos derivados | Normalização server-side por tipo/código; `/crm`, `%` e regra canônica confirmados |
| S12-08 | P2 | Contratos / datas | POST com `2026-02-30` | 400 × regex aceitava data impossível | Validação apenas lexical | Validador de data civil real; integração recebeu 400 |
| S12-09 | P2 | Contratos / payloads | Enviar campo extra e PATCH `{}` | Rejeitar × objetos eram permissivos/patch vazio aceito | Schemas sem `.strict()`/refino | Schemas estritos e patch não vazio; testes 400 |
| S12-10 | P2 | Rotas / IDs e erros | GET com `nao-e-uuid`; injetar erro inesperado | 400 para ID; 500 seguro para falha × classificação por texto podia virar 400 e vazar detalhe | Heurística sobre mensagem da exceção | UUID estrito, erros tipados 400/404 e fallback 500 genérico; segredo não apareceu |
| S12-11 | P2 | Serviço/auditoria | Falhar audit log durante criação | Mutação revertida × atomicidade não era demonstrável | Log não era testável sob falha | Injetor de teste e mesma transação; zero linha residual |
| S12-12 | P2 | Serviço / risco | Associar risco do ciclo 2026 ao objetivo 2027 | 400 × relações cruzadas não eram validadas em todo PATCH | Validação incompleta de pertença | Validação de objetivo/iniciativa e coerência entre ambos; 400 específico |
| S12-13 | P2 | Snapshot / vínculos externos | Origem projeto/tarefa ser soft-deletada | Não exibir vínculo fantasma × IDs persistidos apareciam como ativos | Snapshot não conferia `deletedAt` da origem | Lookup em lote das origens ativas; IDs ausentes/excluídos viram `null` na projeção |
| S12-14 | P2 | Serviço / leitura | Alteração da origem durante montagem do snapshot | Visão consistente × várias consultas sem fronteira única | Snapshot não usava read transaction | `getStrategicSnapshot` executa a montagem em transação de leitura |
| S12-15 | P2 | Serviço / desempenho | Muitos KRs usando mesma fonte | Consulta por KR × trabalho repetido/N+1 | Resolver chamado para cada resultado | Cache por `fonteCodigo`; 80 objetivos/320 KRs em 67,1 ms no reteste final |
| S12-16 | P2 | Filtros / prazo | Hoje, +30 e +31 com filtro “Depois de 30 dias” | Somente +31 × qualquer data futura entrava | Predicado não calculava limite | Fronteira estrita `> hoje+30`; unit test aprovado |
| S12-17 | P2 | Ordenação | Registros empatados em prazo/progresso/data | Ordem determinística × comparadores retornavam zero | Ausência de desempate estável | `id` como último critério em ciclos, entidades, snapshots e timeline; testes atualizados |
| S12-18 | P2 | Filtros / Revisões | Manter filtro de outra aba ao abrir decisões/riscos/check-ins | Coleções não aplicáveis continuam explicáveis × retornavam vazias | Helpers aplicavam incompatibilidade como “nenhum resultado” | Filtros irrelevantes são ignorados por subcoleção; unit tests aprovados |
| S12-19 | P2 | UI / carregamento de opções | Editar KR/iniciativa quando `/opcoes` falha | Bloquear salvamento e preservar vínculos × form podia salvar opções vazias | Estado de erro não chegava ao modal | Alerta/status, submissão desabilitada e preservação dos dados |
| S12-20 | P2 | UI / URL | `aba`/filtros duplicados, inválidos e UUID malformado | URL canônica e estado único × parâmetros inválidos sobreviviam | Leitura tolerante sem normalização | Efeito substitui/remove chaves inválidas; E2E confirmou `aba=visao` e remoção dos demais |
| S12-21 | P2 | UI / snapshot ausente | Resposta sem snapshot válido | Erro recuperável × condição ficava absorvida pelo ramo de loading | Ordem incorreta das condições | Estado próprio com `role=alert` e retry |
| S12-22 | P2 | Datas / UI e serviço | Virada UTC com usuário em São Paulo | Mesmo dia civil local × `toISOString().slice(0,10)` podia avançar data | UTC usado como calendário local | Helper `saoPauloDateKey` compartilhado por usos locais e teste de fuso |
| S12-23 | P2 | KR manual / atualização | Editar somente título/confiança | `ultimaAtualizacao` inalterada × qualquer PATCH podia falsificar frescor | Timestamp ligado à gravação, não ao valor | Atualiza apenas quando valor muda ou fonte passa a manual; integração cobre edição/switch |
| S12-24 | P2 | Fonte Projetos / transparência | Comparar texto com consulta | Denominador descrito exatamente × texto dizia “projetos ativos” | Copy histórica divergia da consulta de sobreposição | Regra canônica agora diz todos não excluídos que se sobrepõem; 1/2=50% |
| S12-25 | P3 | UI / modal | Opções ainda carregando ou com falha | Estado anunciado × ausência silenciosa | Sem feedback específico | `role=status`/`role=alert`, `aria-live=polite` e texto acionável |
| S12-26 | P3 | Datas / apresentação | Data padrão e referência da visão | Data local coerente × geração UTC | Helper duplicado/implícito | Defaults e metadado usam o helper de São Paulo; testes aprovados |
| S12-27 | P3 | E2E / acessibilidade | Axe rodar enquanto toasts animados se sobrepõem | Medir estado estável × contraste transitório gerava falso positivo | Auditoria disparava durante animação | Harness aguarda os toasts terminarem; estados finais ficaram com zero violações |
| S12-28 | P3 | Teste / limpeza | Encerrar integração após abrir SQLite/WAL e logs | Diretório descartável removido × `close()` não aguardado deixava resíduos | Teardown removia só três arquivos enquanto cliente/logs ainda estavam ativos | `await client.close()` + remoção do diretório com retry; run 29968 ausente e 145 resíduos antigos removidos |

## Localização e evidência comum

- Contratos: `packages/contracts/src/strategic-planning.ts`.
- Rotas: `apps/api/src/routes/strategic-planning.routes.ts`.
- Regras, transações e fontes: `apps/api/src/services/strategic-planning.service.ts`.
- Tela/modal/filtros: `apps/web/src/pages/Planejamento.tsx`, `apps/web/src/pages/Planejamento/StrategicPlanningFormModal.tsx`, `apps/web/src/pages/Planejamento/planningFilters.ts`.
- Retestes: `apps/api/src/strategic-planning.integration.test.ts`, `apps/web/src/pages/Planejamento/planningFilters.test.ts`, `apps/web/src/utils/localDate.test.ts`, `tests/e2e/strategic-planning-flow.spec.ts`.

Respostas, IDs de execução e conteúdo são sintéticos. O teste usa UUIDs aleatórios e apaga o SQLite isolado; por isso não se registra UUID efêmero como se fosse identificador persistente de auditoria.
