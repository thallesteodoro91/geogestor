# Prompt de auditoria especializada — Relatórios financeiro e de orçamento

Use este prompt depois das auditorias funcionais dos módulos Financeiro, Orçamentos, Relatórios e Configurações. Ele é autônomo: o executor deve investigar a implementação real, gerar os documentos pelos fluxos reais da aplicação, validar os números por um oráculo independente e inspecionar os PDFs fora do GeoGestor.

---

## PROMPT PARA COPIAR E EXECUTAR

Você atuará como engenheiro sênior de QA full stack, especialista em relatórios financeiros, propostas comerciais, geração de PDF, contabilidade de caixa, integridade de dados, UX, acessibilidade, segurança documental e aplicações desktop Electron.

Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** os relatórios gerados pelo GeoGestor, com foco em dois produtos documentais distintos:

1. **Relatório Financeiro** gerado no módulo Relatórios, incluindo origem dos números, filtros, visualização, download em PDF e impressão;
2. **Orçamento/Proposta Comercial** gerado no módulo Orçamentos, incluindo cálculos, versão, status, identidade empresarial, conteúdo público, marca-d'água e proteção de informações internas.

Não considere um relatório aprovado porque o arquivo foi baixado, porque abre em um leitor de PDF ou porque a API respondeu HTTP 200. Comprove a cadeia completa:

```text
banco autoritativo
  → consulta/agregação e regras de negócio
  → contrato da API
  → modelo exibido na interface
  → modelo documental
  → gerador PDF
  → arquivo efetivamente baixado/impresso
  → conteúdo, valores e apresentação de todas as páginas
```

Todo número relevante deve ser reconciliado em centavos por cálculo independente. Todo PDF deve ser analisado estruturalmente, ter o texto extraído e ser renderizado página a página para inspeção visual. Corrija defeitos comprovados dentro do escopo, execute regressão e documente evidências suficientes para que outra pessoa consiga repetir a auditoria.

## CONFIGURAÇÃO DA AUDITORIA

- Auditoria atual: Especial — Relatórios gerados: Financeiro e Orçamento;
- Módulos/menus principais: Relatórios e Orçamentos;
- Rotas principais: `/relatorios` e `/orcamentos`; abrir detalhes, modais e subrotas reais descobertos no inventário;
- Integrações permitidas: `/financeiro`, `/configuracoes`, clientes, projetos e demais fontes apenas para criar fixtures sintéticas, confirmar origem dos dados, identidade empresarial, invalidar cache ou seguir um vínculo iniciado no documento;
- Documentos no escopo: PDF financeiro, pré-visualização/impressão financeira quando existentes e PDF de orçamento/proposta comercial;
- Documentos fora do escopo: relatórios de Projetos, Executivo, Topografia, Ambiental, Perícias, Qualidade de Dados e outros, salvo regressão mínima quando compartilham o mesmo gerador ou utilitário e são imediatamente afetados por uma correção;
- Implementar correções comprovadas: **SIM**;
- Implementar novos modelos de relatório, nova identidade visual, assinatura eletrônica, envio por e-mail, armazenamento em nuvem ou mudanças de produto: **NÃO sem aprovação expressa**;
- Publicar, transmitir ou compartilhar externamente qualquer documento: **NÃO**;
- Relatórios anteriores que devem ser considerados: todos os relatórios finais já existentes, principalmente as auditorias de Orçamentos, Financeiro, Relatórios, Configurações/Administração, Homologação/Release e Backup. Localize-os em `docs/auditorias/` e não presuma que resultados antigos continuam válidos;
- Diretório de evidências desta auditoria: `docs/auditorias/[AAAA-MM-DD]-relatorios-financeiro-orcamentos/`.

Se a implementação real divergir de algum nome ou rota deste prompt, registre a divergência, use a implementação descoberta e atualize a matriz. Não invente funcionalidades ausentes: marque-as como **NÃO APLICÁVEL** com evidência.

## RESULTADOS INDEPENDENTES OBRIGATÓRIOS

Em vez de emitir apenas um veredito genérico, encerre cada uma destas frentes separadamente:

1. integridade dos dados e cálculos do Relatório Financeiro;
2. visualização e filtros do Relatório Financeiro;
3. PDF financeiro baixado;
4. impressão/pré-visualização financeira, se existente;
5. integridade dos cálculos do Orçamento;
6. conteúdo público e confidencialidade da proposta comercial;
7. versão, status, validade e marca-d'água do Orçamento;
8. identidade empresarial, legibilidade e paginação dos dois documentos;
9. acessibilidade dos fluxos de geração e dos documentos;
10. prontidão geral dos relatórios gerados.

Para cada frente use: **APROVADA**, **APROVADA COM RESSALVAS**, **REPROVADA**, **BLOQUEADA** ou **NÃO APLICÁVEL**. Um bom resultado em um documento não compensa falha no outro.

## REGRAS DE ESCOPO E CONDUTA

1. Leia integralmente todos os `AGENTS.md` aplicáveis e respeite as Web Interface Guidelines do projeto.
2. Leia os relatórios anteriores e transforme riscos, bloqueios e defeitos herdados em itens explícitos de reteste. Relatório anterior é contexto, não evidência atual.
3. Verifique o estado do Git antes de editar. Preserve alterações preexistentes e nunca reverta trabalho alheio.
4. Não pare em plano, inspeção estática ou testes unitários. Abra a aplicação real e gere os arquivos pelos controles usados pelo usuário.
5. Não altere registros reais. Todos os clientes, orçamentos, parcelas, recebimentos, despesas, configurações empresariais e arquivos devem ser sintéticos e criados em ambiente isolado.
6. Não use mocks como prova final da geração. Mocks podem apoiar testes unitários, mas a aprovação exige o caminho integrado real sempre que o ambiente permitir.
7. Não considere o PDF correto apenas por começar com `%PDF`. Valide estrutura, texto, valores, páginas, renderização e ausência de conteúdo proibido.
8. Não use somente o mesmo código do produto para calcular o resultado esperado. Construa um oráculo independente a partir das regras documentadas e dos registros brutos.
9. Não compare somente valores formatados. Compare inteiros em centavos em banco, API e oráculo; só depois valide a formatação `pt-BR` na interface e no PDF.
10. Não use apenas hash binário para comparar duas gerações: metadados e timestamps podem mudar. Compare conteúdo semântico normalizado, número de páginas, dimensões, imagens e elementos visuais; use hash quando a determinismo binário for requisito comprovado.
11. Correções devem ser mínimas, ligadas à causa raiz e acompanhadas de teste automatizado quando tecnicamente razoável.
12. Melhorias de produto ou design não essenciais à correção devem ser listadas separadamente com benefício, esforço e risco. Não as implemente sem aprovação.
13. Envie atualizações curtas ao concluir: inventário, oráculos, geração dos documentos, inspeção externa, correções e retestes.

