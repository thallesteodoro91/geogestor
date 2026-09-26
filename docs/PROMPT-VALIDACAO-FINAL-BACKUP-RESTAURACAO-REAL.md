# Prompt de validação final — Restauração real e recuperação em outro ambiente

Use este roteiro para encerrar exclusivamente os bloqueios físicos remanescentes da auditoria de backup de 19/09/2026. Ele não substitui o prompt completo quando o código de backup, restauração, criptografia, Electron, banco ou armazenamento de documentos tiver mudado materialmente.

---

## PROMPT PARA COPIAR E EXECUTAR

Você atuará como engenheiro sênior de QA full stack, recuperação de desastre, Electron/Windows, SQLite/libSQL, criptografia aplicada, integridade de arquivos, UX e acessibilidade.

Sua tarefa é **VALIDAR, CORRIGIR SE NECESSÁRIO E RETESTAR** os dois únicos bloqueios essenciais ainda abertos no backup do GeoGestor:

1. restauração real no aplicativo instalado e reinício completo do Electron no **Dispositivo A**;
2. recuperação do mesmo backup em outro perfil Windows, VM ou computador independente, sem reutilizar a chave do ambiente original, no **Dispositivo B**.

Não repita toda a auditoria anterior sem necessidade. Use o relatório de 19/09/2026 como linha de base, execute uma regressão curta da criação/integridade e concentre as evidências no ciclo físico:

```text
GeoGestor instalado A
  → dados e documentos sintéticos
  → backup completo pelo fluxo real
  → cópia externa do bundle + método de recuperação
  → mutações posteriores conhecidas
  → restauração gerenciada em A
  → reinício real e reconciliação
  → ambiente limpo B, com outra chave
  → recuperação por código
  → novo snapshot limpo B
  → recuperação por kit
  → reinício real e reconciliação final
```

Um teste unitário, worker isolado, cópia manual do banco ou restauração em outra pasta no mesmo processo não encerra este roteiro. A aprovação exige uso do aplicativo desktop instalado, seletores nativos, encerramento/reinício real e um segundo ambiente Windows independente.

## CONFIGURAÇÃO

- Auditoria: **Validação final de restauração real e recuperação portátil**;
- Módulo: **Configurações → Backup e proteção de dados**;
- Rota principal: `/configuracoes?secao=backups`;
- Fluxos obrigatórios: backup completo, integridade, teste isolado, restauração real, recuperação por código e recuperação por kit;
- Ambiente A: instalação/perfil Windows descartável que cria o backup;
- Ambiente B: outro usuário Windows, VM ou computador limpo, com chave de dispositivo diferente;
- Dados reais: **PROIBIDOS**;
- Restauração no perfil cotidiano do usuário: **PROIBIDA**;
- Correções comprovadas no código: **SIM**;
- Mudanças de produto, novo formato de backup, nova criptografia ou provedor de nuvem: **NÃO sem aprovação expressa**;
- Commit, tag, publicação ou distribuição do instalador: **NÃO sem aprovação expressa**;
- Prefixo dos dados: `QA-BACKUP-FINAL-[DATA-HORA]-`;
- Evidências: `docs/auditorias/[AAAA-MM-DD]-validacao-final-backup/`.

## LINHA DE BASE OBRIGATÓRIA

Leia integralmente antes de agir:

- `docs/auditorias/2026-09-19-backup-recuperacao-desastre/RELATORIO.md`;
- `docs/auditorias/2026-09-19-backup-recuperacao-desastre/DISPOSITIVOS-A-B.md`;
- `docs/auditorias/2026-09-19-backup-recuperacao-desastre/CADERNO-DE-ORACULOS.md`;
- `docs/auditorias/2026-09-19-backup-recuperacao-desastre/ESPECIFICACAO-FORMATOS.md`;
- `docs/auditorias/2026-09-19-backup-recuperacao-desastre/MATRIZ-DE-COMPATIBILIDADE.md`;
- `docs/auditorias/2026-09-19-backup-recuperacao-desastre/SEGURANCA-E-PRIVACIDADE.md`;
- `docs/auditorias/2026-09-19-backup-recuperacao-desastre/ACESSIBILIDADE-HOMOLOGACAO-WINDOWS.md`;
- `docs/PROMPT-AUDITORIA-ESPECIAL-BACKUP-RECUPERACAO.md`;
- `AGENTS.md` e instruções aplicáveis.

