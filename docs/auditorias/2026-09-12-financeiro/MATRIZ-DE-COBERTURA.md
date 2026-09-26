# Matriz de cobertura — Sessão 07: Financeiro

**Legenda:** APROVADO = comportamento já conforme; APROVADO APÓS CORREÇÃO = falhou, foi corrigido e passou no reteste; BLOQUEADO = não comprovável com segurança no ambiente; NÃO APLICÁVEL = capacidade não existe no produto atual.

## Contexto, inventário e dados

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-001 | Stack, versão e dependências identificadas | package manifests/build | APROVADO |
| S07-002 | Rotas financeiras de frontend inventariadas | leitura de `App.tsx` e páginas | APROVADO |
| S07-003 | Endpoints financeiros inventariados | leitura das quatro rotas Fastify | APROVADO |
| S07-004 | Tabelas e relacionamentos financeiros inventariados | schema Drizzle e consultas | APROVADO |
| S07-005 | Consumidores do overview identificados | serviço, página e CSV | APROVADO |
| S07-006 | Relatórios das Sessões 01–06 considerados | leitura documental | APROVADO |
| S07-007 | Worktree sujo detectado e preservado | `git status --short` | APROVADO |
| S07-008 | Banco real identificado antes dos testes | tamanho, data e SHA-256 | APROVADO |
| S07-009 | Dados de QA isolados e prefixados | runner e teste S07 | APROVADO |
| S07-010 | Oráculo financeiro independente definido em centavos | `RECONCILIACAO.md` | APROVADO |

## Rota, navegação e estado na URL

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-011 | `/financeiro` abre a visão geral | E2E S07 | APROVADO |
| S07-012 | Redirect legado chega à rota canônica | E2E S07 | APROVADO |
| S07-013 | Aba principal é refletida na URL | E2E + fonte | APROVADO |
| S07-014 | Aba inválida cai em opção segura | E2E | APROVADO APÓS CORREÇÃO |
| S07-015 | Período válido é preservado na URL | E2E + API | APROVADO |
| S07-016 | Período inválido não quebra a página | E2E | APROVADO APÓS CORREÇÃO |
| S07-017 | Abas principais têm setas e roving tabindex | E2E + web test | APROVADO APÓS CORREÇÃO |
| S07-018 | Abas auxiliares têm setas, Home/End e painéis | E2E + web test | APROVADO APÓS CORREÇÃO |
| S07-019 | Deep link de parcela abre o registro correto | E2E S07 | APROVADO |
| S07-020 | Recarregar deep link mantém contexto | E2E S07 | APROVADO |

## Loading, vazio, erro e recuperação

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-021 | Visão geral tem estado de carregamento | fonte + web test | APROVADO |
| S07-022 | Visão geral vazia não inventa números | serviço + web test | APROVADO |
| S07-023 | Erro de contas a receber não parece vazio | E2E interceptado | APROVADO APÓS CORREÇÃO |
| S07-024 | Erro de despesas não parece vazio | E2E interceptado | APROVADO APÓS CORREÇÃO |
| S07-025 | Erros de lista oferecem nova tentativa | E2E interceptado | APROVADO APÓS CORREÇÃO |
| S07-026 | Recuperação repõe dados sem recarregar app | E2E S07 | APROVADO |
| S07-027 | Lista de parcelas vazia tem mensagem própria | fonte + web test | APROVADO |
| S07-028 | Lista de despesas vazia tem mensagem própria | fonte + web test | APROVADO |
| S07-029 | Auxiliares vazios não quebram o layout | E2E + fonte | APROVADO |
| S07-030 | Atualizações assíncronas usam feedback visível | fonte + E2E | APROVADO |

## Visão geral, filtros, KPIs e exportação

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-031 | Receita contratada fecha com o oráculo | SQLite/API/UI | APROVADO |
| S07-032 | Receita recebida inclui caixa direto e recebimentos | SQLite/API/UI | APROVADO |
| S07-033 | Receita pendente usa saldo principal | SQLite/API/UI | APROVADO |
| S07-034 | Receita atrasada usa vencimento e saldo | SQLite/API/UI | APROVADO |
| S07-035 | Despesas lançadas excluem canceladas/estornadas/excluídas | sentinelas do oráculo | APROVADO |
| S07-036 | Despesas pagas usam baixas efetivas | SQLite/API/UI | APROVADO |
| S07-037 | Despesas abertas fecham com o oráculo | API JSON | APROVADO |
| S07-038 | Despesas vencidas usam status efetivo | integração + E2E | APROVADO APÓS CORREÇÃO |
| S07-039 | Resultado de caixa é recebida menos paga | reconciliação quadripla | APROVADO |
| S07-040 | Resultado de competência é contratada menos lançada | API/oráculo | APROVADO |
| S07-041 | Margens evitam divisão indevida por zero | serviço + testes | APROVADO |
| S07-042 | Período de 12 meses tem meses ordenados | API JSON + captura | APROVADO |
| S07-043 | Intervalo explícito inclusivo aceita um dia | integração | APROVADO APÓS CORREÇÃO |
| S07-044 | Intervalo invertido retorna 400 | integração | APROVADO APÓS CORREÇÃO |
| S07-045 | Filtros de cliente/categoria/tipo/centro são propagados | fonte + API | APROVADO |
| S07-046 | Resumos usam o mesmo universo do filtro | integração | APROVADO APÓS CORREÇÃO |
| S07-047 | CSV é gerado pela visão filtrada | E2E + arquivo | APROVADO |
| S07-048 | CSV contém BOM UTF-8 e `;` | inspeção E2E | APROVADO |
| S07-049 | CSV preserva valores decimais pt-BR | arquivo preservado | APROVADO |
| S07-050 | Alertas refletem valores vencidos reconciliados | captura + JSON | APROVADO |

