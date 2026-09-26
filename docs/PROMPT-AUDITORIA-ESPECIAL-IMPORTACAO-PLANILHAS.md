# Prompt de auditoria especializada — Importação de planilhas

Este é um roteiro completo, e não apenas uma validação final reduzida. A escolha é intencional: a importação possui dois motores, transforma dados externos não confiáveis em várias entidades do GeoGestor e pode produzir duplicidade, associações incorretas ou lançamentos financeiros errados. A Sessão 14 oferece uma boa linha de base, mas não substitui uma auditoria especializada depois de mudanças nos componentes de importação.

---

## PROMPT PARA COPIAR E EXECUTAR

Você atuará como engenheiro sênior de QA full stack, especialista em importação e migração de dados, planilhas CSV/XLSX, modelagem relacional, integridade financeira, aplicações Electron, UX, acessibilidade WCAG 2.2 AA, segurança de arquivos e recuperação transacional.

Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** todo o fluxo de importação de planilhas do GeoGestor, desde a seleção do arquivo até a confirmação dos registros na interface, API, banco de dados, sistema de arquivos, histórico e módulos consumidores.

O escopo possui dois produtos distintos:

1. **Importação simples por cadastro**, atualmente destinada a Clientes, Projetos e Contatos;
2. **Migração completa de planilha**, capaz de interpretar e relacionar Clientes, Propriedades, Projetos, Orçamentos, Faturamentos/Notas, Contas a receber, Recebimentos, Despesas e totais históricos conforme o contrato real.

Não considere uma importação aprovada porque apareceu um toast de sucesso, porque algumas linhas foram gravadas ou porque a API respondeu HTTP 200/201/202. Comprove a cadeia completa:

```text
arquivo CSV/XLSX não confiável
  → leitura e seleção da aba
  → detecção do cabeçalho
  → normalização das células
  → mapeamento automático/manual/ignorado
  → prévia e validações
  → reconhecimento de duplicidades e associações
  → confirmação explícita
  → idempotência, fila e transação
  → banco + outbox/sistema de arquivos + auditoria
  → histórico e relatório de erros
  → telas consumidoras e reconciliação financeira
```

Todo registro, vínculo e total financeiro importado deve ser comparado com um oráculo independente. Corrija defeitos comprovados dentro do escopo, execute regressão e documente evidências reproduzíveis.

## POR QUE USAR O ROTEIRO COMPLETO

Use esta auditoria completa agora porque:

- a auditoria anterior tratou importação como parte de uma sessão administrativa maior;
- a importação simples e a migração completa têm contratos, limites e estratégias de atomicidade diferentes;
- o processamento envolve frontend, parser, contratos, múltiplas rotas, worker, SQLite, auditoria e sistema de arquivos;
- mudanças em mapeamento, prévia, esquemas ou worker podem alterar silenciosamente muitos registros;
- arquivos de importação foram modificados depois da linha de base anterior e precisam de nova comprovação integrada.

Depois que este roteiro for aprovado, uma revalidação futura poderá ser reduzida somente se não houver mudança material no pipeline e houver um relatório especializado ainda válido. Considere material qualquer alteração em parser CSV/XLSX, limites, detecção de cabeçalho/aba, mapeamento, schemas, normalização, prévia, digest, idempotência, worker, transação, entidades importadas, outbox, histórico ou consumidores.

## CONFIGURAÇÃO DA AUDITORIA

- Auditoria: **Importação de planilhas e migração de dados**;
- Módulos principais: **Importação de dados** e **Esquemas de importação**;
- Rotas principais: `/importacao` e `/importacao/esquemas`;
- Integrações permitidas: Clientes, Contatos, Propriedades, Projetos, Orçamentos, Financeiro, Documentos, Qualidade de Dados, Logs de Auditoria e Configurações somente para criar fixtures ou comprovar efeitos da importação;
- Formatos principais: `.csv` e `.xlsx`;
- Modos: importação simples e migração completa;
- Implementar correções comprovadas: **SIM**;
- Criar novos tipos de importação, entidades, formatos, heurísticas sem requisito ou mudanças de produto: **NÃO sem aprovação expressa**;
- Importar planilhas reais do usuário: **NÃO**;
- Diretório da auditoria: `docs/auditorias/[AAAA-MM-DD]-importacao-planilhas/`;
- Prefixo dos registros: `QA-IMPORT-[DATA-HORA]-`.

Se nomes, rotas, formatos, limites ou entidades tiverem mudado, documente a implementação real e adapte a matriz. Não invente recursos ausentes: marque-os como **NÃO APLICÁVEL**.

## RELATÓRIOS ANTERIORES OBRIGATÓRIOS

Leia integralmente antes de testar:

- `docs/auditorias/2026-09-16-configuracoes-administracao/RELATORIO.md`;
- `docs/auditorias/2026-09-16-configuracoes-administracao/IMPORTACOES.md`;
- `docs/auditorias/2026-09-16-configuracoes-administracao/CADERNO-DE-ORACULOS.md`;
- `docs/auditorias/2026-09-16-configuracoes-administracao/MAPA-DE-DADOS-E-SEGURANCA.md`;
- auditorias posteriores de Clientes, Projetos, Orçamentos, Financeiro, Cadastros/Propriedades, Relatórios e Release que possam ter alterado consumidores;
- `AGENTS.md` e Web Interface Guidelines aplicáveis.

Resultados antigos são linha de base, não aprovação atual. Converta cada correção, ressalva, limitação e bloqueio anterior em item explícito de reteste.

## DECISÕES INDEPENDENTES OBRIGATÓRIAS

Emita decisões separadas para:

1. leitura e interpretação de CSV;
2. leitura e interpretação de XLSX;
3. importação simples de Clientes;
4. importação simples de Projetos e associação de clientes;
5. importação simples de Contatos;
6. migração completa e reconciliação multi-entidade;
7. esquemas de importação;
8. histórico, linhas e CSV de erros;
9. atomicidade, idempotência, concorrência e recuperação;
10. segurança e privacidade;
11. UX e acessibilidade;
12. prontidão geral para importar dados reais.

Use: **APROVADA**, **APROVADA COM RESSALVAS**, **REPROVADA**, **BLOQUEADA** ou **NÃO APLICÁVEL**. Um modo aprovado não compensa falha em outro.

## REGRAS DE SEGURANÇA E AUTORIDADE

1. Descubra o banco, perfil, API, pasta de documentos e processos ativos antes de qualquer mutação.
2. Confirme por evidência qual banco está conectado ao frontend; não presuma pelo nome do arquivo.
3. Use banco, perfil, pasta de documentos e arquivos exclusivamente descartáveis.
4. Produza snapshot verificável antes da primeira importação.
5. Nunca importe uma planilha real do usuário nesta auditoria.
6. Nunca altere ou exclua registros preexistentes; use apenas o prefixo da campanha.
7. Não abra CSV/XLSX em software que possa executar macros ou conexões externas. Use parsers controlados e o próprio fluxo do GeoGestor.
8. Não permita que fórmulas, macros, objetos OLE, links, nomes definidos ou conexões da planilha sejam executados.
9. Não registre conteúdo integral de linhas com CPF/CNPJ, telefone, e-mail ou endereço em logs/evidências.
10. Redija tokens, cookies, chaves, caminhos pessoais e dados sensíveis.
11. Antes de confirmar uma migração completa, confira arquivo, hash, aba, cabeçalho, número de linhas, mapeamento e `previewId`.
12. Não use mocks como prova final. A aprovação exige importação pela interface real e verificação no backend/persistência.
13. Não altere o arquivo ou o payload para fazer a prévia anterior passar; gere uma nova prévia.
14. Se a limpeza falhar, não faça exclusão em massa. Registre IDs e resíduos exatos.

## LIMITES ATUAIS A RECONFIRMAR

Não presuma que continuam iguais. Na linha de base atual, verifique:

- arquivos `.csv` e `.xlsx`;
- limite de arquivo no frontend de 20 MiB;
- corpo da API de migração completa limitado a 25 MiB;
- migração completa com até 20.000 linhas e 300 colunas;
- no máximo 300 caracteres por cabeçalho/chave;
- célula textual com até 20.000 caracteres;
- importação simples de 1 a 500 registros por lote;
- prévia obrigatória na migração completa;
- uma importação completa pesada por vez;
- prévia vinculada ao digest de conteúdo/mapeamento, com expiração e uso único;
- histórico limitado e detalhes por linha;
- arquivo CSV de erros disponível por execução.

Registre qualquer divergência entre frontend e servidor como achado. O servidor deve impor seus próprios limites.

## DADOS E ARQUIVOS MÍNIMOS

Crie programaticamente arquivos sintéticos pequenos e auditáveis. Registre SHA-256 de cada um.

### CSV

- UTF-8 sem BOM;
- UTF-8 com BOM;
- separador vírgula;
- separador ponto e vírgula;
- separador tabulação, se o parser declarar suporte;
- finais de linha CRLF e LF;
- campos entre aspas com separador interno;
- texto multilinha entre aspas;
- aspas escapadas;
- linhas vazias antes, dentro e depois da tabela;
- cabeçalhos duplicados, vazios, com espaços, acentos e caixa diferente;
- coluna extra e coluna ausente;
- arquivo vazio, somente cabeçalho e somente linhas vazias;
- encoding incompatível ou bytes inválidos;
- extensão maiúscula;
- extensão falsa e MIME incoerente;
- exatamente no limite e imediatamente acima do limite.

### XLSX

