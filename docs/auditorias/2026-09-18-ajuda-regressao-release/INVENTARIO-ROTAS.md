# Inventário de rotas e navegação

Fonte canônica: `packages/contracts/src/app-navigation.ts`.

## Rotas canônicas — 29

| Grupo | Rotas |
|---|---|
| Setup e visão geral | `/configuracoes-iniciais`, `/` |
| Clientes | `/clientes`, `/clientes/:id` |
| Projetos | `/projetos`, `/projetos/:id` |
| Orçamentos | `/orcamentos`, `/orcamentos/novo`, `/orcamentos/:id/editar` |
| Financeiro | `/financeiro` |
| Importação | `/importacao`, `/importacao/esquemas` |
| Trabalho | `/tarefas`, `/calendario`, `/calendario/:tipo/:id` |
| Relatórios e ferramentas | `/relatorios`, `/topografia`, `/planejamento` |
| Ambiental | `/ambiental`, `/ambiental/:id`, `/ambiental/licencas/:id` |
| Comercial | `/crm` |
| Administração | `/configuracoes`, `/cadastros`, `/propriedades`, `/qualidade-dados`, `/pos-atualizacao`, `/audit-logs`, `/ajuda` |

## Aliases legados — 9

| Origem | Destino canônico | Risco |
|---|---|---|
| `/contatos` | `/crm?view=leads` | médio |
| `/dashboard-financeiro` | `/financeiro` | médio |
| `/gestao-financeira` | `/financeiro?tab=auxiliares` | médio |
| `/despesas` | `/financeiro?tab=pagar` | alto |
| `/operacional` | `/projetos?visualizacao=estatisticas` | médio |
| `/calculadora-ambiental` | `/ambiental?tab=car` | médio |
| `/licenciamento` | `/ambiental?tab=licenciamento` | alto |
| `/faturas` | `/financeiro?tab=faturas` | alto |
| `/relatorio-executivo` | `/relatorios?tipo=executivo` | alto |

## Construtores de links profundos

Foram verificados helpers para cliente, seção de cliente, projeto, seção de projeto, demanda ambiental, financeiro parametrizado, tarefa, parcela a receber, despesa a pagar, orçamento, licença, condicionante, compromisso e oportunidade. Segmentos dinâmicos são codificados e queries são montadas por `URLSearchParams`.

## Comportamentos globais

- Rota desconhecida mantém URL/histórico e renderiza a página 404.
- Links de navegação usam catálogo/`Link`; ações permanecem botões.
- Atalho de busca: Ctrl/Meta+K, com retorno de foco ao acionador.
- Gatilho móvel da busca: visível, 40 × 40 px e nome acessível.
- Cabeçalhos: 17 rotas principais auditadas em 1920×1080, 1366×768 e 390×844; reteste focado verde após correção de altura dos filtros.
- Governança: baseline de literais internos caiu de 70 para 60; zero novos casos.

## Ressalva

Os aliases continuam necessários até inventariar favoritos, alertas e integrações persistidas. Sua presença controlada não significa autorização para remoção.
