# Auditoria do módulo Planejamento Estratégico

**Data:** 30/07/2026
**Escopo:** produto, arquitetura da informação, confiabilidade dos dados, UX, acessibilidade e consistência com os menus finalizados do GeoGestor
**Natureza:** diagnóstico de base, com recomendações implementadas em 31/07/2026

## Status da implementação — 31/07/2026

As recomendações desta auditoria foram aplicadas integralmente. O antigo painel derivado foi substituído por um domínio persistente de planejamento estratégico, sem metas simuladas e sem transformar ausência de dados em desempenho artificial.

- Criados ciclos, pilares, objetivos, resultados-chave, iniciativas, revisões e riscos.
- Adicionadas fontes transparentes de Financeiro, CRM, Projetos e Tarefas, sempre com regra, período, rota e última atualização.
- Implementadas as quatro áreas narrativas: Visão estratégica, Objetivos e metas, Iniciativas, Revisões e riscos.
- Adicionados estado vazio orientado, ações contextuais, histórico de auditoria e exclusão lógica.
- Persistidos ciclo e aba na URL, com navegação de abas por teclado.
- Auditoria WCAG 2.2 AA executada em seis cenários: zero violações automáticas, zero controles sem rótulo, zero saltos de títulos e zero estouro horizontal.
- Validação técnica concluída com 39 testes web, 72 testes de API, lint, checagem de tipos e builds de produção aprovados.

As seções seguintes permanecem como registro do estado anterior e das decisões que orientaram a modernização.

## Resumo executivo

O módulo tem uma base visual aproveitável, mas ainda não funciona como planejamento estratégico. Hoje ele se comporta como um painel derivado de Financeiro e CRM, sem ciclo de planejamento, objetivos, metas cadastráveis, responsáveis, iniciativas, riscos ou revisões.

A prioridade máxima não é estética: é a confiabilidade da decisão. A tela fabrica valores planejados e premissas de custos, apresenta conclusões positivas sem validar os dados e transforma ausência de registros em indicadores como `−100%`. Isso pode induzir o usuário a decisões incorretas.

**Maturidade estimada do módulo atual: 4/10.**

| Dimensão | Avaliação | Diagnóstico |
|:---|:---:|:---|
| Consistência visual | 7/10 | Já usa cabeçalho, navegação local, tema e componentes próximos do padrão finalizado |
| Clareza do propósito | 4/10 | O nome promete estratégia, mas o conteúdo entrega análise financeira e comercial |
| Confiabilidade dos dados | 2/10 | Existem valores simulados, premissas fixas e narrativas não condicionais |
| Capacidade de planejamento | 1/10 | Não há cadastro de objetivos, metas, iniciativas, responsáveis ou revisões |
| Storytelling e decisão | 4/10 | Há cartões narrativos, mas eles descrevem números; não conduzem a uma decisão |
| Estados vazios | 2/10 | A ausência de dados gera gráficos e conclusões artificiais |
| Acessibilidade | 5/10 | A base é semântica, porém foram encontrados problemas de contraste, hierarquia e interação |

## O que já está bem encaminhado

- O módulo usa o `PageHeader`, alinhando título, descrição e largura com as páginas recentes.
- A navegação local segue os estilos compartilhados do sistema.
- A composição responde sem rolagem horizontal global em 390 px.
- React Query, formatadores monetários e helpers de gráficos já estão integrados.
- A separação em indicadores, narrativa e gráficos oferece uma fundação útil para uma futura visão executiva.
- O uso de cores diferencia assuntos, coerente com a identidade visual não monocromática do GeoGestor.

## Achados críticos

### P0. O sistema apresenta dados planejados que nunca foram cadastrados

**Evidência:** `Planejamento.tsx`, linhas 246–247.

- A receita planejada é calculada como 95% da receita realizada.
- A despesa planejada é calculada como 105% da despesa realizada.
- Quando não há valor realizado, a tela injeta R$ 15.000 de receita e R$ 10.000 de despesa planejadas.