Confirme o estado atual do código e dos testes. Se houve mudança material desde o relatório anterior em qualquer parte do pipeline de backup/restauração, interrompa este roteiro reduzido e execute primeiro o prompt completo.

Considere mudança material:

- alteração do formato do bundle ou manifesto;
- alteração de criptografia, envelopes, código ou kit de recuperação;
- alteração da cópia, validação ou restauração do banco;
- alteração da inclusão/restauração de documentos;
- alteração de autorização, preflight, teste isolado ou confirmação;
- alteração do processo worker, encerramento da API ou reinício Electron;
- alteração da chave do banco, armazenamento seguro ou diretórios;
- mudança de schema/migração que afete restauração;
- regressão automatizada relevante atualmente vermelha.

## CONDIÇÃO DE SEGURANÇA — NÃO PROSSIGA SEM ISOLAMENTO

Antes de qualquer restauração, prove documentalmente:

1. que A e B são descartáveis;
2. que não contêm dados reais;
3. que existe snapshot externo ou forma comprovada de recriá-los;
4. que os caminhos de banco, documentos, backup e perfil foram identificados exatamente;
5. que nenhum deles aponta para o perfil cotidiano do usuário;
6. que o destino de backup fica fora da pasta de documentos;
7. que a restauração não pode atingir outra instalação ativa;
8. que o bundle é exclusivamente sintético;
9. que o código e o kit de recuperação não serão registrados nas evidências.

Se qualquer item não puder ser provado, não restaure. Marque a etapa como **BLOQUEADA**, descreva o ambiente necessário e encerre sem tocar nos dados.

Não use como alvo:

- raiz de unidade;
- pasta pessoal do usuário;
- `%APPDATA%` do perfil cotidiano;
- instalação principal do GeoGestor;
- diretório com dados cuja origem não foi identificada;
- caminho contendo variável não resolvida;
- pasta compartilhada por A e B como banco/documentos ativos.

## AMBIENTES MÍNIMOS

### Dispositivo A

- Windows descartável ou VM com snapshot;
- instalação real do candidato do GeoGestor;
- instalador, versão, commit e SHA-256 registrados;
- perfil novo e exclusivamente sintético;
- banco, documentos e backup em caminhos conhecidos;
- pasta externa simulando unidade separada para guardar o bundle;
- chave de dispositivo A criada normalmente pelo produto;
- código e kit de recuperação configurados pelo fluxo real.

### Dispositivo B

- outro usuário Windows, VM ou computador;
- snapshot inicial limpo;
- mesma versão compatível do GeoGestor ou caminho de atualização suportado;
- banco, perfil e pasta de documentos inicialmente inexistentes/vazios;
- chave de dispositivo B diferente da chave A;
- caminhos diferentes de A, incluindo acentos e espaços;
- acesso somente ao bundle e ao método de recuperação autorizado;
- nenhuma cópia do perfil, `safeStorage`, chave, banco ativo ou configuração secreta de A.

Para provar código e kit separadamente, prefira dois snapshots limpos de B:

- **B-código:** recuperação usando somente o código;
- **B-kit:** recuperação usando somente o kit e sua senha, depois de reiniciar o ambiente.

## DADOS SINTÉTICOS MÍNIMOS

Crie pelo fluxo real do GeoGestor no Dispositivo A:

- dois clientes, um com nome acentuado e outro com nome longo;
- dois projetos em estados diferentes;
- um orçamento aprovado com itens, imposto e parcelas;
- um recebimento parcial e um integral;
- despesas paga e pendente, em categorias diferentes;
- uma tarefa pendente e uma concluída;
- um compromisso de agenda;
- uma propriedade com identificadores sintéticos;
- configuração empresarial sintética;
- configuração auxiliar que possa ser conferida após restauração;
- histórico/auditoria gerado pelos fluxos;
- pelo menos seis documentos físicos:
  - contrato PDF sintético;
  - planta ou mapa sintético;
  - imagem PNG ou JPEG;
  - arquivo de texto vazio;
  - arquivo em subpasta profunda;
  - arquivo com acentos, espaços e nome longo;
- um arquivo órfão dentro da pasta configurada, sem registro no banco;
- um registro documental cujo arquivo físico esteja ausente, para comprovar que a inconsistência não é mascarada;
- credenciais Google exclusivamente sintéticas, para provar que são excluídas e precisam ser reconfiguradas.

