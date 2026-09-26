# Prompt de auditoria — Sessão 12: Planejamento estratégico

Você atuará como engenheiro sênior de QA full stack, especialista em planejamento estratégico, indicadores, governança, aplicações desktop, UX, acessibilidade, integridade de dados, cálculos gerenciais, persistência e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 12 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **12 — Planejamento estratégico**.
- Módulo/menu: **Planejamento**.
- Rota principal: **`/planejamento`**.
- Abas atuais:
  - **Visão estratégica** (`aba=visao`);
  - **Objetivos e metas** (`aba=objetivos`);
  - **Iniciativas** (`aba=iniciativas`);
  - **Revisões e riscos** (`aba=revisoes`).
- Entidades atuais: ciclos, pilares, objetivos, resultados-chave, iniciativas, revisões/check-ins, decisões, riscos e snapshots estratégicos.
- Integrações atuais: fontes automáticas de Financeiro, CRM, Projetos e Tarefas; vínculos de iniciativas com Projetos e Tarefas; auditoria das mutações.
- Rotas de integração permitidas: `/financeiro`, `/crm`, `/projetos`, `/projetos/:id` e `/tarefas` somente para criar fixtures, comprovar fontes/vínculos ou seguir links iniciados no Planejamento. Não reauditar esses módulos integralmente.
- Foco especial: ciclo completo de planejamento; cálculo e transparência do progresso; ausência versus zero; qualidade e atualização das fontes; filtros/ordenação/URL; gestão por exceção; tendências entre revisões; linha do tempo; integridade referencial; exclusão lógica; auditoria; concorrência; responsividade e WCAG 2.2 AA.
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
  - relatório efetivamente produzido pela Sessão 11 em `docs/auditorias/[AAAA-MM-DD]-relatorios/RELATORIO.md`.
