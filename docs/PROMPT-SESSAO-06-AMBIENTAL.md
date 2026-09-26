# Prompt de auditoria — Sessão 06: Ambiental

Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop, gestão ambiental, licenciamento, condicionantes, cálculos territoriais, documentos técnicos, UX, acessibilidade, integridade de dados e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 06 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **06 — Ambiental**.
- Módulo/menu: **Ambiental**.
- Rota principal: **`/ambiental`**.
- Rotas de detalhe: **`/ambiental/:id`** para demandas e perícias e **`/ambiental/licencas/:id`** para licenças.
- Redirecionamentos legados: **`/licenciamento` → `/ambiental?tab=licenciamento`** e **`/calculadora-ambiental` → `/ambiental?tab=car`**.
- Abas principais: `tab=ambiental`, `tab=licenciamento` e `tab=car`.
- Cadastro de demanda: `tab=ambiental&action=new`, com uso do formulário de Projeto no contexto ambiental.
- Abas do detalhe da licença: `tab=overview`, `tab=conditions`, `tab=documents` e `tab=history`.
- Deep link de condicionante: parâmetro `condicionante=[ID]` no detalhe da licença.
- Integrações permitidas: acessar Projetos, Clientes, Propriedades, Tarefas, Documentos, Alertas, Visão Geral e Relatórios somente para comprovar efeitos iniciados ou resumidos pelo Ambiental. Não reauditar integralmente esses módulos.
- Foco especial: demandas ambientais, perícias, fases, histórico, próximas ações, conclusão, laudos PDF, licenças, validade efetiva, renovação, condicionantes, comprovantes, alertas de prazo, Análise CAR, memória do cálculo, histórico salvo, persistência e integridade dos vínculos.
- Relatórios anteriores obrigatórios:
  - `docs/auditorias/2026-09-07-visao-geral/RELATORIO.md`
  - `docs/auditorias/2026-09-07-comercial-clientes/RELATORIO.md`
  - `docs/auditorias/2026-09-08-comercial-crm-funil/RELATORIO.md`
  - `docs/auditorias/2026-09-10-comercial-orcamentos/RELATORIO.md`
  - `docs/auditorias/2026-09-11-projetos/RELATORIO.md`
