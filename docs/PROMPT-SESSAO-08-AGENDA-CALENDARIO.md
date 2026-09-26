# Prompt de auditoria — Sessão 08: Agenda — Calendário

Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop, calendários, datas e fusos horários, integrações OAuth, UX, acessibilidade, integridade de dados e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 08 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **08 — Agenda — Calendário**.
- Módulo/menu: **Agenda — Calendário**.
- Rota principal: **`/calendario`**.
- Rotas de detalhe:
  - `/calendario/compromisso/:id`;
  - `/calendario/tarefa/:id`;
  - `/calendario/projeto/:id` quando gerada ou aceita pela aplicação; o calendário atual também encaminha prazos de projeto diretamente para `/projetos/:id`.
- Parâmetros de URL: `mes=AAAA-MM`, `data=AAAA-MM-DD`, `busca`, `tipo` e `status`.
- Fontes agregadas no calendário:
  - início e entrega de projetos;
  - prazo de tarefas;
  - compromissos cadastrados na Agenda.
- Tipos de compromisso atuais: **Visita de Campo**, **Reunião**, **Ligação**, **Administrativo**, **Serviço**, **Entrega** e **Outro**.
- Visualização real: grade mensal e agenda do dia selecionado. Não presuma visão semanal, diária em timeline, recorrência ou drag-and-drop se não existirem na versão auditada.
- Integrações permitidas: acessar Projetos, Clientes, Tarefas, Alertas, Pesquisa global e Configurações — Google Agenda apenas para criar pré-condições ou comprovar efeitos iniciados ou resumidos pelo Calendário. Não reauditar integralmente esses módulos.
- Foco especial: mês e dia selecionados, navegação temporal, grade, contagens, busca, filtros, ordenação, criação e exclusão com desfazer, detalhes, vínculos, atualização das três fontes, datas civis, horários, eventos de dia inteiro, links para Google Agenda, alertas de compromissos, OAuth, sincronização manual e automática, conflitos, duplicidade, persistência e auditoria.
- Relatórios anteriores obrigatórios:
  - `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`;
  - `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`;
  - `docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md`;
  - `docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md`;
  - `docs/auditorias/2026-09-11-projetos/RELATORIO.md`;
  - `docs/auditorias/2026-09-11-ambiental/RELATORIO.md`;
  - `docs/auditorias/2026-09-12-financeiro/RELATORIO.md`.