## Contas a receber e recebimentos

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-051 | Parcelas listam cliente, orçamento, vencimento e saldo | E2E + API | APROVADO |
| S07-052 | Status pago deriva do principal liquidado | integração | APROVADO |
| S07-053 | Status parcial preserva saldo remanescente | E2E/oráculo | APROVADO |
| S07-054 | Status atrasado depende do dia civil | E2E/oráculo | APROVADO |
| S07-055 | Recebimento parcial soma ao valor pago | integração | APROVADO |
| S07-056 | Recebimento integral encerra a parcela | integração | APROVADO |
| S07-057 | Juros e multa entram no caixa, não no principal | E2E/oráculo | APROVADO |
| S07-058 | Desconto reduz o total recebido de forma explícita | rota + testes existentes | APROVADO |
| S07-059 | Taxas são persistidas separadamente | schema + API | APROVADO |
| S07-060 | Sobrepagamento de principal é recusado | testes financeiros | APROVADO |
| S07-061 | Valor zero/negativo é recusado | schema + integração | APROVADO APÓS CORREÇÃO |
| S07-062 | Data inexistente de recebimento é recusada | integração | APROVADO APÓS CORREÇÃO |
| S07-063 | Estorno recompõe saldo e histórico | testes financeiros existentes | APROVADO |
| S07-064 | Recebimento já estornado não é estornado novamente | API focada | APROVADO |
| S07-065 | Dupla baixa concorrente resulta 201 + 409 | integração S07 | APROVADO |
| S07-066 | Concorrência mantém principal total exato | integração S07, 600.000 ¢ | APROVADO |

## Contas a pagar e despesas

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-067 | Criar despesa válida persiste inteiros monetários | testes API existentes | APROVADO |
| S07-068 | Editar despesa preserva campos não enviados | rota + testes | APROVADO |
| S07-069 | PATCH vazio é recusado | integração S07 | APROVADO APÓS CORREÇÃO |
| S07-070 | Data impossível de despesa é recusada | integração S07 | APROVADO APÓS CORREÇÃO |
| S07-071 | Paga exige data de pagamento coerente | schema pós-merge | APROVADO APÓS CORREÇÃO |
| S07-072 | Pendente não mantém baixa indevida | schema pós-merge | APROVADO APÓS CORREÇÃO |
| S07-073 | Cliente excluído não recebe despesa | integração S07 | APROVADO APÓS CORREÇÃO |
| S07-074 | Projeto deve pertencer ao cliente | integração + rota | APROVADO APÓS CORREÇÃO |
| S07-075 | Categoria/tipo/centro são limitados e persistidos | schema + API | APROVADO |
| S07-076 | Filtro Vencida encontra Pendente vencida | integração S07 | APROVADO APÓS CORREÇÃO |
| S07-077 | Resumo do filtro Vencida fecha com a lista | integração S07 | APROVADO APÓS CORREÇÃO |
| S07-078 | Cancelamento exige motivo e não apaga fisicamente | testes financeiros | APROVADO |
| S07-079 | Estorno de despesa paga exige motivo | testes financeiros | APROVADO |
| S07-080 | Exclusão lógica remove a despesa dos KPIs | sentinela E2E | APROVADO |
| S07-081 | Comprovantes são buscados no cliente/projeto certo | web test | APROVADO |
| S07-082 | Busca textual tem nome acessível | fonte + Axe | APROVADO |

