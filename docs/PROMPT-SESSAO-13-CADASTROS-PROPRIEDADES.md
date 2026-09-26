# Prompt de auditoria — Sessão 13: Cadastros e Propriedades

Você atuará como engenheiro sênior de QA full stack, especialista em cadastros mestres, integridade referencial, aplicações desktop, UX, acessibilidade, persistência, migrações e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 13 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **13 — Cadastros e Propriedades**.
- Módulos/menus: **Cadastros** e **Propriedades**.
- Rotas principais:
  - **`/cadastros`** — Tipos de serviço e Categorias de despesa;
  - **`/propriedades`** — cadastro global de propriedades vinculadas a clientes.
- Estados de URL atuais em Cadastros:
  - `aba=servicos|despesas`;
  - `status=ativos|inativos|todos`;
  - `busca=<texto>`.
- Integrações imediatas permitidas:
  - `/orcamentos` e seu editor, somente para comprovar o consumo dos tipos de serviço e valores sugeridos;
  - `/financeiro/despesas`, somente para comprovar categorias, subcategorias e preservação de valores históricos;
  - `/clientes` e `/clientes/:id`, somente para criar cliente sintético, seguir a entrada para Propriedades, conferir contagens e retornar;
  - `/projetos`, `/ambiental` e `/pericias`, somente para criar ou verificar vínculos sintéticos que devam bloquear transferência ou exclusão da propriedade;
  - seletores de propriedades em Orçamentos e Projetos, somente para validar opções, cliente correto e registros ativos.
- Foco especial: catálogos auxiliares, banco autoritativo e cache local; migração de catálogos legados; CRUD lógico dos catálogos; normalização e duplicidade; consumo por Orçamentos e Despesas; CRUD completo de propriedades; identificadores registrais; cliente proprietário; coordenadas; busca, filtro e paginação; opções remotas; vínculos e restrições; migração de propriedades legadas; transações, auditoria, concorrência, responsividade e WCAG 2.2 AA.
- Relatórios anteriores obrigatórios:
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
  - relatório efetivamente produzido pela Sessão 11 em `docs/auditorias/[AAAA-MM-DD]-relatorios/RELATORIO.md`;
  - `docs/auditorias/2026-09-14-planejamento/RELATORIO.md`.
- Observação: no momento da geração deste prompt, o relatório final da Sessão 11 ainda não foi localizado. Procure-o antes da execução; se continuar ausente, registre a lacuna sem inventar resultados.
- Riscos herdados da Sessão 12 que devem ser retestados:
  - a suíte completa da API apresentou **184/185 testes aprovados** e uma falha herdada em `financial-removal-scenarios.integration.test.ts:318`, com `accountsReceivableCents` esperado `0` e obtido `3333`, e `receivedCents` obtido `6668`;
  - confirme que alterações em Cadastros ou Propriedades não alteram as quatro fontes automáticas do Planejamento sem regra explícita;
  - confirme que opções e vínculos ignoram registros logicamente excluídos;
  - publicação continua bloqueada até reconciliar tamanho e SHA-256 do manifesto do instalador.
