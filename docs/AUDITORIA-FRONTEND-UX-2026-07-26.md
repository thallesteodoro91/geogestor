# Auditoria de Frontend, UI/UX e Prontidão Comercial — GeoGestor

**Data da auditoria:** 26/07/2026
**Estado auditado:** branch `codex/release-1.1.1`, commit-base `0159b48`, com alterações locais não consolidadas
**Versão declarada no pacote:** 1.1.2
**Auditor:** Codex
**Escopo excluído:** planos, assinaturas, licenciamento comercial e cobrança recorrente

## 1. Resumo executivo

O GeoGestor já possui uma base funcional e visual substancialmente acima de um protótipo: os fluxos de criação e edição de clientes e projetos funcionaram no banco isolado; os formulários principais de clientes e projetos têm validação contextual, máscaras brasileiras, foco no primeiro erro e preservação de estado; a navegação é ampla, o layout se adapta ao tamanho mínimo oficial de 800×520 sem rolagem horizontal global; o build e o lint do frontend passam; a API empacotada inicia; Electron usa isolamento de contexto, sandbox, token efêmero e cabeçalhos de segurança; existem rotinas de backup, restauração, auditoria e contenção de caminhos.

O produto, contudo, ainda não está pronto para venda. O instalador disponível não passa na verificação de integridade do próprio projeto, a suíte oficial da API não é determinística, falhas da API podem aparecer ao usuário como “dados zerados”, a senha local coletada na configuração não protege o acesso ao aplicativo e a identidade exibida permanece `demo@geogestor.com`. No módulo financeiro, uma nova receita seleciona automaticamente o primeiro cliente e os formulários podem perder dados digitados sem confirmação. Esses problemas atingem integridade do release, confiança, segurança percebida e risco operacional.

**Veredito:** **NÃO LANÇAR**

## 2. Veredito de lançamento

**NÃO LANÇAR**

O GeoGestor pode ser usado em desenvolvimento e em homologação interna, mas o instalador atual não deve ser vendido nem distribuído como release comercial. A decisão não decorre de preferência estética: há falhas objetivas de integridade do pacote, confiabilidade da homologação, comunicação de indisponibilidade e prevenção de erro financeiro.

Uma nova auditoria curta pode mudar o veredito para **APTO PARA BETA CONTROLADO** após a resolução dos bloqueadores e dos itens altos que afetam finanças, identidade e indisponibilidade.

## 3. Nota geral atual

**Nota geral: 6,6/10**

A interface principal e os fluxos modernos estão próximos de 8/10, mas a confiança comercial cai por causa do estado do release, falhas silenciosas, identidade demonstrativa e lacunas nos fluxos financeiros.

## 4. Nível de confiança da auditoria

**Alto.**

Foram combinadas análise estática, execução real com API e SQLite isolados, criação e edição de registros, navegação por teclado, medição de contraste, verificação do tamanho mínimo da janela, build, lint, testes e smoke test da API empacotada.

Limites da confiança:

- O executável instalado via NSIS não foi percorrido visualmente de ponta a ponta; a API empacotada foi executada por smoke test.
- NVDA/JAWS e configuração física do Windows em 125%, 150% e 200% não foram executados; foco, semântica, reflow, redução de movimento e ampliação foram verificados no Chromium.
- `axe-core` não está instalado no projeto; foi usada varredura automatizada própria do DOM, inspeção manual e cálculo de contraste.
- A rede externa estava indisponível. Isso impediu o carregamento dos tiles do OpenStreetMap e, simultaneamente, comprovou o comportamento offline.
- O worktree foi alterado durante a fase inicial da auditoria. As conclusões refletem o estado final observado em 26/07/2026.
- Nenhum dado real foi alterado. Clientes, projetos e registros financeiros de teste foram criados em `scratch/frontend-audit-20260725/geogestor-audit.db`.

## 5. Escopo analisado e limitações

### Tecnologia e arquitetura

- Monorepo PNPM.
- Frontend: React 19, TypeScript, Vite 8, React Router 7, TanStack Query 5, Tailwind CSS, Framer Motion, Recharts, Leaflet, PDFMake e Zod.
- Desktop: Electron 35, preload isolado, API Fastify local e SQLite/Drizzle.
- Estado remoto: TanStack Query; estado de formulários predominantemente local.
- Design system: tokens e classes `geo-*` em `index.css` e `utils/geoTheme.ts`, combinados com Tailwind ad hoc em telas legadas.
- Segurança desktop positiva: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, token local efêmero, CSP no pacote e restrição de navegação.

