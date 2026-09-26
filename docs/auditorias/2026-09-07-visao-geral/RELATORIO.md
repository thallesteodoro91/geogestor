# Auditoria funcional 01 — Visão Geral e tarefas

## Resultado

**Status: APROVADA COM RESSALVAS.** Foram inventariados 62 itens: 54 aprovados, 0 reprovados pendentes, 4 bloqueados e 4 não aplicáveis. Durante a auditoria, 14 defeitos foram reproduzidos e corrigidos (6 P1 e 8 P2); todos passaram pelo reteste focado e pela jornada integrada real.

Não foi encontrado erro novo não previsto no console, na rede ou nos logs ao final. A única resposta `500` do E2E é injetada deliberadamente sobre `PATCH /api/tarefas/:id` para provar que a interface desfaz a atualização otimista e informa a falha.

## Escopo e ambiente

- Sessão: 01 — Visão Geral e integrações imediatas com tarefas.
- Rotas: `/` e `/tarefas`, esta última somente por fluxo iniciado no painel.
- Relatórios anteriores: nenhum.
- Aplicação: GeoGestor 1.0.4; frontend React/Vite; API Fastify; desktop Electron; libSQL/SQLite local.
- Sistema: Microsoft Windows NT 10.0.26200.0; Node v24.17.0; pnpm 11.8.0.
- Git: `main`, commit-base `a16551a`, árvore já estava modificada antes da sessão.
- Viewports comprovados: 1120 × 680 e 360 × 800; temas claro e escuro.
- Banco real identificado: `data/geogestor.db`, 1.990.656 bytes, modificação anterior em 30/08/2026 14:12:58. Ele não foi usado para mutações.
- Banco de QA: criado pelo executor em `scratch/commercial-e2e/run-*/geogestor.db`, com API e frontend em portas aleatórias e origem CORS explícita.
- Prefixo dos dados: `QA-AUDIT-S01-`.

## Evidência funcional principal

O cenário integrado criou, em banco descartável, um cliente, dois projetos, uma receita paga de R$ 100,00, uma despesa paga de R$ 40,00 e tarefas pendente, atrasada, concluída e no limite do período. A interface e a API foram confrontadas com o banco e comprovaram:

- Clientes `01`, Projetos `02`, Área sob Gestão `123,5 ha` e Eficiência `25%`.
- Fluxo de caixa: recebimentos R$ 100,00, pagamentos R$ 40,00 e resultado R$ 60,00.
- Taxa de conclusão: `1 de 4` e 25%; após concluir a tarefa CRUD, `2 de 5` e 40%; após reabrir e excluir, retorno a `1 de 4` e 25%.
- Próximos vencimentos inclui atrasada, pendente e limite; exclui concluída; seus links abrem `/tarefas` com busca profunda.
- Distribuição diferencia carteira ativa/todos os projetos, agrupamento macro/unitário, tipo, tooltip e alternativa textual.
- Alertas exibem as tarefas sintéticas e o filtro “Vencidos” exclui a tarefa futura.
- Criação, edição, recarga, falha de status com rollback, conclusão, reabertura, cancelamento de exclusão e exclusão confirmada de tarefa.
- A exclusão é lógica no banco, o registro deixa de ser retornado pela API e aparece na atividade recente.

## Resultados dos testes

| Verificação | Resultado exato |
|---|---|
| E2E de produção isolado | 2 testes; 2 aprovados; 0 falhas; 40,8 s |
| Integração API focada | 1 teste; 1 aprovado; 0 falhas; 10,9 s |
| Suíte web | 168 testes; 168 aprovados; 0 falhas; 2,41 s |
| Suíte API completa | 156 testes; 156 aprovados; 0 falhas; 108,06 s |
| Suíte Electron | 18 testes; 18 aprovados; 0 falhas; 190,84 ms |
| Typecheck web + API | aprovado; 0 erros |
| ESLint web | aprovado; 0 erros |
| `git diff --check` no escopo | aprovado; sem erro de whitespace |
| Axe WCAG 2.2 A/AA | 0 violações nas telas vazia, populada clara, populada escura e tarefas |