- Implementar correções comprovadas: **SIM**.
- Implementar novos tipos de cadastro, documentos/mapas de propriedade, importação/exportação, restauração ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-cadastros-propriedades/`.

## Objetivo

Validar de ponta a ponta cada aba, filtro, busca, indicador, cartão, formulário, modal, confirmação, paginação, seletor remoto, link e ação existentes em Cadastros e Propriedades. Complete criar → localizar → abrir → editar → recarregar → reiniciar quando relevante → cancelar desativação/exclusão → desativar/excluir → reativar quando suportado, usando somente registros sintéticos.

Não aprove um cadastro porque a tela exibiu uma notificação ou porque a API retornou HTTP 200. Comprove a mesma verdade na interface, na API, no SQLite, no cache local, nos consumidores imediatos e no log de auditoria quando aplicável. Corrija apenas defeitos reproduzidos dentro do escopo e repita os testes integrados após cada correção.

## Limites funcionais e de produto

1. A rota `/cadastros` implementa atualmente apenas **Tipos de serviço** e **Categorias de despesa**. Não invente outros cadastros auxiliares.
2. Catálogos não possuem exclusão física na interface: o ciclo suportado é criar, editar, inativar e reativar. Marque exclusão física/restauração como `NÃO APLICÁVEL` se continuarem ausentes.
3. O SQLite é a fonte autoritativa dos catálogos; `localStorage` é cache e apoio de migração/fallback. Cache divergente nunca pode silenciosamente prevalecer sobre dado válido do banco.
4. A rota `/propriedades` é uma lista/formulário global. Não existe hoje detalhe próprio, upload de documento, download, mapa, geometria, camada, anexo ou exportação nessa rota.
5. Documentos e mapa exibidos no detalhe do cliente pertencem ao escopo principal da Sessão 02. Nesta sessão, confira apenas se criar/editar/excluir uma propriedade atualiza corretamente contagens, lista e entrada iniciada pelo cliente. Não reaudite documentos/mapa por completo.
6. Propriedade é global e pertence a um cliente ativo. Projetos, orçamentos, demandas ambientais e perícias podem referenciá-la; não altere a política de bloqueio sem comprovar o contrato vigente.
7. Não transforme inativação de catálogo em exclusão de histórico. Valores usados em orçamento ou despesa existentes devem continuar legíveis.
8. Não altere normalização, unicidade, obrigatoriedade de UF, política de vínculo ou cascata apenas por preferência. Divergência entre UI, contrato, API e banco é achado; mudança de regra exige decisão de produto quando ambígua.
9. A trilha administrativa completa será reavaliada na Sessão 14. Aqui, valide somente a auditoria gerada pelas mutações de propriedade e registre honestamente se catálogos não produzem log.
10. Ajuda e regressão global pertencem à Sessão 15; divergência diretamente comprovada sobre Cadastros/Propriedades deve ser registrada para correção ou reteste.

## Invariantes dos catálogos auxiliares

Antes de executar, documente o contrato e prove pelo menos:

- as chaves persistidas são `geogestor_tipos_servico` e `geogestor_tipos_despesa`;
- o banco ativo é autoritativo; cache válido só apoia fallback quando a leitura do banco falha ou requer migração conforme o contrato;
- defaults só aparecem quando não existe fonte válida, sem sobrescrever silenciosamente dados reais;
- catálogo de serviços contém no máximo 500 itens, IDs de 1–120 caracteres e nomes únicos após remoção de acentos, diferença de caixa e espaços excedentes;
- serviço possui nome, categoria, valor sugerido inteiro em centavos, não negativo e estado ativo;
- catálogo de despesas contém no máximo 500 itens e categoria única pela mesma normalização;
- categoria de despesa possui descrição, até 100 subcategorias normalizadas e estado ativo;
- criação/edição preserva IDs estáveis; inativação e reativação não recriam o item;
- busca ignora caixa e acento e considera os campos realmente declarados pela interface;
- filtros ativos/inativos/todos, totais e vazios correspondem exatamente ao catálogo persistido;
- serviço inativo desaparece de novas opções em Orçamentos, mas valor histórico permanece disponível em filtros/edição quando necessário;
- categoria inativa desaparece de novas opções em Despesas, mas categoria/subcategoria histórica continuam exibíveis e editáveis sem perda;
- selecionar serviço ativo em novo orçamento preenche descrição e valor sugerido somente na condição prevista, sem sobrescrever item já preenchido;
- valor sugerido é convertido entre centavos no catálogo e reais no formulário uma única vez;
- alteração de catálogo não modifica retroativamente orçamento, despesa, fonte automática do Planejamento nem outro registro operacional;
- PUT com múltiplas configurações valida o conjunto antes de gravar e é atômico;
- migração de `localStorage` é first-write-wins, idempotente e não substitui valor já existente no banco;
- JSON corrompido ou formato legado produz reparo/fallback explícito e observável, sem perda silenciosa;
- falha do cache após sucesso no banco não deve induzir repetição destrutiva, mensagem falsa de não persistência ou divergência duradoura.

## Invariantes das propriedades

Produza um caderno de oráculos com IDs, nomes, identificadores, clientes, vínculos e resultados esperados. Comprove:

- somente propriedades sem `deletedAt` aparecem na lista e nas opções;
- cliente da propriedade existe e está ativo na criação e na atualização;
- nome tem 1–200 caracteres e é único por cliente após normalização de acento, caixa e espaços;
- pelo menos um entre Matrícula, CAR, CCIR e ITR é obrigatório;
- cada tipo de identificador é globalmente único entre propriedades ativas após remover acentos, pontuação, espaços e diferença de caixa;
- a duplicidade é testada para o mesmo cliente, clientes diferentes, identificadores formatados de modo distinto e edição do próprio registro;
- área é finita, não negativa e persistida sem troca de unidade;
- latitude está entre −90 e 90, longitude entre −180 e 180 e ambas são informadas juntas ou ambas nulas;
- município é obrigatório; UF aceita exatamente duas letras e é normalizada em maiúsculas conforme contrato;
- localidade/cidade, situação e observações respeitam limites e nulabilidade;
- PATCH parcial preserva os demais campos, mas o estado final completo continua válido;
- uma propriedade com vínculo em Projeto, Orçamento, Ambiental ou Perícia não pode mudar de cliente nem ser excluída segundo a política vigente;
- uma propriedade sem vínculo pode mudar de cliente e ser excluída logicamente;
- registros vinculados logicamente excluídos são tratados segundo política explicitamente comprovada; ausência de filtro por `deletedAt` não deve ser presumida correta nem incorreta sem evidência de regra;
- lista ordena deterministicamente, pagina em grupos de 25 e retorna total coerente sob busca/filtro;
- busca cobre nome, matrícula, CAR e município conforme contrato; ausência de CCIR/ITR na busca deve corresponder à especificação ou ser registrada como lacuna de UX/produto;
- opções remotas limitam resultados, respeitam cliente e busca, incluem `selectedId` ativo quando necessário e nunca autorizam relação incompatível no salvamento;
- exclusão da única propriedade da última página recua para página válida e atualiza contagens;
- entrada pelo detalhe do cliente abre criação preselecionada; entrada para editar abre exatamente a propriedade solicitada mesmo fora da primeira página ou registra o defeito;
- criar cliente rápido preserva o rascunho da propriedade, seleciona o novo cliente após sucesso e devolve foco corretamente ao cancelar;
- todas as mutações de propriedade são transacionais com auditoria e não deixam meia gravação;
- concorrência não cria nomes/identificadores duplicados nem perde atualização sem sinalização;
- migração legada para a tabela global é idempotente, preserva cliente/identificadores/coordenadas e atualiza referências de Projetos e Orçamentos sem órfãos.

## Dados mínimos para a Sessão 13

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S13-[DATA-HORA]-`:

- dois clientes ativos e um cliente sintético logicamente excluído;
- serviços ativos com valor sugerido zero, valor em centavos, valor alto, nome com acento e nome longo; um serviço inativo e variantes duplicadas por caixa/acento/espaço;
- categorias de despesa ativas com nenhuma, uma e várias subcategorias; subcategorias separadas por vírgula, ponto e vírgula e linha; uma categoria inativa; variantes duplicadas;
- cache válido, ausente, legado e corrompido em perfil isolado; configurações do banco válidas, ausentes, não canônicas e corrompidas somente em banco descartável;
- orçamento e despesa históricos que usam item depois inativado, além de novos formulários para validar opções ativas;
- propriedades sem vínculo para cada cliente, cobrindo cada identificador registral separadamente e uma com todos;
- propriedades com área nula, zero e positiva; coordenadas nulas, válidas, limites exatos e pares inválidos;
- nomes/identificadores duplicados com pontuação, espaços, caixa e acentos diferentes;
- uma propriedade ligada a Projeto, uma a Orçamento, uma a Ambiental e uma a Perícia; relações ativas e, somente em banco descartável, relações logicamente excluídas;
- pelo menos 27 propriedades sintéticas para paginação, empate de nome, busca e filtro por cliente;
- uma propriedade legada embutida em projeto para validar migração em cópia descartável;
- textos vazios/opcionais, limites máximos, Unicode, HTML/JavaScript inerte e conteúdo longo;
- estados sem dados, parciais, loading, erro, lentidão, offline/reconexão e alta cardinalidade.

Nunca injete JSON corrompido, órfãos ou relações inválidas no banco real. Congele o relógio quando necessário e registre exatamente perfil Electron/navegador, banco e cache usados.

## Regras de escopo, segurança e conduta

