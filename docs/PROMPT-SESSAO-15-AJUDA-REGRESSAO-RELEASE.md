# Prompt de auditoria — Sessão 15: Ajuda, Navegação Global, Homologação e Release

Você atuará como engenheiro sênior de QA full stack e release engineer, especialista em aplicações desktop/Electron, UX, acessibilidade WCAG 2.2 AA, integridade de dados, segurança local, empacotamento Windows, SBOM, migração e recuperação. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** a Sessão 15 do GeoGestor, fechar os débitos herdados verificáveis e produzir uma decisão objetiva de homologação.

Esta é a sessão final do ciclo. Ela **não autoriza publicar**, enviar artefatos, criar tag, fazer commit, push ou release. O objetivo é comprovar o produto, gerar um candidato técnico isolado quando todos os pré-requisitos permitirem e informar exatamente o que ainda impede uma liberação comercial.

## Configuração da sessão

- Sessão atual: **15 — Ajuda, Navegação Global, Homologação e Release**.
- Módulo/menu principal: **Ajuda**.
- Escopos transversais: pesquisa global, shell do aplicativo, rotas canônicas e legadas, 404, carregamento, erros globais, reconexão, regressão integrada das Sessões 01–14, runtime Electron, instalação, atualização manual, desinstalação, governança e candidato de release.
- Rotas principais:
  - **`/ajuda`**;
  - **`/` e todas as rotas canônicas registradas no contrato de navegação**;
  - aliases legados apenas para comprovar redirecionamento e preservação correta de parâmetros;
  - uma rota inexistente sintética para validar 404;
  - telas globais de configuração inicial, desbloqueio, indisponibilidade da API, erro e carregamento quando acionadas de modo controlado.