Isso não é planejamento: é uma projeção circular baseada no próprio realizado. Uma meta só deve aparecer se tiver sido cadastrada ou importada de uma fonte identificável.

**Impacto:** crítico.
**Confiança:** alta.

### P0. Ausência de dados vira desempenho de `−100%`

**Evidência:** o endpoint financeiro sempre devolve 24 meses, inicialmente preenchidos com zero (`financeiro.routes.ts`, linhas 1428–1437). A tela considera a lista como existente e compara zero realizado com os valores fictícios.

Na validação visual com a base atual, o módulo exibiu:

- desvio orçamentário médio de `−100%`;
- mensagem “Orçamento sob controle”;
- gráficos preenchidos com metas artificiais;
- recomendação de reserva financeira.

O aviso que depende de `monthlyCashFlow.length === 0` não é acionado, pois o endpoint devolve 24 registros mesmo quando todos são zero.

**Impacto:** crítico.
**Confiança:** alta.

### P0. As conclusões narrativas não respeitam o cenário real

**Evidências:** `Planejamento.tsx`, linhas 520 e 644.

- A tela afirma que a empresa opera com superávit mesmo com receita e despesa iguais a zero ou quando o resultado for negativo.
- Recomenda alocar 10% em reservas sem regra, meta de liquidez ou contexto.
- Declara “bom aproveitamento” comercial mesmo com taxa de conversão de 0%.
- O texto diz “no semestre” mesmo quando o período selecionado é 6 meses, 12 meses ou todo o histórico.

**Impacto:** crítico.
**Confiança:** alta.

### P0. Custos fixos e variáveis são presumidos

**Evidência:** `Planejamento.tsx`, linhas 291–292.

A tela divide toda despesa em 60% fixa e 40% variável, embora o domínio financeiro já possua classificação real de `tipoCusto`. O ponto de equilíbrio e a margem de contribuição, portanto, podem ser matematicamente consistentes e gerencialmente falsos.

**Impacto:** crítico.
**Confiança:** alta.

### P1. A página não possui domínio de planejamento estratégico

A busca no backend, contratos e esquema do banco não encontrou entidades próprias para:

- ciclo estratégico;
- pilares;
- objetivos;
- resultados-chave ou metas;
- iniciativas;
- responsáveis;
- check-ins;
- riscos;
- decisões.

O estado da página se limita à aba ativa e ao recorte de tempo. Não existe criação, edição, acompanhamento ou encerramento de um plano.

**Impacto:** alto.
**Confiança:** alta.

### P1. Existe sobreposição com Financeiro, CRM e Relatórios

As três abas atuais — orçamento, ponto de equilíbrio e funil — repetem análises que pertencem aos módulos de origem. A página não agrega o que seria exclusivamente estratégico: direção, compromisso, prioridade, responsável, desvio e decisão.

**Ajuste recomendado:** os dados de Financeiro, CRM e Projetos devem alimentar resultados-chave vinculados a objetivos, sem serem replicados como dashboards independentes.

**Impacto:** alto.
**Confiança:** alta.

### P1. Métricas e rótulos divergem

- O cartão informa “Ganhos sobre total de leads”, mas a fórmula usa `ganhos / (ganhos + perdidos)`.
- O funil representa quantidades, porém o tooltip está configurado como moeda.
- “Todos” significa apenas os últimos 24 meses retornados pela API.
- “Ponto de equilíbrio” é chamado de “teto”, quando representa um patamar mínimo de receita.

**Impacto:** alto.
**Confiança:** alta.

## Comparação com os menus finalizados

Financeiro e Relatórios já demonstram um padrão melhor para o GeoGestor:

- não inventam indicadores quando a fonte está vazia;
- explicam por que a análise ainda não existe;
- mostram uma ação concreta para o usuário começar;
- usam título, descrição, ação principal, filtros e navegação em ordem previsível;
- apresentam o conteúdo progressivamente.

Planejamento deve herdar esse padrão e acrescentar a camada estratégica. A tela atual faz o inverso: mostra toda a densidade analítica mesmo quando não existe informação confiável.