1. Leia integralmente os `AGENTS.md`, as Web Interface Guidelines e todos os relatórios anteriores disponíveis antes de testar ou editar.
2. Preserve o worktree existente. Registre o estado do Git e não reverta nem atribua à sessão alterações preexistentes.
3. Descubra processos, portas, frontend, API, banco, perfil Electron, `localStorage` e diretórios realmente usados pelo processo em execução.
4. Confirme que frontend, API, SQLite e cache pertencem à mesma instância por PID, porta, caminho absoluto e registro sintético de controle.
5. Antes da primeira mutação, determine se há dados reais e produza snapshot verificável do banco, perfil/cache e arquivos relacionados.
6. Nunca edite, inative ou exclua item preexistente. Toda mutação e vínculo deve usar IDs sintéticos desta sessão.
7. Não pare no plano ou no código. Use a aplicação real e confronte UI, rede, API, SQLite, cache, consumidores e auditoria.
8. Cada item termina como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com evidência.
9. Mocks podem apoiar loading/erro, mas não comprovam persistência, migração, concorrência, vínculo ou limpeza final.
10. Faça correções mínimas ligadas à causa raiz. Separe melhorias e decisões de produto sem implementá-las.
11. Não teste migrações, cascatas, corrupção ou concorrência destrutiva na base real. Não use exclusão ampla para limpar resíduos.
12. Envie atualizações curtas ao concluir inventário, catálogos, propriedades, dependências/migração e regressão.

## Fase 1 — Preparação e linha de base

1. Registre versões do aplicativo, Electron, web, API, contratos, schema/migrações e SQLite; sistema operacional, locale, fuso, viewport, tema e commit/diff.
2. Identifique a migração que cria configurações operacionais, propriedades globais, coluna UF e gatilhos de coerência com Projeto/Orçamento.
3. Confirme tabelas, índices, chaves estrangeiras, gatilhos e `PRAGMA foreign_keys` da instância usada.
4. Identifique comandos de execução e testes existentes: contratos, formulários, catálogos, integração operacional e E2E de Cadastros/Propriedades.
5. Registre contagens, valores das duas configurações, hash do cache, propriedades/vínculos visíveis, console, rede e logs antes das fixtures.
6. Crie `docs/auditorias/[AAAA-MM-DD]-cadastros-propriedades/` e mantenha evidências sanitizadas.
7. Leia o relatório da Sessão 12 e registre a falha financeira herdada e o bloqueio de release sem atribuí-los a esta sessão.

## Fase 2 — Inventário e matriz de cobertura

Crie matriz contendo:

- ID, rota, aba, estado de URL, controle/fluxo e estado condicional;
- ação esperada, pré-condição e resultado visível;
- componente/helper do frontend;
- endpoint/método, contrato, serviço e transação;
- tabela/colunas, chave de configuração, cache, relação e auditoria;
- consumidor afetado e comportamento histórico esperado;
- cenário positivo, negativo, vazio, limite, loading, erro, recuperação e concorrência;
- situação, evidência e achado relacionado.

Varra interface e código para localizar ações contextuais, menus, modais aninhados, confirmações, estados degradados, migração/reparo automático, opções selecionadas fora do filtro, paginação, mensagens de dependência e elementos que só aparecem com dados ativos/inativos.

## Fase 3 — Rotas, navegação, URL e estados

1. Abra `/cadastros` e `/propriedades` pelo menu, URL direta, refresh, voltar/avançar e links internos.
2. Em Cadastros, teste `aba`, `status` e `busca` isolados e combinados, ausentes, vazios, inválidos, duplicados, codificados, com caixa/acento/espaço.
3. Confirme aba/status ativos, preservação intencional da busca por aba, debounce, histórico e ausência de estado híbrido.
4. Navegue pelas abas com mouse, Tab, setas, Home e End; valide `tablist`, `tab`, `tabpanel`, foco e seleção.
5. Em Propriedades, teste busca, cliente e página; documente que esses estados não estão na URL se essa continuar sendo a implementação, avaliando deep link e voltar/avançar sem inventar recurso.
6. Teste entrada vinda do detalhe do cliente para criar/editar, retorno e refresh após o `location.state` ser consumido.
7. Exercite loading, erro, retry, lentidão, resposta fora de ordem, reconexão e vazio global/filtrado/parcial em ambas as rotas.
8. Procure tela branca, flicker, loop de reparo, requisição repetida, dupla submissão, erro de console e cache obsoleto após navegação.

## Fase 4 — Tipos de serviço