### Verificações executadas

- `pnpm --filter web lint`: passou.
- `pnpm --filter web build`: passou em aproximadamente 3 s.
- Testes de domínio do frontend: 18/18 passaram.
- Testes do Electron: 5/5 passaram.
- Suíte completa da API: 61/63 passaram; os dois arquivos que falharam passaram quando executados isoladamente.
- Smoke test da API empacotada: passou.
- Verificação do pacote: falhou por worktree sujo e divergência de tamanho/SHA-256 do instalador.
- Fluxos reais: configuração inicial, cliente, projeto e receita.
- Acessibilidade: clientes e financeiro, teclado, foco, nomes acessíveis, headings, contraste, modal e tamanho mínimo.

## 6. Inventário de telas e fluxos

### Inicialização e gestão

- Configuração inicial.
- Dashboard gerencial.
- Configurações, backup, restauração, Google Calendar e limpeza de dados.
- Ajuda e logs de auditoria.

### Comercial e relacionamento

- Clientes: listagem, filtros, ordenação, cadastro, detalhes, arquivos, mapas, jornada, tarefas e agenda.
- CRM: leads, oportunidades e conversões.
- Orçamentos/propostas: listagem, editor e detalhes/PDF.

### Operação técnica

- Projetos: listagem, cadastro em etapas, detalhes, mapa, tarefas, despesas e documentos.
- Ambiental e licenciamento.
- Calendário.
- Tarefas e visão operacional.
- Calculadora topográfica.
- Importação e esquemas de importação.

### Financeiro e gestão

- Financeiro/Contabilidade 360.
- Receitas, contas a receber, contas a pagar e despesas.
- Faturas/recebimentos.
- Dashboard financeiro.
- Relatórios, relatório executivo e planejamento estratégico.
- Viagens e documentos fiscais.

### Rotas de compatibilidade

- `/contatos` redireciona para CRM.
- `/licenciamento` redireciona para Ambiental.
- `/calculadora-ambiental` redireciona para Ambiental/CAR.

## 7. Pontuação detalhada

| Dimensão | Nota | Evidência resumida |
|---|---:|---|
| Identidade visual e acabamento | 7,4 | Visual profissional nas telas modernas; versões e identidade demonstrativa inconsistentes. |
| Consistência do design system | 6,9 | Tokens `geo-*` coexistem com muitas classes ad hoc e 61 usos de `transition-all`. |
| Navegação e arquitetura da informação | 8,0 | Menu amplo, rotas claras, breadcrumbs e filtros em URL; alta densidade no menu. |
| Usabilidade | 7,2 | Clientes/projetos bons; finanças têm seleção automática perigosa e perda de rascunho. |
| Formulários | 7,5 | Clientes/projetos fortes; configuração inicial e finanças ainda inconsistentes. |
| Feedback e tratamento de erros | 5,2 | Falha da API pode virar zeros; 87 chamadas `alert()` dependem de interceptação global. |
| Acessibilidade | 6,9 | Foco, nomes e modais bons; contraste AA e hierarquia de headings têm falhas. |
| Responsividade e desktop | 7,9 | Sem overflow global em 800×520; modal cabe e rola; densidade elevada no mínimo. |
| Performance | 7,2 | Rotas lazy e build rápido; PDFMake tem 1,83 MB e dashboard dispara várias consultas. |
| Qualidade/manutenção do código | 6,4 | Tipagem razoável, mas arquivos de 1.200–3.316 linhas e TypeScript web sem `strict`. |
| Cobertura de testes | 5,8 | Bom núcleo de API; poucos testes frontend e E2E restrito a orçamento; suíte oficial instável. |
| Confiança para uso comercial | 4,3 | Pacote inválido, identidade demo, senha sem uso e riscos financeiros. |

## 8. Problemas bloqueadores

### GG-B01 — Pacote comercial não passa na verificação de integridade