## Viagens, notas fiscais e diagnóstico

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-083 | Viagem válida aceita adiantamento em centavos | API + E2E | APROVADO |
| S07-084 | Viagem valida cliente/projeto ativos | integração/rota | APROVADO APÓS CORREÇÃO |
| S07-085 | Datas de viagem precisam existir e estar ordenadas | schema | APROVADO APÓS CORREÇÃO |
| S07-086 | Prestação fecha saldo entre adiantamento e gasto | testes existentes | APROVADO |
| S07-087 | Encerrar viagem duas vezes retorna 409 | rota + integração | APROVADO APÓS CORREÇÃO |
| S07-088 | Nota fiscal válida mantém cliente/projeto | E2E + API | APROVADO |
| S07-089 | URL fiscal aceita apenas HTTP/HTTPS | integração S07 | APROVADO APÓS CORREÇÃO |
| S07-090 | Nota substituta precisa existir e estar ativa | integração/rota | APROVADO APÓS CORREÇÃO |
| S07-091 | Nota substituta pertence ao mesmo cliente | rota + integração | APROVADO |
| S07-092 | Cancelamento fiscal exige justificativa | schema + API | APROVADO |
| S07-093 | Interface informa limite do módulo fiscal | E2E S07 | APROVADO |
| S07-094 | Diagnóstico repetido é somente leitura | E2E e contagem de eventos | APROVADO |

## API, segurança, atomicidade e compatibilidade

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-095 | Queries financeiras rejeitam chaves extras | integração S07 | APROVADO APÓS CORREÇÃO |
| S07-096 | Corpos rejeitam chaves extras | integração S07 | APROVADO |
| S07-097 | IDs vazios ou excessivos são recusados | schemas | APROVADO |
| S07-098 | IDs legados não UUID continuam compatíveis | regressão 169/169 | APROVADO |
| S07-099 | Valores monetários são inteiros seguros | schemas e banco | APROVADO |
| S07-100 | URLs não executam esquema ativo | integração S07 | APROVADO |
| S07-101 | Texto hostil é renderizado como conteúdo inerte | React + testes existentes | APROVADO |
| S07-102 | Mutação e auditoria compartilham transação | teste de falha sintética | APROVADO |
| S07-103 | Falha da auditoria reverte a despesa | teste transacional | APROVADO |
| S07-104 | Cancelados não entram no consolidado | sentinelas E2E | APROVADO |
| S07-105 | Estornados não entram no consolidado | sentinelas E2E | APROVADO |
| S07-106 | Excluídos logicamente não entram no consolidado | sentinelas E2E | APROVADO |
| S07-107 | Orçamento rejeitado não vira receita contratada | sentinela E2E | APROVADO |
| S07-108 | Sem credencial ou segredo nas evidências | inspeção + smoke | APROVADO |

## Acessibilidade, responsividade, operação e release

| ID | Critério | Evidência | Veredito |
|---|---|---|---|
| S07-109 | Axe WCAG 2.2 A/AA sem violações na jornada final | E2E S07 | APROVADO |
| S07-110 | Gráfico não expõe foco dentro de `aria-hidden` | E2E após correção | APROVADO |
| S07-111 | Contraste do resultado positivo atinge AA | Axe após correção | APROVADO |
| S07-112 | Viewport de 360 px não tem overflow horizontal | E2E + captura | APROVADO |
| S07-113 | Tema escuro preserva conteúdo e controles | E2E + captura | APROVADO |
| S07-114 | Leitor de tela real percorre o módulo | NVDA/JAWS indisponível | BLOQUEADO |
| S07-115 | Alto contraste nativo do Windows | modo HC não operado | BLOQUEADO |
| S07-116 | Viewports 768/1024/1440 inspecionados visualmente | amostra ampla não executada | BLOQUEADO |
| S07-117 | Zoom nativo de 200% sem perda operacional | zoom nativo não executado | BLOQUEADO |
| S07-118 | Queda de rede e reconexão durante mutação | rede do host não interrompida | BLOQUEADO |
| S07-119 | Virada real da meia-noite preserva status | relógio do host não alterado | BLOQUEADO |
| S07-120 | Volume equivalente à maior base produtiva | base sanitizada grande indisponível | BLOQUEADO |
| S07-121 | Dois processos disputam o mesmo lock SQLite | campanha foi concorrente no mesmo processo | BLOQUEADO |
| S07-122 | Upgrade sobre instalação 1.0.3 preserva perfil | perfil/VM anterior indisponível | BLOQUEADO |
| S07-123 | Controle de acesso por papéis financeiros | produto local não possui RBAC | NÃO APLICÁVEL |
| S07-124 | Transmissão/validação em autoridade fiscal | módulo declara não substituir escrituração | NÃO APLICÁVEL |

## Totais

| Veredito | Quantidade |
|---|---:|
| APROVADO | 86 |
| APROVADO APÓS CORREÇÃO | 27 |
| REPROVADO | 0 |
| BLOQUEADO | 9 |
| NÃO APLICÁVEL | 2 |
| **Total** | **124** |