1. Crie serviço usando todos os campos, categorias predefinidas e categoria personalizada.
2. Teste nome/categoria vazios, espaços, Unicode, limites, texto longo, ID inválido via API, valor zero, negativo, decimal, excessivo, `NaN`, infinito e separadores pt-BR.
3. Compare a exigência visual de valor maior que zero com o contrato que aceita centavos não negativos e com valores legados zero; registre qualquer inconsistência.
4. Teste duplicidade exata e normalizada por acento, caixa e múltiplos espaços em UI e API.
5. Edite nome, categoria, valor e estado; confirme ID estável, ordenação `pt-BR` e persistência após reload/reinício.
6. Inative, cancele a confirmação, confirme, filtre inativos e reative; teste erro e retry sem fechar indevidamente.
7. Confirme que o item ativo aparece em novo orçamento e no filtro aplicável.
8. Selecione-o em item vazio e valide descrição/valor sugerido; prove que não sobrescreve item existente ou condições fora da regra.
9. Após inativar, abra orçamento histórico e novos formulários; preserve o valor histórico e remova apenas a nova escolha.
10. Teste duas criações/edições rápidas, duplo clique e duas janelas com a mesma versão do catálogo.

## Fase 5 — Categorias e subcategorias de despesa

1. Crie categoria usando todos os campos, presets e categoria personalizada.
2. Teste categoria/descrição vazias, limites, Unicode, HTML inerte, até 100 subcategorias e item 101.
3. Informe subcategorias por linha, vírgula e ponto e vírgula; valide trim, colapso de espaços, vazios e ordem.
4. Teste duplicatas exatas e variantes por caixa/acento/espaço dentro da lista e entre categorias; diferencie comportamento atual de requisito pretendido.
5. Teste categoria duplicada normalizada em UI e API.
6. Edite todos os campos, inative, cancele, confirme e reative; prove ID estável e persistência.
7. Confirme categoria/subcategorias ativas em novo formulário de despesa e filtros.
8. Inative categoria usada, edite a despesa histórica e filtre o histórico; valor atual deve permanecer disponível sem reativar silenciosamente o cadastro.
9. Troque categoria e confirme recalculação coerente das subcategorias, sem valor órfão oculto.
10. Verifique que catálogos não alteram despesas existentes, relatórios ou fontes automáticas do Planejamento.

## Fase 6 — Persistência, cache, defaults e migração dos catálogos

1. Registre GET/PUT de `/api/dados-operacionais/configuracoes-operacionais` e PUT de `/migrar`, payload, resposta e efeito no SQLite/cache.
2. Teste chave permitida e desconhecida, objeto vazio, campos extras, catálogo acima do limite, IDs/números/tipos inválidos e JSON grande dentro de limite seguro.
3. Prove validação integral antes do upsert de múltiplas chaves e rollback quando uma delas falha.
4. Com banco válido e cache divergente, confirme prevalência do banco e reparo controlado do cache.
5. Com banco ausente, teste cache válido e defaults; documente quando/como o banco é reparado.
6. Teste formatos legados de arrays de strings, IDs determinísticos/estáveis, valor de serviço zero e idempotência.
7. Injete JSON corrompido somente em cópia descartável; confirme omissão/reparo/fallback sem loop e sem apagar a outra chave válida.
8. Simule indisponibilidade da API com cache válido/ausente e confirme estado degradado, origem informada e salvamento bloqueado.
9. Simule sucesso no banco e falha ao escrever `localStorage`; depois recarregue e reconcilie UI, banco e cache sem duplicar mutação.
10. Teste cache de requisição de 30 segundos, invalidação após salvar e duas abas/janelas concorrentes.
11. Confirme first-write-wins em `/migrar`, inclusive chamadas repetidas e concorrentes.
12. Verifique se mutações de catálogo geram ou não auditoria conforme contrato; ausência não deve ser ocultada.

## Fase 7 — Formulário e CRUD de propriedades

1. Abra criação global, criação iniciada pelo cliente e edição iniciada pela lista/detalhe do cliente.
2. Use cliente, nome, Matrícula, CAR, CCIR, ITR, área, município, UF, localidade, situação, latitude, longitude e observações.
3. Teste obrigatórios, opcionais, limites, espaços, acentos, caracteres especiais, Unicode e HTML/JavaScript inerte.
4. Teste cada identificador isolado, todos juntos, nenhum, valores formatados e normalização em maiúsculas.
5. Teste área vazia, zero, negativa, decimal com vírgula/ponto, milhares, excesso, `NaN` e infinito.
6. Teste coordenadas vazias, apenas uma, zero, limites ±90/±180, fora dos limites, vírgula decimal e sinal.
7. Teste município ausente e UF vazia, de um/três caracteres, minúscula e caracteres não alfabéticos; reconcilie `required` visual com contrato/API.
8. Teste todas as situações do imóvel e valor arbitrário via API conforme contrato.
9. Teste fechar por Cancelar, X, Escape e clique externo com formulário limpo/alterado; confirme aviso, continuar editando, descartar e `beforeunload`.
10. Ao submeter inválido, foque o primeiro erro e associe mensagem ao campo. Em erro da API, preserve rascunho e permita retry.
11. Durante envio, anuncie carregamento, impeça fechamento e dupla submissão.
12. Após criar/editar, confira lista, API, SQLite, timestamps, audit log, detalhe do cliente e opções consumidoras.
13. Recarregue e reinicie serviço/aplicativo para provar persistência.
14. Teste PATCH parcial direto e confirme que campos omitidos não são apagados; estado final inválido deve ser rejeitado.
15. Teste IDs malformado, inexistente, excluído e cliente inexistente/excluído.

