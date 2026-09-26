# Sessão 03 — Comercial — CRM e Funil

## Resultado

**Status: APROVADA COM RESSALVAS.** Os 64 itens aplicáveis terminaram aprovados; 29 foram aprovados após correção. Dois recursos não existem na tela atual e são não aplicáveis: ordenação de leads e importação em lote. Não há reprovação, bloqueio ou pendência.

As ressalvas são de profundidade assistiva e evolução de produto: não houve leitor de tela real nem zoom nativo de 200%, e concorrência multiusuário de reordenação ainda segue a política implícita de última escrita. Axe, teclado, alternativa acessível ao arraste, quatro larguras, temas claro/escuro e rolagem horizontal contida foram exercitados.

## Gate e linha de base

- Gate: `ready/allowed`; ambiente local isolado; correções limitadas ao escopo.
- Relatórios anteriores de Visão Geral e Clientes lidos integralmente.
- Git inicial: `main` em `a16551a`, com worktree já suja; alterações preexistentes preservadas.
- Stack: Electron + React/Vite + Fastify/Drizzle/SQLite.
- Banco real identificado e preservado por tamanho, data e SHA-256; mutações só em bancos descartáveis.

## Cobertura e evidência

- Matriz: 66 itens; 64 aprovados, 0 reprovados, 0 bloqueados, 2 não aplicáveis, 0 pendentes.
- E2E real: 3/3 em 56,4 s, com build, frontend, API e SQLite isolados.
- API/domínio/migração: 8/8 em 20,654 s.
- Typecheck: web e API aprovados.
- Regressão: Sessão 01 aprovada; Sessão 02 aprovada 3/3 em execução isolada.
- Evidência visual: 10 PNGs cobrindo cada visão vazia/populada, conversão, funil, histórico, pós-transições/exclusão e modo escuro.

## Defeitos

Foram reproduzidos e corrigidos sete defeitos:

- 4 P1: contrato/integridade de leads; contrato/integridade de oportunidades; auditoria incompleta; controles interativos aninhados no kanban.
- 3 P2: proteção/erros do formulário de leads; contraste no funil/histórico; contraste do toast escuro.
- 0 P0 e 0 pendentes.

O teste vermelho mais direto foi `POST /api/contatos` com nome em branco retornando 200. Após os schemas e transações, o caso retorna 400 e a suíte consolidada passa 8/8.

## Resultado funcional comprovado

- Deep links, rota legada, navegação local, reload e retorno de orçamento/projeto preservam o contexto.
- Leads: vazio/populado, busca, status, paginação/URL, formulário completo, validações, descarte, normalização, duplicidade, edição, exclusão segura e conversão idempotente.
- Funil: cinco etapas, criação por cliente/lead, filtros/chips/atenção, histórico, transições, perda obrigatória, reabertura, orçamento, projeto idempotente e exclusão confirmada.
- Indicadores: zero e populado; no conjunto conhecido, pipeline aberto `R$ 10.000,00`, ponderado `R$ 6.150,00` e uma perdida, iguais à API/banco.
- Segurança: contratos estritos, IDs/referências inválidos rejeitados, XSS tratado como texto e auditoria sem PII excessiva.
- Acessibilidade: Axe sem violações nos pontos finais; modal e kanban com nomes/foco; toast escuro corrigido.
- Recuperação: HTTP 500 controlado mostrou erro acionável; “Tentar novamente” restaurou os dados reais.

## Arquivos alterados e motivo

- `apps/api/src/routes/contatos.routes.ts`: validação, normalização, duplicidade, HTTP, transações e auditoria de leads.
- `packages/contracts/src/opportunities.ts`: datas reais, contrato estrito, par ação/data e reorder único.
- `apps/api/src/services/oportunidades.service.ts`: validação efetiva e auditoria transacional.
- `apps/api/src/oportunidades.integration.test.ts`: expectativa 201 coerente.
- `apps/web/src/pages/Contatos/Contatos.tsx`: erros por campo, foco, limites, normalização e descarte protegido.
- `apps/web/src/pages/CRM/CRM.tsx`: alça de arraste dedicada, foco do kanban e contrastes.
- `apps/web/src/index.css`: contraste do toast de sucesso escuro.
- `apps/api/src/session03-crm-funnel.integration.test.ts`: regressão API/DB.
- `tests/e2e/session03-crm-funnel.spec.ts`: jornada real e capturas.
- `docs/auditorias/2026-09-08-comercial-crm-funil/*`: entregáveis.

## Riscos residuais

- Reorder concorrente não possui versão otimista/ETag; duas gravações válidas podem adotar a última resposta. Mudar isso exige decisão de produto.
- Leitor de tela real e zoom nativo de 200% requerem rodada manual assistiva; a cobertura atual inclui Axe, teclado, responsividade e scroll interno.
- Runs antigos em `scratch/commercial-e2e` são preexistentes e foram preservados.

## Limpeza e recomendação

Os bancos, builds, arquivos e registros sintéticos desta sessão foram removidos com seus diretórios isolados. Não restou run identificado desta auditoria; o banco real permaneceu no mesmo hash observado.

**Recomendação: não iniciar a Sessão 04 automaticamente.** A Sessão 03 está apta para encerramento; a próxima sessão deve começar apenas por solicitação explícita do usuário.