Comandos e saídas resumidas estão em [COMANDOS-E-RESULTADOS.md](COMANDOS-E-RESULTADOS.md). A matriz completa está em [MATRIZ-DE-COBERTURA.md](MATRIZ-DE-COBERTURA.md) e os defeitos em [ACHADOS.md](ACHADOS.md).

## Arquivos alterados nesta sessão

- `apps/api/src/routes/tarefas.routes.ts`: contrato, normalização, referência de projeto e semântica de exclusão lógica.
- `apps/api/src/routes/dashboard.routes.ts`: seleção correta de próximos vencimentos.
- `apps/api/src/server.ts`: CORS executado antes dos bloqueios de autenticação.
- `apps/api/src/session01-dashboard-tasks.integration.test.ts`: regressão isolada da API e do banco.
- `apps/web/src/App.tsx`: invalidação do cache de autenticação e hidratação operacional após desbloqueio.
- `apps/web/src/pages/Dashboard.tsx`: atualização, links, semântica e contraste.
- `apps/web/src/pages/Tarefas/Tarefas.tsx`: edição, rollback, invalidação, datas, exclusão, submissão e arraste acessível.
- `apps/web/src/components/Layout.tsx`: ação do seletor de tema baseada no tema efetivo.
- `apps/web/src/components/form-controls/DatePickerField.tsx`: remoção de ARIA inválida.
- `apps/web/src/index.css`: tokens claros com contraste AA.
- `tests/e2e/setup-initial.spec.ts`: alinhamento do setup E2E ao formulário atual, continuando contra o backend real.
- `tests/e2e/session01-dashboard-tasks.spec.ts`: jornada, cálculos, acessibilidade, alertas, tooltips e evidências.

Havia muitas alterações preexistentes, inclusive em alguns desses arquivos. Nenhuma alteração alheia foi revertida.

## Limpeza

O executor da última execução informou: `Execução aprovada e resíduos próprios removidos`. Em seguida foram removidos somente os diretórios descartáveis das tentativas desta sessão, após validação da raiz absoluta. A verificação final retornou `RESIDUOS_SESSAO=0`. Consultas no banco real retornaram zero registros com o prefixo da sessão em `tarefas`, `clientes`, `projetos`, `orcamentos` e `despesas`; o arquivo manteve a data de modificação de 30/08/2026. Não houve upload nem criação de anexo/pasta funcional no escopo.

## Riscos residuais e recomendação

Não há defeito funcional conhecido pendente. Permanecem quatro bloqueios de comprovação: leitor de tela real, zoom nativo de 200% e viewports intermediários, interrupção/reconexão lenta controlada durante o painel e duas escritas realmente concorrentes sobre a mesma tarefa. Esses itens devem ser incluídos numa regressão transversal; não justificam reabrir as correções desta sessão.

**Recomendação: pode iniciar a Sessão 02**, mantendo os quatro bloqueios na lista transversal de regressão e repetindo o smoke do painel após alterações em tarefas, financeiro ou projetos.

## Melhorias não implementadas

| Prioridade | Proposta | Benefício | Esforço | Risco |
|---|---|---|---|---|
| 1 | Criar uma suíte transversal em 768, 1024 e 1440 px com zoom nativo de 200% | Evita regressões de reflow entre módulos | Médio | Baixo |
| 2 | Executar roteiro manual NVDA e registrar fala/foco | Complementa Axe com a experiência real | Médio | Baixo |
| 3 | Adicionar teste de concorrência com versão/ETag para tarefas | Detecta perda silenciosa de atualização | Médio | Médio; exige decisão de produto |
| 4 | Tornar estados de conexão lenta/offline determinísticos no harness | Melhora a regressão de recuperação | Médio | Baixo |