- Observação: no momento da geração deste prompt, o relatório final da Sessão 11 ainda não existia. Antes da execução, localize-o pelo diretório/slug, leia-o se estiver disponível e registre honestamente sua ausência se ainda não tiver sido produzido.
- Documento histórico de contexto: `docs/AUDITORIA-PLANEJAMENTO-ESTRATEGICO-2026-07-30.md`. Use-o como histórico; não aceite sua declaração de correção como prova da versão atual.
- Implementar correções comprovadas: **SIM**.
- Implementar novos cenários, projeções, gráficos, exportações ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-planejamento/`.

## Objetivo

Validar de ponta a ponta cada rota, aba, seletor, filtro, resumo, indicador, barra de progresso, narrativa, lista, cartão, detalhe, formulário, modal, confirmação, vínculo, link e ação existente no Planejamento. Complete o ciclo criar → localizar → abrir → editar → recarregar → reiniciar quando relevante → cancelar exclusão → excluir para todas as oito entidades manipuláveis.

Não aprove um indicador porque parece coerente ou porque a API respondeu HTTP 200. Recalcule cada progresso, contagem, atraso, exceção e tendência com oráculo independente derivado dos registros sintéticos ativos. Comprove a mesma verdade na interface, na API, no SQLite, nos snapshots e nos logs de auditoria. Corrija apenas defeitos reproduzidos dentro do escopo e repita os testes integrados após cada correção.

## Limites funcionais e de produto

1. O módulo atual implementa planejamento por ciclos, objetivos, resultados-chave, iniciativas, revisões, decisões e riscos. Não existe entidade separada de “cenário” ou simulação de melhor/pior caso.
2. Não existem hoje gráficos de projeção, PDF, impressão, CSV/XLSX, importação, duplicação de ciclo, restauração de excluído ou reordenação por arraste. Marque-os `NÃO APLICÁVEL` se continuarem ausentes; não os implemente sem aprovação.
3. A ordem de pilares e objetivos é numérica, não drag and drop.
4. Metas são explícitas. Nunca infira uma meta a partir do realizado, nunca substitua ausência por zero e nunca reintroduza projeções artificiais descritas na auditoria histórica.
5. Resultados automáticos são leituras das fontes no período do ciclo. Eles não alteram Financeiro, CRM, Projetos ou Tarefas.
6. Resultado-chave manual preserva o valor informado; automático é recalculado ao carregar o snapshot. Diferencie persistência da configuração e cálculo corrente da fonte.
7. Um link para o módulo de origem comprova navegação, não rastreabilidade até um registro específico quando a URL não contém seu ID.
8. A trilha completa de Auditoria será reavaliada na Sessão 14. Nesta sessão, confira somente os logs produzidos pelas mutações estratégicas sintéticas.
9. O conteúdo de Ajuda pertence à regressão global, mas divergência diretamente comprovada sobre o fluxo de Planejamento deve ser registrada para a Sessão 15.
10. Não mude fórmulas, limites de desatualização, denominadores ou estados de ciclo sem demonstrar o contrato atual e obter decisão de produto quando houver ambiguidade.

## Invariantes estratégicos e de dados

Antes de executar, produza um caderno de oráculos com IDs, datas, valores e fórmulas. No mínimo, comprove:

- somente ciclos sem `deletedAt` aparecem; seleção segue ciclo solicitado válido → ciclo ativo → primeiro ciclo ordenado;
- no máximo um ciclo ativo permanece: ao ativar outro, o anteriormente ativo passa para `em_revisao` de modo transacional;
- datas de ciclo formam intervalo válido e a data final não antecede a inicial;
- pilar pertence a um único ciclo e sua ordem é inteira entre 0 e 999;
- objetivo pertence ao mesmo ciclo do pilar, tem responsável, prazo, status, prioridade e ordem;
- resultado-chave pertence a um objetivo ativo e mantém linha de base, meta, valor atual, unidade, direção, fonte, frequência, confiança e metadados;
- fonte manual exige valor atual; fonte automática exige código permitido e não aceita regra/rota adulteradas como se fossem canônicas;
- ausência de valor atual produz progresso `null`/“—”, nunca zero ou narrativa positiva artificial;
- direção `aumentar` usa `(atual − linha de base) ÷ (meta − linha de base) × 100`;
- direção `reduzir` usa `(linha de base − atual) ÷ (linha de base − meta) × 100`;
- direção `manter` usa tolerância `max(|meta| × 5%, 0,01)` e reduz o progresso conforme a distância até a meta;
- progresso é limitado a `[0, 100]`; intervalo de meta igual a zero segue regra explícita e não produz `NaN`/`Infinity`;
- progresso do objetivo é a média simples de seus resultados-chave disponíveis;
- progresso geral é a média simples de todos os resultados-chave disponíveis no ciclo, sem inventar ponderação por objetivo;
- resultado indisponível não entra na média; resultado igual a zero válido entra;
- frequência define desatualização conforme o contrato vigente: semanal 10, mensal 40, trimestral 110, semestral 210 e anual 400 dias;
- atualização manual do valor atual atualiza `ultimaAtualizacao`; alteração que não muda o valor não deve falsificar a data sem regra explícita;
- iniciativa pertence a objetivo ativo, tem progresso entre 0 e 100, orçamento não negativo em centavos e vínculos opcionais somente com projeto/tarefa ativos;
- iniciativa está atrasada apenas se o prazo é anterior à data civil de hoje e o status não é concluída nem cancelada;
- decisão está atrasada apenas se o prazo é anterior a hoje e o status é pendente ou em andamento;
- decisão concluída exige explicação, recebe `concluidaEm` válida e, ao reabrir, deixa de contar como concluída/atraso conforme seu novo estado;
- risco pertence ao ciclo e qualquer objetivo/iniciativa associado pertence ao mesmo ciclo;
- objetivo em risco é a união sem duplicidade entre status `em_risco` e vínculo com risco de impacto alto/crítico ainda não resolvido/aceito;
- revisão pertence ao ciclo e seu objetivo opcional pertence ao mesmo ciclo;
- revisão com próxima revisão atualiza o ciclo de forma atômica;
- cada revisão cria ou atualiza um único snapshot histórico coerente;
- tendências com menos de dois snapshots permanecem indisponíveis e explicam o motivo;
- tendências comparam os dois snapshots mais recentes por data de captura, não o estado ao vivo com um snapshot;
- melhora/piora de objetivo ignora variação absoluta menor que 0,05 ponto e exige valor disponível nos dois snapshots;
- novos/agravados/mitigados/resolvidos, iniciativas concluídas/atrasadas/bloqueadas e decisões abertas/concluídas são derivados dos IDs e transições entre snapshots;
- exclusões lógicas não reaparecem após reload/reinício e não deixam relações visíveis incoerentes;
- exclusão de pilar com objetivo ativo é bloqueada com mensagem segura e específica;
- exclusão de objetivo trata resultados-chave e iniciativas dependentes atomicamente e preserva ou desvincula histórico/riscos/decisões segundo política comprovada;
- `ON DELETE` do SQLite não é prova de cascata para exclusão lógica; verifique cada tabela explicitamente;
- linha do tempo contém apenas eventos previstos, ordena por data de modo determinístico, limita o backend a 30 e a tela a 8 sem alterar os resumos;
- filtros e ordenação alteram apenas a apresentação, nunca os totais persistidos ou o snapshot;
- valores monetários de fontes automáticas são convertidos de centavos para BRL uma única vez; orçamento de iniciativa permanece inteiro em centavos no banco;
- datas civis não se deslocam na virada do dia em `America/Sao_Paulo`.

## Oráculos das quatro fontes automáticas

Recalcule cada fonte diretamente das tabelas sintéticas, sem usar o serviço de produção como único oráculo:

1. **Resultado de caixa (`financeiro_resultado_caixa`)**
   - recebimentos ativos e não estornados cuja data de recebimento pertence ao ciclo;
   - menos despesas ativas, não canceladas/estornadas, com status pago conforme contrato e data de pagamento ou fallback vigente dentro do ciclo;
   - resultado convertido de centavos para BRL;
   - sem movimentos válidos, valor `null`, não zero.
2. **Conversão comercial (`crm_taxa_conversao`)**
   - oportunidades ativas ganhas ÷ oportunidades ativas encerradas como ganhas/perdidas;
   - data de encerramento ou fallback de atualização dentro do ciclo;
   - denominador zero produz `null`.
3. **Conclusão de projetos (`projetos_taxa_conclusao`)**
   - valide exatamente a população de projetos que se sobrepõe ao intervalo do ciclo, os status considerados concluídos e o denominador usado;
   - confronte a regra textual exibida com a consulta real; qualquer divergência entre “ativos”, “todos no período” e status suportados é achado, não pressuposto.
4. **Conclusão de tarefas (`tarefas_taxa_conclusao`)**
   - tarefas ativas com prazo dentro do ciclo;
   - concluídas segundo as variantes de status vigentes ÷ total desse conjunto;
   - denominador zero produz `null`.

Para cada fonte, registre regra, período, rota, unidade, data de atualização, IDs incluídos/excluídos, numerador, denominador e resultado. Teste status com caixa/acento diferentes somente em banco descartável para descobrir se o contrato normaliza ou exige valor canônico.

## Dados mínimos para a Sessão 12

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S12-[DATA-HORA]-`:

- três ciclos com períodos distintos: rascunho, ativo e encerrado; ative outro ciclo para comprovar a transição do anterior para `em_revisao`;
- pelo menos dois pilares no ciclo principal, com ordens diferentes e nomes longos;
- objetivos em todos os status e prioridades, com ordem empatada, responsáveis distintos e prazos ontem, hoje, +30 e +31 dias;
- resultados manuais para aumentar, reduzir e manter; linha de base/meta iguais; valores abaixo/acima da faixa; zero; negativo; decimal; indisponível e desatualizado;
- um resultado automático de cada fonte: Financeiro, CRM, Projetos e Tarefas;
- fixtures de origem suficientes para numerador/denominador conhecidos, ausência real, exclusão lógica, estorno/cancelamento e bordas do ciclo;
- iniciativas em todos os status, progresso 0/50/100, prazo vencido/hoje/futuro, orçamento nulo/zero/decimal, dependências, marco e vínculos com projeto/tarefa;
- projeto e tarefa ativos vinculáveis, excluídos e pertencentes a combinações relevantes;
- revisões geral e por objetivo, nos três status e níveis de confiança, com campos opcionais e datas iguais/diferentes;
- duas ou mais revisões com mudanças controladas entre elas para validar todos os contadores de tendência;
- decisões em todos os status, vencida/hoje/futura, geral, ligada a objetivo e ligada a revisão; conclusão e reabertura;
- riscos em todos os impactos, probabilidades e status, gerais e vinculados a objetivo/iniciativa, incluindo agravamento, mitigação e resolução entre snapshots;
- textos vazios/opcionais, limites máximos, acentos, nomes extensos, espaços nas bordas, caracteres especiais e HTML/JavaScript inerte;
- estados sem ciclo, ciclo vazio, pilar sem objetivo, objetivo sem resultado, sem iniciativa, sem revisão/decisão/risco, erro, lentidão e alta cardinalidade;
- registros órfãos/legados e JSON de snapshot inválido somente por fixture direta no banco descartável.

Congele o relógio quando possível ou registre exatamente a data/hora/fuso usados. Para tendências, salve o estado esperado antes de cada revisão; não altere retrospectivamente o oráculo depois de observar a tela.

## Regras de escopo, segurança e conduta