Escolha valores financeiros assimétricos e com centavos. Registre o resultado esperado sem reutilizar as funções de cálculo do produto.

## CADERNO DE ORÁCULOS

Antes do backup, produza um caderno contendo:

- contagem por tabela/entidade;
- IDs sintéticos;
- totais financeiros em centavos;
- relações cliente → projeto → orçamento → parcela → recebimento;
- tarefas e compromissos;
- configurações que devem permanecer;
- credenciais que devem ser removidas;
- árvore relativa completa da pasta de documentos;
- tamanho e SHA-256 de cada arquivo;
- indicação de vinculado, órfão ou ausente;
- schema/versão do banco;
- data/hora e fuso;
- hash lógico do conjunto.

Depois de criar o backup, faça mutações sentinela que **não devem aparecer após a restauração**:

- crie um terceiro cliente;
- altere um valor financeiro;
- conclua ou reabra uma tarefa;
- altere um documento existente;
- remova um arquivo sintético;
- crie um novo arquivo;
- altere uma configuração não secreta.

Registre um segundo oráculo do estado pós-backup. A diferença entre os dois estados precisa ser inequívoca.

## FASE 1 — PREPARAÇÃO DO CANDIDATO

1. Verifique Git, versão, commit e integridade da fonte.
2. Use build/instalador limpo e registre SHA-256.
3. Instale no Dispositivo A pelo fluxo normal.
4. Registre versão mostrada na aplicação, caminhos, usuário Windows e chave identificada somente por fingerprint não reversível.
5. Execute smoke mínimo do aplicativo instalado.
6. Execute regressão curta obrigatória:
   - integração de backup/restauração;
   - retenção;
   - testes Electron relacionados;
   - E2E focado do backup;
   - typecheck e lint relevantes.
7. Se houver falha nova no pipeline, não prossiga para restauração física antes de diagnosticar e corrigir.

## FASE 2 — CRIAÇÃO DO BACKUP COMPLETO EM A

1. Crie todos os dados e documentos sintéticos.
2. Reconcile banco, API, interface e sistema de arquivos com o oráculo.
3. Configure código e kit de recuperação pelo fluxo real.
4. Guarde o código e o kit em locais separados do bundle; não os capture no relatório.
5. Escolha pelo seletor nativo um destino externo à pasta de documentos.
6. Execute o preflight e compare arquivos, bytes e espaço disponível.
7. Gere **backup completo** pela interface do aplicativo instalado.
8. Aguarde sucesso real e término da operação; não use somente o toast como prova.
9. Registre nome, tipo, versão, tamanho, SHA-256, manifesto, marcador `COMPLETE`, número de arquivos e data.
10. Valide integridade pelo fluxo do produto e por inspeção independente permitida.
11. Execute o teste isolado do mesmo bundle.
12. Confirme que banco e documentos foram reconciliados no teste.
13. Confirme exclusão das credenciais sintéticas sem perda dos dados operacionais.
14. Copie o bundle validado para a mídia/pasta usada na recuperação, preservando seu hash.
15. Faça as mutações sentinela posteriores.

## FASE 3 — RESTAURAÇÃO REAL NO DISPOSITIVO A

1. Reinicie o GeoGestor antes da restauração.
2. Selecione o bundle pelo diálogo nativo.
3. Confirme nome, tipo completo, data, versão, schema, tamanho, SHA-256 e fingerprint.
4. Tente continuar sem teste isolado válido; o produto deve bloquear.
5. Execute novamente o teste isolado se o contrato exigir.
6. Teste confirmação vazia, parcial, caixa diferente, espaços extras e literal correta.
7. Inicie a restauração pela interface gerenciada.
8. Observe e registre, sem expor segredos:
   - resposta aceita;
   - encerramento seguro da API;
   - execução do worker;
   - resultado da operação;
   - reinício do Electron;
   - recarga da interface;
   - mensagem final.
9. Não interfira manualmente copiando banco ou documentos.
10. Na primeira tela após reinício, confirme que o estado corresponde ao oráculo do backup, não ao estado pós-backup.
11. Reconcile todas as entidades e valores em centavos.
12. Compare a árvore e SHA-256 dos documentos restaurados.
13. Confirme restauração do arquivo órfão existente na raiz do backup.
14. Confirme que o registro do arquivo ausente permanece honestamente inconsistente, sem arquivo inventado.
15. Confirme que as credenciais Google não voltaram e que a interface solicita reconfiguração segura.
16. Verifique histórico, auditoria, status do backup, caches e mensagens.
17. Feche e abra o aplicativo novamente; repita uma reconciliação mínima para comprovar persistência.
18. Inventarie caminhos `before-restore`, pendentes e arquivo de resultado. Não os remova antes da aprovação.