- Implementar correções comprovadas: **SIM**.
- Implementar novas funcionalidades ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-agenda-calendario/`.

## Objetivo

Validar de ponta a ponta cada grade, célula de dia, cartão, legenda, filtro, seletor, campo, modal, botão, link, confirmação, detalhe e integração disponível no Calendário. Não aprove uma função porque o código parece correto ou porque a API respondeu HTTP 200. Comprove o resultado na interface real, nos contratos da API, no SQLite, nas entidades de origem, nos alertas, na jornada do cliente, na trilha de auditoria e, quando autorizado, em uma conta Google de QA.

Recalcule intervalos, quantidade de dias, limites de mês, ordem dos eventos, duração do link externo e datas de sincronização fora do código de produção. Corrija somente defeitos reproduzidos e pertencentes ao escopo. Após cada correção, execute teste automatizado focado, reteste manual integrado e regressão proporcional ao risco.

## Limites funcionais e de integração

1. O calendário consolida prazos de Projetos, Tarefas e Compromissos; ele não deve copiar essas entidades para `compromissos` apenas para exibi-las.
2. Somente compromissos próprios podem ser excluídos pelo calendário. Projeto e tarefa devem ser alterados nos módulos de origem.
3. A interface atual não oferece edição visual de compromisso. Audite `PATCH /api/compromissos/:id` como contrato de backend, mas marque edição pela interface como `NÃO APLICÁVEL`, salvo se o recurso existir na versão executada.
4. Não invente recorrência, participantes, endereço estruturado, duração configurável, lembretes locais, notificações por e-mail, visão semanal/diária ou detecção automática de conflito. Procure esses recursos no código e na interface e registre a ausência como `NÃO APLICÁVEL` ou melhoria não implementada.
5. **Adicionar ao Google Agenda** é um link de composição no navegador; ele não prova sincronização bidirecional nem criação concluída na conta externa.
6. A sincronização OAuth só pode ser exercitada de ponta a ponta com uma conta Google e calendário exclusivos de QA. Nunca use a agenda pessoal ou profissional do usuário.
7. Sem conta externa isolada, teste contratos, URL, estado OAuth, proteção dos segredos e comportamento de erro; marque criação/sincronização externa real como `BLOQUEADO`.
8. Não registre Client ID, Client Secret, access token, refresh token, código OAuth ou conteúdo privado de agenda em relatório, captura, log ou fixture versionada.
9. Mudanças de política de espelhamento, resolução de conflito, exclusão remota ou recorrência são decisões de produto. Documente a lacuna e aguarde aprovação em vez de escolher uma política.

## Invariantes temporais e relacionais

Antes da execução, construa um oráculo independente com os resultados esperados. No mínimo, comprove:

- `mes` representa um mês civil real no formato `AAAA-MM`;
- `data` representa uma data civil existente no formato `AAAA-MM-DD`, sem deslocamento por UTC;
- o intervalo mensal começa no primeiro dia e termina no último dia do mês, ambos inclusivos;
- a grade começa no domingo da primeira semana visível e possui quatro, cinco ou seis linhas completas de sete dias conforme o mês;
- navegar para outro mês preserva o dia selecionado quando possível e limita ao último dia quando necessário;
- um projeto pode gerar no máximo dois eventos distintos: início e entrega, somente quando cada data existir no intervalo;
- uma tarefa gera um evento somente quando possui prazo válido e não está excluída;
- um compromisso gera um evento próprio, com horário opcional e vínculo coerente;
- eventos com horário são ordenados cronologicamente; eventos de dia inteiro usam a posição definida pelo contrato sem ordem instável;
- busca e filtros alteram somente a apresentação, não os registros de origem;
- contagem mensal filtrada, contagem total e agenda do dia representam o mesmo conjunto;
- cliente direto e cliente derivado do projeto não podem divergir;
- projeto, tarefa ou compromisso removido não pode reaparecer por cache, junção duplicada ou sincronização indevida;
- no link externo, evento de dia inteiro termina no dia seguinte, porque o fim do Google é exclusivo;
- no link externo, compromisso com hora possui início local correto, duração padrão atualmente definida e `ctz=America/Sao_Paulo`;
- sincronização repetida não duplica evento quando `googleEventId` já está associado;
- eventos externos com `dateTime` respeitam o fuso e não mudam de dia ao serem persistidos;
- falha parcial externa não pode ser apresentada como sucesso integral;
- segredos e tokens permanecem protegidos e nunca retornam pela API de configurações.

Não use os mesmos helpers de produção para calcular os resultados esperados. Registre data/hora local, ISO externo, intervalo consultado, origem, resultado esperado, UI, API e banco.

## Dados mínimos obrigatórios

Crie tudo somente em banco, perfil e diretórios descartáveis, com prefixo único `QA-AUDIT-S08-[DATA-HORA]-`:

1. Dois clientes ativos sintéticos e dois projetos, um por cliente.
2. Projeto com início e entrega no mesmo mês, projeto atravessando meses, projeto somente com início, projeto somente com entrega e projeto sem datas.
3. Projeto com data no primeiro e no último dia do mês, além de um em 29 de fevereiro de ano bissexto.
4. Tarefa pendente, em progresso e concluída com prazo; tarefa sem prazo; tarefa excluída logicamente; prazos ontem, hoje, amanhã e nas bordas do mês.
5. Compromissos dos sete tipos atuais, distribuídos pelo mês.
6. Um compromisso geral, um ligado somente ao cliente e um ligado ao projeto com cliente derivado.
7. Tentativas de compromisso com projeto de outro cliente, cliente/projeto removido e UUID inexistente.
8. Compromisso de dia inteiro e compromissos em `00:00`, `09:00`, `12:30` e `23:59`.
9. Vários eventos de todas as origens no mesmo dia, incluindo títulos iguais e horários iguais, para testar ordenação e agrupamento.
10. Compromisso para excluir e restaurar pelo **Desfazer**, além de outro para excluir pelo detalhe.
11. Títulos e descrições com acentos, espaços nas bordas, texto longo e conteúdo HTML/JavaScript inerte.
12. Casos de data e hora inválidas: vazio, formato incorreto, 29/02 inválido, `24:00`, `23:60`, valor parcial e texto.
13. Eventos que produzam alertas vencido, hoje, dentro e fora da janela configurada.
14. Volume próximo e acima dos limites de 500 compromissos e 500 eventos derivados, somente em banco descartável, para testar truncamento, desempenho e comunicação ao usuário.
15. Estados de zero dados, dados parciais, filtro sem resultado, carregamento, resposta lenta, falha isolada de cada uma das três APIs, reconexão e dados legados normalizáveis.
16. Se houver conta Google de QA: evento local novo, local alterado, externo novo, externo alterado, evento externo com hora/fuso, evento de dia inteiro, ID remoto ausente, evento remoto removido e sincronização paginada acima de 250 itens quando viável.

Antes de mutar, prepare uma tabela-oráculo por dia e por origem. Não reutilize dados pessoais nem compromissos reais.

## Regras de escopo e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis e siga as Web Interface Guidelines do projeto.
2. Leia integralmente os sete relatórios anteriores. Reteste somente correções, integrações e riscos que afetem diretamente o Calendário.
3. Da Sessão 07, mantenha como riscos herdados: leitor de tela/alto contraste, matriz visual/zoom, offline/reconexão, meia-noite real, volume produtivo, concorrência multiprocesso/lock SQLite e upgrade de instalação. Exercite os relevantes a datas e sincronização; mantenha bloqueio honesto quando o ambiente não permitir.
4. Trabalhe somente nesta sessão. Abra outro módulo apenas para criar uma origem ou provar a atualização do Calendário e registre o motivo.
5. Não pare após fazer um plano ou ler o código. Use a aplicação real e confronte interface, rede, API, SQLite, origem do evento, alertas e logs.
6. Todo item inventariado deve terminar como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com justificativa e evidência.
7. Não confunda o link de composição do Google com a integração OAuth bidirecional. Produza evidências separadas.
8. Endpoints ou estados sem controle visual devem ser inventariados como backend e claramente separados do fluxo principal.
9. Preserve alterações preexistentes. Registre o estado inicial do Git e não reverta trabalho de terceiros.
10. Faça correções mínimas ligadas à causa raiz. Não redesenhe o calendário nem crie funções novas.
11. Melhorias não corretivas devem ser listadas separadamente por benefício, esforço e risco e não podem ser implementadas sem aprovação.
12. Mocks podem apoiar testes unitários do provedor Google, mas não comprovam OAuth ou sincronização externa real. Identifique claramente cada nível de evidência.
13. Envie atualizações curtas ao concluir inventário, grade/navegação, filtros/fontes, compromissos, detalhes, Google Agenda, backend/persistência, correções e regressão.

## Segurança dos dados de teste

1. Identifique banco, perfil Electron, diretório de dados, porta de callback e serviço realmente usados. Nunca presuma qual banco está ativo.
2. Detecte dados reais antes de mutar. Use banco, perfil e agenda externa totalmente isolados.
3. Antes da primeira mutação, produza backup ou snapshot verificável e registre caminho, tamanho, data e SHA-256 quando aplicável.
4. Nunca edite ou exclua cliente, projeto, tarefa ou compromisso preexistente do usuário.
5. Antes de excluir ou sincronizar, confira ID, título, data, horário, origem, cliente, projeto e prefixo exatos.
6. Não conecte a conta Google pessoal do usuário. Não habilite sincronização externa sem credenciais e calendário de QA autorizados.
7. O callback OAuth deve permanecer no loopback esperado. Não redirecione tokens ou códigos para host externo.
8. Use credenciais efêmeras ou de QA fora do repositório e remova-as do banco descartável ao final.
9. Não capture telas do provedor contendo conta, e-mail, calendários privados, códigos ou consentimentos sensíveis.
10. Ao final, remova somente os dados sintéticos e confirme ausência de compromissos, IDs Google, tokens, eventos remotos, alertas, jornadas e auditorias órfãs.
11. Se um defeito impedir a limpeza externa, não faça exclusão em massa. Registre cada resíduo de QA com ID local/remoto e calendário afetado.

## Fase 1 — Preparação e linha de base

1. Identifique Electron, React/Vite, API Fastify, Drizzle/SQLite, contratos de calendário, serviço Google, scheduler, alertas, cofre local, portas e suítes aplicáveis.
2. Verifique Git, processos ativos, logs recentes e saúde da aplicação sem encerrar processos não identificados.
3. Confirme que frontend, API, SQLite, scheduler e perfil Electron pertencem à mesma instância isolada.
4. Registre versão, commit, worktree, sistema operacional, fuso, locale, data/hora, viewport, zoom, tema, banco e estado da integração Google.
5. Capture a linha de base de `compromissos`, `projetos`, `tarefas`, `clientes`, `configuracoes`, `interacoes_cliente`, alertas, `audit_logs` e logs operacionais de sincronização.
6. Registre contagens por origem e dia, datas de borda, IDs Google existentes, erros no console/rede e falhas dos logs.
7. Crie `docs/auditorias/[AAAA-MM-DD]-agenda-calendario/` para relatório, matriz, oráculo temporal, evidências e, se aplicável, protocolo de limpeza externa.

## Fase 2 — Inventário obrigatório

Antes de testar, produza uma matriz contendo:

- ID do item;
- rota, parâmetro, tela, modal, seletor ou integração;
- origem do evento: projeto, tarefa, compromisso ou Google;
- ação e resultado esperado;
- componente do frontend;
- endpoint, método, query, payload e resposta;
- tabelas, vínculos, cache, jornada, alerta, auditoria e efeito externo;
- cenários positivo, negativo, vazio, carregamento, lentidão, erro, concorrência e recuperação;
- situação e evidência.

Varra interface e código para localizar elementos condicionais: mês/data na URL, dias externos ao mês, mês com quatro/cinco/seis semanas, marcador de hoje, eventos excedentes, agenda vazia ou filtrada, tipos/status derivados, erro parcial, popovers, seletor de horário, dia inteiro, aviso de formulário sujo, confirmação de exclusão, toast **Desfazer**, ações conforme origem, detalhes e links Google.

Inventarie, se existirem na versão auditada, pelo menos estes contratos:

- `GET /api/projetos/calendar?inicio=&fim=`;
- `GET /api/tarefas/calendar?inicio=&fim=`;
- `GET /api/compromissos?inicio=&fim=`;
- `GET /api/compromissos?clienteId=`;
- `GET /api/compromissos?projetoId=`;
- `GET /api/compromissos/:id`;
- `POST /api/compromissos`;
- `PATCH /api/compromissos/:id`;
- `DELETE /api/compromissos/:id`;
- endpoints de opções de clientes e projetos usados no formulário;
- endpoint de projeto e de tarefa usados pelas telas de detalhe;
- endpoints de alertas que materializam compromissos;
- `GET /api/configuracoes` e `PATCH /api/configuracoes`, apenas nos campos Google;
- `GET /api/google/status`;
- `GET /api/google/auth-url`;
- `GET /api/google/callback`;
- `POST /api/google/sync`;
- execução periódica do scheduler de sincronização.

## Fase 3 — Rota, URL e navegação temporal

1. Abra `/calendario` pelo menu, URL direta, módulo Agenda, pesquisa global e alerta de compromisso.
2. Teste `mes` e `data` válidos no mesmo mês e em meses diferentes. Defina qual parâmetro prevalece e confirme a URL canônica.
3. Teste parâmetros ausentes, duplicados, codificados, data/mês inválidos, dia inexistente, mês `00`/`13`, ano de borda e parâmetros desconhecidos.
4. Teste voltar/avançar e recarregar depois de mudar mês, dia, busca e filtros. Estado visual, URL e intervalo requisitado devem coincidir.
5. Navegue por mês anterior, próximo, seletor de mês/ano, **Hoje**, dias externos ao mês e troca de ano.
6. Teste 31 → fevereiro, 30 → fevereiro, 29/02 em ano bissexto, dezembro → janeiro e janeiro → dezembro.
7. Confirme que cada mudança consulta exatamente o primeiro e o último dia do mês visível e cancela/ignora resposta obsoleta de navegação rápida.
8. Teste sequência rápida entre vários meses, resposta fora de ordem, recarga, deep link e retorno do detalhe.
9. Procure tela em branco, flash de mês errado, seleção fora da grade, foco perdido, requisição duplicada e carregamento infinito.

## Fase 4 — Grade mensal e agenda do dia

1. Confira título do mês, cabeçalhos Dom–Sáb, primeiro/último dia visível, quantidade de semanas e alinhamento correto de cada data.
2. Valide dia atual, dia selecionado, dias externos e dias com eventos em tema claro/escuro sem depender apenas de cor.
3. Compare cada evento da grade e da agenda lateral com o oráculo, API e banco.
4. Para projetos, confira separadamente **Início** e **Entrega**, título, cliente e link para o projeto exato.
5. Para tarefas, confira título, status, cliente, projeto, prazo e link para `/calendario/tarefa/:id`.
6. Para compromissos, confira tipo, hora ou dia inteiro, descrição, cliente, projeto, link, botão Google e exclusão.
7. Valide ordenação no mesmo dia: horários crescentes, empates determinísticos e posição dos eventos sem horário.
8. Teste mais de dois eventos no desktop e mais de três marcadores no móvel. O indicador `+N` e a agenda do dia devem representar todos os eventos.
9. Confira total mensal, total filtrado, singular/plural e `aria-live` após mudança de filtro, mês e mutação.
10. Teste dia sem eventos, mês vazio, evento somente em dia externo, fonte parcial e muitos eventos.
11. Verifique legenda de cores, tipos adicionais e alternativa textual. A legenda não pode afirmar cobertura incompleta ou depender somente de cor/letra.
12. Confirme que projeto/tarefa não exibem exclusão e que compromisso exibe apenas ações realmente permitidas.

## Fase 5 — Busca, filtros e erro parcial

1. Busque por título, descrição, tipo, status, cliente e projeto em cada origem.
2. Teste acentos, caixa, espaços, termo parcial, caracteres especiais inertes, texto longo e inexistente.
3. Teste filtros de tipo e status isolados e combinados com busca, dia e mês.
4. Confirme tipos dinâmicos e status: Projeto/Início/Entrega, Tarefa/seus status e Compromisso/Agendado.
5. Teste valor de filtro válido, legado, inexistente e adulterado na URL; não aceite filtro invisível sem comunicação.
6. Use **Limpar filtros** na barra e no estado vazio do dia; confirme URL e contagens.
7. Faça falhar isoladamente Projetos, Tarefas e Compromissos. As demais fontes devem permanecer visíveis, com aviso que identifique a fonte indisponível e botão de repetição.
8. Durante repetição e reconexão, não duplique eventos nem substitua dados válidos por vazio falso.
9. Confirme que filtros são client-side somente dentro do mês carregado e que a interface não sugere busca global fora desse intervalo.

## Fase 6 — Criar compromisso

1. Abra **Agendar compromisso** após selecionar diferentes dias, inclusive dia externo ao mês; a data inicial do formulário deve ser correta.
2. Exercite título, tipo, data, horário, dia inteiro, cliente, projeto e descrição.
3. Percorra todos os tipos disponíveis e teste valor desconhecido diretamente na API.
4. Teste seletor de mês/ano, calendário do formulário, dias com evento, botão **Hoje**, troca de ano e retorno de foco.
5. Teste seletor de horário por digitação, setas, Enter, Escape, intervalos de 15 minutos e predefinições **Agora**, **+30 min**, `09:00`, `13:30` e `18:00`.
6. Teste `00:00`, `23:59`, `9`, `930`, `09:30`, entrada parcial, letras, `24:00`, `23:60` e colagem.
7. Marque/desmarque dia inteiro e confirme remoção/restauração coerente do horário, estado disabled, nome acessível e payload `null`.
8. Selecione cliente e projeto em todas as ordens; projeto deve derivar o cliente correto, e trocar cliente deve limpar projeto incompatível.
9. Tente projeto de outro cliente, cliente/projeto inexistente, removido e vínculo cruzado diretamente na API.
10. Teste título/descrição vazios, espaços, limites exatos, texto além do limite, acentos, emoji e conteúdo HTML/JavaScript inerte.
11. Teste data vazia, formato inválido, calendário impossível e período extremo seguro.
12. Confirme erro inline, associação acessível, foco no primeiro erro, mensagem de API e recuperação sem perder campos.
13. Teste fechar por botão, Escape, clique externo e navegação com/sem alterações; cancele e confirme o descarte.
14. Faça duas submissões rápidas e simultâneas. Deve existir um único compromisso ou uma política explícita de duplicidade.
15. Após salvar, confira seleção do dia criado, atualização da grade/agenda/contagem, toast, API, banco, jornada do cliente e auditoria.
16. Recarregue e reinicie o serviço para provar persistência.

## Fase 7 — Detalhes e atualização das origens

1. Abra detalhes de projeto, tarefa e compromisso pela agenda e por URL direta.
2. Teste tipo e ID válidos, UUID inválido, ID inexistente, removido, tipo incorreto e tipo desconhecido. Uma rota desconhecida não deve ser tratada silenciosamente como compromisso.
3. Confira título, rótulo da origem, descrição, data, hora, período do projeto, status/prioridade da tarefa, cliente e projeto.
4. Teste campos ausentes, dados legados inválidos e textos longos sem quebrar layout.
5. Valide links de retorno, projeto e cliente, preservando contexto quando previsto.
6. Altere datas do projeto no módulo de origem e confirme inclusão, movimentação ou remoção imediata dos eventos do calendário.
7. Crie, edite, conclua, reabra e remova uma tarefa sintética no módulo de origem apenas para comprovar o reflexo no calendário; a auditoria completa de Tarefas fica para a Sessão 09.
8. Audite `PATCH /api/compromissos/:id` diretamente: cada campo, PATCH parcial, vazio, inválido, vínculo cruzado, entidade removida, timestamp, jornada e auditoria.
9. Confirme que detalhe de tarefa não exige carregar uma coleção ilimitada nem seleciona registro errado em duplicidade/paginação; se essa for a implementação atual, meça e classifique o risco.
10. Após mudanças, valide cache/invalidação e retorno ao mês/dia corretos.

## Fase 8 — Exclusão, desfazer e atomicidade

1. Na agenda do dia, abra a confirmação, cancele uma vez e confirme em outra.
2. Antes de excluir, valide título e ID exatos do compromisso sintético.
3. Confirme remoção otimista, resposta da API, grade, agenda, contagem, detalhe, banco, jornada e auditoria.
4. Use **Desfazer** dentro do prazo. Determine se a restauração preserva ou recria ID, `googleEventId`, timestamps, vínculos e histórico; não chame de restauração perfeita se recriar outra entidade.
5. Tente **Desfazer** após falha, após expirar o toast, duas vezes e enquanto outra exclusão ocorre.
6. Exclua outro compromisso pela tela de detalhe, cancelando e confirmando. Confira a mensagem de irreversibilidade e o retorno ao calendário.
7. Teste `DELETE` com ID inexistente, inválido, repetido e tentativa de usar ID de projeto/tarefa.
8. Simule falha da API após a remoção otimista; o item deve voltar uma única vez, na ordem correta, com mensagem acionável.
9. Force falha de auditoria em banco descartável. Exclusão, jornada e auditoria devem ser atômicas.
10. Se houver evento sincronizado, comprove a política real de exclusão local/remota e o comportamento no próximo sync. Não apague evento remoto fora do calendário de QA.

## Fase 9 — Link “Adicionar ao Google Agenda”

1. Teste o link na grade/dia e no detalhe para projeto, tarefa, compromisso com hora e compromisso de dia inteiro.
2. Analise a URL antes de abrir: domínio HTTPS correto, `action=TEMPLATE`, título, descrição, cliente/projeto, datas e `ctz=America/Sao_Paulo`.
3. Confira codificação de acentos, quebras de linha, `&`, `?`, `#`, aspas, emoji e texto longo.
4. Para dia inteiro, confirme início na data civil e fim exclusivo no dia seguinte, inclusive fim de mês/ano e 29/02.
5. Para evento com hora, confirme início local, duração padrão atual de uma hora e travessia de meia-noite.
6. Teste bloqueio de popup/navegador indisponível e garanta que clicar não muta o banco local.
7. Se a criação for concluída numa conta Google de QA, confirme manualmente data, hora, fuso, título e descrição; remova o evento remoto ao final.
8. Registre como melhoria, sem implementar, eventual necessidade de duração, localização ou convidados configuráveis.