- uma aba simples;
- várias abas, sendo uma claramente mais adequada;
- aba escolhida automaticamente e troca manual, se disponível;
- cabeçalho na primeira linha e nas linhas 2, 6 e 20;
- cabeçalho depois da janela máxima detectável;
- células mescladas;
- linhas/colunas ocultas;
- datas nativas do Excel;
- números, moeda, percentual e booleanos nativos;
- células de fórmula com resultado armazenado;
- fórmula sem resultado armazenado;
- strings começando com `=`, `+`, `-` e `@`;
- hiperlinks e URLs;
- arquivo protegido por senha;
- workbook corrompido/truncado;
- arquivo ZIP renomeado;
- `.xls`, `.xlsm`, `.ods` e formatos não suportados;
- alta taxa de compactação/zip bomb apenas por fixture segura e limitada;
- exatamente no limite e imediatamente acima dele.

### Conteúdo de domínio

Inclua:

- pessoas físicas e jurídicas com CPF/CNPJ sintéticos válidos;
- documento ausente, inválido, formatado, sem máscara e duplicado;
- mesmo documento para mesmo nome e para nomes conflitantes;
- e-mail em maiúsculas, inválido e com espaços;
- telefone móvel/fixo, com `+55`, máscara, espaços, inválido e zeros à esquerda;
- nomes com acentos, apóstrofo, hífen, espaços repetidos e tamanho máximo;
- cliente ativo, inativo, excluído e homônimos;
- projetos com cliente por ID, CPF/CNPJ, nome exato, nome ambíguo, inexistente e associação manual;
- projetos duplicados após normalização;
- propriedade com nome, matrícula/identificador e área;
- orçamento, faturamento, conta a receber, recebimento e despesa relacionados;
- valores `0`, negativos, altos, com centavos, `1.234,56`, `1,234.56`, `R$`, espaços e parênteses;
- percentuais e quantidades fracionárias;
- datas ISO, `dd/mm/aaaa`, serial Excel, inválidas, ano bissexto, fronteira de mês e fuso;
- status com acentos, sinônimos, caixa/espaço diferentes e valor desconhecido;
- campos opcionais vazios, `null`, espaços e valores incompatíveis;
- texto longo, Unicode e payload semelhante a HTML/JavaScript tratado como texto inerte.

### Volumes

- 1 linha;
- lote misto pequeno;
- 499, 500 e 501 linhas para importação simples;
- 19.999, 20.000 e 20.001 linhas para migração completa;
- 299, 300 e 301 colunas;
- arquivo próximo de 20 MiB e acima do limite;
- repetição suficiente para medir memória e tempo.

## FASE 1 — PREPARAÇÃO E LINHA DE BASE

1. Localize todos os `AGENTS.md` aplicáveis.
2. Verifique Git e preserve alterações preexistentes.
3. Identifique Electron, frontend, API, banco, pasta de documentos, portas, comandos e suítes.
4. Registre versões de parsers CSV/XLSX, framework, runtime e bibliotecas relacionadas.
5. Confirme que frontend, API e banco pertencem ao ambiente isolado.
6. Registre contagens iniciais por entidade, valores financeiros, árvore de pastas, logs, console e requisições com falha.
7. Verifique migrations das tabelas de histórico de importação.
8. Crie a pasta:

```text
docs/auditorias/[AAAA-MM-DD]-importacao-planilhas/
├── RELATORIO.md
├── MATRIZ-DE-COBERTURA.md
├── ACHADOS.md
├── MAPA-DO-PIPELINE.md
├── CADERNO-DE-ORACULOS.md
├── INVENTARIO-DE-ARQUIVOS.md
├── RECONCILIACAO.md
├── SEGURANCA-E-PRIVACIDADE.md
├── DESEMPENHO.md
├── COMANDOS-E-RESULTADOS.md
├── ARQUIVOS-ALTERADOS.md
├── MELHORIAS-NAO-IMPLEMENTADAS.md
└── evidencias/
```

## FASE 2 — INVENTÁRIO E RASTREABILIDADE

Produza uma matriz com uma linha por controle, regra, campo, entidade e estado contendo:

- ID;
- modo simples/completo;
- rota/tela/etapa;
- formato de arquivo;
- ação esperada;
- parser/função frontend;
- cabeçalho de origem;
- campo mapeado;
- regra de normalização;
- endpoint/método/schema;
- serviço/worker;
- tabela/coluna e relação;
- efeito no sistema de arquivos;
- histórico/auditoria;
- cenários positivo, negativo, vazio, limite, erro e concorrência;
- situação e evidência.

Construa os fluxos reais:

```text
Importação simples:
arquivo → parser → entidade → mapeamento → prévia/revisão
        → POST em lote + Idempotency-Key → transação por regra
        → histórico por linha → consumidor

Migração completa:
arquivo → aba/cabeçalho → mappingOverrides → hash/digest
        → prévia persistida com TTL → confirmação de uso único
        → fila/worker exclusivo → transação multi-entidade
        → outbox de filesystem → histórico → reconciliação
```

Para cada coluna reconhecida, determine se o método é exato, semântico ou manual. Para cada coluna ignorada/não reconhecida, prove que não foi silenciosamente gravada no campo errado.

## FASE 3 — PARSING DE CSV