## Fase 8 — Duplicidade, busca, filtros, paginação e opções

1. Teste nome duplicado normalizado no mesmo cliente e o mesmo nome em cliente diferente.
2. Teste Matrícula, CAR, CCIR e ITR duplicados globalmente, variando pontuação, espaços, caixa e acento.
3. Teste edição do próprio registro sem falso positivo e troca para identificador de outro registro.
4. Dispare duas criações concorrentes com mesmo nome/identificador e confira proteção real no banco, não apenas precheck.
5. Busque por nome, matrícula, CAR e município; teste caixa, acento, `%`, `_`, espaços e texto longo.
6. Confirme e documente ausência/presença de busca por CCIR, ITR, cliente, UF e situação.
7. Combine busca e cliente, zere resultados, limpe filtros e confira total/página.
8. Crie mais de 25 itens, navegue anterior/próxima, edite/exclua em páginas diferentes e confirme página válida após redução do total.
9. Teste empates de nome para ordenação determinística entre páginas, sem duplicação/omissão.
10. Em `/propriedades/options`, teste `q`, `clienteId`, `selectedId`, `limit` 1/50/51, UUIDs inválidos e item excluído.
11. Confirme que `selectedId` fora da busca/filtro serve apenas à exibição do valor já selecionado e não permite salvar relação entre clientes incompatíveis.
12. Confirme invalidação de `properties`, `budget-options` e `remote-options` após cada mutação.

## Fase 9 — Cliente rápido e integrações imediatas

1. Com nenhum cliente disponível, confirme foco e ação para criar cliente rápido.
2. Abra o modal aninhado, preencha todos os caminhos necessários, cancele e confirme retorno de foco/rascunho da propriedade.
3. Em sucesso, selecione automaticamente o cliente novo e preserve todos os demais campos.
4. Simule falha/duplicidade do cliente; o modal de propriedade não pode perder dados nem aceitar ID inexistente.
5. Crie propriedade pelo detalhe do cliente; confira filtro, contagem, alerta de “cliente sem propriedade” e retorno.
6. Edite propriedade pelo detalhe do cliente e com mais de 25 itens; abra exatamente o ID solicitado.
7. Confira opções em Projeto e Orçamento: somente propriedades ativas, cliente compatível, rótulos/identificadores corretos e atualização após mutação.
8. Teste gatilhos/validação que impedem Projeto ou Orçamento de referenciar propriedade inativa ou de outro cliente.
9. Confirme que criar/editar/inativar catálogo ou propriedade não altera resultados financeiros, CRM, Projetos/Tarefas ou fontes automáticas do Planejamento além das relações explícitas.
10. Compare contagens de propriedade da lista de clientes, dashboard do cliente, aba Propriedades e banco.

## Fase 10 — Restrições, exclusão lógica e dependências

1. Exclua propriedade sem vínculo: cancele primeiro, confirme depois e valide `deletedAt`, lista, opções, cliente e auditoria.
2. Tente excluir propriedade ligada separadamente a Projeto, Orçamento, Ambiental e Perícia; exija 409/mensagem específica e nenhuma mutação.
3. Tente mudar o cliente de propriedade ligada por cada tipo; valide o mesmo bloqueio.
4. Edite outros campos de propriedade ligada sem trocar cliente; deve continuar permitido se válido.
5. Teste múltiplos vínculos, referências compartilhadas e falha intermediária; nenhuma operação pode ficar pela metade.
6. Em banco descartável, repita com vínculo logicamente excluído e determine a política real. Registre ambiguidade de produto antes de alterar.
7. Teste DELETE/PATCH repetido de item já excluído e inexistente; códigos e mensagens devem ser uniformes.
8. Confirme que item excluído não reaparece após reload/reinício, não entra em opções/duplicidade e não deixa referências visíveis quebradas.
9. Verifique tabelas não contempladas pelo verificador de vínculos e prove se podem referenciar propriedade.
10. Confira exclusão lógica de cliente com propriedade e política de bloqueio/cascata da Sessão 02 sem tocar em dados reais.

