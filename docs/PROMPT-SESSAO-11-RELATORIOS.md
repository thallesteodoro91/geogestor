# Prompt de auditoria — Sessão 11: Relatórios

Você atuará como engenheiro sênior de QA full stack, especialista em relatórios gerenciais, conciliação financeira, métricas operacionais, aplicações desktop, UX, acessibilidade, integridade de dados, geração documental e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 11 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **11 — Relatórios**.
- Módulo/menu: **Relatórios**.
- Rota principal: **`/relatorios`**.
- Redirecionamento legado: **`/relatorio-executivo` → `/relatorios?tipo=executivo`**.
- Tipos de relatório atuais:
  - **Financeiro**;
  - **Projetos**;
  - **Executivo**.
- Períodos atuais: mês atual, últimos 30 dias, trimestre atual, ano atual, todo o histórico e personalizado.
- Recursos principais: KPIs, comparação com período anterior, composição dos indicadores, alertas gerenciais, gráficos, tabelas acessíveis, agenda crítica, pré-visualização, impressão e exportação PDF.
- Rotas de integração permitidas: Financeiro, Orçamentos, Projetos, Clientes e demais registros de origem somente para criar fixtures, comprovar valores ou seguir links iniciados no relatório. Não reauditar esses módulos integralmente.
- Foco especial: regras contábeis e temporais, totais em centavos, coortes, comparação anterior, filtros e URL, cache/invalidação, estados vazio/parcial/erro, rastreabilidade até a origem, gráficos e alternativas textuais, alertas, PDF, impressão, desempenho, acessibilidade e atualização após mutações.
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
  - `docs/auditorias/2026-09-13-topografia/RELATORIO.md`.