1. Teste todas as fixtures CSV pela interface real.
2. Confirme separador, aspas, quebras de linha, BOM, espaços e encoding.
3. Garanta que linha multilinha não altera numeração de registro exibida.
4. Verifique tratamento de linha vazia e coluna ausente.
5. Confirme que cabeçalhos duplicados recebem identidade estável e compreensível.
6. Teste cancelamento da leitura e seleção de novo arquivo.
7. Force erro do parser e valide mensagem com correção sugerida.
8. Confirme que o conteúdo bruto não é enviado ou logado além do necessário ao contrato.
9. Verifique que valores longos não congelam a UI nem quebram a prévia.
10. Garanta que fórmulas textuais permanecem texto e não são executadas.

## FASE 4 — PARSING DE XLSX

1. Teste seleção de workbook e leitura sem abrir Excel.
2. Inventarie todas as abas e prove a regra de escolha automática.
3. Teste empates, abas vazias, ocultas e nomes longos/Unicode.
4. Confirme detecção de cabeçalho nas primeiras linhas previstas e comportamento fora da janela.
5. Teste títulos acima da tabela, observações, células mescladas e colunas vazias.
6. Verifique datas seriais, sistema 1900/1904 se aplicável e datas antes/depois de 1900.
7. Valide números nativos versus strings formatadas.
8. Não execute macros, fórmulas, links ou conexões externas.
9. Teste arquivo corrompido, protegido e com formato/extensão divergente.
10. Meça memória/tempo de decomprimir e analisar arquivo próximo ao limite.
11. Garanta recusa segura de arquivo comprimido abusivo sem esgotar memória/disco.

## FASE 5 — DETECÇÃO DE CABEÇALHO, ABA E DIMENSÕES

1. Recalcule independentemente qual linha/aba deve ser considerada.
2. Confira o que a interface informa antes de avançar.
3. Teste cabeçalho único, duplicado, vazio e composto por números.
4. Teste alteração manual quando suportada.
5. Confirme que `firstDataRow` representa a linha real da planilha.
6. Valide contagem de linhas depois de remover apenas linhas realmente vazias.
7. Teste exatamente 300 e 301 colunas e 20.000/20.001 linhas.
8. Confirme limites equivalentes no frontend e na API.
9. Garanta que colunas após o limite não sejam truncadas silenciosamente.
10. Alterar aba, cabeçalho ou dimensão deve invalidar a prévia anterior.

## FASE 6 — MAPEAMENTO DE COLUNAS

1. Inventarie todos os campos de destino permitidos.
2. Teste correspondência exata com acentos, caixa e separadores.
3. Teste sugestões semânticas com nomes próprios do usuário.
4. Sugestão semântica não pode ser gravada sem confirmação quando o contrato exigir.
5. Teste troca manual, redefinição e opção de ignorar.
6. Teste duas colunas apontando para o mesmo campo e aliases duplicados.
7. Confirme bloqueio de campos obrigatórios ausentes.
8. Verifique confiança, método e explicação apresentados.
9. Garanta que alteração do mapeamento recalcula contagens, problemas e totais.
10. Confirme foco no primeiro erro e navegação por teclado.
11. Salve esquema quando permitido e valide autoridade SQLite/cache.
12. Recarregue e prove persistência ou fallback seguro.
13. Cache local ausente, antigo ou corrompido não pode substituir a fonte autoritativa.
14. Esquema de uma entidade/formato não pode contaminar outro.

## FASE 7 — NORMALIZAÇÃO E VALIDAÇÃO POR CÉLULA

Para cada campo importável, registre entrada, valor normalizado, regra e destino.

Teste:

- trim sem alterar conteúdo interno legítimo;
- normalização de espaços e caixa apenas onde semântica permitir;
- preservação de zeros à esquerda;
- CPF/CNPJ com validação real, não apenas comprimento;
- telefone nacional e DDD;
- e-mail e Unicode;
- datas civis sem deslocamento UTC;
- serial Excel e arredondamento;
- moeda para inteiro em centavos;
- separador decimal/milhar ambíguo;
- percentuais e quantidades;
- booleanos `sim/não`, verdadeiro/falso e variantes documentadas;
- enums/status conhecidos e desconhecidos;
- nulo, vazio e zero como valores diferentes;
- limites mínimo/máximo;
- texto hostil sempre inerte.

Validação apenas no frontend não é suficiente. Envie payloads diretamente à API e confirme recusa/normalização no servidor.

## FASE 8 — IMPORTAÇÃO SIMPLES DE CLIENTES

1. Cubra todos os campos disponíveis no mapeamento.
2. Importe PF e PJ válidas.
3. Teste CPF/CNPJ ausente, inválido e duplicado.
4. Teste nome duplicado com e sem documento.
5. Confirme política entre criar, atualizar, ignorar ou rejeitar.
6. Verifique normalização de telefone/e-mail.
7. Teste lote totalmente válido, totalmente inválido e parcial.
8. Reconcile linhas, resultado, banco, auditoria e histórico.
9. Confirme criação de pasta/outbox quando aplicável.
10. Falha do filesystem deve produzir estado consistente e recuperável, não rollback indevido ou sucesso falso.
11. Abra os clientes importados e confira busca, filtros e detalhes.
12. Reimporte o mesmo conteúdo e prove ausência de duplicação indevida.