- Implementar correções comprovadas: **SIM**.
- Implementar novas funcionalidades ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-ambiental/`.

## Objetivo

Validar de ponta a ponta cada tela, aba, cartão, indicador, filtro, campo, seletor, modal, menu, botão, link, cálculo, histórico, PDF e ação disponível no módulo Ambiental. Não aprove uma função porque o código parece correto ou porque a API respondeu HTTP 200. Comprove o resultado na interface real, no contrato da API, no banco SQLite e, quando aplicável, no projeto vinculado, no histórico, nos alertas, no arquivo PDF e na trilha de auditoria.

Recalcule datas, prazos, quantidades, Reserva Legal de referência, vegetação computável, déficit e excedente fora do código de produção, usando dados conhecidos. Corrija somente defeitos reproduzidos e pertencentes ao escopo. Após cada correção, execute teste automatizado focado, reteste manual integrado e regressão proporcional ao risco.

## Limite técnico e jurídico da Análise CAR

A Análise CAR é uma **triagem quantitativa preliminar**, não uma certificação de regularidade ambiental. Ela não substitui análise técnica, espacial, documental ou decisão do órgão competente. Não declare conformidade legal somente pelo resultado da calculadora.

Antes de aprovar percentuais, datas de referência ou textos jurídicos, confronte-os com fontes oficiais vigentes na data da auditoria, registrando órgão, documento, versão, data de consulta e link. Priorize legislação oficial e orientações oficiais do órgão ambiental competente. Se houver divergência normativa ou interpretação ambígua, classifique o item como bloqueado por decisão técnica/jurídica e proponha a alteração; não mude regra legal ou interpretação de produto sem aprovação expressa.

## Dados mínimos obrigatórios

Crie tudo somente em banco, perfil e diretórios descartáveis, com prefixo único `QA-AUDIT-S06-[DATA-HORA]-`:

1. Dois clientes ativos sintéticos e um cliente inativo/removido somente se o banco descartável permitir.
2. Uma propriedade rural do cliente principal e outra propriedade pertencente ao segundo cliente.
3. Uma demanda do tipo Ambiental e uma do tipo Perícia, com projetos especializados e dados conhecidos.
4. Demandas com status de trabalho aberto, suspenso, concluído e cancelado, em cenários independentes.
5. Demandas ambientais distribuídas pelas fases `Levantamento inicial`, `Documentação`, `Protocolo`, `Em análise`, `Atendimento de exigência`, `Vistoria`, `Deferido`, `Indeferido` e `Concluído`, quando viável.
6. Uma demanda com tarefa atrasada, uma com tarefa futura, uma com tarefa concluída e uma sem tarefa, para validar a próxima ação.
7. Andamentos manuais com título, descrição, data e categoria conhecidos e eventos automáticos de mudança de fase.
8. Licenças LP, LI, LO, Renovação e Outros, vinculadas a projetos sintéticos.
9. Licenças com vencimento ontem, hoje, em 30, 60, 90, 120 e 121 dias, considerando o fuso local.
10. Licenças nos estados registrados `Em análise`, `Válida`, `Em renovação`, `Suspensa`, `Vencida` e `Encerrada`; inclua uma licença registrada como válida, mas efetivamente vencida pela data.
11. Condicionantes Pendente, Em andamento, Cumprida, Vencida e Dispensada; use prazos passado, hoje, futuro e ausente.
12. Uma condicionante marcada como cumprida com data e comprovante, outra vencida por cálculo de prazo e outra dispensada.
13. Um registro por faixa de vencimento e quantidade conhecida para recalcular Válidas, Vencidas, Até 120 dias, Em renovação, Condicionantes pendentes e Condicionantes vencidas.
14. Quatro cenários-base da calculadora com imóvel de 100 ha: demais regiões, Amazônia Legal — floresta, cerrado e campos gerais.
15. Cenários do art. 15 com nenhuma, parte e todas as condições declarativas marcadas.
16. Cenários do art. 67 com até quatro módulos fiscais, imóvel existente em 22/07/2008, remanescente inferior, igual e superior à regra geral.
17. Cenário do art. 68 com indicação de possível conformidade histórica, sem transformá-lo em conclusão automática.
18. Entradas CAR inválidas: total vazio, zero, negativo, texto, infinito/valor extremo seguro, APP negativa ou maior que o imóvel, vegetação maior que o imóvel, soma superior ao total, módulos inválidos e remanescente incompatível.
19. Cálculos ambientais salvos sem vínculo, vinculados a cliente, vinculados a projeto compatível e com tentativa de cliente/projeto incompatíveis.
20. PDFs dos quatro tipos disponíveis: Vistoria Técnica, Monitoramento de Fauna, Inventário Florestal e Laudo Ambiental Genérico; inclua texto longo, acentos e nome de projeto com caracteres especiais seguros.
21. Alertas de licença e condicionante vencida, vencendo hoje, futura dentro da antecedência configurada e fora da janela.
22. Estados de zero dados, dados parciais, busca sem resultado, carregamento, resposta lenta, erro da API, reconexão, texto longo e dados legados normalizáveis.

Defina antes da execução uma tabela com resultados esperados de prazos, status efetivo, contadores e cálculos. Não derive o valor esperado usando as mesmas funções de produção que estão sendo testadas.

## Regras de escopo e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis e siga as Web Interface Guidelines do projeto.
2. Leia integralmente os cinco relatórios anteriores. Reteste somente correções, integrações e riscos que afetem diretamente o Ambiental.
3. Considere as correções da Sessão 05 sobre projetos especializados, cliente/propriedade, datas, status, exclusão e integridade relacional como pré-condições; não as presuma válidas sem uma amostra integrada.
4. Mantenha como risco herdado o smoke do pacote bloqueado pela Configuração Inicial. Não atribua ao Ambiental uma falha externa sem reproduzir sua causa.
5. Trabalhe somente nesta sessão. Abra outro módulo apenas para provar consequência criada pelo Ambiental e registre o motivo.
6. Não pare após planejar ou ler o código. Use a aplicação real e confronte interface, rede, API, banco, PDF, alertas e logs.
7. Todo item inventariado deve terminar como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com justificativa e evidência.
8. Não presuma a existência de mapa, análise geométrica, upload direto no detalhe da licença, protocolo eletrônico com órgão ou emissão oficial de licença. Varra interface e código; registre recursos inexistentes como `NÃO APLICÁVEL`.
9. A aba Documentos da licença apenas encaminha ao projeto na versão atual. Audite o vínculo e a navegação, mas não repita toda a campanha de arquivos da Sessão 05.
10. Preserve alterações preexistentes. Registre o estado inicial do Git e não reverta trabalho de terceiros.
11. Corrija a causa raiz com a menor alteração coerente. Não redesenhe o produto nem crie recursos novos.
12. Melhorias não corretivas devem ser separadas por benefício, esforço e risco e não podem ser implementadas sem aprovação.
13. Mocks podem apoiar testes unitários, mas a comprovação final deve usar frontend, API e SQLite integrados sempre que o ambiente permitir.
14. Envie atualizações curtas ao concluir inventário, demandas, licenças, condicionantes, CAR, PDF/alertas, backend, correções e reteste.

## Segurança dos dados de teste

1. Identifique banco, perfil Electron, diretório de dados, downloads e serviço realmente usados pelo processo. Nunca presuma qual banco está ativo.
2. Detecte dados reais antes de mutar. Use banco, perfil, pastas e downloads totalmente isolados.
3. Antes da primeira mutação, produza backup ou snapshot verificável e registre caminho, tamanho, data e SHA-256 quando aplicável.
4. Nunca altere, conclua, renove, exclua ou vincule dados preexistentes do usuário.
5. Antes de concluir demanda, iniciar renovação ou excluir licença/condicionante, confira ID, nome/número, projeto, cliente e prefixo exatos.
6. Não use nome de técnico, cliente, órgão, processo ou propriedade real nos dados sintéticos.
7. Gere PDFs somente em diretório descartável. Não sobrescreva documentos existentes.
8. Testes de nome de arquivo malicioso devem usar texto inerte e permanecer confinados ao diretório autorizado.
9. Ao final, remova apenas dados sintéticos e confirme a ausência de projetos, especializações, tarefas, interações, licenças, condicionantes, cálculos, alertas, PDFs e auditorias órfãs.
10. Se um defeito impedir a limpeza, não force exclusão ampla. Registre cada resíduo com tabela, ID, caminho e dependências.

## Fase 1 — Preparação e linha de base

1. Identifique Electron, frontend React/Vite, API Fastify, contratos Zod, Drizzle/SQLite, serviços de alerta, gerador PDF, portas, processos, diretórios e suítes aplicáveis.
2. Verifique Git, processos ativos, logs recentes e saúde da aplicação sem encerrar processos não identificados.
3. Confirme que frontend, API, banco, alertas e downloads pertencem à mesma instância isolada.
4. Registre versão do aplicativo, commit, estado do worktree, sistema operacional, fuso, data/hora, viewport, zoom, tema, banco e diretório de downloads.
5. Capture a linha de base das tabelas `projetos`, `ambiental`, `pericias`, `licencas`, `condicionantes_ambientais`, `interacoes_cliente`, `tarefas`, `calculos_salvos`, ocorrências/configurações de alertas e `audit_logs`, ou equivalentes reais.
6. Registre contagens, status, prazos e alertas iniciais, erros no console, falhas de rede e mensagens dos logs.
7. Crie `docs/auditorias/[AAAA-MM-DD]-ambiental/` para relatório, matriz, cálculos, fontes normativas e evidências sanitizadas.

## Fase 2 — Inventário obrigatório

Antes de testar, produza uma matriz contendo:

- ID do item;
- rota, parâmetro, aba, tela ou modal;
- controle ou fluxo;
- ação e resultado esperado;
- componente do frontend;
- endpoint e método da API;
- tabelas, relacionamentos e efeito em arquivos/alertas;
- cenários positivo, negativo, vazio, carregamento, lentidão, erro e recuperação;
- situação e evidência.

Varra a interface e o código para localizar elementos condicionais: botão conforme aba, filtros recolhidos, paginação, ações exclusivas de demanda Ambiental, estados registrados versus efetivos, avisos por proximidade do vencimento, deep link de condicionante, campos exibidos pelo art. 67, salvamento de cálculo, histórico limitado visualmente, estados vazios, confirmações destrutivas e conteúdo que aparece somente com dados.

Inventarie pelo menos estes contratos, se existirem na versão auditada:

- `GET /api/ambiental`;
- `GET /api/ambiental/:id`;
- `PATCH /api/ambiental/:id/fase`;
- `POST /api/ambiental/:id/andamentos`;
- `GET /api/licencas`;
- `GET /api/licencas/:id`;
- `POST /api/licencas`;
- `PATCH /api/licencas/:id`;
- `PUT /api/licencas/:id`;
- `DELETE /api/licencas/:id`;
- `GET /api/licencas/:id/condicionantes`;
- `POST /api/licencas/:id/condicionantes`;
- `PATCH /api/licencas/:id/condicionantes/:conditionId`;
- `DELETE /api/licencas/:id/condicionantes/:conditionId`;
- `GET /api/dados-operacionais/calculos?tipo=ambiental`;
- `POST /api/dados-operacionais/calculos`;
- endpoints de Projetos usados para cadastrar/editar/concluir a demanda;
- endpoints de Alertas que materializam licenças e condicionantes.

## Fase 3 — Navegação global e abas

1. Abra `/ambiental` pelo menu, por URL direta e por retorno de Cliente ou Projeto sintético.
2. Teste `tab=ambiental`, `tab=licenciamento` e `tab=car` por clique, URL, recarga e voltar/avançar.
3. Teste valor de aba ausente, inválido, duplicado e codificado. Confirme fallback para Demandas Ambientais sem tela em branco.
4. Teste navegação das abas somente por teclado com setas, Home e End, incluindo rolagem horizontal em 360 px.
5. Confirme que parâmetros específicos de uma aba não provocam mutações ou filtros invisíveis em outra. Documente quais são preservados e quais devem ser limpos.
6. Valide `/licenciamento` e `/calculadora-ambiental`, preservando o destino canônico e sem loop.
7. Teste `/ambiental/:id` e `/ambiental/licencas/:id` com ID válido, inexistente, UUID inválido, removido e de entidade do tipo incorreto.
8. Procure carregamento infinito, flash de aba errada, requisições duplicadas, erros no console, foco perdido e retorno incorreto.

## Fase 4 — Demandas ambientais e perícias

### Lista, busca, filtros e paginação

1. Confirme que a lista contém somente projetos não excluídos dos tipos Ambiental e Perícia.
2. Teste busca por nome da demanda, cliente, órgão, protocolo, tipo de demanda, número e tipo de perícia, com acentos, caixa, espaços, termo parcial e inexistente.
3. Teste filtros visuais de Tipo, Status, Prazo a partir de e Prazo até, isolados e combinados.
4. Teste também os parâmetros de API `clienteId`, `orgao` e `tipoDemanda`, mesmo que não possuam controle visual; registre a cobertura como backend.
5. Teste intervalo de datas inclusivo, datas iguais, invertidas, impossíveis, prazo ausente e bordas de fuso.
6. Valide paginação de 24 itens, primeira/última página, página além do total, parâmetro zero, negativo, decimal e `limit` acima de 100 diretamente na API.
7. Confirme ordenação por prazo ascendente e atualização descendente quando os prazos empatarem ou forem nulos.
8. Compare total, página, limite e itens entre interface, API e banco.
9. Valide estado carregando, vazio global, vazio filtrado, dados parciais, erro e botão Tentar novamente. Erro não pode parecer ausência de registros.
10. Após criar, editar, concluir ou remover dado sintético, confirme atualização da lista, contagem e filtros sem recarga indevida.

### Cartões e próxima ação

1. Confira nome, tipo da demanda/perícia, órgão ou processo, cliente, fase, status de trabalho, descrição/próxima ação e prazo.
2. Confirme que o próximo item considera somente tarefas não excluídas e não concluídas, ordenadas pelo prazo conforme o contrato.
3. Teste tarefa sem prazo, atrasada, vencendo hoje e várias tarefas com a mesma data.
4. Teste demanda sem tarefa, sem órgão, sem protocolo, sem descrição, sem prazo e com dados longos.
5. Confira tons de prazo vencido, até sete dias e posterior, mas exija texto/semântica que não dependa apenas de cor.
6. Confirme rótulo e apresentação específicos de Perícia e que fase ambiental não é oferecida indevidamente à perícia.

### Cadastro, edição e exclusão da especialização

1. Abra `tab=ambiental&action=new`; confirme modal, URL, fechar/cancelar, Escape, voltar/avançar e aviso de dados não salvos.
2. Cadastre uma demanda Ambiental e uma Perícia pelo formulário contextual de Projeto.
3. Para Ambiental, teste tipo de demanda, órgão ambiental, protocolo e fase inicial, além dos campos de projeto, cliente, propriedade, datas e descrição necessários.
4. Para Perícia, teste tipo, número do processo, data de vistoria, propriedade e status especializado.
5. Tente propriedade de outro cliente, cliente inativo, projeto duplicado e datas incompatíveis.
6. Confirme criação transacional do projeto e da linha especializada correta, sem criar simultaneamente Ambiental e Perícia.
7. Use **Editar demanda** e confirme que o link abre exatamente o projeto especializado. Salve e volte ao detalhe ambiental para validar atualização.
8. Teste mudança de tipo e exclusão somente pelo fluxo real oferecido em Projetos. Comprove bloqueio/cascata e ausência de especialização órfã sem reauditar toda a Sessão 05.
9. Recarregue e reinicie o serviço quando relevante para provar persistência.

## Fase 5 — Detalhe da demanda, fases e histórico

1. Confira cabeçalho, tipo, status, nome, cliente, órgão, protocolo/processo, fase, propriedade, início, prazo, criação, atualização e descrição.
2. Teste dados ausentes, parciais, longos, acentuados e legados sem quebrar o layout.
3. Teste Voltar, Editar demanda, Registrar andamento, Gerar laudo, Adicionar tarefa ou prazo, Anexar documento e Abrir projeto completo.
4. Confirme que os três atalhos de projeto levam ao ID correto. Para tarefa/documento, verifique se a aba/ação esperada é aberta; se não houver deep link específico previsto no produto, registre o comportamento real sem inventar requisito.
5. Em demanda Ambiental, percorra todas as fases suportadas e confirme persistência, timestamp, atualização da lista, evento no histórico e auditoria.
6. Tente fase vazia, desconhecida, muito longa e alteração de fase em Perícia diretamente pela API.
7. Se o endpoint aceitar opcionalmente alterar também o status do projeto, valide a combinação, transação e rejeição de status inválido.
8. Registre andamento com título, descrição, data e categoria. Teste limites de 180, 3.000 e 120 caracteres ou os limites reais.
9. Teste título/descrição vazios, espaços, data impossível, data futura/passada, categoria vazia, conteúdo longo e HTML/JavaScript inerte.
10. Confirme que o histórico mostra somente eventos do projeto correto, em ordem definida, com data, categoria, origem manual/automática e sem duplicidade.
11. Teste falha intermediária na mudança de fase e no andamento. Não pode existir fase sem evento/auditoria nem evento órfão.
12. Conclua a demanda: cancele a confirmação uma vez e confirme em outra. Valide status do projeto, preservação de histórico/documentos e atualização da lista.
13. Tente concluir novamente, concluir demanda cancelada e concluir com requisições simultâneas. Documente idempotência ou erro esperado.

## Fase 6 — Laudo técnico em PDF

1. Abra e feche o modal de laudo por botão, Escape e teclado; teste retorno de foco e bloqueio de dupla geração.
2. Teste os tipos Vistoria Técnica, Monitoramento de Fauna, Inventário Florestal e Laudo Ambiental Genérico.
3. Teste data da vistoria, cliente, técnico responsável e parecer/observações; confirme obrigatoriedade de cliente e técnico também de forma acessível.
4. Compare o nome e o cliente sugeridos com os dados reais da demanda. Dados do projeto não podem ser substituídos silenciosamente por padrão incorreto.
5. Teste campos vazios, espaços, acentos, texto longo, caracteres especiais, data impossível e conteúdo inerte semelhante a HTML.
6. Gere PDF real e confira título, informações gerais, objetivo, parecer, assinatura, data de geração, rodapé e paginação.
7. Confirme que o tipo selecionado altera corretamente o título do documento.
8. Teste várias páginas, quebra de linha, texto longo, ausência de observação, caracteres pt-BR e fontes incorporadas.
9. Verifique nome do arquivo para espaços, barras, `..`, caracteres reservados do Windows, acentos e comprimento. Não permita saída do diretório nem sobrescrita silenciosa.
10. Registre se o PDF é somente download local ou se cria vínculo persistente. Não declare documento anexado ao projeto sem evidência no banco e na pasta.
11. Simule falha de carregamento da biblioteca PDF/download e confirme mensagem recuperável, botão reabilitado e ausência de arquivo parcial.

## Fase 7 — Licenciamento: lista, filtros e resumo

### Lista e filtros

1. Abra `tab=licenciamento` e valide `lic_q`, `lic_status`, `lic_tipo` e `lic_vencimento` na URL.
2. Pesquise por número, protocolo, órgão, projeto e cliente, com acentos, caixa, espaços e termo inexistente.
3. Teste tipos LP, LI, LO, Renovação e Outros.
4. Teste todos os estados `Em análise`, `Válida`, `Em renovação`, `Suspensa`, `Vencida` e `Encerrada`.
5. Teste vencimento `vencida`, `30d`, `60d`, `90d` e `120d`, incluindo exatamente hoje, 30, 60, 90, 120 e 121 dias.
6. Teste filtros isolados e combinados, Limpar, recarga, voltar/avançar e troca de aba.
7. Confirme ordenação por vencimento e atualização, lista móvel em cartões e tabela desktop.
8. Compare número, órgão, projeto, cliente, tipo, vencimento, condicionantes, status efetivo, status registrado e status do trabalho.
9. Teste estados carregando, vazio global, vazio filtrado, erro e recuperação.
10. Verifique comportamento com grande volume. A API não possui paginação visual nesta versão; meça resposta e renderização e registre necessidade de paginação/virtualização como melhoria, não a implemente sem aprovação.

### Status efetivo e resumo operacional

1. Diferencie claramente `statusRegistrado` de `status` efetivo.
2. Confirme que licença registrada como Válida, Em análise ou Em renovação passa a Vencida quando `dataVencimento` é anterior ao dia local.
3. Confirme que Suspensa e Encerrada preservam esses estados mesmo após o vencimento.
4. Teste aliases legados de status e normalização de caixa/acentos sem mascarar valor desconhecido indevidamente.
5. Recalcule os indicadores:
   - Válidas;
   - Vencidas;
   - vencendo em até 120 dias;
   - Em renovação pelo status registrado;
   - Condicionantes pendentes;
   - Condicionantes vencidas.
6. Confirme que “Até 120 dias” inclui hoje e exclui vencidas e Encerradas conforme a regra exibida; documente o tratamento de Suspensas.
7. Confirme que condicionantes Dispensadas não entram nos totais e que Vencida é determinada corretamente pela data.
8. Após criar, editar, renovar, excluir ou alterar condicionante, confirme atualização tanto da lista filtrada quanto do resumo sem contagem antiga.
9. Compare os indicadores da UI com o conjunto completo, não apenas com a lista filtrada, e deixe esse escopo claro ao usuário.

## Fase 8 — Cadastro, edição, renovação e exclusão de licença

1. Abra Nova licença e percorra as seções Empreendimento e vínculo, Identificação, Validade e situação e Observações.
2. Pesquise e selecione projeto; confirme cliente derivado e somente leitura.
3. Tente projeto inexistente/removido, cliente incompatível, cliente inativo e manipulação direta de `clienteId`.
4. Teste tipo LP, LI, LO, Renovação e Outros; número obrigatório até 120; protocolo até 160; órgão obrigatório até 160; tipo até 120; observações até 2.000.
5. Teste emissão opcional e vencimento obrigatório: iguais, vencimento anterior, data impossível, bissexto, borda de fuso e ano extremo seguro.
6. Teste todos os status registrados, payload extra, campos vazios, espaços externos, acentos, duplicidade de número e conteúdo inerte semelhante a script.
7. Confirme o comportamento contratual para números/protocolos duplicados. Não imponha unicidade nova sem regra de negócio aprovada.
8. Salve, localize, abra, edite por PUT completo e, diretamente na API, por PATCH parcial. Confirme que PATCH não apaga campos omitidos.
9. No editor, confirme que o projeto não pode ser trocado se o controle estiver desabilitado; tente alteração direta pela API e valide integridade relacional.
10. Inicie renovação. Confirme status registrado Em renovação, status efetivo conforme a data, mensagem, filtros, resumo, alerta e auditoria.
11. Tente iniciar renovação novamente, em licença Encerrada, durante requisição pendente e por chamadas simultâneas.
12. Exclua licença sintética: cancele uma vez e confirme em outra. Confirme exclusão lógica, 404 posterior no detalhe, ausência na lista e preservação coerente do projeto/documentos.
13. Verifique o tratamento das condicionantes da licença excluída. Elas não podem continuar gerando contadores ou alertas órfãos; documente retenção e cascata de uma exclusão lógica.
14. Tente excluir novamente, excluir ID inexistente/inválido e excluir licença com condicionantes em diferentes estados.
15. Recarregue e reinicie o serviço para comprovar persistência.

## Fase 9 — Detalhe da licença e condicionantes

### Navegação e visão geral

1. Teste as abas Visão geral, Condicionantes, Documentos e Histórico por clique, teclado, URL, recarga e voltar/avançar.
2. Teste aba ausente/inválida e confirme fallback seguro para Visão geral.
3. Confira cabeçalho, tipo, status efetivo, status registrado quando diferente, status do trabalho, número, projeto, cliente e mensagem de vencimento.
4. Recalcule os dias e valide mensagens: vencida há N dias, vence hoje, vence em N dias, válida por mais N dias, renovação em andamento, suspensa e encerrada.
5. Teste exatamente 30 e 120 dias e confirme tons e ícones sem depender apenas de cor.
6. Confira órgão, protocolo, emissão, vencimento, observações e contadores de condicionantes.
7. Na aba Documentos, confirme explicação e link para o projeto correto. Não espere upload direto se o controle não existir.
8. Na aba Histórico, confirme que somente interações do projeto vinculado aparecem, com ordenação e conteúdo corretos.

### CRUD de condicionantes

1. Crie, localize, abra, edite, cumpra, dispense quando permitido, recarregue e exclua condicionante sintética.
2. Teste título obrigatório até 180; descrição até 2.000; data limite; periodicidade até 120; responsável até 160; observações até 2.000; comprovante até 1.000.
3. Teste os status Pendente, Em andamento, Cumprida, Vencida e Dispensada.
4. Ao selecionar Cumprida, confirme preenchimento sugerido da data local e obrigatoriedade no frontend e no servidor.
5. Tente Cumprida sem data, data impossível, cumprimento antes/depois do prazo, remoção da data ao voltar para outro status e payload parcial.
6. Confirme que Pendente ou Em andamento com prazo passado é apresentada como Vencida sem alterar silenciosamente o valor armazenado, caso essa seja a regra.
7. Teste prazo hoje, futuro, passado e ausente; periodicidade e responsável longos; comprovante como texto/referência, sem presumir upload.
8. Use **Marcar como cumprida** e confirme data, contadores, resumo, alerta e auditoria. Tente repetição e concorrência.
9. Edite condicionante e confirme que o `conditionId` pertence à licença da URL. Tente combinar licença A com condicionante B pela API; exija 404/erro seguro e nenhuma mutação.
10. Exclua: cancele uma vez e confirme em outra. Confirme exclusão lógica, retirada dos contadores/alertas e preservação da auditoria.
11. Teste licença inexistente/removida, condicionante inexistente/removida, UUID inválido, payload extra e falha intermediária.

### Deep link e alertas

1. Abra `/ambiental/licencas/:id?tab=overview&condicionante=:conditionId&origem=alerta`.
2. Confirme que condicionante válida leva à aba Condicionantes, informa qual foi aberta e remove somente o parâmetro consumido.
3. Teste condicionante inexistente, removida e pertencente a outra licença. A interface deve informar que não foi encontrada sem abrir registro incorreto.
4. Confirme foco ou destaque suficiente para localizar a condicionante; se houver apenas toast sem localização visual, registre a usabilidade observada.
5. Gere ocorrências de licença e condicionante e valide título, descrição, categoria, data, link, estado lido/oculto e não duplicação.
6. Confirme que licenças Canceladas/Arquivadas, se legadas, e condicionantes Cumpridas/Dispensadas/Canceladas não geram alertas ativos.
7. Confirme que licença excluída logicamente e suas condicionantes deixam de gerar alertas.
8. Teste atualização dos alertas após renovação, mudança de vencimento, cumprimento, dispensa e exclusão.

## Fase 10 — Análise CAR e cálculo independente

### Entradas e validações

1. Teste as quatro regiões/formações e percentuais exibidos:
   - Demais regiões do Brasil: 20%;
   - Amazônia Legal — floresta: 80%;
   - Amazônia Legal — cerrado: 35%;
   - Amazônia Legal — campos gerais: 20%.
2. Valide área total, área em módulos fiscais, APP conservada/em recuperação, vegetação nativa fora de APP e remanescente em 22/07/2008.
3. Teste decimal com vírgula e ponto, casas excessivas, colagem, zero, negativo, texto, notação científica, `NaN`, infinito e valor alto ainda seguro.
4. Rejeite APP, vegetação fora de APP ou remanescente maior que a área total e soma APP + vegetação maior que o total.
5. Confirme que módulos fiscais devem ser maiores que zero quando informados.
6. Confirme que remanescente de 2008 aparece somente quando o imóvel candidato possui até quatro módulos e existia em 22/07/2008.
7. Teste as caixas do art. 15 e dos arts. 67–68 somente com teclado e confira rótulo/click target.

### Fórmulas e cenários

Calcule independentemente e compare cada valor exibido, salvo e reaberto:

1. Regra geral: `área total × percentual regional`.
2. Elegibilidade do art. 15: APP maior que zero e as três condições declarativas marcadas — ausência de nova conversão, APP protegida/em recuperação e inscrição no CAR requerida.
3. APP computável: área de APP somente quando todas as condições do cenário forem atendidas; caso contrário, zero.
4. Vegetação computada: vegetação fora de APP + APP elegível, sem dupla contagem.
5. Candidatura ao art. 67: até quatro módulos fiscais e imóvel existente em 22/07/2008, exigindo remanescente informado.
6. Aplicação quantitativa do art. 67 na implementação: remanescente de 2008 inferior à regra geral passa a ser a referência; igual ou superior não reduz a referência.
7. Déficit: `máximo entre zero e referência − vegetação computada`.
8. Excedente potencial: `máximo entre zero e vegetação computada − referência`.
9. Art. 68: a marcação deve produzir aviso de análise documental necessária, nunca conclusão automática de regularidade.
10. Teste valores exatamente iguais à referência, déficit de centésimo, excedente de centésimo e arredondamento para duas casas.
11. Confirme unidades em hectares, formato pt-BR, números tabulares, memória do cálculo e explicação de APP não computada.
12. Confirme que a ferramenta declara não avaliar geometria, sobreposições, uso restrito, passivos de APP, regularidade da supressão, ZEE, legislação estadual, PRA ou localização aprovada da Reserva Legal.
13. Verifique que o resultado visual não usa termos que possam ser entendidos como aprovação do CAR ou parecer jurídico conclusivo.

### Histórico de cálculos

1. Confirme que Salvar cálculo fica desabilitado sem análise válida.
2. Salve com nome, cliente opcional, projeto opcional e observações; confirme tipo `ambiental`, data, unidade `ha`, método, entradas e resultado JSON.
3. Teste nome vazio/espaços e limite de 200; observações até 4.000; unidade até 80; método até 200; data inválida e payload extra diretamente na API.
4. Teste sem vínculo, somente cliente, projeto compatível, projeto de outro cliente, cliente inativo/removido e IDs inválidos.
5. Confirme integridade entre cliente e projeto e transação com auditoria.
6. Reabra cálculo e compare todos os campos, caixas, região e resultado reproduzido.
7. Teste registros legados com JSON inválido de forma segura; não exponha stack trace nem quebre toda a lista.
8. Confirme ordenação por data/ criação e apresentação dos 20 mais recentes na interface. Verifique o comportamento de volume superior sem presumir paginação inexistente.
9. Não invente editar/excluir cálculo se esses controles não existirem; registre como não aplicável ou melhoria.
10. Recarregue e reinicie o serviço para comprovar persistência.

## Fase 11 — Backend, persistência, segurança e desempenho

Para cada fluxo que lê ou grava dados:

1. Registre método, endpoint, parâmetros, payload sanitizado, resposta esperada e efeito persistente.
2. Teste entradas válidas, inválidas, ausentes, extras, IDs inexistentes, duplicadas e limites relevantes.
3. Confira códigos HTTP, contrato, tipos, mensagens uniformes e ausência de stack trace, SQL, caminhos ou segredos.
4. Confirme validação no servidor; validação somente no frontend não é suficiente.
5. Valide datas reais, não apenas strings lexicograficamente ordenáveis.
6. Confira timestamps, normalização, chaves estrangeiras, vínculos projeto-cliente-propriedade, soft delete e auditoria.
7. Teste atomicidade de projeto + especialização, mudança de fase + histórico, andamento + auditoria, licença + auditoria, condicionante + auditoria e cálculo salvo + auditoria.
8. Teste duas submissões rápidas e atualizações concorrentes para evitar duplicidade ou perda silenciosa.
9. Verifique a política de exclusão lógica de licença/condicionante e as cascatas físicas apenas em cópia descartável.
10. Faça testes seguros de manipulação de ID, mass assignment, injeção, XSS persistente/refletido, JSON excessivo e nome de arquivo do PDF. Não execute payload destrutivo.
11. Verifique busca, filtros, paginação de demandas, ausência de paginação de licenças, limites de 100/500 onde existirem e consultas excessivas.
12. Meça tempos perceptíveis de lista, detalhe, filtros, resumo, cálculo, salvamento e PDF em volume representativo. Registre ambiente e critério.
13. Confira logs e auditoria: ação, entidade, ID, valores anteriores/novos, resultado e proteção de dados pessoais/técnicos.

## Fase 12 — Usabilidade, responsividade e WCAG 2.2 AA

1. Teste tema claro e escuro, viewports aproximados de 360, 768, 1024 e 1440 px, zoom de página a 200%, textos longos e ausência de rolagem horizontal acidental.
2. Percorra abas, filtros, cartões, formulários, detalhes, condicionantes, calculadora, histórico e diálogos somente com teclado.
3. Confirme foco visível, ordem lógica, contenção/retorno do foco em modais, foco no primeiro erro e foco após mudança de rota/aba.
4. Verifique landmarks, títulos hierárquicos, listas/tabelas semânticas, labels vinculados, nomes acessíveis, erros associados e `aria-live` para resultados, carregamento e mutações relevantes.
5. Botões apenas com ícone precisam de `aria-label`; ícones decorativos devem ser ignorados; ações/navegação devem usar elementos nativos adequados.
6. Confirme contraste, uso não exclusivo de cor, redução de movimento, reflow, tamanho dos alvos e árvore de acessibilidade.
7. O resultado CAR e os status de prazo precisam ser compreensíveis sem cor e anunciados sem excesso por leitor de tela.
8. Confira tabelas/licenças no desktop e cartões no celular, truncamento com acesso ao conteúdo, scroll das abas e modais em telas baixas.
9. Revise português, mensagens acionáveis, uso de `…`, datas/quantidades via `Intl`, singular/plural e consistência entre Válida/Vencida/Em renovação.
10. Sinalize `transition: all`, `outline-none` sem reposição, `div/span` clicável, campo sem label/`htmlFor`, botão de ícone sem nome, formatação fixa e `autoFocus` injustificado.
11. Verifique confirmação destrutiva, prevenção de perda de dados e distinção clara entre concluir demanda, encerrar licença, cumprir condicionante e excluir registro.

## Fase 13 — Correção e regressão

1. Antes de corrigir, reproduza o defeito e determine a causa raiz.
2. Adicione ou ajuste teste automatizado que falhe antes da correção sempre que tecnicamente razoável.
3. Faça a menor alteração coerente no frontend, backend, contrato, banco, alerta ou PDF.
4. Não silencie erros, não enfraqueça validações e não introduza dados especiais para o teste passar.
5. Não altere percentuais ou interpretação legal sem fonte oficial, parecer adequado e aprovação expressa.
6. Rode testes focados, lint e typecheck relevantes, testes das aplicações afetadas e regressão do módulo.
7. Repita manualmente o fluxo real corrigido e atualize a evidência.
8. Reteste integrações diretamente afetadas com Projetos, Clientes, Tarefas, Documentos, Alertas, Visão Geral e Relatórios.
9. Revise o diff final e separe alterações preexistentes das realizadas nesta sessão.
10. Se a correção exigir decisão de negócio, jurídica, migração ampla ou recurso novo, documente e aguarde aprovação.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- todas as rotas, aliases, abas, parâmetros, controles, ações condicionais e contratos do escopo foram exercitados ou possuem bloqueio reproduzível;
- demandas, perícias, fases, histórico, conclusão e laudos foram comprovados;
- licenças, status registrado/efetivo, renovação, condicionantes, exclusões e alertas foram comprovados;
- todos os cenários CAR foram recalculados independentemente e confrontados com a interface e o histórico salvo;
- limites técnicos e jurídicos da calculadora estão explícitos e corretos;
- correções foram retestadas automaticamente e na interface real;
- nenhum erro novo relevante aparece no console, rede, API, logs ou alertas;
- dados e arquivos sintéticos foram removidos e a limpeza foi comprovada;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- o relatório declara exatamente tudo o que ficou bloqueado ou não aplicável.

## Classificação dos achados

- **P0** — perda/corrupção de dados, resultado ambiental perigosamente apresentado como aprovação oficial, exclusão/vínculo cruzado grave, falha grave de segurança ou aplicativo inutilizável.
- **P1** — fluxo principal quebrado, cálculo ou prazo materialmente incorreto, alerta crítico ausente/órfão, operação não atômica ou bloqueio sério de acessibilidade.
- **P2** — função secundária incorreta, validação ausente, inconsistência relevante, atualização defasada ou UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com todos os itens e situações.
3. `ACHADOS.md` com ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
4. `CALCULOS-CAR.md` com fixtures, fórmulas, resultados independentes e comparação com UI/API/banco.
5. `FONTES-NORMATIVAS.md` com fontes oficiais, versão, data de consulta e limites de interpretação.
6. Evidências: capturas, PDFs, logs mínimos, alertas, requisições/respostas sanitizadas e consultas, sem dados sensíveis.
7. Relação de arquivos de código alterados e motivo.
8. Comandos executados e resultados exatos.
9. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
10. Riscos residuais e itens que a Sessão 07 deve retestar.
11. Lista separada de melhorias não implementadas, priorizadas por benefício, esforço e risco.
12. Confirmação da limpeza ou inventário exato dos resíduos com IDs e caminhos.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura obtida em números;
- defeitos encontrados por gravidade e quantos foram corrigidos;
- pendências, bloqueios e itens não aplicáveis;
- cálculos CAR comprovados e fontes oficiais consultadas;
- testes executados e resultados exatos;
- confirmação de persistência, alertas e limpeza;
- links para relatório, matriz, achados, cálculos, fontes e evidências;
- recomendação objetiva sobre iniciar ou não a Sessão 07 — Financeiro.

Não use frases vagas como “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, números, IDs, datas, fórmulas e evidências.