1. **Severidade:** BLOQUEADOR.
2. **Área:** empacotamento e distribuição desktop.
3. **Evidência:** `pnpm release:verify-package` terminou com erro; `apps/desktop/dist/release-verification.json` registra `dirty: true`, tamanho divergente e SHA-256 divergente. O manifesto declara 89.017.121 bytes, enquanto o instalador observado tem 89.018.971 bytes.
4. **Como reproduzir:** executar `pnpm.cmd release:verify-package`.
5. **Comportamento atual:** o instalador não corresponde ao manifesto de integridade e foi gerado a partir de worktree sujo.
6. **Esperado:** artefato produzido a partir de commit/tag limpo, com tamanho e hash idênticos ao manifesto e verificação retornando código 0.
7. **Impacto:** não há cadeia confiável entre código auditado e binário vendido.
8. **Causa provável:** instalador regenerado depois do manifesto ou manifesto desatualizado; processo de release executado sobre alterações locais.
9. **Solução:** congelar um commit, limpar o worktree, gerar novamente pacote, SBOM, hashes e evidências na mesma execução; validar assinatura.
10. **Arquivos:** `apps/desktop/dist/release-verification.json`, `apps/desktop/dist/artifact-hashes.json`, `scripts/release-verify.mjs`.
11. **Complexidade:** média.
12. **Aceite:** `release:verify-package` e verificação de assinatura passam; `dirty=false`; tamanho/hash conferem byte a byte.
13. **Bloqueia lançamento:** sim.

### GG-B02 — Suíte oficial da API é não determinística

1. **Severidade:** BLOQUEADOR.
2. **Área:** garantia de qualidade e gate de release.
3. **Evidência:** `pnpm --filter api test` resultou em 61 passes e 2 falhas (`clientes.integration.test.ts` e `oportunidades.integration.test.ts`). Ambos passaram quando executados isoladamente.
4. **Como reproduzir:** executar a suíte completa; depois executar os dois arquivos separadamente.
5. **Comportamento atual:** o resultado depende da concorrência/ordem.
6. **Esperado:** a suíte completa deve ser repetível e verde.
7. **Impacto:** regressões reais não podem ser separadas com confiança de interferência de testes.
8. **Causa provável:** variáveis de ambiente globais e conexões/módulos de banco compartilhados. Diversos arquivos usam o mesmo `scratch/.../geogestor.db`; o script não fixa concorrência.
9. **Solução:** banco único por arquivo/processo, servidor instanciável por teste, limpeza garantida e/ou `--test-concurrency=1` até o isolamento ser corrigido.
10. **Arquivos:** `apps/api/package.json`, `apps/api/src/clientes.integration.test.ts`, `apps/api/src/oportunidades.integration.test.ts` e testes que usam `scratch/.../geogestor.db`.
11. **Complexidade:** média.
12. **Aceite:** cinco execuções consecutivas da suíte completa com 100% de aprovação e sem resíduos.
13. **Bloqueia lançamento:** sim.

## 9. Problemas críticos e altos

### GG-C01 — Indisponibilidade da API aparece como dados zerados

1. **Severidade:** CRÍTICO.
2. **Área:** inicialização, dashboard e tratamento de falhas.
3. **Evidência:** sem API, a tela permaneceu em “Carregando GeoGestor...” por cerca de 30 s e depois exibiu dashboard com clientes/projetos/finanças em zero. `App.tsx:154-170` ignora o erro após o bootstrap; `Dashboard.tsx:127-150` usa arrays vazios sem `isError`.
4. **Como reproduzir:** interromper a API e carregar/recarregar a interface.
5. **Atual:** falha de comunicação é apresentada como ausência de dados.
6. **Esperado:** estado global de indisponibilidade, mensagem clara, “Tentar novamente” e preservação visual do último dado conhecido.
7. **Impacto:** o usuário pode acreditar que perdeu dados ou tomar decisões com números falsamente zerados.
8. **Causa provável:** defaults vazios do React Query sem distinção entre resposta vazia e requisição falha.
9. **Solução:** boundary de saúde da API, estados de erro explícitos e proibição de renderizar KPI zero quando a origem falhou.
10. **Arquivos:** `apps/web/src/App.tsx`, `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/components/RecentActivities.tsx`.
11. **Complexidade:** média.
12. **Aceite:** API desligada nunca produz KPIs válidos; a tela informa a falha em até 5 s e permite recuperar.
13. **Bloqueia lançamento:** sim.