- Implementar correções comprovadas: **SIM**.
- Implementar novos relatórios, CSV/XLSX, novas métricas ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-relatorios/`.

## Objetivo

Validar de ponta a ponta cada seletor, período, parâmetro de URL, cartão, comparação, composição, alerta, gráfico, legenda, tooltip, tabela, resumo, lista, link, pré-visualização, impressão e PDF disponível em Relatórios. Não aprove um número porque ele parece plausível, porque coincide com outro painel ou porque a API respondeu HTTP 200. Recalcule cada métrica com um oráculo independente construído diretamente a partir dos registros sintéticos ativos e das regras documentadas.

Comprove separadamente o universo de registros, a data de competência ou caixa usada, o tratamento de status, cancelamento, estorno e exclusão lógica, o filtro temporal, o cálculo em centavos, a apresentação pt-BR, a tabela acessível, a composição do KPI e o documento exportado. Corrija somente defeitos reproduzidos e pertencentes ao escopo. Após cada correção, execute teste automatizado focado, reteste manual integrado e regressão proporcional ao risco.

## Limites funcionais e de integração

1. A tela atual é de leitura. A geração/visualização de um relatório não cria uma entidade “relatório” persistida nem deve produzir efeitos financeiros.
2. O objeto gerencial é calculado no backend e alimenta os três tipos de relatório; `tipo` escolhe a apresentação no frontend, não uma consulta contábil diferente.
3. CSV e XLSX não existem atualmente nesta tela. Inventarie-os como `NÃO APLICÁVEL`; não os implemente sem aprovação.
4. A rota `/audit-logs` pertence a Configurações/Administração. Nesta sessão, confira rastreabilidade até registros de origem e logs apenas quando uma mutação sintética os produzir; não reaudite todo o módulo de auditoria.
5. Relatórios não substituem os módulos operacionais. Ao seguir um link de alerta, valide destino, contexto e existência do registro, sem repetir a auditoria integral do módulo aberto.
6. Cálculos topográficos salvos não compõem os KPIs gerenciais atuais. Comprove que sua criação não altera totais e não apresente resultados topográficos como recalculados ou certificados pelo backend.
7. Não altere a definição de receita, despesa, conversão, projeto ativo, prazo ou área para “corrigir” divergência sem primeiro demonstrar a regra vigente e obter decisão de produto quando houver ambiguidade.
8. Comparações percentuais ou absolutas devem explicitar base, sinal, zero anterior e ausência de período comparável; não invente comparação para período parcial ou todo o histórico.
9. A identidade visual do PDF deriva da configuração empresarial disponível ao aplicativo. Testes que a modifiquem exigem ambiente isolado e restauração comprovada.
10. A falha conhecida do manifesto da versão candidata, registrada na Sessão 10, deve ser retestada se houver build/publicação, mas não autoriza alterar instaladores ou publicar a versão nesta sessão.

## Invariantes contábeis, operacionais e temporais

Antes de usar a interface, crie um caderno de oráculos em centavos e datas civis. No mínimo, comprove:

- somente registros ativos entram nos cálculos; exclusões lógicas, parcelas canceladas, recebimentos estornados e despesas canceladas/estornadas não entram;
- valores monetários são somados em centavos inteiros e formatados apenas na apresentação, sem erro de ponto flutuante;
- orçamento contratado é orçamento aprovado ou pago cuja data de competência do orçamento pertence ao período;
- a data do orçamento segue a precedência vigente: competência, emissão, orçamento e criação;
- receita recebida usa eventos de caixa: recebimentos ativos, parcela paga legada sem recebimento ativo e orçamento direto aprovado/pago sem parcelas com data de pagamento;
- parcela com recebimento ativo não pode ser contada novamente como pagamento legado;
- múltiplos recebimentos ativos da mesma parcela somam uma única vez cada evento válido;
- parcela paga legada usa `valorPago` positivo e, na ausência dele, o valor da parcela;
- receita pendente é o saldo não pago de parcelas ativas de orçamento aprovado/pago ou o total de orçamento direto sem parcelas e sem pagamento, obedecendo à coorte temporal vigente;
- saldo pendente nunca é negativo, inclusive quando `valorPago` excede o valor da parcela;
- receita vencida é subconjunto da pendente e exige vencimento anterior à data civil de hoje; vencimento hoje não é atrasado;
- despesa paga exige status pago e usa a data de pagamento, com os fallbacks de competência/data definidos no contrato;
- categorias podem conter lançamentos não pagos, mas o gráfico financeiro representa o total pago; categoria com somente valor não pago não deve inflar a barra paga;
- resultado de caixa é receita recebida menos despesa paga;
- impostos previstos somam a fonte tributária definida dos orçamentos aprovados/pagos pertencentes ao período;
- taxa de conversão é aprovados divididos por decididos, onde decididos incluem aprovados, pagos, rejeitados e expirados; denominador zero produz ausência de taxa, não `0%` enganoso;
- o período anterior completo tem a mesma quantidade inclusiva de dias e termina um dia antes do período atual;
- filtro com apenas início ou apenas fim não possui período anterior; intervalo invertido ou data civil inválida é rejeitado;
- mês, trimestre e ano respeitam datas civis locais; “últimos 30 dias” inclui hoje e os 29 dias anteriores;
- anos bissextos, virada de mês/ano e horário próximo da meia-noite de `America/Sao_Paulo` não deslocam um registro de dia;
- a coorte de projetos usa data de início e, se ausente, data de criação;
- projeto concluído inclui as variantes vigentes de concluído/finalizado/entregue; cancelado fica separado; demais estados ativos formam o conjunto ativo;
- total de projetos é exatamente ativos + concluídos + cancelados dentro da coorte;
- somente projetos ativos entram em prazos vencidos, próximos vencimentos e área ativa;
- prazo vencido é anterior a hoje; “vence em breve” inclui hoje até hoje + 30 dias, conforme o contrato;
- área ativa soma somente áreas conhecidas de projetos ativos; `null` é desconhecido e zero é área conhecida igual a zero;
- distribuições de status, tipo e município reconciliam com a coorte; valores vazios usam “Não informado” conforme o contrato;
- listas e gráficos ordenam empates deterministicamente e não perdem registros silenciosamente ao aplicar limites visuais;
- `sourceRecordCount` e `filteredRecordCount` seguem suas definições técnicas e não são apresentados como número de entidades de negócio sem explicação;
- campos de compatibilidade legada, enquanto existirem, permanecem iguais às métricas canônicas correspondentes;
- relatório financeiro, de projetos e executivo derivados da mesma resposta exibem números mutuamente consistentes;
- PDF, impressão, tabela acessível, tooltip e cartão apresentam os mesmos valores, período, unidade e sinal.

Quando uma regra vigente parecer inadequada — por exemplo, recebimento ligado a orçamento cancelado ou pendência filtrada pela coorte de origem — teste e documente o comportamento com uma matriz de estados. Não altere a semântica sem decisão explícita.

## Dados mínimos para a Sessão 11

Crie somente em banco, diretório de dados e perfil descartáveis, com prefixo `QA-AUDIT-S11-[DATA-HORA]-`:

- orçamentos sintéticos em rascunho, aprovado, pago, rejeitado, expirado, cancelado, substituído e excluído, com valores e datas distintos;
- orçamento aprovado direto, sem parcelas, nas versões pago e pendente;
- parcelas pendente, parcialmente paga, paga, paga acima do valor, vencida, com vencimento hoje, futura, cancelada e excluída;
- recebimentos múltiplos, estornado e excluído, além de parcela paga legada sem recebimento ativo;
- despesas pagas e não pagas em categorias conhecidas, inclusive cancelada, estornada e excluída, com datas de competência e caixa diferentes;
- projetos ativos, concluídos, finalizados, entregues e cancelados; data de início presente/ausente; prazo vencido, hoje, +30 e +31 dias;
- projetos com área `null`, zero e positiva; tipo/município conhecido, vazio e empatado para testar ordenação;
- registros no início e fim do período atual, no período anterior equivalente e imediatamente fora de ambos;
- datas em 29 de fevereiro, viradas de mês/ano e, se viável, cenário controlado próximo da meia-noite local;
- combinações que disparem isoladamente os cinco alertas: receita vencida, caixa negativo, baixa conversão, projeto atrasado e área desconhecida;
- estados sem qualquer fonte, fonte global existente sem dados do tipo, período sem dados, somente pendências, somente projetos e dados parciais;
- nomes/categorias longos, acentos, caracteres especiais e texto HTML/JavaScript inerte;
- volume suficiente para truncamento, empates, gráficos densos, documento multipágina e teste de desempenho; use volume extremo apenas em banco descartável;
- identidade empresarial sintética com e sem logo e cor, além de cache local inválido controlado;
- um cálculo topográfico salvo para comprovar ausência de efeito sobre os indicadores.

Fixe em uma tabela a expectativa de cada registro: ID, estado ativo, data relevante, inclusão por período, métrica afetada e valor esperado. Não reutilize dado real nem ajuste manualmente o oráculo depois de ver o resultado da aplicação.

## Regras de escopo, segurança e conduta

1. Leia integralmente todos os `AGENTS.md` aplicáveis, as Web Interface Guidelines e os relatórios anteriores antes de testar ou editar.
2. Verifique o estado do Git e preserve alterações preexistentes. Não reverta nem atribua a esta sessão mudanças alheias.
3. Descubra a arquitetura, os processos, as portas, o frontend, a API, o banco, o perfil Electron e os diretórios realmente usados pelo processo em execução.
4. Antes de qualquer mutação, confirme se há dados reais e produza snapshot verificável do banco e dos arquivos envolvidos. Nunca suponha qual SQLite está ativo.
5. Não edite nem exclua registros preexistentes. Toda mutação deve atingir apenas IDs sintéticos desta sessão.
6. Não pare no plano ou na leitura do código. Use a aplicação real e confronte interface, rede, API, SQLite e arquivos.
7. Cada item termina como `APROVADO`, `APROVADO APÓS CORREÇÃO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`, com evidência.
8. Mocks podem acelerar casos de loading/erro, mas não comprovam contabilidade, cache, PDF, persistência ou integração final.
9. Correções devem ser mínimas e ligadas à causa raiz. Melhorias de produto ficam separadas e não são implementadas sem aprovação.
10. Para falhas temporais, registre relógio, fuso do sistema, data civil calculada e data enviada à API.
11. Para falhas monetárias, preserve centavos originais, expressão do cálculo e resultado formatado.
12. Ao final, remova somente dados, arquivos, perfil e cache sintéticos; confirme a limpeza no banco e no sistema de arquivos.
13. Se a limpeza falhar, não execute exclusão ampla. Liste cada resíduo, ID, tabela e caminho.
14. Envie atualizações curtas ao concluir inventário, reconciliação financeira, relatório operacional, documentos e regressão.

## Fase 1 — Preparação, linha de base e riscos herdados

1. Identifique versões do aplicativo, Electron, frontend, API, SQLite, biblioteca de gráficos e gerador PDF; registre sistema operacional, viewport, tema, fuso, locale e commit/diff.
2. Confira processos ativos e logs sem encerrar processos não identificados.
3. Prove que frontend, API e SQLite pertencem à mesma instância usando porta, caminho absoluto, PID e um registro sintético de controle.
4. Registre contagens, totais, console, rede e logs antes das fixtures.
5. Crie `docs/auditorias/[AAAA-MM-DD]-relatorios/` e mantenha evidências sanitizadas.
6. Leia os riscos residuais anteriores, em especial PDF longo/multipágina, cancelamento/bloqueio de download, leitor de tela real, responsividade/zoom, volume de produção, concorrência SQLite, reinício/upgrade Electron e manifesto de release.
7. Não marque um risco herdado como resolvido apenas porque a suíte automatizada passou; reproduza o cenário que o originou.

## Fase 2 — Inventário e matriz de rastreabilidade

Antes de executar, produza matriz com:

- ID, tipo de relatório, rota/query, período e controle;
- ação e resultado esperado;
- componente/função do frontend;
- endpoint, método, query, serviço e regra de cálculo;
- tabelas, entidades, colunas de data/status/valor e efeito em arquivo;
- registro(s) sintético(s) do oráculo;
- cenários positivo, negativo, limite, vazio, parcial, loading, erro e recuperação;
- situação, evidência e achado relacionado.

Varra interface e código para localizar conteúdo condicional: comparações, composições recolhíveis, alertas, links, legendas, tooltips, tabelas acessíveis, treemap/barra, agenda crítica, pré-visualização, impressão, PDF, mensagens por tipo e campos de compatibilidade. Registre explicitamente o que não existe.

## Fase 3 — Rotas, URL, tipos e períodos

1. Abra `/relatorios` pelo menu, URL direta, refresh, voltar/avançar e deep link.
2. Teste os tipos financeiro, projetos e executivo; confirme estado ativo, título, conteúdo e `tipo` na URL. O padrão financeiro pode omitir `tipo` se esse for o contrato.
3. Teste `tipo` inválido, vazio, duplicado, com caixa diferente e caracteres codificados; não aceite tela branca nem estado impossível.
4. Confirme o redirecionamento legado `/relatorio-executivo`, preservando destino executivo sem loop ou perda indevida de parâmetros.
5. Exercite todos os presets e recalcule início/fim: mês, 30 dias, trimestre, ano e histórico.
6. No personalizado, teste início+fim, apenas início, apenas fim, datas iguais, intervalo invertido, data impossível, bissexto e limites distantes.
7. Confirme que `inicio`, `fim` e `periodo=personalizado` representam o estado visível e sobrevivem a refresh, histórico e troca de tipo.
8. Verifique se troca de preset remove parâmetros obsoletos e se alteração de tipo não dispara cálculo inconsistente.
9. Teste período anterior completo e ausência intencional de comparação em período parcial/histórico.
10. Compare o cálculo de datas do frontend com a normalização do backend no fuso local e em cenário controlado de virada do dia.
11. Intervalo inválido deve impedir consulta, associar erro aos campos e permitir recuperação sem recarregar a aplicação.

## Fase 4 — Contrato da API, cache e estados de carregamento

1. Documente `GET /api/relatorios/geral`, seus parâmetros opcionais, resposta canônica, campos legados e códigos de erro.
2. Teste sem parâmetros, só início, só fim, intervalo completo, datas iguais, invertidas, impossíveis, formato não ISO, valores repetidos, array, campo extra, texto longo e codificação inesperada.
3. Confirme 400 seguro para período inválido e 500 sanitizado para falha inesperada, sem stack trace, SQL, caminho local ou segredo.
4. Verifique validação efetiva no servidor; não aceite depender do calendário do frontend.
5. Compare tipos, nulabilidade, inteiros em centavos, datas e campos da resposta com o contrato consumido pelos três relatórios.
6. Teste skeleton inicial, resposta lenta, timeout/falha, mensagem recuperável, botão tentar novamente, reconexão e nenhuma consulta duplicada indevida.
7. Comprove cache por período: duas consultas idênticas dentro da janela retornam dados coerentes e consultas com períodos distintos não se contaminam.
8. Confirme compartilhamento seguro de requisições concorrentes idênticas e remoção da promessa do cache após falha.
9. Após cada POST/PATCH/PUT/DELETE sintético bem-sucedido em fonte relevante, volte ao relatório e prove invalidação imediata, sem esperar 30 segundos.
10. Teste também mutação irrelevante: documente o custo da invalidação global vigente, mas não altere a estratégia sem evidência de defeito e avaliação de produto.
11. Mutação falha e GET não devem invalidar ou corromper o cache.
12. Recarregue e reinicie API/aplicativo quando relevante para provar ausência de estado fantasma.
13. Meça número de consultas SQL, latência, memória e payload em base pequena e volumosa; compare com os limites existentes.

## Fase 5 — Relatório Financeiro e reconciliação contábil

1. Reconcilie os cartões Receita recebida, Receita pendente, Despesas pagas e Resultado de caixa registro a registro.
2. Confira a parcela vencida exibida dentro da pendência e os limites ontem/hoje/amanhã.
3. Valide Receita contratada, Impostos previstos, Conversão comercial e contagens aprovadas/decididas.
4. Teste todos os estados de orçamento e a precedência de datas de competência.
5. Teste recebimento real, múltiplos recebimentos, pagamento legado, orçamento direto, estorno, exclusão e cancelamento sem dupla contagem.
6. Teste parcelas parciais, saldo zero, pagamento excedente, cancelamento e exclusão.
7. Teste despesas pagas, pendentes, canceladas, estornadas e excluídas com competência diferente da data de caixa.
8. Compare período atual e anterior para receita recebida, despesa paga e caixa; teste anterior positivo, negativo, zero e ausente.
9. No gráfico Evolução do caixa, confira cada mês, barras, área de resultado, ordem, escala, legenda, tooltip e tabela exata. Não aceite meses trocados ou valores arredondados de forma divergente.
10. Teste mês único, lacunas entre meses, todas as séries zeradas, valores negativos, altos e parciais. Registre se o contrato não preenche meses zerados.
11. No gráfico por categoria, confirme total pago, percentual, contagem e alternância barra/treemap nos limites de quantidade de categorias.
12. Verifique categoria não paga, sem nome, longa, empatada e com valor zero; gráfico, lista e tabela devem ser consistentes.
13. Abra “Ver composição” de cada KPI e confira definição, período, filtros, total, quantidade, atualização e registros mensais quando disponíveis.
14. A composição da pendência deve explicar sua limitação atual sem sugerir detalhes inexistentes.
15. Faça conciliação cruzada com Orçamentos e Financeiro somente para os IDs sintéticos e prove que o link leva à origem correta.

## Fase 6 — Relatório de Projetos e reconciliação operacional

1. Reconcilie Projetos ativos, Concluídos, Prazos vencidos e Área ativa conhecida.
2. Confira total, cancelados, próximos 30 dias e quantidade de projetos com área conhecida.
3. Teste todas as variantes de status previstas e valores desconhecidos; documente normalização de caixa, acento e espaços.
4. Prove a coorte por data de início e fallback para criação, inclusive bordas do período.
5. Teste prazo ontem, hoje, +30, +31, ausente e projeto não ativo.
6. Teste área `null`, zero, positiva e valor extremo permitido. Zero deve ser conhecido, não “Não informada”.
7. Recalcule as distribuições por status, tipo e município; confira rótulo de vazio, ordem por contagem, desempate e limites de 6/8 itens.
8. Garanta que itens ocultos pelo limite visual não tornam o total ou a tabela enganoso; registre a política explícita.
9. Na agenda crítica, confira seleção, ordenação, rótulo, data, status, projeto e limite de oito itens.
10. Abra os links para Projetos e confirme registro/contexto corretos, foco e retorno ao relatório com período preservado.
11. Compare contagem de projetos do relatório com a resposta da API e com consulta SQLite independente, sem confundi-la com a visão global de projetos fora da coorte.

## Fase 7 — Relatório Executivo, alertas e links

1. Verifique que o executivo resume exatamente os mesmos dados financeiro e operacional, sem consulta ou arredondamento divergente.
2. Recalcule os seis indicadores: resultado de caixa, recebíveis vencidos, conversão comercial, projetos ativos, prazos vencidos e área ativa conhecida.
3. Confira as três frases-resumo, plural, sinal, moeda, percentual, zero, nulo e período.
4. Dispare isoladamente e em conjunto os alertas `overdue_revenue`, `negative_cash`, `low_conversion`, `overdue_projects` e `unknown_area`.
5. Valide gravidade, título, descrição, parâmetros, ordenação, ausência de duplicidade e alternativa textual ao uso de cor.
6. Confirme destinos: vencidos/caixa → Financeiro; baixa conversão → Orçamentos; projetos vencidos/área desconhecida → Projetos.
7. Teste abertura pelo teclado, URL correta, preservação de contexto possível, voltar ao relatório e ausência de link em alerta sem destino válido.
8. Confirme que baixa conversão só aparece quando há decisões e taxa abaixo do limiar vigente; zero decisões não deve gerar alerta enganoso.
9. Confirme ausência dos alertas quando as condições deixam de existir e atualização imediata após corrigir a fonte sintética.

## Fase 8 — Gráficos, tabelas e transparência dos KPIs

1. Para todo gráfico, confira título, unidade, domínio, eixos, escala, cor, legenda, tooltip, ordenação, arredondamento, moeda, data e percentual.
2. Compare cada ponto/barra/bloco com a tabela acessível e o oráculo. A tabela não pode ser apenas uma transcrição visual incorreta.
3. Teste foco e leitura por teclado dos controles associados; informação não pode depender de hover ou cor.
4. Verifique nomes acessíveis, cabeçalhos de tabela, `caption`, escopo de coluna, leitura de números negativos e associação entre gráfico e descrição.
5. Teste conjunto vazio, um ponto, muitos pontos, séries zeradas, negativa, parcial, valores altos e rótulos longos.
6. Abra e feche todos os detalhes/composições por mouse e teclado; teste Escape, clique externo, retorno de foco e apenas um/múltiplos abertos conforme o contrato.
7. Valide `recordCount`, `updatedAt`, período, filtro e totais da transparência. Horário deve usar locale/fuso correto.
8. Alterne rapidamente tipo e período para procurar resposta fora de ordem, tooltip antigo, legenda incorreta e conteúdo do tipo anterior.
9. Execute árvore de acessibilidade e contraste; documente limitações inerentes da biblioteca de gráficos e a alternativa textual oferecida.

## Fase 9 — Pré-visualização, impressão e PDF

1. Abra/feche a pré-visualização nos três tipos e compare cada seção com a tela, a API e o caderno de oráculos.
2. Confirme período, critérios, identidade, títulos, indicadores, tabelas, alertas e ausência de conteúdo pertencente a outro tipo.
3. Imprima cada tipo em PDF virtual ou captura controlada; verifique que apenas o documento de impressão aparece, sem duplicação da tela oculta.
4. Teste cancelamento da impressão, impressão bloqueada e retorno de foco/estado sem erro.
5. Exporte PDF financeiro, de projetos e executivo com período completo, parcial e histórico quando aplicável.
6. Confirme nome `geogestor-{tipo}-{data-inicial-ou-inicio}-{data-final-ou-atual}.pdf` conforme a implementação vigente, extensão, MIME, tamanho não zero e ausência de sobrescrita silenciosa.
7. Abra o PDF fora do gerador, renderize páginas e extraia texto. Compare valores, sinais, datas, critérios e rótulos.
8. Teste sem logo, com logo válido, logo quebrado, identidade parcial, cor válida/inválida e cache local corrompido. O fallback deve ser seguro e legível.
9. Teste nomes/categorias longos, acentos, símbolos monetários, HTML inerte e conteúdo suficiente para várias páginas.
10. Verifique cabeçalho, rodapé, numeração, margens, quebra de tabela, repetição de cabeçalho, linhas órfãs, corte e sobreposição.
11. Force falha controlada do carregador/gerador e do download; a mensagem deve orientar recuperação sem alegar sucesso.
12. Teste cancelamento ou bloqueio de download no ambiente desktop quando tecnicamente acessível; se não for operado de verdade, marque `BLOQUEADO`.
13. PDF e impressão não devem conter dados reais, caminhos locais, IDs internos desnecessários, scripts, segredos ou conteúdo de outro perfil.
14. Registre CSV/XLSX como `NÃO APLICÁVEL`, salvo se a versão executada comprovar que esses controles passaram a existir.

## Fase 10 — Atualização após mutações e rastreabilidade à origem

1. Para cada fonte, registre cadeia completa: fixture → tabela/ID → endpoint de mutação → invalidação → endpoint gerencial → componente → PDF.
2. Crie, altere status, liquide, estorne, cancele e exclua logicamente somente registros sintéticos necessários.
3. Após cada ação, confira mudança exata esperada em todos os KPIs, gráficos, alertas, contagens e composições afetados.
4. Recarregue a tela e, quando relevante, reinicie serviço/aplicativo para comprovar persistência.
5. Teste duas mutações rápidas e alterações concorrentes; não aceite duplicação, perda de atualização ou relatório híbrido.
6. Confirme atomicidade: falha intermediária não deixa caixa, parcela, orçamento ou projeto em estado parcial refletido no relatório.
7. Verifique que exclusão/estorno remove o efeito correto sem apagar histórico alheio nem deixar arquivos órfãos.
8. Siga links até os registros de origem e compare ID, estado, valor e data. Se o relatório só oferece link ao módulo, documente a limitação sem inventar deep link.
9. Consulte logs de auditoria apenas para mutações que já deveriam registrá-los; visualização/exportação não deve ser tratada como persistência se não houver esse contrato.
10. Comprove que cálculo topográfico salvo, tarefa ou outra mutação não financeira/operacional não altera totais, apesar de poder invalidar o cache global.

## Fase 11 — Segurança, concorrência, desempenho e robustez

1. Faça testes seguros de injeção e XSS em nomes, categorias, município e textos exibidos; conteúdo deve permanecer inerte na tela, tooltip, tabela, impressão e PDF.
2. Manipule queries e IDs de links sem tentar sair do ambiente autorizado; confirme validação, codificação e ausência de vazamento.
3. Verifique que respostas/logs não expõem SQL, stack, caminho do banco, dados de outro perfil ou segredos.
4. Teste simultaneidade de leituras e mutações no SQLite, inclusive lock/busy, sem usar base real.
5. Verifique consistência transacional da resposta: totais e distribuições não podem refletir snapshots temporais diferentes.
6. Meça primeira carga, carga em cache, troca de período, alternância de tipo, render dos gráficos, abertura da prévia, PDF e impressão.
7. Use volume progressivo e documentado. Confirme que 1.500 despesas e volume comparável de projetos/orçamentos não congelam a interface nem geram consulta excessiva.
8. Teste rótulos/categorias em alta cardinalidade; procure payload desnecessário, DOM excessivo e documento impraticável.
9. Verifique cancelamento de requisições/respostas antigas na troca rápida de período e ausência de vazamento de memória.
10. Compare desenvolvimento e aplicativo empacotado nos fluxos críticos, incluindo caminhos do worker/asset do PDF.

## Fase 12 — Usabilidade, acessibilidade e consistência visual

1. Percorra o módulo apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home, End e Escape.
2. Confirme foco visível, ordem lógica, foco após rota/tipo/período, retorno após detalhes e ausência de armadilha.
3. Verifique landmarks, título único, hierarquia de headings, labels, grupos, abas, estados selecionados e mensagens associadas.
4. Atualizações de relatório, erro, retry, alerta e sucesso/falha de PDF precisam ser anunciadas quando relevantes, sem repetição excessiva.
5. Indicadores e alertas não podem depender somente de cor, ícone, posição ou gráfico.
6. Teste tema claro/escuro, 360, 768, 1024 e 1440 px, zoom 200%, redução de movimento, alto contraste e textos longos.
7. Verifique rolagem horizontal, reflow, corte de abas, filtros, cards, tooltips, gráficos, tabelas, alertas, prévia e botões.
8. Confira contraste WCAG 2.2 AA, alvos de toque, hover/active/focus/disabled, ícones decorativos e botões somente com ícone.
9. Confira português, plural, `…`, moedas/datas/percentuais via `Intl`, números tabulares e tratamento explícito de zero/nulo.
10. Sinalize antipadrões do `AGENTS.md`: `transition: all`, `outline-none` sem substituto, elemento não semântico clicável, campo sem label, botão-ícone sem nome, formato fixo e `autoFocus` injustificado.
11. Execute Axe WCAG 2.2 A/AA nos três tipos e em loading, erro, vazio, período inválido, detalhes e pré-visualização.
12. Complemente automação com árvore de acessibilidade e uso manual. Leitor de tela real deve ser `BLOQUEADO` se não for efetivamente operado.

## Fase 13 — Correção e regressão

1. Reproduza cada defeito e determine causa raiz antes de editar.
2. Para erro de cálculo, adicione teste com registros, expressão em centavos, datas, status e resultado esperado independente.
3. Para erro temporal, inclua limites e fuso; para cache, inclua sequência de leitura/mutação/releitura.
4. Para PDF/gráfico/acessibilidade, crie teste automatizado razoável e mantenha evidência manual do artefato real.
5. Faça a menor alteração coerente no frontend, serviço, consulta ou contrato. Não altere fixture de produção para fazer o teste passar.
6. Não silencie erro, não enfraqueça validação e não force atualização total como máscara para invalidação incorreta sem avaliar o custo.
7. Rode testes focados, lint e typecheck; depois regressão web, API, Electron, E2E integrado, build e smoke empacotado.
8. Repita manualmente o fluxo corrigido e reconcilie tela, API, SQLite, PDF e impressão.
9. Mudança de definição gerencial, novo relatório, exportação, auditoria de visualização ou arquitetura de cache exige aprovação expressa.

## Critério de encerramento

Não encerre enquanto houver item do inventário sem situação. Para concluir:

- três tipos e todos os presets/períodos personalizados foram exercitados;
- todos os KPIs, comparações, alertas, gráficos, tabelas e composições foram reconciliados com oráculo independente;
- bordas temporais, status, cancelamento, estorno, exclusão lógica e centavos foram comprovados;
- cache, invalidação, concorrência, refresh e reinício foram testados;
- estados loading, erro, recuperação, vazio, parcial e alta cardinalidade foram cobertos;
- links foram seguidos até fontes sintéticas e sua rastreabilidade foi documentada;
- pré-visualização, impressão e três PDFs foram inspecionados por renderização e extração;
- correções foram retestadas automaticamente e na interface real;
- nenhum erro novo relevante aparece no console, rede, API ou logs;
- dados, arquivos, cache e perfil sintéticos foram removidos com comprovação;
- o diff foi revisado e não contém alterações alheias atribuídas à sessão;
- todo bloqueio e item não aplicável foi declarado com precisão.

## Classificação dos achados

- **P0** — corrupção/perda de dados, exposição grave, total financeiro materialmente incorreto, documento perigoso ou aplicativo inutilizável.
- **P1** — KPI/resultado de caixa incorreto, dupla contagem, período/coorte errados, relatório/PDF principal divergente, cache obsoleto após mutação ou bloqueio sério de acessibilidade.
- **P2** — gráfico/tabela/composição incorreta, alerta/link falho, validação ausente, erro de estado parcial, desempenho relevante ou UX bastante prejudicada.
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. `RELATORIO.md` com resumo executivo e status real.
2. `MATRIZ-DE-COBERTURA.md` com todos os itens, regras, fixtures e situações.
3. `ACHADOS.md` com ID, gravidade, camada, tipo/período, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/funções/endpoints, correção e reteste.
4. `CADERNO-DE-ORACULOS.md` com IDs, datas, status, valores em centavos, inclusão/exclusão, fórmulas, comparações e resultado GeoGestor.
5. `RASTREABILIDADE-DE-ORIGENS.md` ligando KPI/gráfico/alerta a tabela, ID, endpoint, componente, link e documento.
6. `PROTOCOLO-DE-DOCUMENTOS.md` com identidade usada, arquivos PDF/impressão, nome/MIME/hash/tamanho, páginas, extração, inspeção visual, falhas e limpeza.
7. Evidências úteis: capturas, árvore de acessibilidade, logs mínimos, respostas sanitizadas e consultas de verificação, sem dados reais.
8. Relação de arquivos de código alterados e motivo.
9. Comandos e testes executados, versões, tempos e resultados exatos.
10. Contagem final de aprovados, aprovados após correção, reprovados, bloqueados e não aplicáveis.
11. Riscos residuais e itens que a Sessão 12 deve retestar, inclusive manifesto de release se ainda pendente.
12. Melhorias não implementadas separadas por benefício, esforço, risco e necessidade de decisão de produto.
13. Confirmação da limpeza ou inventário exato dos resíduos com IDs, tabelas e caminhos.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura em números por tipo, período, métrica, gráfico, alerta e documento;
- defeitos encontrados por gravidade e quantos foram corrigidos;
- pendências, bloqueios e itens não aplicáveis;
- diferenças máximas encontradas nos oráculos monetários/operacionais e sua resolução;
- cache, invalidação, concorrência e persistência efetivamente comprovados;
- PDFs/impressões validados, páginas, hashes e resultado da inspeção;
- testes executados, tempos e resultados exatos;
- confirmação de limpeza e estado do manifesto de release;
- links para relatório, matriz, achados, oráculos, rastreabilidade, protocolo documental e evidências;
- recomendação objetiva sobre iniciar ou não a **Sessão 12 — Planejamento**.

Não use frases vagas como “parece correto”, “valores plausíveis”, “em geral está bom” ou “a maioria foi testada”. Use fatos, centavos, datas civis, IDs, fórmulas, códigos de alerta, páginas, hashes, tempos e evidências.