- Foco especial: veracidade e cobertura da central de ajuda; categorias, busca, artigos, URLs, relacionados e links; pesquisa global e seus seis tipos; menu, cabeçalho, atalhos, foco e navegação responsiva; deep links; fallback de erro e indisponibilidade; versão; regressão cruzada; fechamento de achados herdados; segurança do Electron; build limpo; instalador; SBOM; hashes; manifesto; smoke test; instalação, atualização manual sobre versão anterior e desinstalação; homologação humana Windows/WCAG; riscos legais e decisão final de release.
- Implementar correções comprovadas: **SIM**.
- Implementar novos recursos, auto-updater, novos tipos de pesquisa, documentação online, telemetria, publicação automática, assinatura digital ou mudanças amplas de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-ajuda-regressao-release/`.

## Relatórios e documentos obrigatórios

Leia integralmente, antes de testar, os relatórios finais efetivamente existentes:

- `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`;
- `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`;
- `docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md`;
- `docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md`;
- `docs/auditorias/2026-09-11-projetos/RELATORIO.md`;
- `docs/auditorias/2026-09-11-ambiental/RELATORIO.md`;
- `docs/auditorias/2026-09-12-financeiro/RELATORIO.md`;
- `docs/auditorias/2026-09-12-agenda-calendario/RELATORIO.md`;
- `docs/auditorias/2026-09-13-agenda-tarefas/RELATORIO.md`;
- `docs/auditorias/2026-09-13-topografia/RELATORIO.md`;
- `docs/auditorias/2026-09-17-relatorios/RELATORIO.md`;
- `docs/auditorias/2026-09-14-planejamento/RELATORIO.md`;
- `docs/auditorias/2026-09-15-cadastros-propriedades/RELATORIO.md`;
- `docs/auditorias/2026-09-16-configuracoes-administracao/RELATORIO.md`.

Use `docs/auditorias/2026-09-14-ambiental/` somente como evidência complementar, se representar reteste posterior identificável. Não some a mesma cobertura duas vezes.

Leia também, como requisitos e contexto histórico — nunca como substitutos de evidência atual:

- `docs/HOMOLOGACAO-HUMANA-WINDOWS-WCAG-2026-08-01.md`;
- `docs/RELATORIO-PRE-RELEASE-LIMPO-GEOGESTOR-1.0-2026-08-13.md`;
- `docs/MANIFESTO-PRE-COMMIT-GEOGESTOR-1.0-2026-08-21.md`;
- `docs/architecture/ADR-005-governanca-de-release.md`;
- `AGENTS.md` e todos os `AGENTS.md` aplicáveis;
- Web Interface Guidelines do projeto;
- contrato de navegação, scripts de governança/release, configuração do Electron e do empacotador existentes na versão auditada.

Quando relatórios divergirem, prevalece a evidência reproduzida mais recente. Registre a divergência e sua resolução; não escolha silenciosamente o resultado mais favorável.

## Verdades atuais que precisam ser reconfirmadas

Trate os pontos abaixo como linha de base, não como conclusão automática:

1. A central de Ajuda possui atualmente 20 artigos, seis categorias e os estados de URL `categoria`, `artigo` e `q`.
2. A pesquisa global é aberta por `Ctrl+K` no Windows, exige ao menos dois caracteres e retorna Cliente, Projeto, Orçamento, Tarefa, Agenda e Documento.
3. O contrato atual contém rotas canônicas, nove aliases legados e uma rota curinga de 404. O código executado é a fonte autoritativa para a contagem final.
4. A versão canônica observada ao gerar este prompt era `1.0.4`, mas a Ajuda ainda declarava versão mínima `1.0.1` e a configuração-fonte do artefato podia divergir do nome comercial esperado. Reexecute a governança e corrija apenas a causa comprovada.
5. Os relatórios das Sessões 11 e 14 registraram a mesma falha herdada em `financial-removal-scenarios.integration.test.ts:318`: valores residuais em `accountsReceivableCents` e `receivedCents`. Reproduza e resolva ou mantenha o bloqueio explícito.
6. Concorrência otimista de catálogos/propriedades não foi comprovada; vários ensaios humanos e físicos continuam pendentes.
7. O manifesto de release estava divergente de instaladores existentes, incluindo artefatos antigos sem entrada e tamanho/SHA-256 incompatíveis.
8. Não foi localizado auto-updater funcional. Portanto, “atualização” significa instalar uma versão nova sobre uma instalação anterior, preservando e migrando dados. Marque atualização automática como `NÃO APLICÁVEL`; qualquer promessa atual de atualização automática é divergência de produto.
9. A assinatura Authenticode não está implementada por decisão do proprietário. Use no relatório a formulação exata: **“Assinatura digital: não implementada por decisão do proprietário — risco residual aceito.”** Ainda assim, valide manualmente o comportamento do SmartScreen quando o ambiente permitir.
10. A revisão legal das licenças e avisos de terceiros não está concluída. SBOM e avisos técnicos não equivalem a parecer jurídico.

## Resultado esperado e separação de decisões

Emita quatro decisões independentes:

1. **Sessão 15:** `APROVADA`, `APROVADA COM RESSALVAS` ou `REPROVADA`.
2. **Produto funcional integrado:** `APROVADO`, `APROVADO COM RESSALVAS` ou `REPROVADO`.
3. **Candidato técnico de release:** `APROVADO` ou `BLOQUEADO`.
4. **Publicação comercial:** sempre informe **`NÃO EXECUTADA`** nesta sessão e liste as autorizações/gates ainda necessários.

Não confunda:

- suíte focada aprovada com regressão completa aprovada;
- build gerado com candidato homologado;
- candidato técnico com publicação comercial;
- risco aceito com teste dispensado;
- ausência de erro visível com integridade comprovada;
- documento histórico com evidência da versão atual.

## Regras de autoridade, segurança e preservação

1. Preserve todas as alterações preexistentes. Registre `git status`, commit, branch e diff antes e depois; não reverta nem reformate trabalho alheio.
2. Não use dados reais. Descubra o banco, WAL/SHM, pasta de documentos, perfil Electron e processos ativos antes de mutar qualquer coisa.
3. Não encerre processo não identificado. Não altere a instalação cotidiana do usuário.
4. Crie perfis, bancos, diretórios, documentos, atalhos e instalações exclusivos da sessão, com prefixo `QA-AUDIT-S15-[DATA-HORA]-`.
5. Faça snapshot verificável, hashes e plano de recuperação antes de upgrade, restore, migração, corrupção controlada ou desinstalação.
6. Nunca teste operação destrutiva usando raiz da unidade, diretório home, glob, variável não resolvida ou caminho ambíguo.
7. Não remova instaladores históricos do diretório original para fazer o manifesto passar. Gere o candidato em cópia isolada e diretório de saída inicialmente vazio.
8. Não use `allow-dirty`, edição manual do relatório de gate, manifesto parcial ou exclusão seletiva de evidência como comprovação final.
9. Não faça stage, commit, tag, push, upload, publicação, release no GitHub ou distribuição do instalador sem autorização separada e explícita.
10. Se a ferramenta de release exigir commit limpo, não crie o commit por conta própria. Faça as correções e testes possíveis, registre a exigência e marque o gate como bloqueado até autorização.
11. Não exponha CPF/CNPJ, e-mail, telefone, endereço, token, segredo, senha, código de recuperação, chave ou caminho pessoal em logs/evidências. Use dados sintéticos e saneie respostas.
12. Corrija apenas defeitos reproduzidos. Mudanças de UX/produto não necessárias à correção entram em lista separada, com benefício, esforço e risco.

## Hierarquia de cenários

- **Nível A — leitura e navegação:** Ajuda, pesquisa, menus, links, atalhos, 404, temas, URL, acessibilidade e inspeção de build. Pode usar a instância isolada comum.
- **Nível B — regressão com mutações sintéticas:** CRUD mínimo cruzado, exclusão/reabertura, documentos, backup e persistência. Exige banco e pasta exclusivos com snapshot.
- **Nível C — ciclo de release e recuperação:** build limpo, instalação, atualização, migração, interrupção, corrupção, desinstalação e recuperação. Exige VM ou perfil/instalação comprovadamente descartável, além de candidato identificado por hash.

Se não houver isolamento comprovável para Nível B ou C, faça inspeção não destrutiva e marque `BLOQUEADO`. Não transforme limitação ambiental em aprovação.

## Dados mínimos para a Sessão 15

Crie somente no ambiente isolado:

- um cliente ativo, um excluído logicamente e um com nome/acento semelhante;
- um projeto ativo e um concluído, vinculados ao cliente sintético;
- um orçamento, uma tarefa, um compromisso e um documento sintético, todos com termos de busca conhecidos;
- registros homônimos entre tipos para ordem, agrupamento e distinção dos resultados;
- texto com acentos, caixa, espaços nas bordas, Unicode, caracteres especiais e conteúdo HTML/JavaScript inerte;
- resultado existente fora dos primeiros oito de um tipo e volume suficiente para verificar limite combinado de 30;
- um deep link válido, um removido/inativo e um ID inexistente por tipo relevante;
- um conjunto financeiro mínimo com oráculo em centavos que reproduza ou descarte a falha herdada de remoção;
- fixtures mínimas para um smoke de cada sessão anterior, preferindo reutilizar factories e sementes já auditadas;
- um banco de versão anterior suportada com contagens, vínculos, documentos e hashes lógicos conhecidos para atualização manual;
- arquivos pequenos sintéticos para documentos, backup, restore e pacote; nenhum dado pessoal real;
- estados vazio, parcial, loading, erro, API lenta, API indisponível, reconexão e resposta fora de ordem.

Remova somente esses dados ao final e prove no SQLite, filesystem, perfil, atalhos e instalações que não ficaram resíduos. Se a remoção invalidar a evidência de upgrade, preserve uma cópia selada no diretório da auditoria, identificada por hash e sem segredo.

## Fase 1 — Preparação e linha de base

1. Leia todos os documentos obrigatórios e extraia cada achado pendente, bloqueio, risco aceito e reteste solicitado para uma matriz de débitos herdados.
2. Identifique arquitetura, pacote, versão, commit, estado dirty, Node, pnpm, Electron, Chromium, frontend, API, contratos, schema, migrations, SO, locale, timezone, DPI, viewport e temas.
3. Descubra processos, portas, banco ativo, WAL/SHM, pasta de documentos, logs, backups, perfil Electron, instalação e origem do frontend. Confirme que pertencem à mesma instância.
4. Registre linha de base: contagens, checksums lógicos, `PRAGMA quick_check`, `foreign_key_check`, `user_version`, migrations, espaço livre e erros já presentes.
5. Rode de forma não mutante os gates de versão/governança disponíveis e registre a saída exata antes de corrigir.
6. Inventarie os instaladores e evidências existentes por nome, versão, tamanho, data e SHA-256 sem excluir ou alterar nenhum deles.
7. Crie `docs/auditorias/[AAAA-MM-DD]-ajuda-regressao-release/`, com subpastas para Ajuda, pesquisa, navegação, regressão, Electron, instalação, upgrade, acessibilidade, release e limpeza.
8. Registre quais cenários Nível C têm ambiente físico/VM disponível. Nenhum item não executado pode ser contado como aprovado.

## Fase 2 — Inventário obrigatório

Produza uma matriz com:

- ID, área, rota/URL, controle, artigo ou fluxo;
- ação esperada e fonte do requisito;
- componente/frontend e estado condicional;
- endpoint/método, payload, resposta e código esperado;
- tabela/entidade, arquivo, cache, cofre, processo ou artefato afetado;
- nível A/B/C e pré-condição de segurança;
- cenários positivo, negativo, vazio, limite, loading, lento, erro, retry, concorrência, reload, reinício e recuperação;
- navegabilidade por teclado, nome acessível e anúncio assíncrono;
- situação `APROVADO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`;
- evidência, achado, correção, reteste e limpeza.

O inventário deve cobrir:

- todos os artigos, categorias e seções da Ajuda;
- cada resultado e estado da pesquisa global;
- todas as rotas canônicas realmente registradas;
- todos os aliases legados e a rota 404;
- ações globais do shell, cabeçalho, sidebar e mobile;
- cada débito herdado das Sessões 01–14;
- cada etapa de governança, build, evidência, pacote, instalação e homologação.

## Fase 3 — Central de Ajuda

### A. Estrutura, URL e busca

1. Confirme pelo código e pela UI a quantidade real de artigos e categorias; não fixe a aprovação nos números históricos se a versão mudou legitimamente.
2. Abra `/ajuda` pelo menu, URL direta, refresh, voltar/avançar e deep links com `categoria`, `artigo` e `q` isolados e combinados.
3. Teste parâmetros válidos, vazios, repetidos, codificados e inválidos. A URL deve ser normalizada sem loop nem perda indevida do histórico.
4. Teste “Todas”, as seis categorias atuais, contagens, ordenação, seleção, estado ativo, estados vazios e retorno à lista no mobile.
5. Pesquise por título, resumo, palavra-chave, título de seção, parágrafo, passo, observação e aviso; cubra acento, caixa, espaços, Unicode, caracteres especiais e nenhum resultado.
6. Confirme que a busca é determinística, rápida, acessível e refletida na URL, sem requisição desnecessária, XSS ou perda do artigo selecionado fora da regra definida.
7. Teste mouse, toque e teclado; ao abrir artigo por teclado/mobile, o foco deve ir ao título. Ao voltar, deve retornar ao cartão correto.

### B. Veracidade dos 20 artigos atuais

Valide, um a um, os artigos atuais e qualquer artigo novo legitimamente presente:

1. Primeira configuração e pasta de dados.
2. Clientes e propriedades.
3. CRM e oportunidades.
4. Projetos e checklist.
5. Orçamentos e aprovação.
6. Contas a receber.
7. Contas a pagar.
8. Agenda e tarefas.
9. Ambiental e licenciamento.
10. Topografia e cálculos.
11. Importação de levantamento vetorial.
12. Relatórios e exportação.
13. Planejamento estratégico.
14. Cadastros auxiliares.
15. Importação de dados.
16. Qualidade dos dados.
17. Logs de auditoria.
18. Modelos de documentos.
19. Backup e recuperação.
20. Alertas e notificações.

Para cada artigo:

- execute todos os passos na versão real ou prove-os por inspeção e fluxo seguro;
- confira nomes, botões, campos, rotas, tabs, limites, formatos, pré-condições, avisos e resultados;
- valide links internos, artigos relacionados e rota de ação;
- confirme que nenhum texto promete função inexistente, inclusive nuvem, atualização automática, criptografia total, exportação ou integração não disponível;
- confronte data de revisão, versão mínima e versão instalada com a política vigente;
- marque instrução desatualizada, ambígua, perigosa ou incompleta como defeito editorial/funcional, com gravidade proporcional ao risco;
- verifique que todos os IDs relacionados existem, que não há artigo órfão nem referência quebrada e que ciclos não prejudicam a navegação;
- confirme português, terminologia uniforme, `…`, datas, moeda, números e caminhos Windows corretos.

### C. Acessibilidade e apresentação

1. Valide headings, landmarks, listas de passos, avisos, links, nomes acessíveis, foco visível, contraste e alternativa textual.
2. Teste 360, 768, 1024 e 1440 px, zoom de 200%, tema claro/escuro, textos longos, redução de movimento e ausência de rolagem horizontal acidental.
3. Confirme que busca vazia, artigo ausente, filtro sem resultado e link quebrado produzem orientação acionável.
4. Rode axe ou equivalente, mas não substitua o ensaio manual de teclado e leitor de tela.

## Fase 4 — Pesquisa global

1. Abra e feche por botão, `Ctrl+K`, Escape, clique externo quando previsto e seleção de resultado; valide foco inicial, contenção, retorno de foco e scroll bloqueado.
2. Teste zero, um e dois caracteres; debounce; digitação rápida; apagar; colar; acentos; caracteres especiais; termos longos; erro; retry e resposta fora de ordem.
3. Valide os seis tipos atuais: Cliente, Projeto, Orçamento, Tarefa, Agenda e Documento.
4. Para cada tipo, prove os campos pesquisáveis reais, rótulo, contexto, ícone, ordenação, limite por tipo, limite total e deep link.
5. Confirme os destinos atuais e seus parâmetros:
   - cliente em `/clientes/:id`;
   - projeto em `/projetos/:id`;
   - orçamento no cliente com `tab=orcamentos` e `orcamentoId`;
   - tarefa em `/tarefas?tarefaId=:id`;
   - compromisso em `/calendario/compromisso/:id`;
   - documento no cliente, com aba e identificadores necessários.
6. Confirme que excluídos, inativos ou removidos não aparecem quando a regra de domínio os exclui. Se aparecerem, valide o comportamento do deep link antes de classificar.
7. Teste registros homônimos entre tipos, resultados acima do oitavo de um tipo, mais de 30 resultados e empates; a ordem deve ser explicável e estável.
8. Meça latência e consultas com alta cardinalidade. Verifique busca excessiva em memória, ausência de paginação, N+1 e bloqueio perceptível; registre melhoria sem redesenhar se não houver defeito funcional.
9. Faça testes seguros de injeção, XSS e manipulação de ID. Conteúdo do resultado nunca pode executar; erros não podem expor query, stack, SQL ou segredo.
10. Confira privacidade: campos sensíveis podem apoiar a localização prevista, mas a lista não deve revelar valor completo desnecessário.
11. Em largura móvel, confirme que o atalho continua coerente e que a ausência visual do botão não torna o recurso inacessível ou enganoso.

## Fase 5 — Navegação global, rotas e shell

### A. Rotas canônicas

1. Extraia a lista autoritativa do contrato e teste cada rota pelo menu/link, URL direta, refresh e voltar/avançar.
2. Cubra rotas parametrizadas com ID válido, inexistente, excluído, formato inválido e pertencente a outra fixture.
3. Confirme título da página, item ativo, breadcrumbs quando existentes, foco no conteúdo principal, scroll e métricas de navegação.
4. Valide carregamento lazy, fallback com `aria-live`, falha de chunk controlada e recuperação sem tela branca.
5. Confira URL e estado de filtros/tabs/paginação nas rotas que os usam; o shell não pode apagar parâmetros legítimos.

### B. Aliases legados

Teste os aliases atuais e qualquer outro encontrado no contrato:

- `/contatos` → `/crm?view=leads`;
- `/dashboard-financeiro` → `/financeiro`;
- `/gestao-financeira` → `/financeiro?tab=auxiliares`;
- `/despesas` → `/financeiro?tab=pagar`;
- `/operacional` → `/projetos?visualizacao=estatisticas`;
- `/calculadora-ambiental` → `/ambiental?tab=car`;
- `/licenciamento` → `/ambiental?tab=licenciamento`;
- `/faturas` → `/financeiro?tab=faturas`;
- `/relatorio-executivo` → `/relatorios?tipo=executivo`.

Para cada um, prove destino, substituição ou criação de histórico, preservação de parâmetros legados permitidos e precedência dos parâmetros canônicos. Não aceite loop, perda silenciosa ou URL intermediária persistente.

### C. 404, setup, desbloqueio e indisponibilidade

1. Abra rota inexistente e confirme que a URL original permanece identificável, o título é correto e os links para Painel, Ajuda, Clientes, Projetos e Financeiro funcionam.
2. Teste 404 por teclado, tema, mobile, refresh e histórico.
3. Em perfil novo, valide o gate de configuração inicial; em perfil configurado, confirme que não reaparece indevidamente.
4. Com política de segurança ativa em perfil sintético, valide bloqueio/desbloqueio, retorno à rota pretendida, erro e recuperação sem revelar senha.
5. Torne apenas a API isolada indisponível; valide tela de indisponibilidade, retry, reconexão e restauração do estado sem recarregamento infinito.
6. Teste erro não tratado de modo controlado. O usuário não pode receber stack, caminho local, componente interno ou segredo em build de produção; deve poder tentar novamente ou voltar com foco correto.

### D. Shell e ações globais

1. Teste skip link, sidebar desktop/mobile, abertura/fechamento, Escape, item ativo, estados hover/focus/disabled e restauração de scroll.
2. Teste cabeçalho, tema, alertas, backup, pesquisa, identidade, versão, bloqueio e ações condicionais do Electron.
3. Confirme elementos semânticos, botões versus links, `aria-label` em ícones, `aria-hidden` decorativo e foco visível.
4. Teste viewport mínimo suportado, 800×520 do desktop, 800×600, 1024×768, escalas 125%, 150%, 200%, zoom 200% e reflow de 320 CSS px quando disponível.
5. Teste claro/escuro, alto contraste do Windows, movimento reduzido, textos longos e alvos de toque.
6. Confirme ausência de `transition: all`, `outline-none` sem reposição, navegação em `div/span`, campos sem label, formatação fixa e outros antipadrões do `AGENTS.md`.

## Fase 6 — Regressão integrada das Sessões 01–14

1. Converta cada achado e risco residual anterior em item rastreável: `FECHADO`, `AINDA REPRODUZ`, `BLOQUEADO`, `NÃO APLICÁVEL` ou `SUPERADO POR MUDANÇA DOCUMENTADA`.
2. Reexecute a suíte completa da API e reproduza especificamente o cenário financeiro herdado. Se falhar, determine causa raiz, adicione/ajuste teste e faça a menor correção coerente.
3. Não aprove o produto integrado enquanto houver cálculo financeiro conhecido incorreto, corrupção/perda de dados, falha crítica de segurança ou suíte obrigatória vermelha sem justificativa externa comprovada.
4. Revalide concorrência de catálogos e propriedades. Se o contrato ainda não definir versionamento otimista, demonstre o comportamento real de duas edições e classifique o risco de perda de atualização.
5. Execute um smoke real de cada sessão:
   - Visão Geral e atualização após mutação;
   - Clientes/documentos/mapas;
   - CRM;
   - Orçamentos;
   - Projetos;
   - Ambiental;
   - Financeiro;
   - Calendário;
   - Tarefas;
   - Topografia;
   - Relatórios;
   - Planejamento;
   - Cadastros/Propriedades;
   - Configurações/Administração.
6. Prefira cenários críticos já automatizados e fixtures mínimas; não repita toda auditoria manual sem propósito. O smoke deve provar integrações, cálculos, persistência, deep links e ausência de regressão.
7. Rode typecheck, lint, testes web, API, Electron e E2E completos. Registre comandos, duração, totais e falhas exatas.
8. Inspecione console, rede, API, logs Electron e banco durante a regressão; nenhuma falha nova relevante pode ser ignorada.
9. Recarregue e reinicie a instância isolada para provar persistência dos registros críticos e limpeza de caches obsoletos.

## Fase 7 — Runtime Electron e segurança do pacote

1. Confirme instância única; uma segunda abertura deve focar a existente sem duplicar API, banco ou janela.
2. Valide API apenas em loopback, porta dinâmica quando a preferida estiver ocupada, token local e header de sessão; acesso externo deve falhar.
3. Confirme `nodeIntegration: false`, `contextIsolation: true`, sandbox ativo e superfície mínima do preload.
4. Valide CSP, `nosniff`, política de referrer, bloqueio de navegação externa e abertura segura de HTTP/HTTPS no navegador padrão.
5. Teste `window.open`, esquemas inválidos, arquivo local e tentativa de origem diferente; nenhum conteúdo externo deve herdar privilégios.
6. Confirme que DevTools não fica disponível no build de produção fora de override explicitamente documentado.
7. Valide armazenamento do banco em `userData`, chaves protegidas por `safeStorage` no Windows e sanitização de `api-process.log`.
8. Simule queda controlada da API isolada e valide backoff, limite de reinícios e estado compreensível após esgotamento.
9. Teste fechamento normal e com backup em andamento; valide esperar, tentar novamente, voltar ao app e fechar sem backup somente conforme contrato e confirmação.
10. Teste notificação nativa, suspend/resume, sessão bloqueada/desbloqueada e encerramento do Windows quando o ambiente permitir.

## Fase 8 — Instalação, atualização manual e desinstalação

Execute apenas com instalador produzido e identificado pelo SHA-256 da mesma execução.

### A. Instalação limpa

1. Instale como usuário comum no Windows 10 e 11, quando disponíveis, sem privilégios administrativos indevidos.
2. Teste caminho padrão e caminho com espaços/acentos; confirme atalho de menu Iniciar, atalho solicitado, nome, ícone, versão e desinstalador.
3. Abra o app, conclua setup sintético e valide banco/pastas no perfil correto, portas, logs e primeiro backup.
4. Confirme que o instalador não contém banco, log, `.env`, source map, segredo, caminho pessoal, arquivo temporário ou fixture.
5. Registre comportamento real do SmartScreen e deixe claro que não há editor verificado.

### B. Atualização manual sobre versão suportada

1. Instale a versão anterior suportada em ambiente descartável e crie dados/arquivos sintéticos com contagens e hashes lógicos conhecidos.
2. Faça backup verificável e instale a nova versão sobre a anterior usando o fluxo normal do instalador.
3. Valide migrations, `user_version`, integridade, contagens, vínculos, valores em centavos, documentos, preferências e histórico.
4. Confirme idempotência ao abrir/reiniciar novamente e ao executar verificação pós-atualização.
5. Simule interrupção apenas em VM descartável; valide rollback ou recuperação documentada, sem banco meio migrado.
6. Prove compatibilidade e caminho de recuperação. Não chame esse fluxo de auto-update.

### C. Desinstalação e reinstalação

1. Teste desinstalação por Configurações do Windows e menu criado; confirme remoção de binários, processo, atalhos e entradas do programa.
2. Verifique a política real para dados do usuário. Não apague dados sem confirmação explícita; documente preservação ou opção de remoção.
3. Reinstale e valide recuperação dos dados preservados ou restauração pelo kit autorizado.
4. Teste recuperação em outro perfil/equipamento somente com cópia sintética e chaves/kit previstos pelo produto.
5. Liste resíduos exatos; não faça limpeza ampla para melhorar artificialmente o resultado.

## Fase 9 — Homologação humana Windows e WCAG

Use `docs/HOMOLOGACAO-HUMANA-WINDOWS-WCAG-2026-08-01.md` como checklist vinculante e registre cada item individualmente. Inclua ao menos:

1. instalação limpa em Windows 10 e 11;
2. atualização da versão anterior suportada;
3. desinstalação, atalhos e política de dados;
4. SmartScreen do binário não assinado;
5. NVDA e Narrator no setup, desbloqueio, pesquisa, alertas, formulários, modais e erros;
6. navegação integral por teclado;
7. ordem e retorno de foco;
8. escalas 125%, 150%, 200%, zoom 200% e reflow;
9. resoluções mínimas;
10. alto contraste do Windows;
11. conteúdo, português e mensagens acionáveis;
12. operação offline e reconexão;
13. múltiplos monitores com DPI misto;
14. suspender/retomar, bloqueado e desbloqueado;
15. uso prolongado e consumo de recursos;
16. migração e interrupção;
17. backup/restore pela interface instalada;
18. recuperação em outro perfil/equipamento;
19. revisão visual final de todas as rotas, temas, gráficos, mapas, PDFs e diálogos nativos.

Automação não substitui esses ensaios. Se hardware, VM, leitor de tela ou tempo contínuo não estiver disponível, marque o item `BLOQUEADO` com ambiente necessário. Só aprove a homologação comercial para o instalador final cujo hash foi testado.

## Fase 10 — Governança, versão e fonte

1. Determine a versão canônica e confira raiz, API, desktop, Ajuda, About/Configurações, sidebar, metadata do pacote e nome do instalador.
2. Confirme que a versão mínima da Ajuda representa corretamente a política atual; não altere datas históricas por conveniência.
3. Execute os gates de governança e registre violações novas, existentes e reduzidas, inclusive navegação hardcoded, endpoints repetidos, assets não usados, termos proibidos e artefatos sensíveis.
4. Valide o registro de compatibilidade, migrations, versão mínima suportada e estratégia de upgrade/rollback.
5. Confira nome comercial e padrão do instalador. A configuração-fonte e o pacote preparado devem concordar com a versão comercial.
6. Revise dependências, lockfile, licenças, avisos de terceiros e exceções. Destaque componentes que exigem revisão jurídica, inclusive licenças incomuns e atribuição do OpenStreetMap quando aplicável.
7. Não declare conformidade jurídica; entregue inventário técnico e gate `REVISÃO JURÍDICA PENDENTE` quando ainda aplicável.
8. O commit de um candidato final deve ser conhecido e limpo, com `dirty: false`. Se o worktree não puder ficar limpo sem incorporar trabalho do usuário, bloqueie o candidato em vez de ocultar o estado.

## Fase 11 — Candidato técnico de release

Use os scripts canônicos existentes; não recrie manualmente um pipeline paralelo.

1. Prepare uma cópia isolada do repositório a partir do estado autorizado e um diretório de saída vazio. Preserve o diretório original e seus instaladores históricos.
2. Execute o verificador de fonte antes do build. Registre commit, versão, dirty, Node, pnpm, plataforma e run ID.
3. Rode gates completos: typecheck, lint, testes web, API, Electron, E2E, integridade de release, SBOM, governança e quaisquer testes previstos pelo candidato.
4. Gere contratos, database, API, web e desktop usando o build canônico.
5. Gere o instalador Windows x64 e confirme configuração NSIS atual: instalação por usuário, escolha de diretório quando prevista, nome/atalho e desinstalador.
6. Gere evidências na mesma execução: SBOM CycloneDX, hashes, metadata, smoke do pacote e relatório do gate.
7. Valide que versão, commit, run ID, nome, tamanho e SHA-256 concordam em todas as evidências.
8. O manifesto deve cobrir exatamente os instaladores do diretório isolado: nenhum ausente, extra, antigo ou divergente.
9. Faça varredura do conteúdo do pacote por `.db`, `.sqlite`, `.map`, `.log`, `.env`, backup, temporário, segredo, chave privada, caminho local, CPF/CNPJ formatado, e-mail real e token materializado.
10. Rode smoke do pacote real: inicialização da API empacotada, banco temporário criptografado quando previsto, setup, política de segurança, endpoints vazios, auditoria e ausência de conteúdo sensível.
11. Execute verificação estrita final e guarde a saída original. Não edite JSON de gate para mudar resultado.
12. Verifique Authenticode apenas como evidência informativa e use a formulação obrigatória do risco aceito.
13. Compare o conteúdo instalado com o pacote e o pacote com as evidências; o binário homologado deve ter o mesmo hash do candidato reportado.
14. Não publique. Uma eventual aprovação técnica significa apenas que o artefato está pronto para decisão do proprietário.

## Fase 12 — Backend, persistência e segurança transversal

1. Para cada fluxo global que lê/grava, registre endpoint, método, parâmetros, payload, resposta, autenticação local e efeito persistente.
2. Teste entrada válida, ausente, inválida, duplicada, IDs inexistentes, limites, duas submissões e concorrência relevante.
3. Confirme códigos HTTP, contratos, validação no servidor e mensagens uniformes, sem stack ou segredo.
4. Verifique transação, atomicidade, timestamps, FKs, unicidade, exclusão lógica, cascatas e auditoria.
5. Faça testes seguros de autorização local, manipulação de ID, injeção, XSS, path traversal, origem externa, upload hostil e IPC exposto.
6. Recarregue, reinicie a API e o app instalado quando aplicável; compare UI, API, SQLite, arquivos e logs.
7. Confirme que logs/evidências sanitizam senha, token, chave, CPF/CNPJ e dados pessoais sintéticos conforme necessidade.

## Fase 13 — Correção e reteste

1. Reproduza o defeito e determine causa raiz antes de editar.
2. Adicione teste automatizado que falhe antes da correção sempre que tecnicamente razoável.
3. Faça a menor alteração coerente. Não enfraqueça validações, não silencie exceções e não adicione caso especial para a fixture.
4. Corrija primeiro P0/P1; não gaste a janela de homologação em melhoria P3 enquanto existir bloqueio funcional ou de integridade.
5. Rode teste focado, typecheck/lint relevante, regressão da área e fluxo manual real corrigido.
6. Se a correção alterar artefato, descarte o candidato anterior e gere todas as evidências novamente na mesma execução.
7. Se exigir decisão de negócio, mudança arquitetural, licença, assinatura, publicação ou autoridade Git, documente e aguarde aprovação.

## Fase 14 — Limpeza, reconciliação e critérios de encerramento

Antes de encerrar:

- todos os itens do inventário têm situação e evidência;
- todos os relatórios anteriores foram reconciliados;
- a falha financeira herdada foi corrigida e retestada ou permanece bloqueio explícito;
- todas as suítes obrigatórias executadas estão verdes, ou cada falha está atribuída e impede a decisão correspondente;
- Ajuda, pesquisa, rotas, aliases, 404 e shell foram exercitados;
- o smoke de cada Sessão 01–14 foi executado ou tem bloqueio reproduzível;
- nenhum erro novo relevante aparece em console, rede, API, Electron ou banco;
- dados, perfis, instalações, atalhos e arquivos sintéticos foram removidos ou inventariados exatamente;
- o diff foi revisado e contém somente correções/evidências da sessão;
- qualquer candidato reportado veio de fonte autorizada, commit conhecido, `dirty: false`, diretório limpo e mesma execução de SBOM/hash/smoke;
- nenhum commit, tag, push ou publicação foi feito sem autorização;
- bloqueios humanos, legais, de assinatura e de ambiente aparecem claramente.

O candidato técnico deve ser `BLOQUEADO` se houver qualquer um destes casos:

- teste obrigatório vermelho;
- cálculo financeiro conhecido incorreto;
- versão divergente;
- commit desconhecido ou dirty no candidato final;
- manifesto incompleto/divergente;
- SBOM/hash/smoke não pertencentes à mesma execução;
- segredo, dado real ou artefato proibido no pacote;
- migration/upgrade sem integridade comprovada;
- P0/P1 pendente relacionado ao release;
- instalador final diferente do hash homologado.

A publicação comercial continua `NÃO EXECUTADA`, mesmo com candidato técnico aprovado. Recomende publicação somente após homologação humana necessária, revisão jurídica/negocial pendente, aceitação formal dos riscos e autorização expressa do proprietário.

## Classificação dos achados

- **P0:** perda/corrupção de dados, segredo no pacote, execução privilegiada indevida, falha grave de segurança ou produto inutilizável.
- **P1:** fluxo principal/global quebrado, cálculo financeiro incorreto, upgrade inseguro, gate de release inválido ou bloqueio sério de acessibilidade.
- **P2:** ajuda incorreta, deep link/alias/pesquisa inconsistente, validação ausente, erro secundário ou UX bastante prejudicada.
- **P3:** problema visual/textual menor, dívida técnica ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e as quatro decisões independentes.
2. Matriz completa de cobertura da Sessão 15.
3. Matriz de reconciliação dos achados, bloqueios e riscos das Sessões 01–14.
4. Inventário de artigos da Ajuda, com veracidade, links, revisão e versão.
5. Inventário de rotas canônicas, aliases, parâmetros, deep links e 404.
6. Matriz dos seis tipos da pesquisa global, campos, limites, ordem e destinos.
7. Lista de achados com ID, gravidade, camada, rota/artefato, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
8. Comandos de teste executados, totais, duração e resultados exatos.
9. Evidências sanitizadas de UI, console/rede, API, SQLite, filesystem, Electron e homologação física.
10. Relatório de upgrade com versão anterior, contagens/hashes antes/depois, migrations, interrupção e recuperação.
11. Relatório de instalação/desinstalação e resíduos.
12. Se gerado, dossiê do candidato: versão, commit, dirty, run ID, instalador, tamanho, SHA-256, SBOM, manifesto, smoke, verificação e conteúdo instalado.
13. Relação de arquivos alterados e motivo.
14. Contagem final: aprovados, reprovados corrigidos, reprovados pendentes, bloqueados e não aplicáveis.
15. Riscos residuais, riscos aceitos, decisões ainda exigidas e lista separada de melhorias não implementadas com benefício, esforço e risco.
16. Confirmação de limpeza ou inventário exato de resíduos, IDs, caminhos e hashes.

## Formato obrigatório da resposta final

Comece pelo resultado real, nesta ordem:

- **Status da Sessão 15:** APROVADA, APROVADA COM RESSALVAS ou REPROVADA;
- **Produto funcional integrado:** APROVADO, APROVADO COM RESSALVAS ou REPROVADO;
- **Candidato técnico de release:** APROVADO ou BLOQUEADO;
- **Publicação comercial:** NÃO EXECUTADA;
- cobertura em números;
- defeitos encontrados, corrigidos e pendentes por gravidade;
- situação de cada gate herdado;
- testes/suítes executados e totais;
- instalador, versão, commit e SHA-256, se houver candidato válido;
- bloqueios humanos, ambientais, jurídicos e de autoridade;
- links para relatório e evidências;
- recomendação objetiva: `NÃO PUBLICAR` ou `PRONTO PARA DECISÃO DO PROPRIETÁRIO`, nunca “publicado”.

Não use “parece funcionar”, “em geral”, “a maioria”, “provavelmente pronto” ou percentuais sem denominador. Use fatos, contagens, IDs, hashes e evidências.