## Fase 11 — Migração legada e integridade estrutural

1. Em cópia descartável anterior à migração, crie projetos com propriedade embutida e execute a migração real.
2. Confirme criação determinística da propriedade global, cliente correto e cópia de nome, matrícula, CAR, CCIR, ITR, área, localização, coordenadas e observações suportadas.
3. Quando matrícula já existir para o mesmo cliente, confirme reutilização conforme regra sem duplicidade.
4. Confirme atualização de `propriedadeId` em Projetos e Orçamentos relacionados.
5. Execute a migração novamente e prove idempotência por contagens, IDs e hashes relevantes.
6. Teste legado parcial, identificador ausente, coordenada parcial, cliente excluído e conflito de identificador somente em banco descartável.
7. Valide gatilhos de insert/update de Projeto e Orçamento para propriedade ativa e do mesmo cliente.
8. Inspecione índices/constraints de unicidade. Se a regra depende apenas de precheck em aplicação, demonstre o risco concorrente.
9. Procure órfãos, duplicatas, referências cruzadas e divergências entre coluna legada e propriedade global.

## Fase 12 — Backend, segurança, desempenho e auditoria

1. Inventarie todos os endpoints da sessão, schemas, status HTTP, payloads, respostas, tabelas e efeitos colaterais.
2. Teste entradas válidas/inválidas, ausentes, extras, tipos errados, UUIDs, limites, corpos grandes e strings de controle.
3. Mensagens devem ser seguras e uniformes, sem stack trace, caminho absoluto, SQL, segredo ou dado de outro cliente.
4. Force falha entre mutação e auditoria de propriedade; confirme rollback completo.
5. Teste duas edições concorrentes da mesma propriedade e dois salvamentos de catálogo; detecte perda silenciosa de atualização.
6. Faça testes seguros de XSS persistente/refletido, injeção, manipulação de ID e relacionamento cruzado. Conteúdo permanece inerte na UI, logs e JSON.
7. Meça lista/paginação, busca, opções e catálogos com volume realista; procure N+1, payload excessivo, busca sem índice e bloqueio perceptível.
8. Teste lock SQLite, leitura durante escrita, reinício do serviço e aplicativo empacotado quando o ambiente permitir.
9. Confira audit log de propriedade: ação, entidade, ID, antes/depois, timestamp e ausência de dado sensível indevido.
10. Execute a suíte completa da API e reconcilie a falha financeira herdada; não atribua regressão sem comparação objetiva.

## Fase 13 — Usabilidade, acessibilidade, correção e regressão

1. Percorra todos os fluxos apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home, End e Escape.
2. Confirme foco visível, ordem lógica, contenção/retorno de modais, foco inicial e primeiro erro.
3. Verifique HTML semântico, headings, landmarks, tablist/tabpanel, labels, nomes acessíveis, `aria-live`, `aria-busy` e confirmações.
4. Estado ativo/inativo, origem degradada, erro e vínculo bloqueado não podem depender apenas de cor.
5. Teste tema claro/escuro, 360, 768, 1024 e 1440 px, zoom 200%, redução de movimento, alto contraste e textos máximos.
6. Verifique reflow, sobreposição, truncamento, lista, paginação, modais aninhados, seletor remoto e alvos de toque.
7. Confira português, plural, `…`, datas/números/moeda via `Intl`, números tabulares e diferença entre zero/nulo.
8. Sinalize antipadrões do `AGENTS.md`: `transition: all`, `outline-none` sem substituto, elemento não semântico clicável, campo sem label, botão-ícone sem nome e formato fixo.
9. Execute Axe WCAG 2.2 A/AA nas duas abas de Cadastros e na lista/formulário/confirmação de Propriedades, em estados vazio, loading, erro, filtrado e degradado.
10. Complemente com árvore de acessibilidade e navegação manual; leitor de tela real fica `BLOQUEADO` se não for efetivamente operado.
11. Antes de corrigir, reproduza e determine causa raiz; adicione teste automatizado que falhe antes sempre que razoável.
12. Faça a menor alteração coerente, rode testes focados, lint/typecheck e regressão web/API/Electron/E2E/build/smoke.
13. Repita manualmente o fluxo corrigido e reconcilie UI, API, SQLite, cache, consumidor e auditoria.
14. Novo cadastro, documento/mapa de propriedade, importação/exportação, restauração ou mudança de regra exige aprovação expressa.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- as duas abas de Cadastros e todos os parâmetros de URL foram exercitados;
- criação, edição, inativação, reativação, busca e filtros dos dois catálogos foram comprovados;
- banco autoritativo, cache, defaults, migração legada, reparo e estado degradado foram reconciliados;
- Orçamentos e Despesas consumiram corretamente itens ativos e preservaram históricos inativos;
- CRUD completo de propriedades, todos os campos, normalização e duplicidade foram exercitados;
- busca, filtro por cliente, paginação, opções remotas e entradas pelo cliente foram comprovados;
- Projeto, Orçamento, Ambiental e Perícia foram testados como dependências de transferência/exclusão;
- migração legada, gatilhos, transações, concorrência, soft delete e auditoria foram verificados;
- correções foram retestadas automaticamente e na interface real;
- nenhum erro novo relevante aparece no console, rede, API ou logs;
- todos os dados/cache sintéticos foram removidos e os resíduos verificados tabela a tabela;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- bloqueios, itens não aplicáveis e decisões de produto foram declarados com precisão.