## Fase 10 — OAuth e sincronização Google

### Configuração e segredos

1. Acesse somente a seção Google Agenda em Configurações e registre o motivo da integração.
2. Teste estados não configurado, configurado/desconectado, conectado, sincronizando, sucesso, erro e reconexão.
3. Salve Client ID e Client Secret somente no perfil isolado; confira que o segredo é protegido pelo cofre local e nunca retorna em `GET /api/configuracoes`.
4. Teste segredo vazio na primeira configuração, preservação de segredo existente, valor mascarado, limites, erro e descarte de alterações.
5. Inspecione banco, logs, auditoria, diagnóstico, backup de QA e respostas para confirmar ausência de segredo/token em claro.
6. Teste desconectar, cancelar confirmação, confirmar e repetir. Tokens devem ser removidos e sync desativado sem apagar compromissos.

### OAuth

1. Valide `/api/google/auth-url`: HTTPS, domínio Google, escopo mínimo necessário, redirect loopback correto, `state` imprevisível, uso único e expiração.
2. Teste callback com sucesso em conta de QA, código ausente, erro do provedor, `state` ausente, inválido, expirado, reutilizado e código inválido.
3. Confirme mensagem segura no callback, ativação do sync somente após autenticação válida e ausência de código/token na URL ou log após concluir.
4. Teste polling da interface: sucesso, timeout, falhas transitórias, desmontagem do componente e ausência de intervalos órfãos.