## SEGURANÇA, PRIVACIDADE E ISOLAMENTO

1. Descubra primeiro qual API, banco, perfil Electron, diretório de dados, diretório de download e configuração empresarial estão ativos.
2. Confirme por evidência o banco usado pelo processo. Não suponha que o arquivo mais óbvio é o banco ativo.
3. Use banco, perfil, pasta de dados, pasta de download e pasta de evidências descartáveis e exclusivos desta auditoria.
4. Antes de mutações, produza snapshot verificável dos dados sintéticos ou use uma base que possa ser descartada integralmente.
5. Prefixe todos os registros com `QA-AUDIT-DOCS-[DATA-HORA]-`.
6. Use apenas nomes, CPF/CNPJ, e-mails, telefones, endereços, propriedades e dados bancários fictícios. Não copie informações reais para os PDFs de evidência.
7. Nunca envie, imprima em impressora física, sincronize, publique ou compartilhe externamente um documento. Para impressão, use visualização ou impressora virtual isolada e confirme o destino antes de prosseguir.
8. Não marque um orçamento como enviado ao cliente real. Se o fluxo exigir estado `enviado`, aplique-o somente a uma proposta sintética.
9. Antes de excluir ou alterar uma fixture, confirme seu nome, ID e prefixo.
10. Preserve PDFs sintéticos necessários à auditoria somente na pasta de evidências. Remova downloads intermediários e registre os arquivos mantidos, seus hashes e a razão.
11. Redija tokens, cookies, chaves, caminhos pessoais, documentos de identidade e segredos nos logs e respostas anexados ao relatório.
12. Se a limpeza falhar, não faça exclusão ampla. Registre cada resíduo com entidade, ID, arquivo, caminho e motivo.

## DADOS MÍNIMOS OBRIGATÓRIOS

Crie os dados somente no ambiente isolado. Valores devem ser escolhidos para que inclusões e exclusões incorretas sejam detectáveis, evitando números simétricos ou fáceis de coincidir por acaso.

### A. Conjunto financeiro

Crie, no mínimo:

- um orçamento aprovado dentro do período, com parcelas e recebimentos válidos;
- um orçamento aprovado sem parcelas, quando essa representação for permitida;
- um orçamento pago diretamente, se o produto oferecer esse fluxo legado;
- um orçamento em rascunho, um rejeitado, um cancelado e um excluído logicamente, usando valores altos sentinela que jamais devem entrar nos indicadores aprovados;
- uma parcela integralmente paga;
- uma parcela parcialmente paga;
- uma parcela pendente futura;
- uma parcela vencida antes da data civil atual de `America/Sao_Paulo`;
- uma parcela vencendo exatamente hoje;
- parcelas nas duas fronteiras do período selecionado e imediatamente fora delas;
- uma parcela cancelada e uma excluída com valores sentinela;
- recebimentos válidos, parciais, múltiplos para a mesma parcela, estornados e excluídos;
- uma despesa paga com data de pagamento;
- uma despesa paga que exercite a regra de data substituta permitida pelo contrato;
- despesas pendente, vencida, cancelada, estornada e excluída com valores sentinela;
- ao menos três categorias de despesa, incluindo categoria sem despesa paga;
- imposto previsto com taxa e valor cuja base possa ser conferida manualmente;
- períodos atual, anterior, personalizado, vazio e parcial;
- casos de zero, nulo, valor alto, arredondamento e centavos não divisíveis igualmente;
- datas próximas à meia-noite e à virada de mês/ano no fuso de negócio, apenas em ambiente descartável;
- nomes longos, acentos, símbolos e texto semelhante a HTML/JavaScript tratado como texto inerte.

Use valores sentinela distintos para registros que não podem ser contabilizados. Se qualquer sentinela aparecer no relatório, a falha deve ser imediatamente rastreável à classe de registro indevidamente incluída.

### B. Conjunto de orçamentos/propostas

Crie, no mínimo:

- uma proposta mínima válida;
- uma proposta completa com cliente, propriedade/serviço, município/UF, área, matrícula, método de levantamento, escopo, metodologia, entregáveis, prazo, observações públicas, condições e aceite;
- itens obrigatórios e opcionais;
- item de serviço, despesa reembolsável e taxa de repasse, quando previstos pelo contrato;
- quantidades fracionárias, valores unitários com centavos, quantidade zero somente se permitida e valor alto dentro do limite;
- desconto e acréscimo por item, nos modos fixo e percentual aplicáveis;
- desconto e acréscimo globais;
- impostos incluídos e por fora, com diferentes bases e regras de acumulação quando suportadas;
- custos internos, margem, markup, lucro estimado, conta financeira e anotações internas preenchidos com marcadores exclusivos, como `CONFIDENCIAL-QA-CUSTO`, `CONFIDENCIAL-QA-CONTA` e `CONFIDENCIAL-QA-NOTA`;
- pagamento à vista e parcelado, incluindo parcelas com resto de centavos;
- proposta com muitas parcelas, se o limite permitir;
- todas as situações de orçamento aceitas pelo produto, inclusive rascunho, emitido, enviado, em negociação, aprovado, rejeitado, expirado, cancelado e substituído, adaptando a lista ao contrato real;
- versões `v1` e `v2` com alterações claras em itens, totais, prazo e texto público;
- data de emissão, validade futura, validade encerrada, fronteiras de dia, fim de mês, ano bissexto e fuso `America/Sao_Paulo`;
- identidade empresarial completa, mínima, ausente e cache local inválido, em perfis descartáveis separados;
- logotipo PNG e JPEG válidos, imagem muito grande dentro do limite, MIME/extensão incoerentes, dados truncados e formato não aceito;
- cores claras, escuras e com contraste limítrofe;
- documento longo com pelo menos 100 itens ou o limite real, textos longos e várias páginas;
- CPF/CNPJ fictício válido e identificador inválido rejeitado pelo fluxo apropriado;
- caracteres com acento, `ç`, hífen, apóstrofo, símbolos técnicos e texto semelhante a HTML/JavaScript, sempre inerte.

### C. Estados de sistema

Cubra:

- nenhum dado;
- poucos dados;
- volume elevado;
- carregamento;
- API lenta;
- erro de API;
- perda de conexão;
- reconexão;
- falha do carregador de fontes/PDF;
- indisponibilidade de logo;
- cache local ausente, obsoleto e corrompido;
- duas gerações rápidas;
- mutação concorrente durante a geração;
- recarga da página;
- reinício da API e, quando relevante, do aplicativo desktop.

## FASE 1 — PREPARAÇÃO E LINHA DE BASE

