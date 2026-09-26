# Prompt de auditoria — Sessão 09: Agenda — Tarefas

Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop, gestão de tarefas, UX, acessibilidade, integridade de dados, persistência e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 09 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **09 — Agenda — Tarefas**.
- Módulo/menu: **Agenda — Tarefas**.
- Rota principal: **`/tarefas`**.
- Deep link principal: **`/tarefas?tarefaId=:id`**.
- Rotas de integração permitidas:
  - `/calendario` e `/calendario/tarefa/:id`, somente para comprovar prazo, detalhe e retorno;
  - `/projetos/:id`, somente na aba de tarefas/checklist do projeto;
  - `/clientes/:id`, somente nas tarefas do cliente;
  - `/configuracoes?secao=modelos`, somente em **Modelos de checklist**;
  - `/`, somente nos indicadores, vencimentos e atividades derivados de tarefas;
  - centro de Alertas e Pesquisa global, somente nos resultados/deep links de tarefa.
- Estados atuais da tarefa: **A Fazer**, **Em Progresso** e **Concluído**.
- Prioridades atuais: **Baixa**, **Média** e **Alta**.
- Visualização principal real: quadro Kanban com três colunas. Não presuma visão em tabela, recorrência, subtarefas, responsáveis, comentários, anexos, etiquetas, estimativas ou ordenação manual persistente se esses recursos não existirem na versão auditada.
- Foco especial: carregamento do quadro, busca, filtros, período, projeto, prioridade, paginação, contagens, estados vazios/erro, CRUD, formulário sujo, drag-and-drop, conclusão/reabertura, vínculo cliente–projeto, datas civis, exclusão lógica, modelos de checklist, aplicação idempotente de modelos, integrações com projeto/cliente/calendário/painel/alertas, cache, concorrência, persistência, auditoria e acessibilidade.
- Relatórios anteriores obrigatórios:
  - `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`;
  - `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`;
  - `docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md`;
  - `docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md`;
  - `docs/auditorias/2026-09-11-projetos/RELATORIO.md`;
  - `docs/auditorias/2026-09-11-ambiental/RELATORIO.md`;
  - `docs/auditorias/2026-09-12-financeiro/RELATORIO.md`;
  - `docs/auditorias/2026-09-12-agenda-calendario/RELATORIO.md`.