## FASE 4 — RECUPERAÇÃO POR CÓDIGO NO DISPOSITIVO B

1. Parta de snapshot limpo B-código.
2. Instale e inicie o GeoGestor normalmente.
3. Confirme que a fingerprint da chave B difere da A.
4. Transfira somente o bundle e o código por canais separados; não copie perfil, chave, banco ou `safeStorage` de A.
5. Confirme que a chave B sozinha não abre o bundle A.
6. Teste código inválido, incompleto, alterado e correto, respeitando rate limit.
7. Selecione o bundle pelo diálogo nativo.
8. Execute preflight e teste isolado.
9. Autorize e restaure pelo fluxo real.
10. Confirme encerramento, worker e reinício Electron.
11. Reconcile integralmente banco, valores, relações e documentos.
12. Confirme caminhos com usuário diferente, espaços e acentos.
13. Reinicie novamente e prove persistência/idempotência.
14. Meça RTO desde o início da recuperação até a primeira tela íntegra.
15. Calcule RPO comparando o instante do bundle com a última mutação protegida.

## FASE 5 — RECUPERAÇÃO POR KIT NO DISPOSITIVO B

1. Retorne ao snapshot limpo B-kit; não reaproveite a sessão do código.
2. Reinicie o ambiente para eliminar sessões temporárias.
3. Transfira somente bundle e kit; forneça a senha separadamente.
4. Teste kit errado, senha errada, kit adulterado, versão incompatível e kit correto.
5. Confirme que a sessão derivada do kit é opaca, temporária, ligada ao fluxo e de uso único.
6. Selecione e teste o mesmo bundle.
7. Restaure pelo aplicativo instalado.
8. Confirme worker, reinício e mensagem final.
9. Reconcile o caderno completo.
10. Reinicie novamente e repita o smoke.
11. Meça RTO/RPO e compare com o cenário por código.
12. Confirme que código, senha e segredo não apareceram em logs, histórico, clipboard persistente ou evidências.

## FASE 6 — FALHAS SEGURAS ESSENCIAIS

Execute somente em snapshots descartáveis:

- bundle adulterado depois do teste isolado;
- manifesto alterado;
- arquivo removido do bundle;
- arquivo extra não manifestado;
- espaço insuficiente simulado com segurança;
- pasta de documentos indisponível;
- aplicativo fechado durante uma etapa segura antes da promoção final;
- falha após instalar banco e antes/depois de instalar documentos, apenas se houver mecanismo de injeção autorizado no ambiente de teste;
- cancelamento antes do ponto não cancelável;
- código/kit incorretos e excedente de tentativas.

Para cada falha, confirme:

1. dados anteriores preservados ou rollback concluído;
2. nenhuma mistura temporal entre banco e documentos;
3. bundle original não alterado;
4. operação não marcada como sucesso;
5. mensagem clara e segura;
6. reinício possível;
7. temporários e resíduos inventariados;
8. nova tentativa válida funciona.

Não simule queda de energia no equipamento real. Use snapshot de VM.

## FASE 7 — HOMOLOGAÇÃO HUMANA WINDOWS E ACESSIBILIDADE

No candidato instalado, teste manualmente:

- diálogos nativos de selecionar pasta, bundle e kit;
- cancelar cada diálogo;
- teclado completo;
- foco inicial e retorno do foco;
- aviso de encerramento;
- progresso e anúncio de erro/sucesso;
- Narrator ou NVDA;
- alto contraste do Windows;
- DPI 125%, 150% e 200%;
- zoom/reflow equivalente a 320 CSS px quando aplicável;
- temas claro e escuro;
- mensagens compreensíveis sem conhecimento técnico;
- confirmação destrutiva inequívoca.

Registre versão do leitor de tela, configuração de DPI e resultado. Não declare conformidade completa sem executar o teste humano.

## FASE 8 — CORREÇÃO E RETESTE

Se um defeito for reproduzido:

1. preserve a evidência anterior;
2. determine causa raiz;
3. adicione teste automatizado que falhe antes, quando razoável;
4. aplique a menor correção coerente;
5. gere novo candidato limpo com novo SHA-256;
6. descarte resultados físicos obtidos com o candidato anterior para a área afetada;
7. repita A e B no mesmo candidato corrigido;
8. rode regressão focada e relevante;
9. atualize as evidências.

