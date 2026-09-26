# Matriz de cobertura

| Área | Universo | Cobertura executada | Resultado | Lacuna |
|---|---:|---|---|---|
| Artigos da Central de Ajuda | 20 | metadados, busca, categorias, links, URL, fallback e conteúdo proibido | 20/20 cobertos; testes estáticos verdes | revisão humana da clareza final |
| Categorias da Ajuda | 6 + filtro “todos” | combinação com busca e estado vazio | coberta | nenhuma funcional identificada |
| Ajuda E2E | 3 jornadas | URL/histórico, foco móvel, WCAG/estado | 3/3 aprovadas | NVDA/Narrador reais |
| Rotas canônicas | 29 | unicidade, registro, construtores e navegação | 29/29 cobertas estaticamente | revisão visual humana rota a rota |
| Aliases legados | 9 | destino canônico e preservação de query | 9/9 cobertos | decidir janela futura de retirada |
| Fallback desconhecido | 1 comportamento | 404, URL e histórico | aprovado | nenhuma funcional identificada |
| Tipos de pesquisa global | 6 | cliente, projeto, orçamento, tarefa, compromisso e documento | 6/6 aprovados | benchmark de alta cardinalidade |
| Estados da pesquisa | 5 | mínimo de 2 caracteres, carregamento, erro/retentativa, vazio e resultado | cobertos por testes Web/E2E | teste humano com leitor de tela |
| Limites da pesquisa | 2 | 8 por tipo e 30 agregados | aprovados | carga real volumosa |
| Atalhos e mobile | teclado + toque | Ctrl/Meta+K, retorno de foco e gatilho móvel 40 × 40 | aprovados em testes focados | dispositivo físico |
| Navegação global | shell e links profundos | catálogo, helpers, foco, aliases e 17 cabeçalhos em três larguras | focado verde após correção | conjunto integral ainda vermelho |
| Web unitário/estático | 202 | suíte integral | 202/202 | nenhuma no gate |
| API integração/unidade | 190 | suíte integral | 190/190 | nenhuma no gate |
| Electron | 18 | main, preload e autorização de restauração | 18/18 | smoke instalado humano |
| Governança | 18 | baseline, versão, release e artefatos | 18/18 | avisos históricos |
| E2E comercial integral | 90 | execução única, um worker, banco compartilhado | 56 passaram; 13 falharam; 21 não rodaram | isolamento e rerun integral |
| Homologação humana | 19 | revisão documental somente | 0/19 executados nesta sessão | todos pendentes |
| Candidato Windows | 1 candidato novo esperado | origem estrita verificada antes do build | 0 produzido | worktree sujo |
| Publicação | 1 decisão explícita | checagem de autorização e gates | não executada | depende de aprovação futura |

## Interpretação

A cobertura funcional da Sessão 15 é suficiente para aprovação com ressalvas, mas a cobertura do produto integrado e da distribuição não é suficiente para release. Percentuais agregados não são usados para esconder itens bloqueantes: o E2E integral, a homologação humana e o candidato instalável são gates separados.