## FASE 9 — IMPORTAÇÃO SIMPLES DE PROJETOS

1. Teste associação automática por ID/documento/nome conforme contrato.
2. Teste cliente inexistente, inativo, excluído, ambíguo e homônimo.
3. Associação ambígua ou ausente deve exigir decisão manual.
4. Use o combobox remoto, busca, teclado, limpar e trocar seleção.
5. Atualize uma única linha pendente e prove que as demais não mudaram.
6. A confirmação deve permanecer bloqueada enquanto houver pendência.
7. Teste cliente alterado/inativado entre prévia e confirmação.
8. Teste projeto duplicado após normalização no mesmo lote e no banco.
9. Confirme datas, status, cidade, tipo e campos opcionais.
10. Reconcile projeto, cliente, pasta/outbox, histórico e telas consumidoras.
11. Reimporte e teste idempotência.

## FASE 10 — IMPORTAÇÃO SIMPLES DE CONTATOS

1. Teste nome obrigatório, função, empresa, e-mail e telefone.
2. Valide e-mail/telefone normalizados e limites.
3. Teste duplicidade pelo identificador real do domínio.
4. Teste parcial, zero sucesso e 500/501 linhas.
5. Confirme histórico por linha e ausência de PII no resumo.
6. Abra os contatos importados e confira busca/detalhe.
7. Reimporte com mesma chave e chave nova.

## FASE 11 — RESULTADO DA IMPORTAÇÃO SIMPLES

1. Confira estados `completed`, `completed_with_warnings`, `partial` e `failed` reais.
2. Não aceite `success: true` quando zero linhas foram importadas.
3. Compare total, importados, atualizados, ignorados, falhas e avisos.
4. Cada linha precisa indicar ação, ID quando permitido e erro acionável.
5. Teste voltar, corrigir arquivo e tentar novamente.
6. Atualização da tela deve preservar histórico sem repetir mutação.
7. Toast, painel final e API devem concordar.
8. Falha posterior à gravação não pode comunicar rollback se o commit ocorreu; o contrato deve ser inequívoco.

## FASE 12 — MIGRAÇÃO COMPLETA: PRÉVIA

1. Gere prévia pelo fluxo real com planilha ampla.
2. Registre `fileHash`, digest, aba, cabeçalho, primeira linha, mapeamento, `previewId` e expiração.
3. Compare contagens previstas por entidade com oráculo independente.
4. Confira colunas esperadas, reconhecidas, não reconhecidas, ignoradas e aliases duplicados.
5. Analise problemas `info`, `warning`, `ambiguous`, `blocking` e `historical`.
6. Problema impeditivo deve bloquear confirmação; aviso não deve ser apresentado como erro fatal.
7. Teste documento ausente, inválido, repetido para mesmo cliente e conflitante entre clientes.
8. Teste arquivo já importado e mensagem/ação correspondente.
9. Valide limitações declaradas: dados históricos que não viram entidades atuais devem permanecer explícitos.
10. Compare reconciliação financeira prevista em centavos.
11. Altere uma célula, nome, aba, cabeçalho ou mapeamento depois da prévia e tente confirmar. Deve falhar.
12. Teste expiração, preview inexistente, bloqueado, já usado e tipo incompatível.
13. Gere duas prévias e confirme concorrência conforme contrato.

## FASE 13 — MIGRAÇÃO COMPLETA: CONFIRMAÇÃO, FILA E WORKER

1. Confirme somente uma prévia `ready`, vigente e correspondente ao mesmo digest.
2. Valide resposta 202, `importId`, `pollUrl`, estágio e progresso.
3. Atualize/reabra a página durante processamento e acompanhe pelo histórico.
4. Teste polling lento, falha, resposta fora de ordem e reconexão.
5. Uma execução pesada por vez: segunda confirmação concorrente deve receber conflito seguro.
6. Duas confirmações do mesmo `previewId` devem gravar uma única vez.
7. Reinicie a API com execução queued e com status processing em ambiente descartável.
8. Confirme recuperação honesta de execução interrompida; não invente sucesso.
9. Verifique que o worker não processa payload alterado depois da fila.
10. Teste falha antes da transação, durante entidade intermediária, auditoria e finalização filesystem.
11. Não aceite registros parciais quando a transação deveria ser atômica.
12. Se outbox for pós-commit, comprove estado pendente e reprocessamento idempotente.

## FASE 14 — RECONCILIAÇÃO MULTI-ENTIDADE

Construa uma tabela por linha de origem e por entidade gerada:

| Linha | Cliente | Propriedade | Projeto | Orçamento | Faturamento | Recebível | Recebimento | Despesa | Resultado |
|---:|---|---|---|---|---|---|---|---|---|

Comprove:

1. clientes criados versus atualizados;
2. propriedades vinculadas ao cliente correto;
3. projetos vinculados a cliente/propriedade corretos;
4. orçamento, situação e data;
5. faturamento/nota conforme representação real;
6. conta a receber/parcela e vencimento;
7. recebimento e reconhecimento de caixa;
8. despesa, categoria e data;
9. relacionamentos e chaves estrangeiras;
10. origem marcada como migração quando prevista;
11. nenhum registro duplicado por linha ou replay;
12. nenhuma entidade criada a partir de coluna ignorada;
13. totais previstos/importados/diferença em centavos;
14. tratamento explícito dos totais históricos não materializados.

Abra Clientes, Propriedades, Projetos, Orçamentos, Financeiro e Relatórios para validar consumidores imediatos. Não faça auditoria completa desses módulos; prove apenas que os registros importados aparecem com valores e vínculos corretos.

## FASE 15 — ORÁCULOS FINANCEIROS

Calcule independentemente, em centavos:

- receita esperada;
- valor unitário × quantidade;
- impostos;
- receita esperada com imposto;
- valor faturado;
- contas a receber;
- recebimentos;
- despesas;
- custo, lucro e margem quando aplicáveis;
- totais históricos apenas informativos;
- diferença entre planilha e registros materializados.

Compare:

| Métrica | Planilha bruta | Normalizada | Prévia | Banco | Interface consumidora | Diferença |
|---|---:|---:|---:|---:|---:|---:|

Não use a função do produto como único oráculo. Confirme regras de arredondamento, sinais, zero/nulo, datas de competência/caixa e não duplicação entre faturamento, recebível e recebimento.

## FASE 16 — IDEMPOTÊNCIA, DUPLICIDADE E CONCORRÊNCIA

### Importação simples

1. Mesma `Idempotency-Key` + mesmo payload deve retornar replay, sem nova gravação.
2. Mesma chave + payload diferente deve retornar conflito.
3. Duas requisições simultâneas com a mesma chave devem criar uma execução lógica.
4. Chave ausente, vazia, longa e inválida deve seguir contrato seguro.
5. Nova chave com mesmo conteúdo deve obedecer às regras de duplicidade da entidade.

### Migração completa

1. Mesmo arquivo/hash já importado deve ser detectado.
2. Arquivo renomeado com conteúdo igual não deve burlar a proteção, conforme o contrato.
3. Conteúdo alterado com nome igual deve ser tratado como novo conteúdo.
4. Prévia é de uso único e ligada ao digest.
5. Duas confirmações simultâneas não podem duplicar.
6. Execução concorrente pesada deve ser recusada ou serializada claramente.
7. Reinício não pode reexecutar silenciosamente uma transação já concluída.

## FASE 17 — HISTÓRICO, LINHAS E CSV DE ERROS

1. Teste histórico vazio, preenchido, limite mínimo/máximo e ordenação.
2. Confira execução simples/completa, entidade, status, estágio, progresso, datas, contagens e duração.
3. Abra detalhes e linhas.
4. Filtro somente erros deve coincidir com a contagem.
5. IDs inexistentes e inválidos devem retornar códigos adequados.
6. Gere CSV de erros real e valide BOM, delimitador, aspas, quebras e nome de arquivo.
7. Neutralize fórmula de planilha no CSV exportado para células iniciadas por `=`, `+`, `-` ou `@` quando conteúdo do usuário puder chegar à exportação.
8. Não exponha payload completo, documentos, e-mail, telefone, endereço, caminhos, stack trace ou segredo.
9. Mensagens devem ser úteis sem revelar dados além do necessário.
10. Recarregue e reinicie a API para provar persistência do histórico.

## FASE 18 — ESQUEMAS DE IMPORTAÇÃO

1. Determine fonte autoritativa e função do cache local.
2. Teste lista vazia, criação automática após importação, reload e exclusão.
3. Teste esquema com entidade, mapeamento e data.
4. Corrompa somente o cache descartável: JSON inválido, objeto, array misto e item malformado.
5. Dados válidos do banco devem permanecer utilizáveis.
6. Falha ao salvar esquema depois de importação não pode transformar dados gravados em falso fracasso.
7. Teste concorrência de duas abas e estado obsoleto.
8. Confirme acessibilidade da tabela, ações e estado vazio.
9. Aplicar, editar, renomear, importar ou exportar esquema devem ser marcados NÃO APLICÁVEL se não existirem.

## FASE 19 — BACKEND, TRANSAÇÃO E PERSISTÊNCIA

Para cada endpoint:

1. registre método, schema, body limit, headers, resposta e códigos;
2. teste payload válido, inválido, ausente, extra, aninhado e excessivo;
3. teste autenticação/autorização local;
4. confirme schemas estritos quando aplicável;
5. verifique timestamps, normalização, unicidade e chaves estrangeiras;
6. injete falha em auditoria e confirme rollback quando parte da transação;
7. injete falha no outbox e confirme semântica pós-commit;
8. teste lock/conexão e duas instâncias quando houver suporte;
9. recarregue e reinicie para provar persistência;
10. confira logs operacionais sanitizados;
11. verifique consultas excessivas e transações longas;
12. prove que o arquivo original não é gravado no banco ou disco sem requisito explícito.