### Sincronização manual e automática

1. Com provedor controlado e, quando permitido, conta de QA, teste local → Google e Google → local separadamente.
2. Local → Google: novo, alteração, evento com ID remoto válido e ID remoto removido/404. Confirme recriação única e atualização de `googleEventId`/`ultimoSyncGoogle`.
3. Confirme que horário e dia inteiro são preservados. Evento com hora não pode virar dia inteiro silenciosamente.
4. Google → local: evento de dia inteiro, com `dateTime` e fuso, sem título, sem descrição, alterado e novo.
5. Teste evento próximo da meia-noite em UTC negativo/positivo; persista o dia civil correto em `America/Sao_Paulo`.
6. Teste paginação externa acima de 250 itens ou simulação fiel do contrato, sem perda nem duplicidade.
7. Execute sync repetido sem alterações; `sent` e `received` devem ser zero ou coerentes, sem duplicar registros.
8. Teste edição concorrente local/remota, exclusão local, exclusão remota e mudanças nas duas pontas. Documente a política efetiva de precedência e perda de dados.
9. Faça uma etapa falhar após outras terem sucesso. A resposta deve indicar sincronização parcial, contagens verdadeiras e caminho de recuperação, sem alegar rollback inexistente.
10. Confirme que a sincronização automática respeita `googleSyncActive`, não roda sem autenticação, não sobrepõe execução em andamento e registra sucesso/falha no log operacional.
11. Teste intervalo de 15 minutos com relógio controlado ou fake timer; não aguarde tempo real desnecessariamente.
12. Após reiniciar o serviço, confira recuperação segura dos tokens protegidos, continuidade controlada e ausência de sync não autorizado.