Não aprove mistura de versões. A criação e as restaurações A/B que sustentam o veredito devem usar o mesmo candidato identificado ou uma sequência de compatibilidade explicitamente testada.

## CRITÉRIOS DE APROVAÇÃO

### Dispositivo A aprovado somente se

- o backup completo foi criado pelo aplicativo instalado;
- o bundle real foi validado e testado isoladamente;
- a restauração foi iniciada pelo fluxo Electron gerenciado;
- API/worker encerraram e o Electron reiniciou corretamente;
- banco e documentos correspondem exatamente ao oráculo do backup;
- mutações posteriores não aparecem;
- credenciais excluídas permanecem ausentes;
- um segundo reinício preserva o estado;
- não há P0/P1 pendente.

### Dispositivo B aprovado somente se

- possui chave/perfil realmente diferentes de A;
- não recebeu a chave ou o perfil A;
- a chave B sozinha não abriu o bundle;
- recuperação por código passou em ambiente limpo;
- recuperação por kit passou em outro snapshot limpo;
- ambos passaram pelo aplicativo instalado e reinício real;
- banco, valores, relações e documentos reconciliaram exatamente;
- RPO/RTO foram medidos;
- segredos não vazaram;
- não há P0/P1 pendente.

### Prontidão geral

- **APROVADA:** A e B aprovados no mesmo candidato e nenhum P0/P1 pendente.
- **APROVADA COM RESSALVAS:** somente bloqueios não essenciais, claramente externos ao contrato de recuperação, permanecem; A e B continuam obrigatoriamente aprovados.
- **REPROVADA:** A ou B falha, restauração mistura estados, documento falta, valor diverge, segredo vaza ou rollback falha.
- **BLOQUEADA:** não há dois ambientes descartáveis reais ou não é possível executar reinício/diálogo nativo com segurança. Bloqueio não equivale a aprovação.

## ENTREGÁVEIS

Crie:

```text
docs/auditorias/[AAAA-MM-DD]-validacao-final-backup/
├── RELATORIO.md
├── MATRIZ-A-B.md
├── CADERNO-DE-ORACULOS.md
├── INVENTARIO-DO-BUNDLE.md
├── RECONCILIACAO-BANCO-E-DOCUMENTOS.md
├── RPO-RTO.md
├── HOMOLOGACAO-WINDOWS.md
├── FALHAS-E-ROLLBACK.md
├── SEGURANCA-E-SEGREDOS.md
├── COMANDOS-E-RESULTADOS.md
├── ARQUIVOS-ALTERADOS.md
└── evidencias/
```

As evidências devem conter:

- versão, commit e SHA-256 do candidato;
- identificação sanitizada de A e B;
- fingerprint não reversível das chaves;
- hash e inventário do bundle;
- contagens e valores antes/depois;
- árvore relativa e hashes dos documentos;
- tempos e sequência de reinício;
- capturas sanitizadas da interface;
- logs mínimos sem segredo;
- testes e códigos de saída;
- resíduos e limpeza.

Nunca inclua código de recuperação, senha do kit, segredo, chave, token ou caminho pessoal identificável.

## FORMATO DA RESPOSTA FINAL

Comece pelo resultado real:

1. **Prontidão geral:** APROVADA, APROVADA COM RESSALVAS, REPROVADA ou BLOQUEADA;
2. **Dispositivo A:** resultado e evidência do reinício;
3. **Dispositivo B por código:** resultado;
4. **Dispositivo B por kit:** resultado;
5. reconciliação em números e centavos;
6. documentos esperados, restaurados, ausentes, divergentes e hashes;
7. RPO e RTO observados;
8. defeitos por gravidade e correções;
9. testes executados e resultados exatos;
10. homologação Windows/acessibilidade;
11. pendências e bloqueios;
12. limpeza e resíduos;
13. links para relatório e evidências;
14. recomendação final: `CONFIAR PARA RECUPERAÇÃO DE DESASTRE` ou `NÃO CONFIAR ATÉ CORRIGIR/DESTRAVAR`.

Não use “o backup parece funcionar”. Use fatos: candidato e hash, bundle e hash, IDs sintéticos, valores em centavos, arquivos e hashes, reinícios observados, RPO/RTO e diferenças encontradas.