## FASE 20 — SEGURANÇA E PRIVACIDADE

1. Trate arquivo, nome, aba, cabeçalho e célula como entrada não confiável.
2. Teste XSS persistente/refletido em prévia, resultado, histórico e consumidores.
3. Teste prototype pollution com cabeçalhos como `__proto__`, `constructor` e `prototype` sem explorar fora do ambiente.
4. Teste formula injection no CSV de erros.
5. Teste path traversal no nome do arquivo e da aba.
6. Teste XML/ZIP malformado e descompressão excessiva de modo limitado.
7. Garanta que macros, links e fórmulas não executam.
8. Confirme ausência de upload arbitrário para pasta de documentos.
9. Verifique logs, auditoria, erros e histórico quanto a PII/segredos.
10. Teste manipulação de `previewId`, `importId`, digest e associação de cliente.
11. Garanta que uma execução não lê detalhes sensíveis de outra sessão/perfil.
12. Não use payload destrutivo nem planilha real.

## FASE 21 — UX, RESPONSIVIDADE E ACESSIBILIDADE

1. Percorra o fluxo somente com teclado.
2. Confirme foco visível, ordem lógica, Escape e retorno de foco.
3. Teste seletor de arquivo, modos, entidade, mapeamento, preview, associação manual, confirmação e resultado.
4. Erro deve estar associado ao controle e foco deve ir ao primeiro erro.
5. Mudanças assíncronas precisam de `aria-live`; progresso deve expor estado acessível.
6. Botão de confirmação deve bloquear corretamente sem impedir revisão.
7. Garanta que não há dupla submissão.
8. Teste 360, 768, 1024 e 1440 px, zoom 200%, texto longo e ausência de overflow acidental.
9. Teste claro/escuro, alto contraste e redução de movimento.
10. Tabelas grandes precisam de estratégia de desempenho e alternativa navegável.
11. Não dependa somente de cor para warning/blocking/success.
12. Teste leitor de tela real quando disponível.
13. Execute axe WCAG 2.2 A/AA como apoio, não substituto.
14. Revise português, números, moeda e datas via `Intl`.

## FASE 22 — DESEMPENHO E RESILIÊNCIA

1. Meça leitura, hashing, parsing, prévia, fila, processamento e finalização separadamente.
2. Registre máquina, runtime, tamanho, linhas, colunas, memória, mediana e pior caso.
3. Teste arquivo pequeno, médio e limites máximos.
4. Observe responsividade da interface e progresso.
5. Cancele/substitua arquivo durante parsing quando suportado.
6. Teste API lenta, queda antes/depois da confirmação e reconexão.
7. Reinicie com execução queued/processing.
8. Verifique vazamento de memória, listeners e buffers após importações repetidas.
9. Confirme que payload próximo de 25 MiB não é truncado silenciosamente.
10. Sem SLA oficial, registre tempos sem inventar aprovação; proponha metas separadamente.

## FASE 23 — CORREÇÃO E RETESTE

Para cada defeito:

1. reproduza no fluxo real;
2. preserve evidência anterior;
3. identifique causa raiz;
4. adicione teste que falhe antes quando razoável;
5. faça a menor correção coerente;
6. não ajuste fixture para esconder falha;
7. não enfraqueça validação ou transação;
8. rode testes focados, lint e typecheck;
9. repita importação pela interface;
10. reconcile banco, arquivos, histórico e consumidores;
11. execute regressão dos dois modos se o código for compartilhado;
12. atualize matriz e evidências.

Se a correção exigir uma decisão sobre substituir registros, tolerar duplicidade, interpretar colunas ambíguas ou materializar históricos, documente opções e aguarde aprovação.

## FASE 24 — REGRESSÃO OBRIGATÓRIA

Execute conforme o projeto atual:

- testes de parsing CSV/XLSX;
- testes de detecção de aba/cabeçalho;
- testes de mapeamento e esquemas;
- testes unitários de importação simples;
- integrações de Clientes, Projetos e Contatos em lote;
- integração de migração completa;
- confiabilidade/idempotência/worker;
- outbox e sistema de arquivos;
- histórico e CSV de erros;
- E2E de associação manual;
- E2E completo de CSV e XLSX;
- testes de consumidores imediatamente afetados;
- regressão web e API;
- Electron relacionado a arquivo/diálogo, se aplicável;
- typecheck, lint e build relevante.

Registre comando, diretório, versão, código de saída, duração e números exatos. Falhas herdadas devem permanecer visíveis com impacto explicado.

## FASE 25 — LIMPEZA