- Implementar correções comprovadas: **SIM**.
- Implementar novas funcionalidades ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-agenda-tarefas/`.

## Objetivo

Validar de ponta a ponta cada coluna, cartão, contador, filtro, busca, seletor, paginação, campo, modal, botão, confirmação, atalho, drag-and-drop, modelo de checklist, deep link e integração de tarefa disponível no GeoGestor. Não aprove uma função porque o código parece correto ou porque a API respondeu HTTP 200. Comprove o resultado na interface real, no contrato da API, no SQLite, nas telas consumidoras, nos alertas, na jornada do cliente e na trilha de auditoria.

Construa oráculos independentes para filtros, paginação, atraso, taxa de conclusão e aplicação de modelos. Corrija somente defeitos reproduzidos e pertencentes ao escopo. Depois de cada correção, execute teste automatizado focado, reteste manual integrado e regressão proporcional ao risco.

## Limites funcionais e de integração

1. Audite integralmente a rota `/tarefas`, os contratos `/api/tarefas*` e os modelos de checklist. Nos demais módulos, cubra somente fluxos que criam, exibem, alteram, removem ou resumem tarefas.
2. A aba de tarefas de Projeto e as tarefas de Cliente são pontos alternativos do mesmo domínio. Uma mutação feita em qualquer ponto deve aparecer nos outros sem duplicidade ou vínculo divergente.
3. A interface principal atual exige projeto ao criar/editar. O backend também aceita tarefa ligada diretamente a cliente. Teste ambos, documente a diferença e não crie uma nova regra de produto sem aprovação.
4. O drag-and-drop atual representa mudança de **status**. Não exija persistência da posição dentro da coluna se o produto não possuir campo/contrato de ordenação; porém, verifique se a interação não promete uma ordem que será perdida após recarregar.
5. A exclusão atual é lógica. Não transforme exclusão em restauração, lixeira ou remoção física sem decisão de produto.
6. Modelos de checklist pertencem ao domínio de tarefas, embora a interface esteja em Configurações e sua aplicação ocorra ao criar projeto ou por endpoint. Audite-os nesta sessão sem reauditar toda a tela de Configurações ou o cadastro completo de Projeto.
7. Não invente responsáveis, recorrência, subtarefas, comentários, anexos, etiquetas, dependências, cronômetro, SLA ou notificações por e-mail. Registre ausência como `NÃO APLICÁVEL` ou melhoria não implementada.
8. O Google Agenda não integra tarefas diretamente por OAuth. Teste apenas a representação local da tarefa no Calendário e, se exibido, o link de composição já coberto na Sessão 08. Não repita OAuth/sincronização externa sem evidência de regressão específica.

## Invariantes obrigatórios

Antes de executar, monte um oráculo independente. No mínimo, comprove:

- cada tarefa ativa aparece uma única vez no quadro e em exatamente uma coluna válida;
- as três colunas representam `A Fazer`, `Em Progresso` e `Concluído` sem perda silenciosa de status legado;
- contagens das colunas somam os itens da página carregada; total e paginação representam o conjunto filtrado completo;
- a interface deixa claro quando a contagem é da página e não do total global;
- busca, projeto, prioridade e intervalo de prazo compõem o mesmo predicado no frontend, na API e na contagem total;
- trocar qualquer filtro reinicia ou ajusta a página para um valor válido;
- intervalo é inclusivo nas duas bordas e rejeita data civil inválida e início posterior ao fim;
- projeto ativo determina seu cliente; `clienteId` direto e cliente derivado do projeto nunca divergem;
- tarefa ligada diretamente a cliente continua acessível e não é corrompida ao ser aberta pela interface;
- concluir move a tarefa para `Concluído`; reabrir aplica exatamente o status definido pelo produto e não restaura estado anterior sem contrato;
- uma atualização otimista que falha retorna uma única vez ao estado anterior e informa a falha;
- tarefa excluída deixa de aparecer no quadro, calendário, painel, projeto, cliente, pesquisa e alertas, sem apagar projeto ou cliente;
- recarregar a tela e reiniciar o serviço preservam criação, edição, status e exclusão;
- tarefas sem prazo não entram nos cálculos ou alertas que explicitamente dependem de prazo;
- taxa de conclusão no painel considera exatamente o intervalo e os estados documentados;
- tarefa concluída ou excluída não gera alerta de prazo ativo;
- deep link resolve o ID exato independentemente da página, filtro ou título duplicado e não deixa filtro oculto;
- uma resposta antiga de busca/filtro não substitui a resposta mais recente;
- aplicação de modelo cria no máximo uma tarefa por etapa inédita no projeto, usando a normalização documentada;
- reaplicar o mesmo modelo não duplica títulos equivalentes por caixa, acento ou espaços normalizados;
- aplicar modelo é atômico quanto às tarefas, auditorias, aplicação e jornada criadas pela mesma requisição;
- exclusão de modelo preserva tarefas e histórico de aplicações já existentes;
- toda mutação registra ação, entidade e ID corretos na auditoria, sem payload sensível ou stack trace.

Não use os mesmos helpers de produção para calcular os resultados esperados. Registre fixture, consulta, predicado, total esperado, página, coluna, consumidores e resultado real.

## Dados mínimos obrigatórios

Crie tudo somente em banco, perfil e diretórios descartáveis, com prefixo único `QA-AUDIT-S09-[DATA-HORA]-`:

1. Dois clientes ativos e dois projetos ativos, um projeto por cliente.
2. Uma tarefa em cada status para cada projeto e uma tarefa em cada prioridade.
3. Tarefas com prazo ontem, hoje, amanhã, no primeiro e no último dia do intervalo e sem prazo.
4. Uma tarefa diretamente ligada ao cliente, sem projeto, criada pela API para validar o contrato e sua renderização.
5. Tentativas com cliente/projeto divergentes, entidades inexistentes, removidas e UUID inválido.
6. Tarefas com mesmo título em projetos diferentes e títulos equivalentes por caixa, acentos e espaços.
7. Título/descrição vazios, nos limites exatos, acima do limite, com acentos, emoji e HTML/JavaScript inerte.
8. Datas válidas e inválidas, incluindo 29/02 válido e inválido, formato parcial e intervalo invertido.
9. Uma tarefa para cada transição de status, outra para falha otimista e outra para duas alterações concorrentes.
10. Tarefas independentes para cancelar exclusão, confirmar exclusão, repetir exclusão e falha durante exclusão.
11. Pelo menos 101 tarefas ativas para validar limite 100, segunda página, filtros e deep link de item fora da página inicial; use volume maior somente em banco descartável.
12. Um status e uma prioridade legados/desconhecidos inseridos diretamente no banco descartável para verificar tratamento explícito.
13. Modelos de checklist ativo e inativo, com uma etapa e com várias etapas/prioridades, além de nomes/etapas duplicados normalizados.
14. Projeto vazio para primeira aplicação, projeto com uma etapa já existente e projeto para falha transacional durante aplicação.
15. Tarefas que produzam alerta vencido, hoje, dentro e fora da antecedência configurada.
16. Estados de zero dados global, zero resultado filtrado, dados parciais, carregamento lento, falha da API, reconexão e resposta fora de ordem.

Não reutilize tarefas pessoais/profissionais. Gere previamente uma tabela-oráculo com IDs, vínculos, status, prioridade, prazo, coluna, página, alerta e presença esperada em cada tela consumidora.

## Regras de escopo e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis e siga as Web Interface Guidelines do projeto.
2. Leia integralmente os oito relatórios anteriores. Reteste apenas correções, integrações e riscos que afetem diretamente Tarefas.
3. Da Sessão 08, considere comprovadas as correções do endpoint de detalhe da tarefa, das datas do calendário, dos deep links e da atualização integrada; reteste-as com mutações desta sessão.
4. Mantenha como riscos herdados, quando relevantes: leitor de tela real/alto contraste, zoom e matriz visual ampla, offline/reconexão, virada real de meia-noite, volume produtivo, concorrência multiprocesso/lock SQLite e upgrade de instalação antiga.
5. A ausência de uma conta Google de QA não bloqueia esta sessão. Só registre o bloqueio se um fluxo de tarefa realmente depender do provedor externo.
6. Não pare após planejar ou ler o código. Use a aplicação real e confronte interface, rede, API, SQLite, integrações, alertas e logs.
7. Todo item inventariado deve terminar como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com justificativa e evidência.
8. Endpoints ou campos sem controle visual devem ser inventariados como backend e separados do fluxo disponível ao usuário.
9. Preserve alterações preexistentes. Registre o estado inicial do Git e não reverta trabalho de terceiros.
10. Faça correções mínimas ligadas à causa raiz. Não redesenhe o quadro nem crie funções novas.
11. Melhorias não corretivas devem ser listadas separadamente por benefício, esforço e risco e não podem ser implementadas sem aprovação.
12. Mocks podem apoiar testes de falha e unidade, mas a aprovação final exige o caminho integrado real sempre que o ambiente permitir.
13. Envie atualizações curtas ao concluir inventário, listagem/filtros, CRUD, transições/Kanban, modelos, integrações, backend, correções e regressão.

## Segurança dos dados de teste

1. Identifique banco, perfil Electron, diretório de dados, API e frontend realmente usados. Nunca presuma qual banco está ativo.
2. Detecte dados reais antes de mutar. Use banco e perfil completamente isolados.
3. Antes da primeira mutação, produza backup/snapshot verificável e registre caminho, tamanho, data e SHA-256 quando aplicável.
4. Nunca edite, conclua, reabra, mova ou exclua tarefa preexistente do usuário.
5. Antes de excluir, valide ID, título, projeto, cliente e prefixo exatos do registro sintético.
6. Testes de cascata, falha forçada, status legado e volume devem ocorrer apenas em banco descartável.
7. Não use exclusão física ampla para limpar. Remova somente fixtures identificadas e suas relações sintéticas.
8. Ao final, confirme ausência de tarefas, modelos, etapas, aplicações, alertas, jornadas e auditorias órfãs criadas pela sessão.
9. Se um defeito impedir a limpeza, não force operação ampla. Registre cada resíduo, ID, tabela e vínculo.

## Fase 1 — Preparação e linha de base

1. Identifique Electron, React/Vite, quadro drag-and-drop, API Fastify, contratos, Drizzle/SQLite, serviço de alertas, consumidores de tarefas, portas e suítes aplicáveis.
2. Verifique Git, processos ativos, logs recentes e saúde da aplicação sem encerrar processos não identificados.
3. Confirme que frontend, API, SQLite e perfil Electron pertencem à mesma instância isolada.
4. Registre versão, commit, worktree, sistema operacional, locale, fuso, data/hora, viewport, zoom e tema.
5. Capture linha de base de `tarefas`, projetos, clientes, modelos/etapas/aplicações de checklist, alertas, jornada e `audit_logs`.
6. Registre erros iniciais de console/rede/API e contagens por status, prioridade, prazo, projeto e cliente.
7. Crie `docs/auditorias/[AAAA-MM-DD]-agenda-tarefas/` para relatório, matriz, oráculo, evidências e protocolo de limpeza.

## Fase 2 — Inventário obrigatório

Antes de testar, produza uma matriz contendo:

- ID do item;
- rota, parâmetro, tela, coluna, cartão, modal, filtro ou integração;
- ação e resultado esperado;
- componente do frontend;
- endpoint, método, query, payload, código e resposta;
- tabelas, vínculos, cache, alerta, jornada e auditoria;
- cenários positivo, negativo, vazio, carregamento, lentidão, erro, concorrência e recuperação;
- situação e evidência.

Varra interface e código para localizar elementos condicionais: ações visíveis apenas em hover/foco, alça de arraste, concluir/reabrir, edição, confirmação, paginação, filtros avançados, badge de filtros, destaque de deep link, estados vazios, erro, projeto/cliente ausente, data vencida, textos longos, modelo ativo/inativo, duplicação e exclusão de modelo.

Inventarie, se existirem na versão auditada, pelo menos estes contratos:

- `GET /api/tarefas` nos modos legado e paginado;
- `GET /api/tarefas/options`;
- `GET /api/tarefas/calendar?inicio=&fim=`;
- `GET /api/tarefas/:id`;
- `POST /api/tarefas`;
- `PATCH /api/tarefas/:id`;
- `DELETE /api/tarefas/:id`;
- `GET /api/tarefas/modelos?ativos=`;
- `POST /api/tarefas/modelos`;
- `PATCH /api/tarefas/modelos/:id`;
- `POST /api/tarefas/modelos/:id/duplicar`;
- `DELETE /api/tarefas/modelos/:id`;
- `POST /api/tarefas/modelos/:id/aplicar`;
- `POST /api/tarefas/aplicar-modelo`;
- endpoints de opções de projeto/cliente usados nos formulários;
- endpoint do painel que calcula totais, vencimentos e taxa de conclusão;
- endpoints de alertas que materializam prazos de tarefas.

## Fase 3 — Rota, módulo, deep link e estado

1. Abra `/tarefas` pelo menu Agenda, URL direta, Visão Geral, Calendário, Alerta, Pesquisa global e referências de Projeto/Cliente.
2. Confirme submenu ativo, título, ação principal e retorno coerente ao módulo de origem.
3. Teste `?tarefaId=` válido para item da primeira e da segunda página, UUID inválido, inexistente, excluído e duplicado na URL.
4. O deep link deve localizar o ID exato, rolar/destacar de forma acessível e limpar/canonizar o parâmetro sem deixar busca ou filtro inesperado.
5. Teste deep link combinado com filtros existentes, voltar/avançar e recarregar. Documente claramente o que é preservado e o que é limpo.
6. Teste URL com parâmetros desconhecidos, fragmento, codificação e navegação rápida entre dois deep links.
7. Verifique se busca, projeto, prioridade, prazo e página são refletidos na URL quando a diretriz do projeto exigir estado compartilhável. Se não forem, classifique impacto como defeito ou melhoria segundo o contrato existente, sem implementar decisão de produto.
8. Procure tela em branco, flash de dados errados, requisição duplicada, resposta fora de ordem, destaque sem foco, carregamento infinito e erro silencioso.

## Fase 4 — Quadro, carregamento, busca, filtros e paginação

1. Reconcile os cartões de cada coluna com API e banco por ID, status e ordem determinística.
2. Confira título, descrição, projeto/cliente, prioridade e prazo em cada cartão, inclusive campos ausentes e textos longos.
3. Valide os contadores das colunas, total exibido, singular/plural e relação com a página de 100 itens.
4. Com mais de 100 tarefas, confirme primeira/segunda página, botões anterior/próxima, limites, total, `totalPages`, mudança de página e item de borda.
5. Ao filtrar na página 2, a aplicação deve retornar a uma página válida ou carregar o resultado correto; não aceite quadro vazio por página fora do intervalo.
6. Teste busca pelo que a interface promete: título, descrição, projeto e cliente. Compare caixa, acentos, espaços, termo parcial, caractere especial inerte e inexistente.
7. Se o backend pesquisar apenas parte dos campos anunciados, registre como defeito de contrato/interface e corrija a causa mínima dentro do escopo.
8. Teste projeto e prioridade isolados, combinados entre si, com busca, prazo e paginação.
9. Teste data inicial, final, ambas, bordas inclusivas, sem prazo, intervalo invertido e datas impossíveis.
10. Abra/feche filtros avançados, confira badge, valores persistidos, **Limpar filtros**, foco e retorno visual.
11. Diferencie corretamente zero dados global de zero resultado filtrado. O estado filtrado deve oferecer limpar filtros, não induzir criação desnecessária.
12. Teste carregamento inicial, atualização, API lenta, falha, repetição e reconexão. Dados antigos preservados não podem ser apresentados como atuais sem aviso.
13. Dispare buscas/filtros rapidamente e entregue respostas fora de ordem. A última intenção do usuário deve prevalecer.
14. Teste modo legado e modo paginado diretamente; ambos devem seguir o contrato documentado, sem truncamento silencioso ou shape ambíguo.
15. Valide `page`, `limit`, `q`, `id`, `projetoId`, `clienteId`, `prioridade`, `inicio`, `fim` e `mode` com tipos, limites, decimais, repetição e valores inválidos.

## Fase 5 — Criar e editar tarefas

1. Abra **Nova tarefa** por todos os gatilhos e confira foco inicial, título, fechamento e retorno de foco.
2. Exercite título, projeto, prioridade, prazo e descrição, inclusive todos os opcionais.
3. Teste título vazio/espaços, limites exatos, excesso, acentos, emoji e HTML/JavaScript inerte.
4. Teste descrição vazia, longa, no limite e acima dele; confirme quebra/truncamento e ausência de XSS.
5. Teste cada prioridade e tentativa de prioridade desconhecida diretamente na API.
6. Teste prazo vazio, ontem, hoje, amanhã, bordas, 29/02 válido/inválido, formato parcial e texto.
7. Selecione projetos com títulos iguais e clientes distintos. A opção deve identificar inequivocamente o vínculo.
8. Tente projeto inexistente/removido e vínculo cruzado diretamente na API.
9. Pela API, crie tarefa somente com cliente, somente com projeto, com ambos coerentes, com ambos divergentes e sem ambos.
10. Teste campos `status` e `categoria` disponíveis somente no backend, inclusive limites e valores inválidos; identifique-os como contrato sem UI.
11. Confirme que uma nova tarefa pela interface nasce em `A Fazer` e aparece no projeto/cliente corretos.
12. Edite todos os campos, salve, reabra, recarregue e reinicie o serviço. Confirme timestamps e vínculo derivado.
13. Abra para editar uma tarefa ligada apenas ao cliente. A interface não pode corromper, esconder ou forçar vínculo sem comunicar a regra.
14. Teste fechar por botão, Escape, clique externo, navegação e recarga com/sem alterações. Cancele e confirme o descarte.
15. Teste validação inline, associação acessível, foco no primeiro erro e preservação dos campos após falha.
16. Faça duas submissões rápidas e simultâneas. Registre a política real de duplicidade e impeça duplo envio acidental.
17. Teste `PATCH` parcial, vazio, com campo extra e com tipo errado. Atualização vazia não deve gerar mutação/auditoria enganosa sem contrato.
18. Após criar/editar, confira quadro, total, coluna, painel, projeto, cliente, calendário, alerta, jornada e auditoria.

## Fase 6 — Status, conclusão, reabertura e Kanban

1. Mova uma tarefa por todas as transições entre `A Fazer`, `Em Progresso` e `Concluído` usando drag-and-drop.
2. Use os botões rápidos de concluir e reabrir em cada estado. Documente exatamente o destino da reabertura.
3. Confirme cartão, coluna, contadores, API, banco, `updatedAt`, jornada e auditoria após cada transição.
4. Concluir deve registrar a interação de conclusão uma única vez. Atualizar tarefa já concluída não pode duplicar a jornada.
5. Reabra e conclua novamente; verifique política de novo registro de conclusão e ausência de duplicidade acidental.
6. Simule falha de PATCH durante mudança otimista. O cartão deve retornar à coluna original, sem duplicação, com mensagem acionável.
7. Faça duas mudanças rápidas e respostas invertidas. O estado final deve ser coerente e não perder atualização silenciosamente.
8. Faça duas alterações concorrentes via API/duas janelas e documente a política de concorrência ou o risco de `last-write-wins`.
9. Arraste dentro da mesma coluna e para posições diferentes. Confirme que nenhuma ordem é prometida/persistida indevidamente.
10. Recarregue e reinicie o serviço após cada status crítico.
11. Teste drag-and-drop somente por teclado conforme a biblioteca suportar. Deve existir alternativa acessível para mudar status sem mouse.
12. Teste toque/ponteiro, cancelamento do arraste, soltar fora da área, scroll durante arraste, redução de movimento e foco preservado.
13. Insira status legado/desconhecido no banco descartável. A tarefa não pode desaparecer silenciosamente nem tornar os totais irreconciliáveis.
14. Verifique se prazo atrasado possui indicação textual/semântica adequada e se concluir remove o alerta de atraso.

## Fase 7 — Exclusão lógica e integridade referencial

1. Abra a confirmação pelo cartão, confira título/ID sintéticos, cancele e prove que nada mudou.
2. Confirme a exclusão de outra tarefa e confira estado de carregamento e proteção contra clique duplo.
3. Verifique `deletedAt`, ausência em todas as listagens/consumidores e preservação do projeto/cliente.
4. Teste ID inválido, inexistente, já excluído e repetição concorrente de `DELETE`.
5. Simule falha de API. O cartão deve permanecer/retornar uma única vez e a interface deve explicar como repetir.
6. Confirme que tarefa excluída não aparece em Calendário, detalhe, painel, alertas, pesquisa, opções, projeto ou cliente, inclusive após recarregar/reiniciar.
7. Verifique vínculos de planejamento/estratégia ou outras referências existentes. Como a exclusão é lógica, nenhuma tela pode abrir como se a tarefa estivesse ativa nem perder referência sem política explícita.
8. Force falha de auditoria em banco descartável e prove atomicidade da exclusão.
9. Confira que a mensagem “não pode ser desfeita” corresponde ao produto. Não implemente restauração sem aprovação.

## Fase 8 — Modelos de checklist

1. Abra `/configuracoes?secao=modelos` diretamente e pelo menu, focando apenas **Modelos de checklist**.
2. Liste modelos ativos/inativos e teste carregamento, vazio, erro, repetição e textos longos.
3. Crie e edite nome, descrição, tipo de projeto, estado ativo e todas as etapas.
4. Em cada etapa, teste título, descrição e prioridades Baixa/Média/Alta.
5. Adicione, remova e reordene etapas para cima/baixo; confira primeira/última etapa e mínimo de uma etapa.
6. Teste limites de 1 a 100 etapas, nomes/títulos vazios, limites de caracteres, duplicidade, acentos, espaços e conteúdo inerte.
7. Feche o modal com e sem alterações por botão, Escape e clique externo. Confirme descarte/foco quando houver risco de perda.
8. Duplique modelo ativo e inativo. Confira novo ID, nome, cópia integral das etapas, estado inicial previsto e ausência de vínculo compartilhado mutável.
9. Exclua modelo, primeiro cancelando e depois confirmando. Verifique soft delete, inativação, remoção das opções e preservação das tarefas/aplicações históricas.
10. Teste endpoints com UUID inválido/inexistente, payload extra, tipo errado, PATCH vazio, concorrência e falha transacional.
11. Aplique modelo ativo em projeto vazio e reconcilie cada etapa com tarefa, prioridade, descrição, projeto e cliente derivados.
12. Reaplique o mesmo modelo e confirme `criadas`/`ignoradas` sem duplicidade.
13. Aplique modelo com tarefa preexistente equivalente por caixa, acento e espaços; confirme a regra de normalização.
14. Teste etapas duplicadas dentro do próprio modelo e dois modelos com etapas equivalentes.
15. Tente aplicar modelo inativo/excluído, projeto removido/inexistente e combinações adulteradas.
16. Force falha no meio da aplicação e prove atomicidade entre tarefas, auditorias, registro de aplicação e jornada.
17. No cadastro de um projeto sintético, selecione um modelo e conclua o fluxo somente para provar a integração. Como criação do projeto e aplicação são requisições separadas, simule falha da segunda e confirme mensagem honesta e estado recuperável.
18. Determine e documente o significado real de **tipo de projeto** no modelo. Se for apenas metadado e não filtrar opções/aplicação, não invente comportamento.

## Fase 9 — Projeto, cliente e demais pontos de tarefa

1. Na aba de tarefas de um projeto sintético, crie tarefa, conclua/reabra, filtre, pesquise e exclua. Reconcile imediatamente com `/tarefas`.
2. Confira progresso do checklist, “X de Y concluídas”, percentual, atrasadas, abertas, estados vazios e filtros da aba do projeto.
3. Com mais de 100 tarefas no projeto, verifique truncamento, total e comunicação; não aceite percentual calculado sobre subconjunto sem aviso.
4. No Cliente, teste tarefas diretas e derivadas de projetos. Uma tarefa deve aparecer uma única vez e no cliente correto.
5. Crie/edite/conclua/exclua tarefa pelo Cliente somente com fixtures sintéticas e reconcile com quadro, projeto quando houver, banco e auditoria.
6. Teste projeto/cliente removido após existir tarefa e confirme política de órfão, filtros, detalhe e opções.
7. Valide mensagens, campos e regras consistentes entre `/tarefas`, Projeto e Cliente. Diferença intencional deve ser documentada; diferença que corrompe dados deve ser corrigida.

## Fase 10 — Calendário, painel, alertas, pesquisa e auditoria

1. Para tarefa com prazo, confira evento único em `/calendario`, detalhe `/calendario/tarefa/:id`, status, prioridade, projeto, cliente e data civil.
2. Crie, altere o prazo, remova o prazo, conclua, reabra e exclua; após cada ação, confira inclusão, movimentação ou remoção no calendário.
3. Teste prazo na borda de mês, 29/02 e próximo da meia-noite do sistema sem deslocamento UTC.
4. Na Visão Geral, reconcilie total, concluídas, pendentes, taxa de conclusão no período e Próximos Vencimentos.
5. Confirme que tarefa sem prazo e excluída não entra na taxa por prazo; estados legados devem seguir regra explícita.
6. Crie tarefas vencida, hoje, dentro e fora da antecedência. Confira categoria, gravidade, título, data e deep link no centro de Alertas.
7. Concluir, reabrir, mudar prazo e excluir deve invalidar o alerta corretamente, sem cache ou estado lido/oculto órfão.
8. Teste mais de 500 tarefas elegíveis para alertas em banco descartável. Não aceite truncamento silencioso nem seleção não determinística.
9. Abra tarefa por alerta e pesquisa global, inclusive item fora da primeira página e título duplicado. O ID exato deve prevalecer.
10. Confira atividades recentes/jornada do cliente para criação, edição, conclusão e aplicação de modelo segundo o contrato, sem duplicidade.
11. Confira `audit_logs` para criar, editar, mudar status, excluir, criar/editar/duplicar/excluir/aplicar modelo. Ação, entidade, ID e resultado devem ser corretos.
12. Não reaudite integralmente Calendário, Visão Geral, Alertas ou Pesquisa; cubra somente os efeitos originados por tarefas.

## Fase 11 — Backend, persistência, segurança e desempenho

1. Para cada endpoint, registre método, query, payload, resposta, código HTTP e efeito esperado.
2. Exija validação no servidor para UUID, enums, datas civis reais, limites, campos extras, tipos errados, paginação inteira e intervalos.
3. Confira códigos `400`, `404` e `409` quando aplicáveis, contrato uniforme, mensagem segura e ausência de stack trace/segredo.
4. Verifique criação/atualização/exclusão no SQLite, timestamps, normalização, chaves estrangeiras e cliente derivado.
5. Procure duplicidade de `JOIN` entre cliente direto e cliente do projeto e divergência causada por filtros com precedência inesperada.
6. Teste transações e atomicidade entre tarefa, auditoria, jornada e aplicação de modelo.
7. Recarregue página e reinicie API/Electron para comprovar persistência e invalidação de cache.
8. Teste duas criações, atualizações, transições e exclusões concorrentes no mesmo registro.
9. Faça testes seguros de injeção, XSS persistente/refletido e manipulação de ID. Use conteúdo inerte e permaneça no ambiente autorizado.
10. Meça carregamento com 0, 100, 101 e volume alto; busca, filtros, drag, renderização, deep link e aplicação de 100 etapas.
11. Verifique consultas excessivas, índices/paginação, ordenação determinística e limite 500 do gerador de alertas.
12. Confira logs: ação, entidade, ID, resultado e proteção de dados. Erro forçado deve ser diagnosticável sem expor internals ao usuário.

## Fase 12 — Usabilidade, acessibilidade e consistência visual

1. Percorra todo o fluxo apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home, End e Escape.
2. Confirme alternativa de teclado ao arraste, foco visível, ordem lógica e anúncio de mudança de coluna/status.
3. Ações reveladas em hover também precisam aparecer e funcionar por foco, toque e leitor de tela.
4. Verifique semântica do quadro, colunas, listas, cartões, títulos e contagens. Não dependa somente da posição visual.
5. Confirme labels, `name`, `autocomplete`, instruções, erros associados, `aria-live`, `aria-busy`, foco no erro e retorno após modal/confirmação.
6. Botões apenas com ícone precisam de `aria-label`; ícones decorativos devem ser ignorados.
7. Teste tema claro/escuro, 360, 768, 1024 e 1440 px, zoom 200%, redução de movimento, alto contraste quando disponível e textos longos.
8. Verifique rolagem horizontal do Kanban, sobreposição, corte de cartões/modais, alvos de toque, truncamento e estados hover/active/focus/disabled.
9. Status e prioridade devem possuir texto/ícone equivalente e contraste WCAG 2.2 AA, sem depender apenas de cor.
10. Confira português, `…`, datas pt-BR via `Intl`, singular/plural e consistência de “A Fazer”, “Em Progresso”, “Concluído”, “tarefa” e “checklist”.
11. Sinalize os antipadrões do `AGENTS.md`: `transition: all`, `outline-none` sem substituto, elemento não semântico clicável, campo sem label, botão-ícone sem nome, formato fixo e `autoFocus` injustificado.
12. Execute Axe WCAG 2.2 A/AA no quadro, formulários, confirmação e modelos, complementando com inspeção manual e árvore de acessibilidade. Leitor de tela real deve ser bloqueado se não for operado.

## Fase 13 — Correção e regressão

1. Antes de corrigir, reproduza o defeito e determine a causa raiz.
2. Adicione ou atualize teste automatizado que falhe antes da correção sempre que tecnicamente razoável.
3. Faça a menor alteração coerente no frontend, API, contrato, SQLite, alertas ou consumidores.
4. Não silencie erros, não enfraqueça validação, não aumente limites sem desenho seguro e não introduza fixture especial.
5. Rode testes focados, lint e typecheck; depois execute regressão de API, web, Electron, build e smoke empacotado conforme o risco.
6. Repita manualmente a jornada corrigida e reconcilie interface, API, banco, calendário, painel, alertas, jornada e auditoria.
7. Responsáveis, recorrência, ordenação persistente, restauração, nova política de duplicidade ou mudança ampla do modelo exigem aprovação.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- rota, deep links, quadro, cartões, filtros, período, paginação e estados de UI foram exercitados;
- CRUD, descarte, confirmação, transições, falha otimista, concorrência e exclusão lógica foram comprovados;
- os contratos de tarefa e modelos foram testados positiva e negativamente;
- modelos foram criados, editados, duplicados, excluídos, aplicados e reaplicados com reconciliação;
- Projeto, Cliente, Calendário, Visão Geral, Alertas e Pesquisa foram validados somente nas integrações imediatas;
- correções foram retestadas automaticamente e na interface real;
- nenhum erro novo relevante aparece no console, rede, API ou logs;
- dados sintéticos foram removidos e a limpeza foi comprovada;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- o relatório declara exatamente tudo o que ficou bloqueado ou não aplicável.

## Classificação dos achados

- **P0** — perda/corrupção de tarefas, mutação em dado real, vínculo cruzado grave, exclusão indevida, falha grave de segurança ou aplicativo inutilizável.
- **P1** — tarefa perdida/duplicada, status ou prazo incorreto, aplicação não atômica, total/taxa materialmente incorreto, fluxo principal quebrado ou bloqueio sério de acessibilidade.
- **P2** — busca/filtro/paginação/contador incorreto, validação ausente, cache desatualizado, vínculo inconsistente, erro silencioso ou UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com todos os itens e situações.
3. `ACHADOS.md` com ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
4. `ORACULO-DE-TAREFAS.md` com fixtures, vínculos, predicados, páginas, colunas, contagens, prazos, consumidores e comparação UI/API/banco.
5. `PROTOCOLO-MODELOS-CHECKLIST.md` com modelos/etapas, duplicação, normalização, aplicações, criadas/ignoradas, atomicidade e limpeza.
6. Evidências: capturas, árvore de acessibilidade, logs mínimos, requisições/respostas sanitizadas, consultas e contagens, sem dados sensíveis.
7. Relação de arquivos de código alterados e motivo.
8. Comandos executados e resultados exatos.
9. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
10. Riscos residuais e itens que a Sessão 10 deve retestar.
11. Lista separada de melhorias não implementadas, priorizadas por benefício, esforço e risco.
12. Confirmação da limpeza ou inventário exato dos resíduos com IDs e localizações.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura obtida em números e por fluxo;
- defeitos encontrados por gravidade e quantos foram corrigidos;
- pendências, bloqueios e itens não aplicáveis;
- tarefas, transições, páginas, filtros e aplicações de modelo reconciliados;
- testes executados e resultados exatos;
- confirmação de persistência, atomicidade, auditoria e limpeza;
- links para relatório, matriz, achados, oráculo, protocolo de modelos e evidências;
- recomendação objetiva sobre iniciar ou não a **Sessão 10 — Topografia**.

Não use frases vagas como “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, números, IDs, datas, contratos e evidências.