### GG-C02 — Senha local é coletada, mas não protege o sistema

1. **Severidade:** CRÍTICO.
2. **Área:** configuração inicial, identidade e segurança percebida.
3. **Evidência:** a configuração exige “Senha Local” e grava `adminSenhaHash`; nenhuma rotina autentica essa senha. Após configurar nome/e-mail reais, o menu continua exibindo `Usuário` e `demo@geogestor.com` (`Sidebar.tsx:280-290`).
4. **Como reproduzir:** concluir a configuração inicial e reabrir o app.
5. **Atual:** a senha é armazenada, mas não há bloqueio/login; identidade configurada não é exibida.
6. **Esperado:** implementar desbloqueio local real ou remover senha e explicar que a proteção é a conta do Windows; sempre mostrar a identidade configurada.
7. **Impacto:** falsa expectativa de proteção de dados reais e aparência inequívoca de produto demonstrativo.
8. **Causa provável:** configuração de autenticação iniciada e não concluída.
9. **Solução:** decisão explícita de arquitetura de segurança; preferencialmente sessão local com bloqueio, timeout e validação do hash.
10. **Arquivos:** `apps/web/src/pages/ConfiguracaoInicial.tsx`, `apps/web/src/components/Sidebar.tsx`, `apps/api/src/server.ts:168-175, 635-671`, `packages/database/src/schema.ts:15-17`.
11. **Complexidade:** alta para autenticação; baixa para remover a promessa.
12. **Aceite:** teste automatizado prova que dados não são acessíveis antes da autenticação, ou a UI não solicita senha e documenta o modelo baseado no Windows.
13. **Bloqueia lançamento:** sim.

### GG-A01 — Nova receita seleciona o primeiro cliente automaticamente

1. **Severidade:** ALTO.
2. **Área:** Financeiro → Nova Receita.
3. **Evidência:** o primeiro cliente apareceu selecionado sem ação do usuário; `Financeiro.tsx:463-466` executa `setOrcClienteId(clientes[0].id)`.
4. **Como reproduzir:** cadastrar dois clientes e abrir “Nova Receita”.
5. **Atual:** a receita nasce vinculada ao primeiro cliente.
6. **Esperado:** opção vazia obrigatória, exceto quando o fluxo for aberto a partir de um cliente/projeto explícito.
7. **Impacto:** receitas podem ser atribuídas ao cliente errado.
8. **Causa provável:** conveniência implementada como default.
9. **Solução:** iniciar `clienteId=''`; permitir prefill somente por contexto de navegação identificado.
10. **Arquivos:** `apps/web/src/pages/Financeiro/Financeiro.tsx:463-480`.
11. **Complexidade:** baixa.
12. **Aceite:** formulário global nunca seleciona cliente automaticamente; envio vazio foca o campo.
13. **Bloqueia lançamento:** sim.

### GG-A02 — Formulários financeiros perdem alterações sem confirmação

1. **Severidade:** ALTO.
2. **Área:** Nova/Editar Receita e Conta a Pagar.
3. **Evidência:** todos os caminhos de fechamento chamam diretamente `setShow...Modal(false)` em `Financeiro.tsx:1568-1571, 1649-1651, 1657-1660, 1746-1748`; não há dirty state nem `beforeunload`.
4. **Como reproduzir:** preencher vários campos e clicar em Cancelar, backdrop ou pressionar Esc.
5. **Atual:** o rascunho desaparece.
6. **Esperado:** “Descartar alterações / Continuar editando”, igual aos formulários de cliente e projeto.
7. **Impacto:** perda de trabalho e risco de omissão de informação financeira.
8. **Causa provável:** os modais financeiros não usam o padrão de formulário sujo já existente.
9. **Solução:** fingerprint inicial, dirty state, proteção de fechamento e navegação.
10. **Arquivos:** `apps/web/src/pages/Financeiro/Financeiro.tsx`, `apps/web/src/components/Modal.tsx`.
11. **Complexidade:** média.
12. **Aceite:** Cancelar/Esc/backdrop/navegação exigem confirmação quando houver mudança; sem mudança fecham imediatamente.
13. **Bloqueia lançamento:** sim.

