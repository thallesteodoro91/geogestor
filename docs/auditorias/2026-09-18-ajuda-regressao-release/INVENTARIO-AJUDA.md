# Inventário da Central de Ajuda

Fonte: `apps/web/src/pages/Ajuda/helpContent.ts`. Data editorial declarada no catálogo: 13/08/2026. Versão mínima comum após correção: `1.0.4`.

| # | ID | Categoria | Título |
|---:|---|---|---|
| 1 | `primeira-configuracao` | Primeiros passos | Primeira configuração e pasta de dados |
| 2 | `clientes-propriedades` | Comercial | Clientes e propriedades |
| 3 | `crm-oportunidades` | Comercial | CRM e oportunidades |
| 4 | `projetos-checklist` | Projetos | Projetos e checklist operacional |
| 5 | `orcamentos-aprovacao` | Financeiro | Orçamentos, PDF e aprovação |
| 6 | `contas-receber` | Financeiro | Contas a receber |
| 7 | `contas-pagar` | Financeiro | Contas a pagar |
| 8 | `agenda-tarefas` | Operacional | Agenda e tarefas |
| 9 | `ambiental-licenciamento` | Operacional | Ambiental e licenciamento |
| 10 | `topografia-calculos` | Operacional | Topografia e cálculos |
| 11 | `importacao-levantamento-vetorial` | Operacional | Importar levantamento vetorial e configurar mapa-base |
| 12 | `relatorios-exportacao` | Operacional | Relatórios e exportação |
| 13 | `planejamento-estrategico` | Operacional | Planejamento estratégico |
| 14 | `cadastros-auxiliares` | Sistema e segurança | Cadastros auxiliares |
| 15 | `importacao-dados` | Sistema e segurança | Importação de dados |
| 16 | `qualidade-dados` | Sistema e segurança | Qualidade dos dados |
| 17 | `logs-auditoria` | Sistema e segurança | Logs de auditoria |
| 18 | `modelos-documentos` | Sistema e segurança | Modelo dos PDFs |
| 19 | `backup-recuperacao` | Sistema e segurança | Backup, restauração e recuperação |
| 20 | `alertas-notificacoes` | Sistema e segurança | Alertas e notificações |

## Categorias e comportamento

- Seis categorias reais e um filtro agregado “Todos os guias”.
- Busca normalizada por título, resumo, palavras-chave e conteúdo, independente de acentos.
- Categoria e busca são combináveis; estado vazio é intencional.
- Estado selecionado é refletido na URL e entradas inválidas têm fallback seguro.
- Artigos relacionados usam IDs válidos e rotas internas registradas.
- O guia geoespacial diferencia levantamento vetorial próprio de mapa-base raster.
- Não foram encontradas promessas de nuvem obrigatória, assinatura digital ou atualização automática inexistente.

## Evidência

- Testes Web: metadados, busca, filtros, links, URL, conteúdo obsoleto e estados acessíveis.
- E2E dedicado: três jornadas aprovadas — URL/histórico, foco móvel e WCAG/estado.
- Lacuna: revisão humana de clareza, NVDA/Narrador e validação no instalador final.