## Estrutura narrativa recomendada

A página deve contar uma história em cinco perguntas, sempre nessa ordem:

### 1. Onde estamos?

Uma visão executiva do ciclo atual:

- nome e período do plano;
- situação geral;
- progresso dos objetivos;
- objetivos em risco;
- data da última revisão;
- qualidade e atualização das fontes.

### 2. Onde queremos chegar?

Direção estratégica:

- visão do ciclo;
- pilares estratégicos;
- objetivos;
- indicadores, linha de base, meta, unidade e prazo;
- responsável por cada objetivo.

### 3. Como chegaremos lá?

Execução:

- iniciativas e projetos vinculados;
- responsável;
- prazo;
- orçamento;
- dependências;
- progresso;
- próximo marco.

### 4. O que está desviando?

Gestão por exceção:

- resultados abaixo da trajetória;
- iniciativas atrasadas;
- riscos por impacto e probabilidade;
- dados desatualizados;
- bloqueios e causa do desvio.

### 5. O que precisa ser decidido agora?

Fechamento acionável:

- decisões pendentes;
- próximos passos;
- responsáveis;
- prazos;
- data da próxima revisão;
- registro do check-in executivo.

## Arquitetura de navegação proposta

1. **Visão estratégica** — síntese do ciclo, progresso, alertas e próximas decisões.
2. **Objetivos e metas** — pilares, objetivos e resultados-chave.
3. **Iniciativas** — plano de ação, responsáveis, prazos e dependências.
4. **Revisões e riscos** — check-ins, decisões, riscos e histórico de mudanças.

As abas atuais podem ser redistribuídas:

- orçamento e ponto de equilíbrio tornam-se indicadores do objetivo financeiro;
- conversão do funil torna-se um resultado-chave do objetivo comercial;
- indicadores operacionais vêm de Projetos e Tarefas;
- cada indicador mantém link para o módulo de origem.

## Modelo de tela recomendado

### Cabeçalho

- kicker: `Estratégia e execução`;
- título: `Planejamento estratégico`;
- seletor do ciclo ativo;
- estado do ciclo: rascunho, ativo, em revisão ou encerrado;
- ação primária contextual: `Criar planejamento`, `Novo objetivo` ou `Registrar revisão`.

### Primeira dobra

- cartão narrativo curto: “O plano está avançando, mas dois objetivos exigem decisão”;
- 3 ou 4 indicadores de síntese, sem truncar títulos;
- data da última atualização e nível de confiança dos dados;
- fila de decisões prioritárias.

### Corpo

- progresso por pilar;
- objetivos em risco;
- iniciativas prioritárias;
- trajetória meta × realizado apenas quando houver meta cadastrada;
- próximos marcos;
- riscos e bloqueios.

### Estado vazio

Quando não houver ciclo estratégico:

> Transforme a direção da empresa em objetivos mensuráveis. Crie um ciclo, defina os resultados esperados e conecte indicadores do Financeiro, CRM e Projetos.

Ação principal: `Criar primeiro planejamento`.

Passos:

1. Defina o ciclo e os pilares.
2. Cadastre objetivos e metas.
3. Vincule iniciativas e fontes.
4. Faça revisões periódicas.

## Modelo de dados mínimo

| Entidade | Conteúdo essencial |
|:---|:---|
| `strategic_cycles` | nome, período, visão, status |
| `strategic_pillars` | nome, descrição, ordem |
| `strategic_objectives` | título, descrição, responsável, prazo, status |
| `strategic_key_results` | linha de base, meta, valor atual, unidade, frequência, fonte |
| `strategic_initiatives` | responsável, prazo, progresso, orçamento, dependências |
| `strategic_checkins` | data, confiança, narrativa, bloqueios, decisões |
| `strategic_risks` | impacto, probabilidade, mitigação, responsável |

Os valores automáticos devem guardar fonte, última sincronização e regra de cálculo. Metas permanecem explícitas e nunca devem ser inferidas do realizado.