### GG-A03 — Mapas dependem de internet e falham sem estado offline

1. **Severidade:** ALTO.
2. **Área:** mapas de cliente, projetos, topografia e visualizador.
3. **Evidência:** requisições a `tile.openstreetmap.org` falharam; a tela não apresentou explicação. URLs externas estão em `ClienteDetalhes.tsx:432`, `ProjetosMap.tsx:106-108`, `CalculadoraTopografica.tsx:390` e `MapaVisualizador.tsx:64`.
4. **Como reproduzir:** abrir mapas sem conexão.
5. **Atual:** base cartográfica vazia e erros apenas no console.
6. **Esperado:** banner offline e distinção entre camada do usuário e mapa-base; opcionalmente cache/offline.
7. **Impacto:** software local de geografia parece defeituoso e pode induzir interpretação errada.
8. **Causa provável:** ausência de tratamento de erro do tile layer.
9. **Solução:** detectar `tileerror`/offline, informar dependência, manter camadas vetoriais visíveis e oferecer configuração de fonte.
10. **Arquivos:** telas de mapa citadas.
11. **Complexidade:** média; alta para cache offline.
12. **Aceite:** modo offline exibe explicação e mantém dados próprios; nenhuma área vazia é apresentada como mapa carregado.
13. **Bloqueia lançamento:** sim, salvo se a dependência online for declarada e tratada claramente.

### GG-A04 — Não há regressão E2E dos três fluxos comerciais principais

1. **Severidade:** ALTO.
2. **Área:** qualidade.
3. **Evidência:** os E2E existentes concentram-se em orçamento/PDF; não há jornada automatizada de clientes, projetos e finanças nem teste automatizado WCAG.
4. **Como reproduzir:** inventariar `tests/e2e` e scripts de `apps/web/package.json`.
5. **Atual:** regressões de integração só aparecem por teste manual.
6. **Esperado:** smoke E2E no desktop/Chromium para CRUD, erros, cancelamento, filtros e persistência.
7. **Impacto:** alto risco de regressão em um worktree com milhares de linhas modificadas.
8. **Causa provável:** testes cresceram primeiro no backend e no orçamento.
9. **Solução:** Playwright com banco temporário e gate de acessibilidade.
10. **Arquivos:** `tests/e2e`, `apps/web/package.json`.
11. **Complexidade:** alta.
12. **Aceite:** jornadas críticas passam em CI e no pacote candidato.
13. **Bloqueia lançamento:** sim para o mínimo de smoke crítico.

## 10. Problemas médios e baixos

### GG-M01 — Mensagem técnica em inglês no valor da receita

- **Severidade:** MÉDIO.
- **Evidência/reprodução:** enviar Nova Receita sem valor mostra `Expected number, received nan`. O valor vazio vira `NaN` em `financeForm.ts:37,45`; o schema de `Financeiro.tsx:530-545` repassa a mensagem padrão do Zod.
- **Atual/esperado:** erro técnico em inglês versus “Informe um valor maior que zero”.
- **Impacto:** reduz compreensão e confiança no módulo financeiro.
- **Solução/complexidade:** validar a string antes da conversão ou customizar `invalid_type_error`; baixa.
- **Aceite:** vazio, texto inválido, zero, negativo e excesso exibem mensagens em português junto ao campo.
- **Bloqueia lançamento:** deve ser corrigido no lote obrigatório, embora exista alternativa simples.

### GG-M02 — Contraste abaixo de WCAG AA

- **Severidade:** MÉDIO.
- **Evidência:** no tema claro foram medidos: títulos de seção do menu 2,56:1, `Ctrl K` 2,44:1, contador do H1 2,46:1 (mínimo 3:1 para texto grande) e versão 3,77:1.
- **Critério WCAG:** 1.4.3 Contraste (Mínimo).
- **Impacto:** baixa visão, telas com brilho/contraste reduzidos.
- **Solução/complexidade:** escurecer tokens de texto secundário; baixa.
- **Aceite:** todo texto normal ≥4,5:1 e texto grande ≥3:1 em claro/escuro.
- **Bloqueia lançamento:** não, mas bloqueia conformidade AA.

### GG-M03 — Versão exibida é inconsistente