1. Leia integralmente os `AGENTS.md`, as Web Interface Guidelines, os relatórios anteriores disponíveis e a auditoria histórica antes de testar ou editar.
2. Preserve o worktree existente. Registre o estado do Git e não reverta nem atribua à sessão alterações preexistentes.
3. Descubra processos, portas, frontend, API, banco, perfil Electron e diretórios realmente usados pelo processo em execução.
4. Confirme que o frontend aponta para a API e SQLite corretos por PID, porta, caminho absoluto e registro sintético de controle.
5. Antes da primeira mutação, determine se há dados reais e produza snapshot verificável do banco e dos arquivos relacionados.
6. Nunca edite nem exclua registro preexistente. Toda mutação e relação deve usar IDs sintéticos desta sessão.
7. Não pare no plano ou no código. Use a aplicação real e confronte UI, rede, API, SQLite, snapshots e auditoria.
8. Cada item termina como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com evidência.
9. Mocks podem apoiar loading/erro, mas não comprovam fórmulas, fontes automáticas, tendências, concorrência ou persistência final.
10. Faça correções mínimas ligadas à causa raiz. Separe melhorias e mudanças de regra sem implementá-las.
11. Não teste cascatas ou dados legados em base real. Não use exclusão ampla para limpar resíduos.
12. Envie atualizações curtas ao concluir inventário, CRUDs, fontes/fórmulas, governança/snapshots e regressão.

## Fase 1 — Preparação e linha de base

1. Registre versões do aplicativo, Electron, web, API, contratos, schema/migrações e SQLite; sistema operacional, locale, fuso, viewport, tema e commit/diff.
2. Confirme as migrações de planejamento e governança, tabelas, índices, chaves estrangeiras e estado de `PRAGMA foreign_keys`.
3. Identifique comandos de execução e suítes existentes, inclusive testes de integração estratégica, validação de formulário, filtros e E2E.
4. Registre contagens por tabela, ciclos/IDs visíveis, console, rede, logs e linha de base antes das fixtures.
5. Crie `docs/auditorias/[AAAA-MM-DD]-planejamento/` e mantenha evidências sanitizadas.
6. Leia riscos da Sessão 11 se o relatório existir; se não existir, declare a lacuna e reconcilie as fontes financeiras diretamente.
7. Verifique se o manifesto de release pendente em sessões anteriores continua bloqueando publicação, sem tentar publicar nesta sessão.

## Fase 2 — Inventário e matriz de cobertura

Crie matriz contendo:

- ID, aba, entidade, controle/fluxo e estado condicional;
- ação esperada, pré-condição e resultado visível;
- componente e helper do frontend;
- endpoint/método, schema, serviço e transação;
- tabela/colunas/relacionamentos, snapshot e auditoria;
- oráculo, fixture e cálculo esperado;
- cenários positivo, negativo, vazio, limite, loading, erro e recuperação;
- situação, evidência e achado relacionado.

Varra código e interface para localizar ações contextuais, botões em cartões, detalhes de fórmula, badges, links de origem, conteúdo limitado, filtros incompatíveis entre abas, confirmações, mensagens de ausência, opções carregadas da API e recursos condicionais de conclusão.

## Fase 3 — Rota, ciclo, abas, URL e estados

1. Abra `/planejamento` pelo menu, URL direta, refresh, voltar/avançar e deep link.
2. Teste `aba=visao`, `objetivos`, `iniciativas` e `revisoes`, além de aba ausente, vazia, inválida, duplicada e caixa diferente.
3. Teste `ciclo=<UUID>` válido, inexistente, excluído, inválido e pertencente a ciclo não ativo; confirme fallback e correção da URL.
4. Selecione cada ciclo e confirme preservação da aba, troca do snapshot e ausência de dados do ciclo anterior.
5. Ative um novo ciclo e prove que só ele permanece ativo após refresh e reinício.
6. Teste abas por clique e teclado com setas, Home e End; confira foco, `aria-selected`, `aria-controls` e painel correspondente.
7. Verifique voltar/avançar entre ciclo, aba e filtros sem estados híbridos nem resposta fora de ordem.
8. Teste ação principal contextual: criar planejamento, continuar com primeiro pilar, novo objetivo e registrar revisão.
9. Exercite loading/erro/retry separadamente para lista de ciclos, snapshot e opções; falha de opções não pode permitir vínculo/fonte inválidos nem apagar conteúdo carregado.
10. Teste estado global sem ciclos, ciclo vazio, cada vazio parcial e vazio filtrado, com ações corretas.

## Fase 4 — CRUD e formulários das oito entidades

Para ciclo, pilar, objetivo, resultado-chave, iniciativa, revisão, decisão e risco:

1. Abra criação por todas as ações disponíveis e edição por cada cartão.
2. Use todos os campos, seletores e opções; valide defaults, labels, nomes, autocomplete, máscaras e ordem de foco.
3. Teste obrigatórios, opcionais, limites máximo/mínimo, valores fora da faixa, tipo incorreto, `null`, espaços, Unicode, texto longo, datas impossíveis e campos extras.
4. Confirme validação no frontend e servidor. Regex `AAAA-MM-DD` não basta para aceitar uma data civil real.
5. Teste fechar por Cancelar, X, Escape e clique externo com formulário limpo e alterado.
6. Com alteração não salva, confirme aviso, continuar editando, descartar e proteção no refresh/fechamento da janela.
7. Ao submeter inválido, foque o primeiro erro; associe erro ao campo. Ao falhar na API, preserve dados e permita corrigir/repetir.
8. Durante o envio, mostre `aria-busy`, estado “Salvando…”, bloqueie fechamento e dupla submissão.
9. Após sucesso, confira toast, anúncio, fechamento, atualização da tela, API, SQLite, `createdAt`/`updatedAt` e audit log.
10. Edite um campo por vez e combinações; campos omitidos em PATCH não podem ser zerados ou apagados.
11. Teste cancelar exclusão e confirmar exatamente o nome/ID sintético; confirme loading, erro e retry.
12. Teste GET/PATCH/DELETE com UUID válido inexistente, ID malformado, registro excluído e entidade de outro ciclo.
13. Verifique schema de objetos extras, mensagens uniformes, códigos 201/200/204/400/404 e ausência de stack trace/segredo.

## Fase 5 — Ciclos, pilares e objetivos

1. Crie e edite ciclos em rascunho, ativo, em revisão e encerrado; teste intervalo igual, invertido, impossível e próximo de ano bissexto.
2. Teste próxima revisão vazia, antes/dentro/depois do ciclo e sua apresentação; não invente restrição de negócio ausente, mas documente incoerência.
3. Prove ativação exclusiva sob duas solicitações rápidas e concorrentes.
4. Confira ordenação de ciclos: ativo primeiro e demais por início descendente, inclusive empates.
5. Crie pilares com ordens 0/999, duplicadas e alteradas; confira ordenação por ordem e nome.
6. Tente mover objetivo para pilar do mesmo ciclo e de outro ciclo; o segundo deve ser rejeitado.
7. Teste todos os status/prioridades, responsáveis, prazos e ordem dos objetivos.
8. Confira ordenação padrão por ordem e prazo, além das ordenações de filtro.
9. Exclua pilar vazio; bloqueie pilar com um e vários objetivos ativos com mensagem específica e sanitizada.
10. Exclua objetivo com resultados, iniciativas, riscos, revisões e decisões relacionados; confirme política de cada relação, atomicidade, snapshots e resíduos.

## Fase 6 — Resultados-chave manuais, fórmulas e transparência

1. Teste direções aumentar, reduzir e manter com casos 0%, 50%, 100%, abaixo de 0 e acima de 100 antes do clamp.
2. Teste linha de base igual à meta com atual igual/diferente, valores negativos, decimais pt-BR, magnitude alta, `NaN`, infinito e precisão.
3. Recalcule progresso do resultado, do objetivo e geral sem arredondamento prematuro.
4. Confirme que valores indisponíveis ficam fora das médias e que zero válido não é confundido com ausência.
5. Valide formatação de BRL, percentual e unidade livre; não converta BRL duas vezes nem tratar reais como centavos.
6. Abra “Como o progresso é calculado?” por mouse/teclado e confira direção, valores, fórmula, tolerância, clamp e leitura acessível.
7. Teste frequências e limites exatos de desatualização, inclusive horário/fuso e data inválida legada.
8. Edite valor manual e confira `ultimaAtualizacao`; edite apenas título/confiança e verifique se a data mantém significado.
9. Troque manual ↔ automático e entre fontes automáticas; confirme limpeza/substituição coerente de valor, unidade, código, regra, período, rota e atualização.
10. Exclua resultado e confira recálculo imediato de objetivo, progresso geral, dados desatualizados e gestão por exceção.

## Fase 7 — Fontes automáticas e integrações