## Modernização visual e de interação

### Ajustes recomendados

- Usar o mesmo tratamento leve de cartões de Relatórios e Financeiro; reservar fundos saturados para estados ou destaques realmente prioritários.
- Remover `truncate` dos títulos de KPI em telas largas; permitir duas linhas com `line-clamp-2`.
- Exibir números somente quando a fonte for válida; caso contrário usar `—` com explicação.
- Transformar insights genéricos em alertas condicionais com ação: “Revisar meta”, “Abrir Financeiro”, “Ver oportunidades paradas”.
- Levar o período e o ciclo para o cabeçalho/filtro principal, refletindo a seleção na URL.
- Usar gráficos de trajetória, progresso e exceção; evitar gráficos sem meta real.
- Reduzir densidade de meses e formatar eixos com `Intl.NumberFormat`.
- Mostrar legendas e explicar a fonte dos indicadores.

### Acessibilidade verificada

O teste automatizado encontrou:

- 6 ocorrências de contraste insuficiente;
- 1 quebra de hierarquia de títulos;
- conteúdo fora de landmarks.

Também devem ser ajustados:

- comportamento completo de teclado nas abas, com setas e foco gerenciado;
- `aria-controls`, IDs de painéis e estado pressionado nos seletores;
- tooltip de fórmula acessível por foco, clique e Escape, não apenas por hover;
- foco visível padronizado com `focus-visible`;
- animações e gráficos respeitando `prefers-reduced-motion`.

No celular, a navegação local é cortada lateralmente sem um sinal claro de continuidade. Recomenda-se indicar rolagem, usar snap ou trocar por seletor compacto quando necessário.

## Roadmap recomendado

### Fase 0 — Integridade da informação

1. Remover metas e composições de custos simuladas.
2. Detectar ausência real de movimentos, não apenas lista vazia.
3. Substituir conclusões fixas por regras condicionais.
4. Corrigir fórmula/rótulo da conversão e tooltip do funil.
5. Implementar estado vazio no padrão de Financeiro e Relatórios.

### Fase 1 — Fundamento estratégico

1. Criar ciclos, pilares, objetivos e resultados-chave.
2. Permitir metas manuais e fontes automáticas identificadas.
3. Cadastrar responsáveis, prazos e situação.
4. Criar a navegação narrativa proposta.

### Fase 2 — Execução e revisão

1. Vincular iniciativas a Projetos e Tarefas.
2. Adicionar check-ins, riscos, decisões e histórico.
3. Criar alertas por desvio e dados desatualizados.
4. Apresentar “próximas decisões” na visão executiva.

### Fase 3 — Polimento

1. Unificar cards, filtros, estados vazios e ações com os menus finalizados.
2. Corrigir acessibilidade e responsividade.
3. Persistir ciclo, aba e período na URL.
4. Adicionar exportação executiva somente após a estabilização do modelo.

## Critérios de aceite para a futura implementação

- Nenhuma meta aparece sem cadastro ou fonte verificável.
- Ausência de dados nunca gera zero, percentual ou narrativa positiva artificial.
- Todo indicador informa unidade, período, fonte e última atualização.
- Cada objetivo tem responsável, prazo, status e pelo menos um resultado-chave.
- Cada desvio relevante conduz a uma ação ou decisão.
- A visão inicial responde: situação, risco, prioridade e próximo passo.
- A navegação funciona por mouse, teclado e toque.
- Não existem violações sérias de acessibilidade na auditoria automatizada.
- A experiência mantém o padrão visual de PageHeader, navegação local, estados vazios e ações dos menus finalizados.

## Conclusão

O módulo não precisa apenas de um novo layout. Ele precisa mudar de “dashboard com interpretações automáticas” para “sistema de direção e execução”. A melhor evolução é preservar a base visual já compartilhada, corrigir imediatamente a confiabilidade dos dados e construir uma jornada que conecte objetivos, indicadores, iniciativas, riscos e decisões.