- **Severidade:** MÉDIO.
- **Evidência:** `index.html` e pacote informam 1.1.2; Sidebar, Configurações e Ajuda informam 1.1.1.
- **Impacto:** suporte e usuário não sabem qual build está instalado.
- **Solução/complexidade:** injetar uma única versão no build; baixa.
- **Aceite:** título, menu, Ajuda, Configurações, executável e relatório de suporte mostram a mesma versão.
- **Bloqueia lançamento:** corrigir antes de distribuir o próximo pacote.

### GG-M04 — Feedback é fragmentado e dependente de interceptação global

- **Severidade:** MÉDIO.
- **Evidência:** 87 chamadas `alert()`; `App.tsx:7-20` substitui globalmente `window.alert` e escolhe tipo de toast por palavras da mensagem. Há apenas sete confirmações nativas.
- **Impacto:** feedback inconsistente, mensagens classificadas incorretamente e dificuldade de foco/anúncio.
- **Solução/complexidade:** serviço tipado de notificações e erros de formulário; média.
- **Aceite:** nenhum fluxo novo usa `alert`; erro acionável aparece junto ao contexto e é anunciado.
- **Bloqueia lançamento:** não isoladamente.

### GG-M05 — Configuração inicial está abaixo do padrão dos formulários modernos

- **Severidade:** MÉDIO.
- **Evidência:** usa H2 sem H1; inputs não têm `name` nem `autocomplete`; senha gerou recomendação do Chromium; erros dependem da validação nativa. `ConfiguracaoInicial.tsx:43-66`.
- **Impacto:** pior autofill, semântica e experiência no primeiro contato.
- **Solução/complexidade:** aplicar componentes/tokens do design system, H1, nomes e autocomplete; baixa.
- **Aceite:** `organization`, `name`, `email` e `new-password`; erros inline, foco e H1.
- **Bloqueia lançamento:** não.

### GG-M06 — Hierarquia de headings inconsistente no Financeiro

- **Severidade:** BAIXO.
- **Evidência:** varredura encontrou H1 seguido diretamente por H3 em “Composição de custos” e “Fluxo de caixa mensal”.
- **Impacto:** navegação por headings menos previsível.
- **Solução/complexidade:** usar H2 para seções principais; baixa.
- **Aceite:** outline lógico sem saltos.
- **Bloqueia lançamento:** não.

### GG-M07 — Componentes excessivamente grandes

- **Severidade:** MÉDIO.
- **Evidência:** `ClienteDetalhes.tsx` 3.316 linhas, `Financeiro.tsx` 1.770, `ListagemClientes.tsx` 1.481, `BudgetEditor.tsx` 1.446 e várias telas acima de 1.000 linhas.
- **Impacto:** mudanças pequenas têm grande superfície de regressão; dificulta testes e revisão.
- **Solução/complexidade:** extrair domínios, hooks e seções; alta.
- **Aceite:** componentes de página orquestram módulos menores com testes próprios.
- **Bloqueia lançamento:** não, mas aumenta o risco atual.

### GG-L01 — Design system ainda convive com padrões legados

- **Severidade:** BAIXO.
- **Evidência:** 61 usos de `transition-all`, cores `indigo/emerald/zinc` ad hoc e telas antigas com estilos diferentes dos tokens `geo-*`.
- **Impacto:** acabamento e manutenção inconsistentes.
- **Solução/complexidade:** migração gradual para tokens e propriedades de animação explícitas; média.
- **Aceite:** componentes compartilhados dominam botões, filtros, campos, tabs e cards.
- **Bloqueia lançamento:** não.

### GG-L02 — TypeScript do frontend não habilita modo estrito

- **Severidade:** BAIXO.
- **Evidência:** `tsconfig.app.json` não ativa `strict` e desativa alertas de não usados.
- **Impacto:** menor proteção durante refactors, apesar do uso atual de `any` ser baixo.
- **Solução/complexidade:** habilitação incremental por flags; média.
- **Aceite:** `strict`, `noUnusedLocals` e `noUnusedParameters` ou plano documentado sem erros.
- **Bloqueia lançamento:** não.

## 11. Aspectos positivos encontrados