## Classificação dos achados

- **P0** — perda/corrupção de cadastro mestre, associação da propriedade ao cliente errado, exclusão apesar de vínculo, migração destrutiva ou falha grave de segurança.
- **P1** — duplicidade estrutural, catálogo autoritativo sobrescrito por cache, vínculo cruzado, histórico perdido, transação quebrada, propriedade principal inacessível ou bloqueio sério de acessibilidade.
- **P2** — CRUD, filtro, busca, paginação, opção, validação, cache, auditoria ou restrição secundária incorretos; UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com rotas, abas, catálogos, propriedades, controles, fixtures e situações.
3. `ACHADOS.md` com ID, gravidade, camada, rota/entidade, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/funções/endpoints, correção e reteste.
4. `CADERNO-DE-ORACULOS.md` com IDs, normalizações, duplicidades, centavos, coordenadas, páginas, vínculos e comparação GeoGestor.
5. `MATRIZ-DE-CATALOGOS.md` com fonte banco/cache/default, formato, versão, ativos/inativos, consumidores, migração, reparo e resultado.
6. `MATRIZ-DE-DEPENDENCIAS.md` com Propriedade × Cliente/Projeto/Orçamento/Ambiental/Perícia, estado ativo/excluído, transferência, exclusão e evidência.
7. `PROTOCOLO-DE-MIGRACAO.md` com estado antes/depois, IDs, hashes, referências, idempotência e resíduos.
8. `PROTOCOLO-DE-INTEGRIDADE.md` com transações, soft deletes, constraints/gatilhos, concorrência, auditoria e limpeza.
9. Evidências úteis: capturas, árvore de acessibilidade, logs mínimos, respostas sanitizadas, consultas e cache sanitizado, sem dados reais.
10. Relação de arquivos de código alterados e motivo.
11. Comandos/testes executados, versões, tempos e resultados exatos.
12. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
13. Riscos residuais e itens que a Sessão 14 deve retestar.
14. Melhorias não implementadas separadas por benefício, esforço, risco e necessidade de decisão de produto.
15. Confirmação da limpeza ou inventário exato de resíduos com IDs, chaves, tabelas, perfil/cache e caminhos.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura em números por rota, catálogo, CRUD, dependência, migração e estado;
- defeitos por gravidade e quantos foram corrigidos;
- pendências, bloqueios, decisões de produto e itens não aplicáveis;
- divergências encontradas entre banco, cache, UI e consumidores;
- duplicidades, vínculos, migração, transações, auditoria e regressão efetivamente comprovados;
- testes executados, tempos e resultados exatos, incluindo a situação da falha financeira herdada;
- limpeza, riscos herdados e estado do manifesto de release;
- links para relatório, matriz, achados, oráculos, catálogos, dependências, migração, integridade e evidências;
- recomendação objetiva sobre iniciar ou não a **Sessão 14 — Configurações e Administração**.

Não use frases vagas como “parece correto”, “cadastro consistente”, “em geral está bom” ou “a maioria foi testada”. Use fatos, IDs, chaves, versões de cache, centavos, nomes normalizados, coordenadas, páginas, relações, consultas e evidências.