## Fase 11 — Alertas e integrações imediatas

1. Crie compromissos vencido, hoje, futuro dentro e fora da antecedência configurada.
2. Confira categoria, gravidade, título, descrição, data e deep link `/calendario/compromisso/:id` no centro de alertas.
3. Teste adiar, dispensar ou resolver somente se essas ações existirem no alerta atual e forem seguras com dados sintéticos.
4. Após editar ou excluir compromisso, confirme atualização/remoção do alerta sem órfão.
5. Compare calendário, alerta e pesquisa global para o mesmo ID.
6. Confirme que mudanças no compromisso aparecem na jornada do cliente/projeto sem duplicidade e que vínculos permanecem íntegros.
7. Não reaudite todos os alertas, Clientes, Projetos ou Pesquisa global; cubra apenas o caminho iniciado pelo calendário.

## Fase 12 — Backend, persistência, segurança e desempenho

1. Para cada endpoint, registre método, query, payload, resposta, código HTTP e efeito esperado.
2. Teste schemas estritos, campos extras, tipos errados, limites, datas/horas reais, UUIDs e intervalos invertidos. Validação apenas no frontend não é suficiente.
3. Confirme `404` para inexistente/removido, `400` para entrada inválida e `409` para conflito quando aplicável, com mensagens seguras e consistentes.
4. Verifique criação/atualização/exclusão no banco, timestamps, normalização, chaves estrangeiras e cliente derivado do projeto.
5. Procure duplicidade causada por `JOIN` entre cliente direto e cliente do projeto; um compromisso deve aparecer uma vez.
6. Confirme que projetos/tarefas excluídos não entram no calendário e que status encerrado segue a regra real documentada.
7. Teste transações e atomicidade entre compromisso, jornada e auditoria.
8. Recarregue a tela e reinicie API/Electron para comprovar persistência e retomada do mês/dia.
9. Teste duas criações, atualizações e exclusões concorrentes sobre o mesmo registro.
10. Faça testes seguros de injeção, XSS, manipulação de ID, open redirect no OAuth, CSRF/state, exposição de segredo e abuso do callback. Use conteúdo inerte e permaneça no ambiente autorizado.
11. Meça carregamento do mês, renderização com muitos eventos, troca rápida de mês, busca/filtro e detalhe de tarefa.
12. Valide limites de 500 itens: não pode haver truncamento silencioso. Se o produto não pagina, exiba o risco e proponha solução sem implementá-la como nova função.
13. Confira logs e auditoria: ação, entidade, ID, resultado e dados sensíveis protegidos.