1. Confira `/api/planejamento/opcoes`: quatro fontes, códigos, nomes, regras, períodos, rotas e unidades canônicas.
2. Recalcule cada fonte conforme a seção de oráculos e compare UI, resposta e tabelas de origem.
3. Teste registros nas bordas inclusivas do ciclo, antes/depois, excluídos, cancelados, estornados e status alternativos.
4. Sem registros/denominador, exija `null`, estado “Dado indisponível”, explicação e exclusão da média.
5. Compare `estadoDado`, `desatualizado`, `ultimaAtualizacao` e `dadosDesatualizados`; indisponível e desatualizado não podem ser confundidos silenciosamente.
6. Altere a fonte operacional e recarregue o snapshot; o resultado automático deve atualizar sem PATCH no resultado-chave.
7. Recarregue e reinicie o serviço para provar cálculo determinístico e persistência apenas da configuração.
8. Faça chamadas concorrentes com mutação na fonte e leitura do snapshot; não aceite resposta internamente híbrida sem registrar o risco transacional.
9. Tente código/tipo incompatível, código inexistente, metadados adulterados e fonte de outro tipo; o servidor deve rejeitar ou normalizar com contrato claro.
10. Abra links das fontes e confirme destinos, navegação por teclado e retorno ao ciclo/aba preservados quando suportado.

## Fase 8 — Iniciativas, vínculos e execução

1. Teste todos os status, progressos 0–100, orçamento nulo/zero/centavos, prazo, marco, descrição e dependências.
2. Confirme arredondamento monetário uma única vez entre formulário em reais, API em centavos, SQLite e tela.
3. Teste projeto/tarefa ativo, excluído, inexistente e remoção posterior da origem; valide política de vínculo sem registro fantasma.
4. Abra projeto por deep link e tarefa pela rota disponível; documente que a tarefa não é localizada individualmente se não houver parâmetro/realce.
5. Recalcule atraso em ontem/hoje/amanhã para planejada, em andamento, bloqueada, concluída e cancelada.
6. Confira próximo marco: iniciativa aberta futura mais próxima, texto do marco ou título, com fallback para próxima revisão do ciclo.
7. Teste empate de prazo, reordenação após edição, filtros e alta cardinalidade.
8. Exclua iniciativa vinculada a risco e fontes externas; confirme política de desvinculação lógica e ausência de relação visível quebrada.

## Fase 9 — Revisões, snapshots, tendências, decisões e riscos

1. Crie revisão geral e por objetivo em no rumo, atenção e crítico, usando todos os campos opcionais.
2. Próxima revisão anterior ao check-in deve ser rejeitada; confira atualização atômica do ciclo quando válida.
3. Verifique compatibilidade legada de `decisoesPendentes`: migração/criação gera no máximo uma decisão própria, sem duplicar em rerun.
4. Crie decisões gerais, por objetivo e por revisão; impeça vínculos cruzados entre ciclos.
5. Conclua decisão com data/nota, tente sem nota, reabra, cancele e conclua novamente; confira `concluidaEm`, nota e contagens.
6. Teste PATCH parcial direto ao reabrir para descobrir se metadados de encerramento ficam coerentes.
7. Crie riscos gerais e vinculados; teste atualização de objetivo/iniciativa para outro ciclo, inclusive pela API direta.
8. Recalcule objetivos em risco sem dupla contagem e excluindo riscos resolvidos/aceitos.
9. Capture pelo menos dois snapshots com mudanças controladas e valide cada campo de tendências.
10. Teste duas revisões na mesma data, edição da revisão, ordenação, upsert único e comparação dos dois snapshots corretos.
11. Exclua revisão e verifique snapshot e decisão vinculada; exclusão lógica não aciona automaticamente `ON DELETE` físico.
12. Injete JSON inválido de snapshot em banco descartável e confirme fallback seguro, sem 500 ou dado inventado.
13. Confira que snapshots históricos não mudam retroativamente após editar resultado, risco, iniciativa ou decisão.
14. Verifique linha do tempo: tipos, datas, status, conteúdo, ordenação, limites 30/8 e textos longos.

## Fase 10 — Visão estratégica, narrativas e gestão por exceção

1. Recalcule Progresso geral, Objetivos em risco, Iniciativas atrasadas e Decisões pendentes.
2. Confira metadados de fonte, período, atualização, última revisão e próximo marco.
3. Valide todas as narrativas condicionais: ciclo sem objetivos, sem resultados, com pontos de atenção, somente dados desatualizados e sem desvios.
4. A contagem textual de pontos de atenção deve corresponder exatamente à soma definida e usar singular/plural correto.
5. Teste gestão por exceção com resultados desatualizados, iniciativas atrasadas e riscos altos/críticos abertos.
6. Confira prioridade/limites: até três de cada origem, no máximo seis finais, ordem estável e ausência de ocultação enganosa.
7. Use “Tratar”, “Ver objetivos”, “Nova decisão”, “Registrar revisão” e “Criar objetivo”; confirme aba/modal corretos e ciclo preservado.
8. Valide Próximas decisões: estados abertos, atraso, responsável, prazo, ordenação e limite de quatro.
9. Confira evolução entre revisões, estados sem comparação e todas as contagens exibidas.
10. Verifique linha do tempo vazia e preenchida, sem afirmar que ausência de risco cadastrado significa ausência de risco real.