1. Identifique arquitetura, versão do app, commit, estado de trabalho, sistema operacional, versão do Electron/navegador, viewport, zoom, tema, locale, fuso, banco, perfil, portas e comandos de execução.
2. Localize todos os `AGENTS.md`, contratos, schemas, rotas, serviços, consultas, componentes, modelos documentais, utilitários de PDF, fontes, imagens e testes relacionados aos dois documentos.
3. Mapeie as bibliotecas de PDF e suas versões, como os assets/fontes são carregados e se há dependência de rede.
4. Identifique o diretório real de download e configure um destino descartável sem arquivos prévios.
5. Verifique processos já ativos, saúde da aplicação, logs recentes, console e requisições com falha. Não encerre processos não identificados.
6. Confirme que frontend, API e SQLite pertencem ao mesmo ambiente isolado.
7. Registre a linha de base de contagens, totais, configuração empresarial, cache, arquivos existentes e hashes relevantes.
8. Crie a pasta da auditoria com, no mínimo:

```text
docs/auditorias/[AAAA-MM-DD]-relatorios-financeiro-orcamentos/
├── RELATORIO.md
├── MATRIZ-DE-COBERTURA.md
├── ACHADOS.md
├── MAPA-DE-DADOS-E-ORIGENS.md
├── CADERNO-DE-ORACULOS.md
├── PROTOCOLO-DE-DOCUMENTOS.md
├── SEGURANCA-E-CONFIDENCIALIDADE.md
├── COMANDOS-E-RESULTADOS.md
├── ARQUIVOS-ALTERADOS.md
├── MELHORIAS-NAO-IMPLEMENTADAS.md
└── evidencias/
    ├── api/
    ├── banco/
    ├── pdf/
    ├── renderizados/
    ├── interface/
    └── logs/
```

9. Leia e referencie explicitamente os achados anteriores que serão retestados, sem copiar conclusões antigas como se fossem novas.

## FASE 2 — INVENTÁRIO E RASTREABILIDADE OBRIGATÓRIOS

Antes de testar, produza uma matriz com uma linha por controle, regra, campo ou bloco documental contendo:

- ID;
- documento: Financeiro ou Orçamento;
- rota, aba, tela, modal ou fluxo;
- controle/ação;
- regra esperada;
- origem de dados no banco;
- consulta/serviço/regra de agregação;
- endpoint, método, query e contrato;
- componente de interface;
- função/modelo gerador do documento;
- seção e página esperada no PDF;
- cenário positivo, negativo, vazio, limite, erro e concorrência;
- risco de confidencialidade;
- método de prova;
- situação: APROVADO, REPROVADO, BLOQUEADO ou NÃO APLICÁVEL;
- evidência.

Faça duas rastreabilidades completas e separadas:

```text
Financeiro:
SQLite → agregação gerencial → contrato da API → filtros/tela
       → modelo documental → definição PDF → download/impressão

Orçamento:
SQLite → detalhe/versionamento → contrato da API → detalhe/tela
       → cálculo independente + cálculo do produto
       → modelo da proposta → definição PDF → download
```

Para cada campo impresso, declare sua origem. Para cada campo sensível não impresso, registre uma regra explícita de exclusão.

Varra interface e código para localizar condições ocultas: seções que aparecem apenas com dados, tabelas omitidas quando vazias, alertas, marca-d'água por status, itens opcionais, parcelas, impostos, logotipo, endereço, rodapé, páginas adicionais, confirmações e mensagens de erro.

## FASE 3 — CADERNO DE ORÁCULOS INDEPENDENTES

Construa o oráculo sem importar ou chamar funções de cálculo do produto. Use os registros brutos do banco ou uma exportação sanitizada e uma implementação independente simples.

### 3.1 Regras financeiras

Descubra e documente o contrato real. Como ponto de partida, verifique se as regras vigentes são:

- **Receita contratada:** soma dos orçamentos aprovados/pagos, ativos e não excluídos, cuja data de competência definida esteja no período;
- **Receita recebida:** recebimentos válidos, não excluídos e não estornados, reconhecidos pela data de caixa; fluxos legados ou pagamento direto só entram quando não duplicam eventos de recebimento;
- **Receita pendente:** saldo elegível `máximo(0, valor da parcela - valor pago válido)`, incluindo representação aprovada sem parcelas apenas quando o contrato assim determinar;
- **Receita vencida:** parte pendente com vencimento anterior à data civil de hoje em `America/Sao_Paulo`; o que vence hoje não é atrasado, salvo regra expressamente diferente;
- **Despesas pagas:** despesas ativas com status pago, não canceladas, não estornadas e não excluídas, reconhecidas pela data de caixa definida no contrato;
- **Resultado de caixa:** receita recebida menos despesas pagas no mesmo recorte;
- **Impostos previstos:** base contratada multiplicada pelas regras/taxas aplicáveis, sem misturar imposto pago, retido ou meramente estimado;
- **Taxa de conversão:** aprovados divididos pelas decisões elegíveis, com denominador, exclusões e tratamento de zero documentados;
- **Séries mensais:** cada evento contabilizado uma única vez no mês de sua data de negócio, usando o fuso e as fronteiras corretas;
- **Categorias de despesa:** total por categoria deve reconciliar exatamente com a soma de despesas pagas mostrada no mesmo relatório e recorte.

Não imponha essas regras se o contrato atual tiver mudado legitimamente. Nesse caso, registre a regra encontrada, compare-a com documentação/interface e classifique qualquer divergência semântica.

### 3.2 Regras do orçamento

Derive, em centavos e na ordem real do domínio:

- subtotal bruto dos itens obrigatórios;
- descontos e acréscimos por item;
- subtotal líquido dos itens;
- despesas reembolsáveis e taxas de repasse;
- itens opcionais separados e não somados, salvo quando selecionados conforme regra explícita;
- desconto global;
- acréscimo global;
- impostos incluídos;
- impostos por fora;
- bases de imposto e ordem de aplicação;
- total final;
- soma das parcelas;
- custos internos;
- honorários líquidos, quando existentes;
- lucro estimado;
- margem;
- markup.

Valide arredondamento em cada etapa. Não permita que arredondamentos por linha e no total criem diferenças silenciosas. Para parcelamento com resto, confirme que a soma exata das parcelas é igual ao total e que o ajuste está em parcela definida de modo estável.

Compare cinco pontos independentes:

1. registros brutos do banco;
2. total persistido pelo servidor;
3. resultado do oráculo;
4. valor exibido na interface;
5. valor impresso no PDF.

Se o gerador recalcula valores no cliente, compare também esse resultado. Divergência entre total persistido e recalculado não pode ser mascarada usando um em uma seção e outro em outra; registre como defeito e avalie se a geração deve ser bloqueada.