## Fase 13 — Usabilidade, acessibilidade e consistência visual

1. Percorra tudo somente com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home, End, Page Up, Page Down e Escape.
2. Na grade, confirme padrão de foco móvel, um único `tabIndex=0`, `role=grid`, linhas/células, `aria-selected`, `aria-current` e rótulo completo com data/quantidade.
3. Teste teclado atravessando semana, mês e ano; o foco deve acompanhar a seleção inclusive após carregar o novo mês.
4. Nos popovers, confirme abertura, foco inicial, navegação, escolha, Escape, clique externo, retorno de foco e ausência de conteúdo inacessível fora da tela.
5. Verifique nomes acessíveis, labels, instruções, erros associados, `aria-live`, `aria-busy`, confirmação e anúncio de criação/exclusão/desfazer.
6. Botões apenas com ícone precisam de `aria-label`; ícones decorativos devem ser ignorados.
7. Teste tema claro/escuro, 360, 768, 1024 e 1440 px, zoom de 200%, redução de movimento, alto contraste quando disponível e textos longos.
8. Verifique rolagem horizontal controlada da grade em 360 px, sobreposição, truncamento, corte de popover/modal, alvos de toque e estados hover/active/focus/disabled.
9. Cores de origem e status precisam de texto/ícone equivalente e contraste WCAG 2.2 AA.
10. Confira português, `…`, datas/horas pt-BR via `Intl`, nomes dos tipos, singular/plural e consistência entre “Agenda”, “Calendário” e “Google Agenda”.
11. Sinalize os antipadrões do `AGENTS.md`: `transition: all`, `outline-none` sem foco substituto, elemento não semântico clicável, campo sem label, botão-ícone sem nome, formato fixo e `autoFocus` injustificado.
12. Execute Axe WCAG 2.2 A/AA na grade, modal, popovers e três tipos de detalhe, complementando com inspeção manual e árvore de acessibilidade. Leitor de tela real deve ser bloqueado se não for operado.

