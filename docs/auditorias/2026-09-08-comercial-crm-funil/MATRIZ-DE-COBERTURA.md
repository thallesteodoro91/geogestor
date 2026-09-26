# Matriz de cobertura — Sessão 03 — Comercial — CRM e Funil

Inventário criado antes das mutações em 08/09/2026 e encerrado em 09/09/2026. `AC` indica item aprovado após correção comprovada. As evidências `E2E`, `API` e `DB` remetem ao roteiro `tests/e2e/session03-crm-funnel.spec.ts`, à suíte `apps/api/src/session03-crm-funnel.integration.test.ts` e a `COMANDOS-E-RESULTADOS.md`.

| ID | Rota/visão | Controle ou fluxo | Frontend / endpoint | Entidade/efeito | Cenários | Situação | Evidência |
|---|---|---|---|---|---|---|---|
| S03-C01 | `/crm` | Entrada padrão no Funil | `CRM`; GET oportunidades/analytics | leitura | sucesso, vazio, 500/retry | APROVADO | E2E 02, 05, erro recuperável |
| S03-C02 | Leads | Deep link | navegação; GET contatos | contatos | URL direta, reload | APROVADO | E2E 01, 04 |
| S03-C03 | Funil | Deep link | navegação; GET oportunidades | oportunidades | URL direta, reload | APROVADO | E2E 02, 05 |
| S03-C04 | Indicadores | Deep link | navegação; GET analytics | agregados | URL direta, reload | APROVADO | E2E 03, 08 |
| S03-C05 | `/crm?view=invalida` | Fallback seguro | `CRM` | leitura | parâmetro inválido | APROVADO | E2E navegação |
| S03-C06 | `/contatos` | Rota legada | `App` | compatibilidade | redirecionamento | APROVADO | E2E navegação |
| S03-C07 | `/crm` | Histórico e reload | Router | leitura | voltar, avançar, reload | APROVADO | E2E orçamento/projeto e deep links |
| S03-C08 | três visões | Menu Comercial ativo | Layout/Sidebar | estado visual | Leads, Funil, Indicadores | APROVADO | E2E 01–05 |
| S03-C09 | três visões | Carregando, vazio e erro | Skeleton/FormError; GETs | leitura | inicial, vazio, parcial, 500/retry | APROVADO | E2E 01–03 e erro controlado |
| S03-C10 | três visões | Console/rede sem segredo | app/API | logs | sucesso e 500 controlado | APROVADO | E2E consoleErrors; API mensagens sanitizadas |
| S03-C11 | Leads | Vazio/sem resultado | `Contatos`; GET contatos | contatos | zero e busca sem match | APROVADO | E2E 01 e busca |
| S03-C12 | Leads | Busca textual | `Contatos`; GET contatos `q` | contatos | campos indexados, acentos e injeção segura | APROVADO | E2E busca; API paginação/filtro |
| S03-C13 | Leads | Status | `Contatos`; GET `status` | contatos | todos, ativos, convertidos | APROVADO | E2E 04; API analytics |
| S03-C14 | Leads | Paginação/URL | `Contatos`; GET page/pageSize | contatos | limites e reload | APROVADO | E2E paginação; API pageSize=2 |
| S03-C15 | Leads | Ordenação | não exposta na tela | — | disponibilidade | NÃO APLICÁVEL | Ausência confirmada; criar seria nova função |
| S03-C16 | Leads | Modal, foco e descarte | `Modal`, `Contatos` | formulário | cancelar com/sem alteração, foco inválido | APROVADO | AC; E2E confirmação de descarte |
| S03-C17 | Leads | Criar todos os campos | POST contatos | contato/auditoria | acentos e trim | APROVADO | AC; E2E + API 201 + DB |
| S03-C18 | Leads | Validações | formulário/POST contatos | contato | nome, e-mail, telefone, data, extras | APROVADO | AC; teste vermelho→verde API e E2E inline |
| S03-C19 | Leads | Duplicidade | POST contatos | unicidade lógica | e-mail e telefone normalizados | APROVADO | AC; API 409 |
| S03-C20 | Leads | Editar/persistir | PUT contatos/:id | contato/auditoria | válido, inválido, XSS | APROVADO | AC; API/DB |
| S03-C21 | Leads | Editar ID ausente | PUT contatos/:id | contato | inexistente/excluído | APROVADO | AC; API 404 |
| S03-C22 | Leads | Excluir | ConfirmDialog/DELETE | soft delete/auditoria | cancelar, confirmar, repetir | APROVADO | AC; API 200/404 + DB |
| S03-C23 | Leads | Bloquear exclusão vinculada | DELETE contatos/:id | integridade | oportunidade ativa | APROVADO | AC; API 409 |
| S03-C24 | Leads | Converter sem match | POST converter | cliente+lead+oportunidade+histórico | transação | APROVADO | AC auditoria; E2E 04 + API/DB |
| S03-C25 | Leads | Converter por e-mail | POST converter | associação | normalização | APROVADO | API `email_normalizado`, sem duplicação |
| S03-C26 | Leads | Converter por telefone | POST converter | associação | DDD/55 normalizados | APROVADO | API `telefone_normalizado`, sem duplicação |
| S03-C27 | Leads | Converter novamente | POST converter | idempotência | repetição | APROVADO | E2E/API `idempotent=true` |
| S03-C28 | Leads | Conflitos seguros | POST converter | integridade | vínculo/matches ambíguos | APROVADO | API regras de match e vínculo persistido |
| S03-C29 | Leads | Atomicidade | serviço de conversão | transação | falha/conflito sem meia gravação | APROVADO | API transacional + contagens/relacionamentos DB |
| S03-C30 | Leads | Importação em lote visível | não exposta nesta tela | — | disponibilidade | NÃO APLICÁVEL | Briefing manda marcar quando ausente; criar seria nova função |
| S03-C31 | Funil | Vazio e cinco etapas | `CRM`, DnD; GET oportunidades | oportunidades | zero dados | APROVADO | E2E 02 |
| S03-C32 | Funil | Criar de cliente | modal/POST oportunidades | oportunidade+histórico/auditoria | todos os campos | APROVADO | AC; E2E 05 + API 201 |
| S03-C33 | Funil | Criar de lead | modal/POST oportunidades | oportunidade+lead | vínculo exclusivo | APROVADO | API 201 e GET detalhe |
| S03-C34 | Funil | Valor/probabilidade/vínculo | contrato POST/PATCH | oportunidade | ausente, negativo, >100 | APROVADO | AC; domínio/API 400 |
| S03-C35 | Funil | Próxima ação/data | contrato/modal | oportunidade | par incompleto e data impossível | APROVADO | AC; API 400; calendário E2E |
| S03-C36 | Funil | Textos/referências | contrato/serviço | oportunidade | trim, extras, orçamento incompatível | APROVADO | AC; API 400/201 |
| S03-C37 | Funil | Editar/persistir | PATCH oportunidades/:id | oportunidade/auditoria | valor, probabilidade, orçamento | APROVADO | AC; E2E + API/DB |
| S03-C38 | Funil | Histórico | modal; GET oportunidades/:id | etapas/motivo/timestamp | criação e transições | APROVADO | AC contraste; E2E 06 + API history |
| S03-C39 | Funil | Busca | `CRM`; GET oportunidades | filtro cliente | título e metadados comerciais | APROVADO | E2E busca/URL; API lista enriquecida |
| S03-C40 | Funil | Filtros | `CRM` | filtro local | responsável e serviço | APROVADO | E2E filtros combinados |
| S03-C41 | Funil | Chips | `CRM` | URL/estado | remover um e limpar | APROVADO | E2E chips |
| S03-C42 | Funil | Ação atrasada | `CRM`/analytics | derivado | ontem, hoje, futuro, sem ação | APROVADO | E2E carga conhecida; API analytics |
| S03-C43 | Funil | Parada >14 dias | `CRM`/analytics | derivado | antiga e recente | APROVADO | E2E filtro de atenção |
| S03-C44 | Funil | Movimento entre colunas | DnD/transition | etapa+ordem+histórico | caminhos de transição | APROVADO | AC sem controles aninhados; API transition + E2E cartões |
| S03-C45 | Funil | Reordenação | DnD/PATCH reorder | ordem | payload e persistência | APROVADO | AC; API rejeita estágio divergente/IDs duplicados |
| S03-C46 | Funil | Alternativa ao arraste | botões acessíveis | transition | teclado/nome acessível | APROVADO | AC; E2E move anterior/próxima; Axe |
| S03-C47 | Funil | Ganhar | modal/transition | encerra pipeline | motivo opcional | APROVADO | E2E/API, projeto e métricas |
| S03-C48 | Funil | Perder | modal/transition | encerra pipeline | motivo obrigatório | APROVADO | E2E validação + API 400/200 |
| S03-C49 | Funil | Reabrir | cartão/transition | recompõe pipeline | Perdido→Proposta | APROVADO | E2E/API history+analytics |
| S03-C50 | Funil | Lead não pode ganhar | cartão/API | integridade | cliente ausente | APROVADO | E2E CTA converter + API 400 |
| S03-C51 | Funil | Vincular orçamento | modal/link-budget | orçamento+valor+etapa/auditoria | mesmo cliente | APROVADO | AC; E2E link + API/DB |
| S03-C52 | Funil | Rejeitar orçamento indevido | link-budget | integridade | outro cliente/inexistente | APROVADO | AC; API 400 |
| S03-C53 | Funil | Abrir orçamento/voltar | Link/Router | contexto | ida/volta | APROVADO | E2E `/orcamentos?budgetId=`→CRM |
| S03-C54 | Funil | Converter em projeto | convert-project | projeto+vínculo/auditoria | navegação e idempotência | APROVADO | AC; E2E projeto + API idempotente |
| S03-C55 | Funil | Excluir oportunidade | alertdialog/DELETE | soft delete/auditoria | cancelar/confirmar | APROVADO | AC; E2E 07 + API 204 |
| S03-C56 | Funil | ID excluído/ausente | PATCH/DELETE | integridade | repetição | APROVADO | AC; API DELETE repetido 404 |
| S03-C57 | Funil | Submissão/reordenação repetida | API/serviço | idempotência/ordem | duplicação | APROVADO | AC; conversão idempotente e reorder duplicado 400 |
| S03-C58 | Indicadores | Leads | métricas/GET analytics | agregados | zero e populado | APROVADO | E2E 03/08 + API valores exatos |
| S03-C59 | Indicadores | Pipeline | métricas/GET analytics | agregados | aberto/ponderado/ativas | APROVADO | E2E/API: 1.000.000/615.000 centavos |
| S03-C60 | Indicadores | Ganhas/perdidas | métricas/GET analytics | agregados | transições | APROVADO | E2E/API counts |
| S03-C61 | Indicadores | Atrasadas/paradas | métricas/GET analytics | agregados | datas-limite | APROVADO | E2E carga conhecida + filtros |
| S03-C62 | Indicadores | Por etapa | tabela/analytics | quantidade/valor/dias | cálculo conhecido | APROVADO | E2E 08 + API por etapa |
| S03-C63 | Indicadores | Formatação pt-BR | métricas/tabela | apresentação | zero, moeda, %, datas | APROVADO | E2E 03/08/09 |
| S03-C64 | Backend | Contratos/HTTP | rotas CRM | validação | válidos, ausentes, extras, IDs | APROVADO | AC; API 8/8 |
| S03-C65 | Banco/segurança | Normalização, soft delete, auditoria | serviços/tabelas | integridade | SQL/XSS/IDs/relações | APROVADO | AC; API/DB, metadados sem `<script>`/PII |
| S03-C66 | UX/A11y | Teclado, foco, contraste, temas e layout | três visões/modais/kanban | apresentação | Axe, claro/escuro, 360–1440 | APROVADO | AC; Axe 0 violações nos pontos auditados; E2E 01–10 |

## Contagem final

- APROVADO: 64, dos quais 29 exigiram ao menos uma correção do produto.
- REPROVADO: 0.
- BLOQUEADO: 0.
- NÃO APLICÁVEL: 2 (`S03-C15`, `S03-C30`).
- PENDENTE: 0.