- Clientes e projetos oferecem bom padrão de validação: mensagens próximas, `aria-invalid`, `aria-describedby` e foco no primeiro erro.
- Modais implementam focus trap, retorno de foco, `inert`, Escape, `aria-modal`, título acessível e redução de movimento.
- Confirmações destrutivas usam `alertdialog` e focam “Cancelar”.
- Busca e filtros de clientes são refletidos na URL e no `sessionStorage`.
- Estados vazios de clientes e projetos são claros e oferecem próxima ação.
- CRUD de cliente e criação de projeto funcionaram no ambiente isolado.
- Formatação de CPF e telefone brasileira funcionou.
- Tamanho mínimo 800×520 não gerou overflow horizontal global; formulário longo permaneceu rolável e dentro da viewport.
- Varredura de clientes: 38 controles visíveis, nenhum sem nome acessível, nenhuma imagem visível sem `alt`, H1 presente e nenhum ID duplicado.
- Varredura financeira: 44 controles visíveis sem nome ausente e sem IDs duplicados.
- Navegação por 28 elementos com Tab mostrou foco visível.
- `prefers-reduced-motion` é tratado globalmente e em componentes.
- Rotas são lazy-loaded e o build separa mapas, gráficos, drag-and-drop e PDF.
- Lint e build passam; testes de domínio do frontend e Electron passam.
- API empacotada iniciou e retornou tabelas operacionais vazias no smoke test.
- Segurança Electron aplica sandbox, isolamento de contexto, allowlist de navegação e token local.
- Existem backup/restauração, auditoria transacional, soft delete/recuperação e contenção de caminhos.

## 12. Correções obrigatórias antes do lançamento

1. Gerar pacote limpo e fazer integridade/assinatura passarem.
2. Tornar a suíte oficial determinística e verde.
3. Implementar estado global de indisponibilidade da API, sem falsos zeros.
4. Decidir e concluir o modelo de senha local; remover identidade demo.
5. Remover seleção automática do primeiro cliente em receitas.
6. Proteger rascunhos financeiros em todos os fechamentos.
7. Corrigir mensagem `NaN` e demais mensagens financeiras.
8. Tratar mapas offline ou declarar dependência com feedback claro.
9. Sincronizar versão em todas as superfícies.
10. Adicionar smoke E2E de cliente, projeto e finanças.
11. Corrigir contrastes de navegação e contador.

## 13. Melhorias recomendadas após o lançamento

- Refatorar componentes acima de 1.000 linhas.
- Substituir interceptação global de `alert` por serviço de feedback tipado.
- Expandir testes de componentes, teclado e WCAG.
- Adicionar virtualização ou paginação de servidor para cadastros acima de 500 itens.
- Reduzir `transition-all` e consolidar tokens.
- Avaliar cache de mapas/base cartográfica configurável.
- Habilitar TypeScript estrito progressivamente.
- Adicionar telemetria local opt-in de performance e diagnósticos exportáveis.

## 14. Plano para alcançar qualidade 10/10

### Fase 0 — Release confiável

- Corrigir isolamento dos testes.
- Congelar commit e regenerar pacote, hashes, SBOM e assinatura.
- Criar checklist automatizado de candidato.

### Fase 1 — Segurança e corretude

- Resolver senha/identidade.
- Corrigir indisponibilidade e rascunhos.
- Eliminar defaults financeiros perigosos.
- Homologar backup/restauração em instalação limpa e upgrade.

### Fase 2 — Acessibilidade e feedback

- Corrigir contraste e headings.
- Padronizar erros, toasts e live regions.
- Executar NVDA, teclado integral, zoom e escalas do Windows.
- Adicionar axe/Playwright ao gate.

### Fase 3 — Cobertura e manutenção

- E2E dos fluxos críticos.
- Extrair componentes/hook de páginas grandes.
- Habilitar strict mode.
- Criar fixtures e banco isolado por teste.

### Fase 4 — Acabamento e performance

- Consolidar design system.
- Medir startup do executável e rotas em máquinas de referência.
- Revisar chunks e carregamento de gráficos/PDF.
- Homologar dados longos, 500+ registros e operação offline.

**Distância estimada até 10/10:** 3,4 pontos e aproximadamente três ciclos: estabilização comercial, acessibilidade/cobertura e refinamento arquitetural.

## 15. Matriz de prioridade por impacto e esforço