## Fase 14 — Correção e regressão

1. Antes de corrigir, reproduza o defeito e determine a causa raiz.
2. Adicione ou atualize teste automatizado que falhe antes da correção sempre que tecnicamente razoável.
3. Faça a menor alteração coerente no frontend, API, contrato, data/fuso, banco ou sincronização.
4. Não silencie falhas parciais, não enfraqueça validação/OAuth e não introduza fixture especial para o teste passar.
5. Rode testes focados, lint e typecheck; depois execute regressão de API, web, Electron, build e smoke empacotado conforme o risco.
6. Repita manualmente a jornada corrigida e reconcilie interface, API, banco, origem, alerta, jornada e auditoria.
7. Alteração de escopo OAuth, política de espelhamento, conflito ou exclusão remota exige decisão de produto e aprovação.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- rota, parâmetros, mês, dia, grade, agenda lateral, busca, filtros, popovers e detalhes foram exercitados;
- as três fontes foram reconciliadas com API, SQLite e oráculo temporal;
- criação, vínculo, persistência, exclusão, falha otimista e desfazer foram comprovados;
- links externos foram validados sem alterar agenda pessoal;
- OAuth/sync foram testados no nível possível e todo bloqueio externo foi declarado;
- alertas, pesquisa e módulos de origem imediatamente afetados foram verificados;
- correções foram retestadas automaticamente e na interface real;
- nenhum erro novo relevante aparece no console, rede, API, scheduler ou logs;
- dados locais, credenciais e eventos externos sintéticos foram removidos e a limpeza foi comprovada;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- o relatório declara exatamente tudo o que ficou bloqueado ou não aplicável.