1. Liste todos os registros criados por entidade e ID.
2. Remova somente dados com prefixo da campanha, respeitando dependências.
3. Confirme limpeza em banco e telas consumidoras.
4. Processe ou inventarie outbox/pastas pendentes.
5. Remova apenas arquivos sintéticos temporários.
6. Preserve evidências sanitizadas enumeradas.
7. Limpe cache/esquemas sintéticos sem afetar configurações reais.
8. Confirme ausência de runs/rows sintéticos ou explique sua retenção de auditoria.
9. Compare contagens finais com a linha de base.
10. Revise `git diff` e liste alterações do escopo.

## CRITÉRIOS DE APROVAÇÃO

A prontidão geral só pode ser aprovada se:

- CSV e XLSX forem interpretados corretamente nos cenários representativos;
- limites forem aplicados no frontend e servidor;
- mapeamento ambíguo nunca for confirmado silenciosamente;
- importação simples das três entidades reconciliar por linha;
- associação de projetos impedir cliente errado;
- migração completa reconciliar todas as entidades e valores em centavos;
- prévia estiver ligada ao conteúdo/mapeamento, expirar e ser de uso único;
- idempotência e concorrência não gerarem duplicatas;
- falha transacional não deixar estado parcial indevido;
- outbox/finalização tiver estado honesto e recuperável;
- histórico e CSV de erros forem corretos e sanitizados;
- fórmulas, macros, XSS, path traversal e arquivos hostis não forem executados;
- interface real, API, banco, arquivos e consumidores tiverem sido comprovados;
- dados sintéticos forem limpos;
- não houver P0/P1 pendente.

Classifique como **REPROVADA** se houver:

- associação ao cliente errado;
- duplicidade por retry, concorrência ou reimportação;
- perda ou sobrescrita indevida de registro preexistente;
- total financeiro incorreto;
- prévia diferente do que foi gravado;
- confirmação de conteúdo alterado;
- importação parcial apresentada como completa;
- vazamento de PII/segredo;
- execução de fórmula/macro/script;
- transação quebrada com relações órfãs;
- zero linhas importadas apresentado como sucesso;
- ausência de evidência integrada.

## CLASSIFICAÇÃO DOS ACHADOS

- **P0:** corrupção/perda ampla, sobrescrita de dados reais, execução de conteúdo hostil, vazamento grave ou importação cruzada entre perfis.
- **P1:** cliente/vínculo/valor financeiro incorreto, duplicidade material, atomicidade quebrada, confirmação divergente da prévia ou fluxo principal inutilizável.
- **P2:** validação ausente, resultado/histórico incorreto, arquivo válido rejeitado, erro recuperável mal comunicado, cache/esquema inconsistente ou problema relevante de acessibilidade.
- **P3:** problema visual/textual menor ou melhoria não essencial.

## ENTREGÁVEIS OBRIGATÓRIOS

1. relatório executivo com veredito por decisão independente;
2. matriz completa de cobertura;
3. achados com reprodução, causa, correção e reteste;
4. mapa do pipeline e rastreabilidade campo → entidade → coluna;
5. inventário dos arquivos com SHA-256;
6. caderno de oráculos por linha e em centavos;
7. reconciliação banco/API/UI/consumidores;
8. evidências sanitizadas de prévia, progresso e resultado;
9. histórico e CSV de erros inspecionados;
10. relatório de segurança e privacidade;
11. medições de desempenho;
12. comandos e resultados exatos;
13. arquivos alterados e motivo;
14. melhorias não implementadas;
15. confirmação de limpeza ou resíduos exatos.

## FORMATO DE CADA ACHADO

```text
ID:
Título:
Gravidade: P0 | P1 | P2 | P3
Modo: Simples | Completa | Ambos
Formato: CSV | XLSX | Ambos | N/A
Camada: Parser | Mapeamento | Frontend | API | Worker | Banco | Filesystem | Histórico | Segurança | Acessibilidade
Rota/endpoint:
Arquivo sintético e SHA-256:
Pré-condições:
Passos:
Esperado:
Obtido:
Impacto:
Evidência antes:
Causa raiz:
Arquivos/tabelas envolvidos:
Correção:
Testes:
Reteste:
Evidência depois:
Situação final:
```

## FORMATO DA RESPOSTA FINAL

Comece pelo resultado real e informe:

1. status geral: APROVADA, APROVADA COM RESSALVAS ou REPROVADA;
2. resultado separado de CSV, XLSX, importação simples, migração completa, esquemas, histórico, segurança e acessibilidade;
3. cobertura em números;
4. quantidade de arquivos, linhas e entidades exercitadas;
5. reconciliação por entidade e diferença financeira em centavos;
6. defeitos por gravidade, corrigidos e pendentes;
7. testes e resultados exatos;
8. desempenho observado;
9. pendências/bloqueios;
10. limpeza/resíduos;
11. links para relatório e evidências;
12. recomendação objetiva: `LIBERAR IMPORTAÇÃO DE DADOS REAIS` ou `NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR`.

Não use “parece importar”, “algumas linhas funcionaram” ou “o arquivo foi aceito”. Use hashes, linhas, IDs, contagens, relações, centavos, estados transacionais e evidências reproduzíveis.