### 3.3 Artefatos do oráculo

O caderno deve conter:

- IDs sintéticos e estado de cada registro;
- valores brutos em centavos;
- fórmula;
- inclusão/exclusão por regra;
- resultado esperado;
- comparação banco/API/UI/PDF;
- diferença encontrada;
- consulta ou script independente reproduzível.

## FASE 4 — RELATÓRIO FINANCEIRO: API, FILTROS E INTERFACE

1. Identifique o endpoint gerencial real, método, parâmetros, limites, schema e formato da resposta.
2. Teste período padrão, atual, anterior, personalizado, um único dia, fronteiras inclusivas, intervalo invertido, data inexistente, formato inválido, parâmetros repetidos e parâmetros extras.
3. Confirme validação no servidor; não aceite apenas bloqueio do frontend.
4. Teste IDs inexistentes ou filtros adicionais apenas se fizerem parte do contrato real.
5. Confira códigos HTTP, mensagens seguras e ausência de stack trace, SQL, caminhos, segredos ou dados de outros perfis.
6. Compare cada KPI, composição, série mensal, categoria, alerta e contagem com o oráculo.
7. Confirme que o período da URL, o rótulo na tela, a requisição, o conteúdo e o PDF representam exatamente o mesmo recorte.
8. Valide persistência ou limpeza intencional do período ao recarregar, navegar, voltar/avançar e abrir deep link.
9. Teste estado vazio, parcial, um único ponto, todos os valores zero, valores altos, negativos quando semanticamente válidos e séries sem meses intermediários.
10. Confirme formatação `pt-BR` via `Intl`: moeda, percentuais, números, datas e nomes de mês.
11. Verifique títulos, unidades, legenda, eixos, escala, tooltip, cores, arredondamento e alternativa textual dos gráficos.
12. Faça uma mutação financeira válida e confirme atualização sem recarga indevida. Depois recarregue e reinicie a API quando relevante para provar persistência e invalidação de cache.
13. Teste mutações que não devem alterar o relatório: estorno, exclusão, cancelamento ou registro fora do período, conforme a regra.
14. Se houver cache de relatório, prove sua chave, TTL e invalidação. Garanta que períodos diferentes, bancos/perfis diferentes e mutações não compartilham resposta obsoleta.
15. Teste duas consultas concorrentes e resposta fora de ordem ao trocar rapidamente o período.
16. Registre tempo de consulta, tamanho da resposta e número de consultas em volume representativo.

## FASE 5 — RELATÓRIO FINANCEIRO: MODELO DOCUMENTAL E PDF

1. Gere o PDF pelo botão real da interface com o período ativo. Não chame apenas a função do gerador em teste isolado.
2. Confirme que o botão informa carregamento, impede submissão duplicada quando necessário e só exibe sucesso depois que o download realmente foi iniciado/concluído conforme o contrato da biblioteca.
3. Force falha no carregamento do gerador, fontes ou criação do blob e confirme mensagem acionável, ausência de falso sucesso e recuperação em nova tentativa.
4. Confirme que não há requisição externa inesperada para carregar biblioteca, fonte, logo ou imagem, principalmente no aplicativo offline/empacotado.
5. Verifique o nome sugerido do arquivo: tipo do relatório, período, caracteres seguros, extensão `.pdf` e estabilidade da convenção.
6. Compare cabeçalho, razão social, CNPJ, telefone, e-mail, endereço, logotipo, cor institucional e demais campos empresariais com a configuração autoritativa atual.
7. Confirme título, período, data de geração, fuso, critérios metodológicos e alertas.
8. Recalcule todos os valores impressos e compare com API, tela e oráculo.
9. Confirme que as seções financeiras usam o mesmo universo: indicadores, evolução de caixa, despesas por categoria, alertas e metodologia.
10. Garanta que estado vazio não produz página quebrada, gráfico enganoso ou texto que afirme haver movimentação.
11. Teste ausência e corrupção de logotipo, campo empresarial longo, endereço multilinha e cor de contraste ruim. O PDF deve usar fallback seguro ou falhar claramente, nunca ficar ilegível.
12. Confirme que dados administrativos não destinados ao documento, segredos, IDs internos, caminhos e stack traces não aparecem.
13. Gere o mesmo relatório duas vezes sem mutação. Compare conteúdo semântico, páginas, dimensões e imagens; explique diferenças esperadas de timestamp/metadados.
14. Mude um registro financeiro durante ou imediatamente antes da geração. Prove qual snapshot o PDF representa e impeça mistura de valores antigos e novos no mesmo arquivo.

## FASE 6 — PRÉ-VISUALIZAÇÃO E IMPRESSÃO FINANCEIRA

Quando a aplicação oferecer visualização HTML ou impressão:

1. Compare o modelo exibido com o modelo do PDF: título, período, identidade, KPIs, séries, categorias, alertas e critérios.
2. Confirme que a prévia é atualizada após trocar período ou mutar dados.
3. Teste abrir, fechar, voltar, cancelar impressão e gerar novamente.
4. Garanta foco inicial útil, contenção quando modal, Escape, retorno do foco e nome acessível.
5. Verifique mídia de impressão, margens, cabeçalho, rodapé, cores, quebras de página e ausência de controles da interface no documento impresso.
6. Use impressora virtual/PDF isolada para produzir um arquivo e aplique o mesmo protocolo externo de inspeção.
7. Não selecione impressora física. Se o diálogo nativo não puder ser automatizado com segurança, execute a parte possível e marque o restante como bloqueio físico reproduzível.

Se a funcionalidade não existir, marque **NÃO APLICÁVEL**; não a implemente como parte desta auditoria.

## FASE 7 — ORÇAMENTO: DETALHE, VERSÃO E SNAPSHOT

1. Identifique o endpoint do detalhe, o schema, as tabelas e a representação de versões/histórico.
2. Confirme que gerar pela lista refaz a leitura do detalhe atual, caso esse seja o comportamento esperado.
3. Confirme que gerar pelo detalhe/modal usa dados atuais e não props, cache ou estado obsoleto.
4. Edite um orçamento em outra janela antes da geração e verifique se o usuário recebe o documento atualizado ou uma indicação clara de conflito.
5. Teste duas gerações simultâneas e garanta que arquivos, nomes e conteúdos não se cruzam.
6. Compare `v1` e `v2`: código, número da versão, status, validade, itens, totais, textos e nome do arquivo.
7. Garanta que uma versão histórica, quando oferecida como imutável, reproduz seu snapshot e não dados atuais misturados.
8. Confirme que versão substituída, cancelada ou rejeitada não aparenta estar aprovada devido a ausência de marca visual.
9. Recarregue a página e reinicie o serviço para confirmar persistência dos dados que alimentam a proposta.
10. Verifique se gerar/baixar é somente leitura. Não deve alterar status, versão, histórico, timestamps ou auditoria, salvo comportamento explicitamente previsto e informado.