## Fase 11 — Filtros, ordenação e URL

1. Teste `responsavel`, `status`, `prioridade`, `prazo`, `objetivo`, `risco`, `dados` e `ordem` isolados e combinados.
2. Confirme persistência na URL, refresh, voltar/avançar, troca de ciclo e troca de aba.
3. Teste valores inválidos, duplicados, codificados, com caixa/acento/espaço e IDs inexistentes.
4. Nos objetivos, valide responsável, status, prioridade, prazo, qualidade e ordenações manual/prazo/prioridade/progresso/atualização.
5. Nas iniciativas, valide responsável, status, objetivo, prazo e ordenações por prazo/progresso/atualização.
6. Nas revisões, valide a aplicação coerente de um status compartilhado sobre decisões, riscos e check-ins e as contagens agregadas.
7. Confirme que filtro de risco exclui entidades às quais não se aplica e que filtro de prazo/responsável tem comportamento explicado, não silencioso.
8. Teste fronteiras de prazo: vencido `< hoje`, próximos 30 `hoje…+30` e “Depois de 30 dias” estritamente `> hoje+30`. Divergência entre rótulo e implementação é defeito.
9. Confira ordenação determinística em empates e que filtros não mutam a coleção original.
10. Limpar filtros remove somente chaves de filtro, preservando `ciclo` e `aba`.
11. Filtro de uma aba que não se aplica à aba seguinte não deve produzir vazio inexplicável; documente e corrija apenas se o comportamento for comprovadamente inadequado.

## Fase 12 — Backend, persistência, segurança e desempenho

1. Inventarie GET/POST/PATCH/DELETE de `/api/planejamento`, payload, resposta e efeito em cada tabela.
2. Teste schemas válidos/inválidos, enums, números finitos, centavos, UUIDs, datas civis, campos ausentes/extras e corpos grandes dentro de limites seguros.
3. Confirme 404 somente para entidade não encontrada e 400 para regra/validação; falha inesperada não deve ser mascarada como erro do usuário nem expor detalhes.
4. Verifique transações entre entidade e audit log, ativação de ciclo, revisão/snapshot/decisão legada e atualização da próxima revisão.
5. Force falhas intermediárias em banco descartável e confirme rollback completo.
6. Teste duas criações/edições rápidas, dois ciclos ativados simultaneamente, check-ins concorrentes e atualização perdida.
7. Valide `createdAt`, `updatedAt`, `deletedAt`, índices, chaves estrangeiras e integridade após soft delete.
8. Confira exclusões de ciclo, pilar, objetivo, resultado, iniciativa, check-in, decisão e risco tabela a tabela; liste todo resíduo.
9. Faça testes seguros de XSS persistente, injeção, manipulação de ID e relacionamento cruzado. Conteúdo deve permanecer inerte na UI, logs e snapshots JSON.
10. Meça lista de ciclos, opções e snapshot com volume; procure N+1, múltiplas consultas por resultado automático, payload excessivo e bloqueio da UI.
11. O endpoint de opções lista projetos/tarefas sem paginação; teste volume realista e registre risco sem redesenhar o produto.
12. Teste lock SQLite, leitura durante escrita, reinício do serviço e aplicativo empacotado.
13. Verifique auditoria de cada CRUD: ação, entidade, antes/depois, ID, atomicidade e ausência de dados sensíveis indevidos.

## Fase 13 — Usabilidade, acessibilidade, correção e regressão