## Classificação dos achados

- **P0** — perda/corrupção de compromissos, sincronização que altera agenda externa fora do escopo, vazamento de segredo/token, vínculo cruzado grave ou aplicativo inutilizável.
- **P1** — data/fuso incorreto, evento duplicado/perdido, exclusão ou sync destrutivo, fluxo principal quebrado, OAuth inseguro, operação não atômica ou bloqueio sério de acessibilidade.
- **P2** — filtro/contagem/navegação incorreta, validação ausente, erro parcial enganoso, vínculo inconsistente, cache desatualizado ou UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com todos os itens e situações.
3. `ACHADOS.md` com ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
4. `ORACULO-TEMPORAL.md` com fixtures, intervalos, grade esperada, eventos por origem, ordem, links Google e comparação UI/API/banco.
5. `PROTOCOLO-GOOGLE-AGENDA.md` com nível testado, conta/calendário de QA sanitizados, casos OAuth/sync, conflitos, bloqueios e limpeza externa; não inclua segredos.
6. Evidências: capturas, árvore de acessibilidade, URLs sanitizadas, logs mínimos, requisições/respostas, consultas e contagens, sem dados sensíveis.
7. Relação de arquivos de código alterados e motivo.
8. Comandos executados e resultados exatos.
9. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
10. Riscos residuais e itens que a Sessão 09 deve retestar.
11. Lista separada de melhorias não implementadas, priorizadas por benefício, esforço e risco.
12. Confirmação da limpeza local/externa ou inventário exato dos resíduos com IDs e localizações.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura obtida em números e por origem de evento;
- defeitos encontrados por gravidade e quantos foram corrigidos;
- pendências, bloqueios e itens não aplicáveis;
- meses/dias, eventos e ordenações reconciliados;
- nível real de comprovação da integração Google: link, contrato simulado ou OAuth/sync externo;
- testes executados e resultados exatos;
- confirmação de persistência, atomicidade, auditoria e limpeza local/externa;
- links para relatório, matriz, achados, oráculo, protocolo Google e evidências;
- recomendação objetiva sobre iniciar ou não a **Sessão 09 — Agenda — Tarefas**.

Não use frases vagas como “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, números, IDs, datas, horas, fusos, contratos e evidências.