| Prioridade | Item | Impacto | Esforço |
|---:|---|---|---|
| P0 | Pacote íntegro e reproduzível | Máximo | Médio |
| P0 | Suíte determinística | Máximo | Médio |
| P0 | Falha de API não virar zero | Máximo | Médio |
| P0 | Senha/identidade coerentes | Máximo | Alto |
| P0 | Remover cliente financeiro automático | Alto | Baixo |
| P0 | Proteger rascunhos financeiros | Alto | Médio |
| P1 | Corrigir erros financeiros | Alto | Baixo |
| P1 | Estado offline dos mapas | Alto | Médio |
| P1 | E2E de CRUD crítico | Alto | Alto |
| P1 | Versão única | Médio | Baixo |
| P1 | Contraste AA | Médio | Baixo |
| P2 | Feedback tipado | Médio | Médio |
| P2 | Refatorar páginas grandes | Médio | Alto |
| P3 | Strict TypeScript/design tokens | Médio | Médio |

## 16. Checklist final de homologação

### Release

- [ ] Worktree limpo e commit/tag aprovado.
- [ ] Build completo reproduzível.
- [ ] Hash, tamanho, SBOM e assinatura conferidos.
- [ ] Instalação limpa, atualização e desinstalação testadas.
- [ ] Versão idêntica em todas as telas.

### Dados e segurança

- [ ] Senha local protege o app ou foi removida com modelo claro.
- [ ] Identidade configurada substitui dados demo.
- [ ] Backup completo restaurado em máquina limpa.
- [ ] Falha durante restauração preserva banco anterior.
- [ ] API desligada nunca mostra KPIs zerados como válidos.

### Fluxos

- [ ] CRUD completo de cliente, inclusive duplicidade e exclusão.
- [ ] CRUD completo de projeto.
- [ ] Receita, despesa, parcela, pagamento parcial e estorno.
- [ ] Nenhum cliente é selecionado implicitamente.
- [ ] Rascunhos são protegidos.
- [ ] Filtros, ordenação e retorno de navegação persistem.
- [ ] Mensagens de erro explicam a correção.
- [ ] Ações destrutivas confirmam e, quando possível, permitem restauração.

### Acessibilidade e desktop

- [ ] Teclado completo e sem traps.
- [ ] NVDA percorre headings, campos, tabs, tabelas e modais.
- [ ] Contraste WCAG AA em claro e escuro.
- [ ] 100%, 125%, 150% e 200% no Windows.
- [ ] 800×520, 1120×680, maximizado e múltiplos monitores.
- [ ] Redução de movimento.
- [ ] Textos longos e dados extremos.
- [ ] Mapas têm estado offline.

### Qualidade

- [ ] Lint, build e todas as suítes verdes em cinco execuções.
- [ ] E2E de cliente, projeto, orçamento e finanças.
- [ ] Teste automatizado de acessibilidade.
- [ ] Smoke no executável candidato.
- [ ] Nenhum erro inesperado no console/log operacional.

## 17. Veredito final

**NÃO LANÇAR**

### Respostas diretas

**O GeoGestor pode ser vendido hoje?**
Não. O instalador atual não tem integridade validada e há riscos objetivos na indisponibilidade, identidade/segurança e finanças.

**Quais problemas obrigatoriamente precisam ser resolvidos?**
Pacote íntegro; suíte determinística; estado de API indisponível; senha/identidade; seleção automática de cliente; proteção de rascunho financeiro; mensagens financeiras; estado offline dos mapas; versão única; smoke E2E crítico.

**Quais podem aguardar atualização posterior?**
Refatoração dos componentes grandes, TypeScript estrito, remoção total de `transition-all`, virtualização avançada e cache offline completo — desde que o estado offline já seja claro.

**Qual a distância até uma experiência 10/10?**
A base está em 6,6/10. A maior distância não é visual: é confiança operacional, release reproduzível, feedback de falha e cobertura.

**Quais testes repetir depois das correções?**
Suíte completa cinco vezes; E2E de cliente/projeto/finanças; falha e retorno da API; backup/restauração; instalação/upgrade; integridade/assinatura; teclado/NVDA; contraste; escalas do Windows; offline; dados longos; 500+ registros; e smoke do executável final.