## FASE 8 — ORÇAMENTO: CÁLCULOS E CONTEÚDO PÚBLICO

1. Execute o ciclo real: criar, preencher todos os tipos de item, salvar, abrir detalhe, gerar PDF, editar, criar/revisar versão e gerar novamente.
2. Compare banco, resposta do detalhe, cálculo do produto, interface, oráculo e PDF.
3. Verifique descrição, quantidade, unidade, preço unitário, subtotal, ajustes e total por item.
4. Confirme que itens opcionais são identificados de forma inequívoca e não entram no investimento total enquanto não contratados.
5. Valide subtotal, reembolsáveis, taxas de repasse, desconto, acréscimo, impostos e investimento total.
6. Verifique valores zero, centavos, fracionários, altos, limites, negativos rejeitados e percentuais fora do intervalo.
7. Confirme condições de pagamento, número, ordem, datas e soma das parcelas.
8. Verifique cliente, documento, contato, propriedade/serviço, município/UF, área, matrícula e método.
9. Distinga corretamente ponto de apoio físico no solo de estação base eletrônica GNSS; não permita ambiguidade técnica no texto.
10. Confira escopo, metodologia, entregáveis, prazo, observações públicas, termos, aceite e assinaturas.
11. Valide emissão e validade usando data civil e fuso corretos, inclusive expiração na fronteira do dia.
12. Teste textos vazios, longos, multiline, acentos e caracteres especiais. Não aceite corte silencioso, mojibake ou interpretação como HTML/JavaScript.
13. Confirme que o nome do arquivo é seguro, legível e inclui identificadores públicos úteis, como código e versão, sem PII desnecessária ou path traversal.
14. Force falha de geração/download e confirme ausência de toast de sucesso falso.

## FASE 9 — STATUS, MARCA-D'ÁGUA E USO INDEVIDO

1. Inventarie todos os status reais e estabeleça a marca-d'água ou sinalização esperada para cada um.
2. Gere um PDF por status relevante.
3. Para rascunho, confirme aviso explícito equivalente a `RASCUNHO — NÃO ENVIAR` e a confirmação antes da exportação quando prevista.
4. Para rejeitado, expirado, cancelado e substituído, confirme sinalização inequívoca, legível em todas as páginas necessárias e não dependente apenas de cor.
5. Para emitido, enviado, em negociação e aprovado, confirme a regra real e ausência de marca incorreta.
6. Verifique opacidade, contraste, rotação, camada e repetição da marca-d'água. Ela não pode ocultar valores nem desaparecer em impressão monocromática.
7. Confirme que o status textual do cabeçalho/rodapé corresponde ao estado persistido e à marca.
8. Mude o status, gere novamente e garanta que cache ou nome de arquivo não reutiliza documento anterior.
9. Teste orçamento expirado por data mesmo quando o status persistido não foi atualizado, conforme a regra do domínio.
10. Trate proposta sem marca obrigatória ou proposta aprovada marcada como rascunho como defeito de alto impacto comercial.

## FASE 10 — CONFIDENCIALIDADE DA PROPOSTA

Esta fase é obrigatória e bloqueia aprovação do documento.

1. Preencha todos os campos internos com marcadores exclusivos.
2. Pesquise esses marcadores:
   - no texto visível de todas as páginas;
   - no texto extraído do PDF;
   - nos bytes do arquivo;
   - em metadados, objetos, streams descomprimidos quando a ferramenta permitir;
   - em nomes de arquivo e anexos incorporados.
3. Devem estar ausentes da proposta comercial, salvo requisito aprovado em contrário:
   - anotações internas;
   - custos internos;
   - conta financeira;
   - lucro estimado;
   - margem;
   - markup;
   - histórico interno/auditoria;
   - IDs técnicos e chaves de banco;
   - caminhos locais;
   - tokens, segredos e mensagens de erro;
   - dados internos de outras versões ou outros clientes.
4. Verifique se campos internos não vazam em propriedades de acessibilidade, alt text, metadata, comentários, camadas invisíveis ou conteúdo fora da página.
5. Crie dois clientes/orçamentos em paralelo e prove isolamento: a proposta A não pode conter nenhuma informação da proposta B.
6. Teste texto hostil inerte, fórmulas, sequências de path traversal e nomes com separadores. O PDF não deve executar ação, criar link inseguro ou gravar fora do diretório de download.
7. Inspecione links/ações do PDF. Não aceite JavaScript embutido, arquivo anexado, formulário ativo ou URL externa não autorizada.
8. Qualquer vazamento de custo, conta, margem, nota interna ou dado de outro cliente deve ser classificado no mínimo como **P1**, podendo ser **P0** se houver exposição real ou sistemática.

## FASE 11 — IDENTIDADE EMPRESARIAL E CONFIGURAÇÃO

1. Determine a fonte autoritativa do modelo empresarial e o papel de qualquer cache local.
2. Salve uma identidade sintética nova e gere imediatamente os dois documentos. Ambos devem usar os dados atuais ou informar de forma clara que é necessário recarregar.
3. Recarregue a tela e reinicie a aplicação para comprovar persistência.
4. Corrompa somente o cache descartável, preserve a fonte autoritativa e confirme fallback/recuperação.
5. Teste cache antigo com fonte atualizada; não aceite documento com identidade obsoleta silenciosamente.
6. Verifique razão social, nome fantasia quando aplicável, CNPJ, telefone, e-mail, endereço, conselho/registro profissional, termos padrão, logotipo e cor.
7. Teste campos ausentes. O documento não deve imprimir rótulos vazios, `undefined`, `null`, vírgulas soltas ou espaços excessivos.
8. Teste logo PNG/JPEG válido, dado truncado, MIME divergente, SVG se não suportado e imagem grande. Não permita quebra total do PDF por cache inválido sem erro tratável.
9. Confira proporção, resolução, transparência, limites e ausência de sobreposição do logotipo.
10. Meça contraste dos textos e elementos essenciais em relação ao fundo. Use fallback acessível para cor institucional inadequada.
11. Confirme que identidade de um perfil/banco não contamina outro.
12. Se os dois documentos usam pipelines diferentes, execute todos os cenários em ambos; aprovação em um não prova o outro.

## FASE 12 — PROTOCOLO EXTERNO DE VALIDAÇÃO DOS PDFs

Para cada PDF de evidência, registre em `PROTOCOLO-DE-DOCUMENTOS.md`:

- fluxo que o gerou;
- data/hora e fuso;
- IDs sintéticos de origem;
- período, versão e status;
- nome sugerido e nome salvo;
- tamanho em bytes;
- SHA-256;
- assinatura `%PDF-` e versão PDF;
- quantidade de páginas;
- dimensões de cada página;
- ferramenta e versão usada na validação;
- resultado estrutural;
- resultado da extração de texto;
- resultado da renderização;
- resultado visual por página;
- pesquisa de marcadores confidenciais;
- observações e achados.

Execute, quando as ferramentas estiverem disponíveis:

1. verificação estrutural com parser independente e/ou `qpdf --check`;
2. leitura de metadados;
3. contagem de páginas;
4. confirmação de A4 ou formato documentado em todas as páginas;
5. extração de texto por página com ferramenta independente;
6. renderização de **todas** as páginas em resolução suficiente, usando Poppler, PDFium ou equivalente;
7. inspeção visual de cada imagem renderizada;
8. busca dos valores esperados e dos marcadores proibidos;
9. inventário de fontes, imagens, links, ações, anexos e formulários;
10. abertura em pelo menos um leitor externo, quando seguro e disponível.

Não aprove um PDF apenas com screenshot da primeira página. Procure em todas as páginas:

- página branca inesperada;
- conteúdo cortado ou fora da área;
- cabeçalho/rodapé sobreposto;
- linhas ou células divididas incorretamente;
- título órfão no fim da página;
- tabela sem cabeçalho repetido;
- sequência de páginas incorreta;
- `Página X de Y` incorreto;
- marca-d'água ausente ou ilegível;
- fonte substituída, caracteres ausentes ou texto corrompido;
- imagem esticada, borrada ou com fundo inadequado;
- moedas, sinais, percentuais ou casas decimais incorretos;
- texto escondido por clipping;
- quebra ruim de palavras, URLs e identificadores;
- conteúdo interno invisível fora da página.

Teste ao menos:

- documento mínimo de uma página;
- documento médio realista;
- documento longo multipágina;
- documento com textos longos;
- documento sem logo;
- documento com logo;
- cada marca-d'água relevante;
- relatório financeiro vazio e preenchido;
- impressão virtual, se aplicável.

## FASE 13 — PAGINAÇÃO, LEGIBILIDADE E QUALIDADE VISUAL

1. Inspecione A4 em 100%, 200% e ajuste à página.
2. Verifique hierarquia de títulos, alinhamento, espaçamento, densidade, consistência tipográfica e destaque do total.
3. Confirme que valores financeiros usam algarismos tabulares quando a comparação em coluna exigir.
4. Garanta contraste WCAG 2.2 AA para texto essencial e que status/marca-d'água não dependam só de cor.
5. Confirme cabeçalho e rodapé consistentes, código/versão/status corretos e paginação `X de Y`.
6. Teste quebra de linhas de tabela, repetição de cabeçalho e prevenção de linhas inseparáveis quando possível.
7. Verifique que assinaturas e aceite não ficam separados de seus rótulos de forma ambígua.
8. Garanta que totais, condições de pagamento e termos não sejam ocultados ou quebrados de modo a alterar interpretação.
9. Faça inspeção monocromática ou simule escala de cinza nos status destrutivos.
10. Compare tema claro/escuro da interface: o PDF deve preservar sua identidade própria e não herdar cores ilegíveis do tema.
11. Valide nomes e textos em português, uso de `…`, acentuação e terminologia técnica consistente.

## FASE 14 — ACESSIBILIDADE

### Interface de geração

1. Percorra tudo apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas e Escape.
2. Confirme foco visível, ordem lógica e retorno de foco após confirmação/modal.
3. Botões de baixar, imprimir e fechar precisam de nome acessível e estado de carregamento anunciado.
4. Mensagens de geração, sucesso e erro importantes devem ser anunciadas com `aria-live` apropriado.
5. Confirme labels, headings, landmarks, semântica das abas e associação entre período e conteúdo.
6. Teste zoom 200%, reflow, 360/768/1024/1440 px, modo escuro, redução de movimento e alto contraste quando disponível.
7. Execute análise automatizada de WCAG, mas não a trate como substituta do percurso manual.

### Documento

1. Inspecione ordem de leitura pelo texto extraído e, quando disponível, pela árvore de acessibilidade do leitor.
2. Confirme que o conteúdo essencial não depende apenas de gráficos, cor, posição ou marca visual.
3. Para gráficos financeiros, exija equivalente textual na interface e conteúdo numérico compreensível no documento.
4. Verifique seleção, cópia e busca de texto; não aceite relatório transformado integralmente em imagem sem necessidade.
5. Inspecione idioma, título e metadados quando suportados.
6. Verifique tags, estrutura, headings, tabelas e texto alternativo quando a biblioteca gerar PDF marcado.
7. Se o pipeline atual não produzir PDF/UA ou tags estruturais, não invente conformidade. Registre a limitação, avalie impacto e classifique como defeito ou melhoria conforme requisitos formais do produto e existência de alternativa HTML acessível.
8. Faça teste básico com leitor de tela real se disponível. Se não, registre bloqueio físico e não declare compatibilidade completa.

## FASE 15 — ERROS, OFFLINE, CONCORRÊNCIA E ATOMICIDADE

1. Interrompa a API antes de carregar dados e depois de carregar, mas antes de gerar.
2. Simule resposta lenta e troca rápida de período/orçamento.
3. Force falha de fonte, logo, blob, download e janela de impressão.
4. Confirme que erro não gera arquivo parcial com aparência válida nem falso sucesso.
5. Teste recuperação sem reiniciar toda a aplicação.
6. Gere dois documentos diferentes rapidamente e confirme conteúdo e nomes corretos.
7. Gere o mesmo arquivo duas vezes e verifique política de colisão do sistema operacional sem sobrescrita silenciosa indevida.
8. Faça uma alteração concorrente no dado de origem e determine se o relatório é um snapshot consistente. Não aceite documento híbrido.
9. Reinicie o serviço entre leitura e geração quando a arquitetura permitir e observe comportamento previsível.
10. Teste offline completo após assets já instalados: fontes e biblioteca não devem depender de CDN.
11. Verifique logs: ação, tipo de documento, entidade/período, resultado e duração, sem conteúdo sensível. Não exija trilha inexistente como funcionalidade nova; documente a realidade.
12. Confirme que download ou impressão não executa mutação indevida no banco.

## FASE 16 — SEGURANÇA DOCUMENTAL

