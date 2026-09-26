# Matriz de cobertura

Estados permitidos: `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` e `NÃO APLICÁVEL`.

| # | Critério | Estado | Evidência/observação |
| ---: | --- | --- | --- |
| 1 | Rota direta `/relatorios` | APROVADO | E2E na aplicação real. |
| 2 | Entrada pela navegação lateral | APROVADO | Link semântico existente e rota exercitada. |
| 3 | Deep link com período e aba | APROVADO APÓS CORREÇÃO | URL canônica validada no E2E. |
| 4 | Recarregar/manter estado relevante | APROVADO APÓS CORREÇÃO | Estado importante deriva da URL. |
| 5 | Alternância Financeiro/Projetos/Executivo | APROVADO | Três visões exercitadas. |
| 6 | Presets de período | APROVADO APÓS CORREÇÃO | Testes unitários cobrem todos os presets. |
| 7 | Período personalizado válido | APROVADO | E2E com início=fim. |
| 8 | Data impossível/período invertido | APROVADO APÓS CORREÇÃO | Erro associado ao filtro; consulta bloqueada. |
| 9 | Parâmetro repetido ou extra | APROVADO APÓS CORREÇÃO | API responde 400 seguro. |
| 10 | Comparação com período anterior | APROVADO | Oráculo 7.000/7.000/0/7.000 ¢. |
| 11 | Contratado | APROVADO | 27.000 ¢ reconciliados. |
| 12 | Recebido | APROVADO | 14.000 ¢ reconciliados. |
| 13 | Pendente e parcial | APROVADO APÓS CORREÇÃO | 11.000 ¢; parcial e sobrepago cobertos. |
| 14 | Vencido | APROVADO APÓS CORREÇÃO | 11.000 ¢; dia de negócio em São Paulo. |
| 15 | Despesas pagas | APROVADO APÓS CORREÇÃO | 3.000 ¢; pendentes/excluídas não entram. |
| 16 | Caixa | APROVADO | 11.000 ¢ no oráculo principal; -1.400 ¢ no E2E. |
| 17 | Impostos | APROVADO | 2.700 ¢ no oráculo principal. |
| 18 | Conversão | APROVADO | 71,4% na API e 20% no E2E. |
| 19 | Composição/contagem financeira | APROVADO APÓS CORREÇÃO | Contadores específicos no contrato. |
| 20 | Categorias reconciliadas com KPI | APROVADO APÓS CORREÇÃO | Só despesas pagas e mesma data de caixa. |
| 21 | Limite visual de categorias | APROVADO APÓS CORREÇÃO | 25 categorias; itens adicionais declarados. |
| 22 | Estado com apenas pendências | APROVADO APÓS CORREÇÃO | Não é classificado como vazio. |
| 23 | Status de projetos | APROVADO APÓS CORREÇÃO | Acentos, caixa, vazio e desconhecido cobertos. |
| 24 | Área ativa e área desconhecida | APROVADO APÓS CORREÇÃO | 15,5 ha/3 conhecidos; nulo e zero tratados. |
| 25 | Distribuição por município | APROVADO APÓS CORREÇÃO | Total preservado e limite visual informado. |
| 26 | Projetos atrasados | APROVADO APÓS CORREÇÃO | Só ativos; fronteira temporal coberta. |
| 27 | Próximos do prazo | APROVADO APÓS CORREÇÃO | Hoje e +30 inclusos; +31 excluído. |
| 28 | Ordem determinística em empate | APROVADO APÓS CORREÇÃO | Data, nome e ID como desempate. |
| 29 | Cinco classes de alerta executivo | APROVADO APÓS CORREÇÃO | Cinco alertas distintos no E2E. |
| 30 | Destinos dos links de alerta | APROVADO | `href` estruturado coberto por teste; clique manual amplo não repetido. |
| 31 | Rastreabilidade dado→API→UI→PDF | APROVADO APÓS CORREÇÃO | Documento de origens e modelos específicos. |
| 32 | Topografia não altera KPIs | APROVADO | Controle negativo da integração. |
| 33 | GET não invalida relatório | APROVADO APÓS CORREÇÃO | Teste do cliente da API. |
| 34 | Mutação bem-sucedida invalida cache | APROVADO APÓS CORREÇÃO | Unidade + E2E criando projeto. |
| 35 | Mutação com falha não invalida cache | APROVADO APÓS CORREÇÃO | Teste do cliente da API. |
| 36 | Relatório ativo refaz consulta | APROVADO APÓS CORREÇÃO | Evento global e React Query observados. |
| 37 | Consulta substituída é abortada | APROVADO APÓS CORREÇÃO | `AbortSignal` propagado ao cliente. |
| 38 | Estado de carregamento | APROVADO | Componentes e testes existentes. |
| 39 | Erro com ação de nova tentativa | APROVADO | Componente e testes existentes. |
| 40 | Estado vazio intencional | APROVADO APÓS CORREÇÃO | Composição evita falso vazio. |
| 41 | Texto longo | APROVADO APÓS CORREÇÃO | UI e sete páginas PDF inspecionadas. |
| 42 | Entrada HTML-like/XSS | APROVADO | Exibida como texto inerte na UI e PDF. |
| 43 | Datas/moedas em pt-BR | APROVADO APÓS CORREÇÃO | `Intl` e fuso explícito. |
| 44 | Desktop 1440 px | APROVADO | Captura E2E. |
| 45 | Layout 1024 px | APROVADO | E2E sem rolagem horizontal indevida. |
| 46 | Tablet 768 px | APROVADO | E2E sem rolagem horizontal indevida. |
| 47 | Móvel 360 px | APROVADO | E2E sem rolagem horizontal indevida. |
| 48 | Navegação por teclado nos fluxos principais | APROVADO APÓS CORREÇÃO | Controles nativos, foco e menu exercitados. |
| 49 | Axe automatizado | APROVADO APÓS CORREÇÃO | Nenhuma violação crítica no cenário E2E. |
| 50 | Leitor de tela real | BLOQUEADO | NVDA/JAWS não disponível nesta execução. |
| 51 | Alto contraste e zoom nativo de 200% | BLOQUEADO | Viewports foram cobertos; configuração nativa não. |
| 52 | Tema escuro completo | BLOQUEADO | Não houve sessão visual dedicada ao tema. |
| 53 | PDF Executivo | APROVADO APÓS CORREÇÃO | 3 páginas; hash e conteúdo validados. |
| 54 | PDF Financeiro | APROVADO APÓS CORREÇÃO | 2 páginas; hash e conteúdo validados. |
| 55 | PDF Projetos | APROVADO APÓS CORREÇÃO | 2 páginas; hash e conteúdo validados. |
| 56 | Identidade/logo seguro | APROVADO APÓS CORREÇÃO | Logo válido e fallback inválido cobertos. |
| 57 | Paginação/cabeçalhos/rodapés | APROVADO APÓS CORREÇÃO | Sete páginas renderizadas. |
| 58 | Tabelas e linhas longas no PDF | APROVADO APÓS CORREÇÃO | `dontBreakRows`; sem linha órfã. |
| 59 | Preview de impressão | APROVADO APÓS CORREÇÃO | Captura `04-impressao-executivo.png`. |
| 60 | Cancelamento no diálogo nativo de impressão | BLOQUEADO | Diálogo físico não automatizado. |
| 61 | Falha assíncrona no download PDF | APROVADO APÓS CORREÇÃO | Teste confirma propagação da rejeição. |
| 62 | Volume de 1.500 despesas/25 categorias | APROVADO | 1.274.250 ¢ em 12,7 ms. |
| 63 | Concorrência com contenção/busy SQLite | BLOQUEADO | Sem ensaio de lock deliberado. |
| 64 | Leituras idênticas simultâneas e deduplicação | BLOQUEADO | Não instrumentado no E2E real. |
| 65 | Mutações concorrentes durante snapshot | BLOQUEADO | Sem barreira transacional controlada. |
| 66 | Suíte web completa | APROVADO | 202/202. |
| 67 | Suíte API completa | REPROVADO | 188/189; falha herdada de remoção financeira. |
| 68 | Suíte Electron | APROVADO | 18/18. |
| 69 | Lint | APROVADO | Sem erros. |
| 70 | Typecheck | APROVADO | Sem erros. |
| 71 | Build desktop e instalador | APROVADO | Build concluído. |
| 72 | Smoke da API empacotada | APROVADO | Lock e criptografia preservados; sem segredos. |
| 73 | UI empacotada completa/reinício/upgrade | BLOQUEADO | Build e API cobertos; jornada física não. |
| 74 | Manifesto de release | REPROVADO | Entradas ausentes e hash/tamanho divergentes. |
| 75 | Integridade da base real | APROVADO | Hash, tamanho e mtime idênticos antes/depois. |
| 76 | Limpeza de dados temporários | APROVADO | Runs criados pela auditoria removidos; evidência final mantida. |
| 77 | Exportação CSV/XLSX | NÃO APLICÁVEL | Não existe no produto e não foi criada. |
| 78 | Persistência de entidade “relatório” | NÃO APLICÁVEL | Relatórios são projeções consultivas. |
| 79 | Log de auditoria por visualização/exportação | NÃO APLICÁVEL | Não faz parte do contrato atual. |
| 80 | Compatibilidade dos campos existentes | APROVADO | Campo novo é opcional; consumidores anteriores preservados. |
| 81 | Ausência de nova métrica/semântica | APROVADO | Mudanças restringem-se a correção e transparência. |

## Critério de decisão

O escopo funcional de Relatórios não tem P0/P1 pendente e todos os 12 achados foram aprovados após correção. As duas reprovações pertencem à regressão financeira geral e ao empacotamento de release, não ao cálculo/renderização dos relatórios; por isso o resultado global é **APROVADA COM RESSALVAS**, e não uma aprovação irrestrita.