1. Percorra todos os fluxos apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home, End e Escape.
2. Confirme foco visível, ordem lógica, contenção/retorno do modal, foco inicial e foco no primeiro erro.
3. Verifique HTML semântico, headings, landmarks, tablist/tabpanel, labels, nomes acessíveis, `aria-live`, `aria-busy` e progressbar sem valor enganoso.
4. Status, risco, atraso, confiança e progresso não podem depender apenas de cor.
5. Teste tema claro/escuro, 360, 768, 1024 e 1440 px, zoom 200%, redução de movimento, alto contraste e textos máximos.
6. Verifique reflow, navegação horizontal sinalizada, sobreposição, truncamento, cards, três colunas de revisão, modais e alvos de toque.
7. Confira português, plural, `…`, datas/números/moeda via `Intl`, números tabulares e diferenciação de zero/nulo.
8. Sinalize antipadrões do `AGENTS.md`: `transition: all`, `outline-none` sem substituto, elemento não semântico clicável, campo sem label, botão-ícone sem nome e formato fixo.
9. Execute Axe WCAG 2.2 A/AA nas quatro abas e nos estados vazio, loading, erro, filtrado, todos os modais, aviso de descarte e confirmação de exclusão.
10. Complemente com árvore de acessibilidade e navegação manual; leitor de tela real fica `BLOQUEADO` se não for efetivamente operado.
11. Antes de corrigir, reproduza e determine causa raiz; adicione teste automatizado que falhe antes sempre que razoável.
12. Faça a menor alteração coerente, rode testes focados, lint/typecheck e regressão web/API/Electron/E2E/build/smoke.
13. Repita manualmente o fluxo corrigido e reconcilie UI, API, SQLite, snapshot e auditoria.
14. Mudança de fórmula, fonte, limite, ciclo de vida, cenário ou exportação exige aprovação expressa.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- quatro abas, seleção de ciclos e todos os parâmetros de URL foram exercitados;
- os oito CRUDs foram testados, incluindo cancelamento e confirmação de exclusão;
- fórmulas aumentar/reduzir/manter, médias, clamp, ausência e zero foram reconciliados;
- quatro fontes automáticas foram recalculadas diretamente das origens;
- iniciativas, vínculos, atrasos, próximos marcos e orçamentos foram comprovados;
- revisões, snapshots, tendências, decisões, riscos e linha do tempo foram validados;
- filtros/ordenações foram combinados e conferidos nas bordas temporais;
- transações, concorrência, soft delete, auditoria, reload e reinício foram testados;
- correções foram retestadas automaticamente e na interface real;
- nenhum erro novo relevante aparece no console, rede, API ou logs;
- todos os dados sintéticos foram removidos e os resíduos verificados tabela a tabela;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- bloqueios e itens não aplicáveis foram declarados com precisão.

## Classificação dos achados

- **P0** — perda/corrupção de dados estratégicos, meta/indicador fabricado, violação grave de isolamento entre ciclos ou falha séria de segurança.
- **P1** — fórmula/fonte automática incorreta, snapshot/tendência retroativo, transação quebrada, exclusão com dano, ciclo ativo inconsistente ou fluxo principal inacessível.
- **P2** — CRUD/filtro/vínculo secundário incorreto, validação ausente, atraso/narrativa/contagem errados, auditoria incompleta, desempenho relevante ou UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com abas, entidades, controles, regras, fixtures e situações.
3. `ACHADOS.md` com ID, gravidade, camada, aba/entidade, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/funções/endpoints, correção e reteste.
4. `CADERNO-DE-ORACULOS.md` com fórmulas, datas, valores, IDs, fontes, inclusão/exclusão e comparação GeoGestor.
5. `MATRIZ-DE-FONTES.md` com as quatro fontes automáticas, regra textual, consulta real, numerador, denominador, unidade, período, atualização e link.
6. `PROTOCOLO-DE-GOVERNANCA.md` com estados antes/depois de cada revisão, snapshot, tendência, decisão, risco e linha do tempo.
7. `PROTOCOLO-DE-INTEGRIDADE.md` com relações, soft deletes, cascatas/restrições, transações, auditoria, resíduos e limpeza.
8. Evidências úteis: capturas, árvore de acessibilidade, logs mínimos, respostas sanitizadas e consultas, sem dados reais.
9. Relação de arquivos de código alterados e motivo.
10. Comandos/testes executados, versões, tempos e resultados exatos.
11. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
12. Riscos residuais e itens que a Sessão 13 deve retestar.
13. Melhorias não implementadas separadas por benefício, esforço, risco e necessidade de decisão de produto.
14. Confirmação da limpeza ou inventário exato de resíduos com IDs, tabelas e caminhos.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura em números por aba, entidade, fonte, fórmula e estado;
- defeitos por gravidade e quantos foram corrigidos;
- pendências, bloqueios e itens não aplicáveis;
- maiores diferenças encontradas nos oráculos e resolução;
- fontes automáticas, snapshots, tendências, relações e auditoria efetivamente comprovados;
- testes executados, tempos e resultados exatos;
- limpeza, riscos herdados e estado do manifesto de release;
- links para relatório, matriz, achados, oráculos, fontes, governança, integridade e evidências;
- recomendação objetiva sobre iniciar ou não a **Sessão 13 — Cadastros e Propriedades**.

Não use frases vagas como “parece correto”, “progresso plausível”, “em geral está bom” ou “a maioria foi testada”. Use fatos, IDs, datas civis, fórmulas, percentuais, centavos, snapshots, transições, consultas e evidências.