1. Teste XSS persistente/refletido com payload inerte nos campos textuais e confirme que aparece somente como texto seguro.
2. Teste manipulação de ID no detalhe do orçamento e isolamento entre entidades.
3. Valide autorização/autenticação local real para leitura dos dados; não invente controles ausentes.
4. Teste path traversal, separadores, caracteres reservados e nomes de arquivo longos no código do orçamento e nome do cliente.
5. Confirme sanitização do nome sem colisão perigosa e sem gravação fora do destino escolhido.
6. Verifique `javascript:`, `file:`, links externos, anexos e ações no PDF.
7. Inspecione logs e respostas para stack trace, SQL, caminho local, tokens e dados de outro cliente.
8. Confirme que imagens aceitas têm tipo e conteúdo compatíveis e não são interpretadas como código.
9. Teste negação de serviço segura com logo/texto/quantidade no limite, sem ultrapassar limites autorizados.
10. Não execute payload destrutivo, malware ou exploração fora do ambiente isolado.

## FASE 17 — DESEMPENHO E ESCALA

1. Meça tempo da consulta financeira sem cache e com cache, geração do modelo, geração do PDF, download, tamanho e memória perceptível.
2. Teste conjunto financeiro volumoso representativo, incluindo muitas despesas e categorias.
3. Teste orçamento com 100 itens ou o limite real, muitas parcelas e termos longos.
4. Registre hardware, ambiente, volume, repetições, mediana e pior caso. Não use uma única medição como conclusão.
5. Confirme que a interface permanece responsiva, exibe progresso e evita clique duplicado.
6. Procure consultas N+1, payload excessivo, renderização bloqueante e crescimento de memória a cada geração.
7. Gere documentos repetidamente e verifique vazamento de object URLs, listeners, janelas e blobs.
8. Defina critérios mensuráveis a partir dos requisitos existentes. Se não houver SLA, relate os números sem inventar um limite oficial e proponha uma meta separadamente.

## FASE 18 — CORREÇÃO E RETESTE

Para cada defeito:

1. reproduza no fluxo real;
2. registre evidência anterior à correção;
3. determine causa raiz e camada;
4. crie ou ajuste teste automatizado que falhe antes, quando razoável;
5. faça a menor correção coerente;
6. não altere números esperados para fazer o teste passar;
7. não remova conteúdo necessário para ocultar problema de paginação;
8. não enfraqueça validação, segurança ou confidencialidade;
9. rode teste focado, lint e typecheck relevantes;
10. rode regressão dos módulos compartilhados;
11. gere novamente o PDF pelo fluxo real;
12. repita extração, renderização e inspeção de todas as páginas;
13. atualize matriz, achado e evidência.

Se a correção afetar o gerador compartilhado, reteste pelo menos um documento não alvo que use o mesmo utilitário para impedir regressão. Se exigir decisão contábil, fiscal, jurídica, de identidade visual ou mudança ampla de produto, documente opções e aguarde aprovação.

## FASE 19 — REGRESSÃO OBRIGATÓRIA

Execute, conforme os comandos reais do projeto:

- testes unitários dos cálculos e apresentação;
- testes dos contratos;
- integrações da API de Relatórios;
- integrações da API de Orçamentos e Financeiro imediatamente afetadas;
- testes do modelo documental financeiro;
- testes do gerador e qualidade do orçamento;
- E2E do Relatório Financeiro;
- E2E de Orçamentos;
- geração de documento longo;
- inspeção automatizada dos PDFs;
- lint;
- typecheck;
- regressão web;
- regressão API;
- testes Electron relacionados ao download, assets e segurança local;
- smoke no aplicativo empacotado, se um candidato íntegro estiver disponível.

Registre comando, diretório, versão, código de saída, quantidade exata de testes, duração e falhas. Não esconda falhas herdadas: se não forem causadas pela auditoria, identifique-as como herdadas e explique seu impacto.

## FASE 20 — LIMPEZA E RECONCILIAÇÃO FINAL

1. Feche leitores, prévias e janelas temporárias.
2. Remova apenas registros com o prefixo da campanha e confirme relacionamentos/dependências.
3. Remova somente downloads intermediários sintéticos. Preserve as evidências enumeradas no protocolo.
4. Verifique banco, diretório de download, perfil/cache, temporários e sistema de arquivos.
5. Confirme ausência de registros, anexos, object files, blobs, pastas e relacionamentos órfãos.
6. Restaure apenas configurações sintéticas do perfil descartável; não toque nas configurações reais do usuário.
7. Compare contagens e hashes da linha de base quando aplicável.
8. Revise o `git diff` e liste exatamente os arquivos alterados pela correção/documentação.
9. Se houver resíduos, registre IDs, caminhos, tamanho, risco e instrução segura de remoção.

## CRITÉRIOS DE APROVAÇÃO

### Relatório Financeiro

Só pode ser aprovado se:

- todos os indicadores e séries reconciliam em centavos com o oráculo;
- período, fuso, filtros, tela, API e PDF representam o mesmo universo;
- registros cancelados, estornados, excluídos, rejeitados ou fora do período são tratados corretamente;
- mutações e cache não deixam dados obsoletos;
- PDF real foi baixado, validado, extraído, renderizado e inspecionado em todas as páginas;
- identidade, critérios, alertas, paginação e formatação estão corretos;
- estados vazio, parcial, erro e volume foram cobertos;
- não há P0/P1 pendente.

### Orçamento/Proposta Comercial

Só pode ser aprovado se:

- total persistido, cálculo independente, interface e PDF reconciliam em centavos;
- itens opcionais, ajustes, impostos e parcelas obedecem às regras;
- código, versão, status, emissão e validade estão corretos;
- marca-d'água representa o status e é legível;
- informações internas e dados de outros clientes estão ausentes de conteúdo visível, texto extraído, bytes e metadados;
- identidade empresarial está atual e isolada por perfil;
- documento mínimo, médio e longo foram renderizados e inspecionados integralmente;
- falhas de geração não produzem falso sucesso ou arquivo enganoso;
- não há P0/P1 pendente.

### Prontidão geral

Classifique como **REPROVADA** se ocorrer qualquer um dos seguintes:

- valor financeiro materialmente incorreto;
- mistura de período, versão, status, cliente ou snapshot;
- documento enviado como válido apesar de ser rascunho/cancelado/expirado;
- vazamento de custo, margem, conta, nota interna, segredo ou dado de outro cliente;
- PDF corrompido, ilegível ou com conteúdo essencial cortado;
- falso sucesso de geração que induza o usuário a acreditar que possui um documento válido;
- ausência de evidência do arquivo real.

Bloqueios físicos podem resultar em **APROVADA COM RESSALVAS** apenas quando o núcleo lógico e integrado estiver comprovado, não houver P0/P1 pendente e cada bloqueio estiver descrito com pré-requisito objetivo para encerramento.

## CLASSIFICAÇÃO DOS ACHADOS

- **P0 — Crítico:** vazamento real/sistemático de dados sensíveis ou de outro cliente; corrupção/perda de dados; documento financeiro gravemente falso que possa causar dano imediato; execução insegura pelo PDF.
- **P1 — Alto:** total, imposto, parcela, status, versão, validade ou período incorreto; proposta divulga custo/margem/conta/nota interna; documento principal inutilizável; marca obrigatória ausente; bloqueio sério de acessibilidade; falso sucesso material.
- **P2 — Médio:** campo público relevante ausente/incorreto; quebra de página relevante; cache obsoleto recuperável; validação insuficiente; nome de arquivo inadequado; erro sem recuperação clara; inconsistência visual que prejudica entendimento.
- **P3 — Baixo:** detalhe visual/textual menor, desalinhamento sem perda de informação ou melhoria recomendada.

## ENTREGÁVEIS OBRIGATÓRIOS

1. `RELATORIO.md` com resumo executivo e veredito por frente.
2. `MATRIZ-DE-COBERTURA.md` completa, sem item sem situação.
3. `ACHADOS.md` com ID, gravidade, documento, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
4. `MAPA-DE-DADOS-E-ORIGENS.md` com rastreabilidade campo a campo.
5. `CADERNO-DE-ORACULOS.md` com cálculos independentes em centavos.
6. `PROTOCOLO-DE-DOCUMENTOS.md` com inventário, SHA-256 e inspeção individual dos PDFs.
7. `SEGURANCA-E-CONFIDENCIALIDADE.md` com campos permitidos/proibidos e resultados das buscas.
8. PDFs sintéticos representativos mantidos como evidência.
9. texto extraído de cada PDF relevante.
10. imagens renderizadas de todas as páginas dos PDFs de evidência.
11. capturas da interface, logs mínimos, respostas sanitizadas e consultas de verificação.
12. relação de arquivos alterados e motivo.
13. comandos de teste com resultados exatos.
14. contagem final de aprovados, aprovados após correção, reprovados pendentes, bloqueados e não aplicáveis.
15. riscos residuais e testes que exigem leitor de tela, diálogo nativo, aplicação empacotada ou impressora virtual/ambiente físico.
16. melhorias não implementadas, priorizadas por benefício, esforço e risco.
17. confirmação da limpeza ou inventário exato de resíduos.

## FORMATO DE CADA ACHADO

```text
ID:
Título:
Gravidade: P0 | P1 | P2 | P3
Documento: Financeiro | Orçamento | Ambos
Camada: Banco | API | Contrato | Interface | Cálculo | PDF | Impressão | Acessibilidade | Segurança
Rota/fluxo:
Pré-condições:
Dados sintéticos/IDs:
Passos para reproduzir:
Resultado esperado:
Resultado obtido:
Impacto:
Evidência antes:
Causa raiz:
Arquivos, endpoints e tabelas envolvidos:
Correção aplicada:
Testes automatizados:
Reteste manual:
Evidência depois:
Situação final:
```

## TABELAS OBRIGATÓRIAS NO RELATÓRIO FINAL

### Reconciliação financeira

| Métrica | Banco bruto | Oráculo | API | Interface | PDF | Diferença | Resultado |
|---|---:|---:|---:|---:|---:|---:|---|
| Receita contratada | | | | | | | |
| Receita recebida | | | | | | | |
| Receita pendente | | | | | | | |
| Receita vencida | | | | | | | |
| Despesas pagas | | | | | | | |
| Resultado de caixa | | | | | | | |
| Impostos previstos | | | | | | | |
| Taxa de conversão | | | | | | | |

### Reconciliação do orçamento

| Componente | Banco | Oráculo | Cálculo do produto | Interface | PDF | Diferença | Resultado |
|---|---:|---:|---:|---:|---:|---:|---|
| Subtotal bruto | | | | | | | |
| Ajustes por item | | | | | | | |
| Reembolsáveis | | | | | | | |
| Taxas de repasse | | | | | | | |
| Desconto global | | | | | | | |
| Acréscimo global | | | | | | | |
| Impostos incluídos | | | | | | | |
| Impostos por fora | | | | | | | |
| Total final | | | | | | | |
| Soma das parcelas | | | | | | | |

### Confidencialidade

| Marcador/campo proibido | UI pública | Texto extraído | Bytes/objetos | Metadados | Resultado |
|---|---|---|---|---|---|
| Nota interna | | | | | |
| Custo interno | | | | | |
| Conta financeira | | | | | |
| Lucro/margem/markup | | | | | |
| IDs/caminhos/segredos | | | | | |
| Dados de outro cliente | | | | | |

### Inventário dos documentos

| ID | Tipo | Período/versão/status | Arquivo | Páginas | Tamanho | SHA-256 | Estrutura | Texto | Render | Visual | Resultado |
|---|---|---|---|---:|---:|---|---|---|---|---|---|

## FORMATO DA RESPOSTA FINAL

Comece pelo resultado real, não pelo processo. Informe nesta ordem:

1. status geral: APROVADA, APROVADA COM RESSALVAS ou REPROVADA;
2. status independente do Relatório Financeiro e do Orçamento;
3. cobertura obtida em números;
4. quantidade de PDFs gerados e páginas inspecionadas;
5. defeitos encontrados por gravidade e quantos foram corrigidos;
6. resultado da reconciliação financeira e do orçamento, com diferença em centavos;
7. resultado da busca por conteúdo confidencial;
8. pendências e bloqueios;
9. testes executados e resultados exatos;
10. links para relatório, matriz, oráculos, protocolo, PDFs e imagens renderizadas;
11. confirmação de limpeza;
12. recomendação objetiva: liberar ou não os relatórios para uso real.

Não use frases vagas como “parece correto”, “o PDF abriu”, “os valores batem visualmente” ou “a maioria foi testada”. Use números, IDs, hashes, fórmulas, diferenças em centavos, quantidade de páginas e evidências reproduzíveis.

## EXEMPLO DE ABERTURA DA RESPOSTA FINAL

```text
Status geral: REPROVADA.

Relatório Financeiro: APROVADO COM RESSALVAS — 68/70 critérios encerrados, diferença de R$ 0,00 entre banco, oráculo, API, interface e PDF; dois testes físicos bloqueados.

Orçamento: REPROVADO — 74/77 critérios encerrados; 1 P1 pendente porque a proposta substituída foi gerada sem marca-d'água. Os 9 marcadores internos ficaram ausentes dos 6 PDFs e de seus metadados.

Foram gerados 10 PDFs, totalizando 31 páginas; todas foram extraídas e renderizadas. Encontrados 7 defeitos (0 P0, 2 P1, 4 P2 e 1 P3), dos quais 6 foram corrigidos e retestados. Não liberar propostas comerciais até corrigir DOC-ORC-004.
```

Adapte apenas os valores e estados aos resultados comprovados. Nunca reutilize o exemplo como conclusão.
