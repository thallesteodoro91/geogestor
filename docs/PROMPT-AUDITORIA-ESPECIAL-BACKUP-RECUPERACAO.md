# Prompt de auditoria especializada — Backup, Restauração e Recuperação de Desastre

> Se a auditoria completa de 19/09/2026 continuar válida e o objetivo for apenas encerrar seus bloqueios físicos, use o roteiro reduzido [PROMPT-VALIDACAO-FINAL-BACKUP-RESTAURACAO-REAL.md](./PROMPT-VALIDACAO-FINAL-BACKUP-RESTAURACAO-REAL.md).

Você atuará como engenheiro sênior de QA full stack, segurança de dados e recuperação de desastre, especialista em Electron/Windows, SQLite/libSQL, criptografia aplicada, sistemas de arquivos, UX e acessibilidade WCAG 2.2 AA. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** todo o ciclo de backup do GeoGestor até demonstrar, com evidências reproduzíveis, se os dados podem ser recuperados depois de erro humano, corrupção, perda do computador ou atualização malsucedida.

Não considere o backup aprovado porque um botão exibiu sucesso, uma pasta foi criada, um checksum coincidiu ou um teste unitário passou. Um backup só é útil quando sua restauração preserva o banco, os documentos, os vínculos e os valores conhecidos no ambiente de destino autorizado.

## Resposta direta — o que cada backup deve proteger

Na implementação atual existem **duas modalidades diferentes**, que não podem ser tratadas como equivalentes:

| Modalidade | Informações do GeoGestor | Arquivos dos clientes | Limite principal |
|---|---|---|---|
| **Backup somente do banco** | **SIM.** Deve conter o SQLite do GeoGestor com clientes, contatos, propriedades, projetos, orçamentos, parcelas, recebimentos, despesas, tarefas, compromissos, configurações, cadastros auxiliares, vínculos, histórico e demais dados persistidos no banco. | **NÃO.** Conserva os registros e caminhos cadastrados, mas não copia o conteúdo físico de contratos, plantas, mapas, comprovantes e demais documentos. | Restaurar somente esta modalidade pode devolver cadastros que apontam para arquivos inexistentes ou para versões temporais diferentes. |
| **Backup completo** | **SIM.** Inclui uma cópia consistente do banco, com exclusão controlada das credenciais sensíveis definidas pelo produto. | **SIM.** Inclui recursivamente todos os arquivos regulares existentes dentro da pasta de documentos configurada no GeoGestor. | Não inclui arquivos mantidos fora dessa raiz, links/symlinks, o próprio destino de backup, aplicativos, Windows, instaladores nem fontes externas não materializadas na pasta. |

Portanto, a resposta à dúvida de produto é: **o backup completo protege ambos — as informações do GeoGestor e os arquivos armazenados na pasta de documentos; o backup somente do banco protege apenas as informações estruturadas e os metadados dos arquivos.**

O auditor deve provar essa distinção na versão executada. A implementação atual percorre a pasta configurada, não apenas os arquivos que possuem vínculo no banco. Assim, o inventário também deve identificar:

- arquivo vinculado ao banco e presente na pasta;
- registro no banco cujo arquivo físico está ausente;
- arquivo físico órfão, sem registro no banco;
- arquivo regular em subpasta profunda;
- arquivo fora da raiz configurada;
- link simbólico ou ponto de nova análise;
- pasta vazia, arquivo vazio, nome Unicode e nome longo;
- pasta de backup separada da pasta de documentos.

O resultado esperado deve ser explícito: o backup completo precisa preservar todos os arquivos regulares da raiz autorizada e os respectivos caminhos lógicos; itens fora da raiz não podem ser copiados silenciosamente; links não suportados devem interromper a operação com mensagem segura; divergências entre banco e sistema de arquivos devem ser relatadas, não mascaradas.

## Configuração da auditoria

- Auditoria: **Backup, Restauração e Recuperação de Desastre**.
- Módulo principal: **Configurações → Backup e proteção de dados**.
- Rota principal: **`/configuracoes?secao=backups`**.
- Âncoras/deep links relevantes:
  - `foco=backup-protection-details-title`;
  - `foco=backup-policy-title`;
  - `foco=backup-actions`;
  - `foco=backup-recovery-summary`;
  - `foco=backup-details-actions-title`;
  - demais âncoras encontradas na versão executada.
- Integrações imediatas:
  - indicador global de status do backup;
  - Configurações → Manutenção → Histórico operacional;
  - `/pos-atualizacao` e Saúde do GeoGestor;
  - configuração inicial e pasta de documentos;
  - proteção por senha local;
  - runtime Electron, encerramento, reinício da API e armazenamento seguro do Windows;
  - importação, migração da pasta de dados, reset e atualização apenas para comprovar a criação/uso de backups de segurança.
- Foco especial: backup somente do banco; backup completo; consistência de snapshot; documentos; criptografia; manifesto; checksums; exclusão de credenciais; política automática; alterações pendentes; retenção; destino externo; espaço; operação concorrente; cancelamento; encerramento; integridade; teste isolado; autorização; código e kit de recuperação; restauração real; rollback; reinício; recuperação em outro perfil/equipamento; RPO, RTO, segurança, acessibilidade e limpeza.
- Implementar correções comprovadas: **SIM**.
- Implementar provedor de nuvem, sincronização remota, novo formato de backup, nova estratégia criptográfica ou mudança de produto: **NÃO sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-backup-recuperacao-desastre/`.

## Evidências anteriores obrigatórias

Leia integralmente antes de testar:

- `docs/auditorias/2026-09-19-backup-recuperacao-desastre/RELATORIO.md`, se presente;
- `docs/auditorias/2026-09-16-configuracoes-administracao/RELATORIO.md`;
- `docs/auditorias/2026-09-16-configuracoes-administracao/BACKUP-E-RECUPERACAO.md`;
- `docs/auditorias/2026-09-18-ajuda-regressao-release/RELATORIO.md`;
- `docs/auditorias/2026-09-18-ajuda-regressao-release/HOMOLOGACAO-HUMANA.md`;
- `docs/auditorias/2026-09-18-ajuda-regressao-release/MATRIZ-DE-RECONCILIACAO.md`;
- `docs/AUDITORIA-CONFIGURACOES-BACKUP-2026-08-23.md`;
- `docs/AUDITORIA-BACKEND-E-SEGURANCA-LOCAL-2026-08-01.md`;
- `docs/ADR-001-CRIPTOGRAFIA-INTEGRAL-DO-BANCO.md`;
- `docs/architecture/ADR-004-restauracao-desktop.md`;
- artigo `backup-recuperacao` da Central de Ajuda;
- `AGENTS.md`, Web Interface Guidelines e demais instruções aplicáveis.

Evidência antiga serve como linha de base, não como aprovação atual. Considere primeiro a auditoria especializada mais recente, quando existir, e transforme cada ressalva ou bloqueio dela em item de reteste. As auditorias anteriores validaram partes do contrato com fixtures descartáveis, mas deixaram ensaios físicos dependentes de ambiente, como restauração no aplicativo instalado e recuperação em outro perfil/equipamento. Esta auditoria deve fechar especificamente esses pontos ou manter bloqueios honestos; números antigos de testes não substituem uma regressão atual.

## Contrato atual a ser reconfirmado

Não presuma que o código permaneceu igual. Confirme na versão executada:

1. Formato atual de bundle e versões legíveis. Na linha de base, o serviço usa formato 4 quando existe recuperação portátil e mantém leitura compatível dos formatos 1–4.
2. O bundle contém `manifest.json`, marcador `COMPLETE`, banco, objetos/documentos quando aplicável, totais, hashes, schema, tipo, dispositivo e informação de exclusão de credenciais.
3. Diretórios com `PENDING` e arquivos `.db` legados sem manifesto não são restauráveis nem contam como proteção completa.
4. Em produção protegida, o banco e documentos usam criptografia; o formato portátil usa chave de dados aleatória e envelopes independentes para dispositivo e recuperação.
5. O kit usa formato `GeoGestor-Recovery-Kit` versão 1, scrypt e AES-256-GCM; o código começa com `GG-R1`.
6. Credenciais Google e tokens são removidos da cópia de backup, sem remover dados operacionais.
7. A restauração real depende do aplicativo desktop gerenciado, de seleção nativa, autorização ligada ao caminho e prazo, teste isolado aprovado e frase literal `RESTAURAR BACKUP DO GEOGESTOR`.
8. A restauração substitui o banco e, quando completa, a árvore de documentos; antes disso preserva caminhos `before-restore` para rollback.
9. O Electron reinicia a API depois da restauração e apresenta o resultado; o modo web/dev não gerenciado deve recusar restauração real.
10. O adaptador atual de pasta sincronizada não observa o provedor remoto e, por isso, não pode inventar confirmação de upload, versionamento, imutabilidade ou recuperação pelo provedor.
11. A política padrão atual prevê backup automático, consolidação de alterações, intervalos distintos, retenção mínima/recente/diária/mensal, limite de espaço, tolerância, execução no início/encerramento e teste periódico de restauração.
12. Alterações de banco e alterações de documentos têm escopos diferentes: mutações de arquivos devem exigir backup completo antes de declarar tudo protegido.

Se a implementação divergir, atualize primeiro o mapa do contrato. Não adapte o resultado ao texto deste prompt.

## Decisões independentes obrigatórias

Emita sete decisões separadas:

1. **Criação de backup do banco:** `APROVADA`, `APROVADA COM RESSALVAS` ou `REPROVADA`.
2. **Criação de backup completo:** `APROVADA`, `APROVADA COM RESSALVAS` ou `REPROVADA`.
3. **Automação, política e retenção:** `APROVADA`, `APROVADA COM RESSALVAS` ou `REPROVADA`.
4. **Restauração no computador original:** `APROVADA`, `BLOQUEADA` ou `REPROVADA`.
5. **Recuperação em outro perfil/equipamento:** `APROVADA`, `BLOQUEADA` ou `REPROVADA`.
6. **Segurança, privacidade e acessibilidade:** `APROVADA`, `APROVADA COM RESSALVAS` ou `REPROVADA`.
7. **Prontidão geral para recuperação de desastre:** `APROVADA`, `APROVADA COM RESSALVAS` ou `REPROVADA`.

Um resultado verde de criação não aprova restauração. Um teste isolado não aprova o ciclo físico Electron. Recuperar somente o banco não aprova a proteção dos documentos. Recuperar no computador original não aprova recuperação após perda do equipamento.

## Regras de autoridade e segurança

1. Descubra primeiro todos os bancos, WAL/SHM, pastas de documentos, backups, perfis Electron, chaves envolvidas, processos e portas. Nunca suponha qual instância está ativa.
2. Não leia, copie, restaure, mova, renomeie ou exclua backup real do usuário. Inventários de dados reais devem ser estritamente somente leitura e sanitizados.
3. Todos os testes de criação e restauração usarão banco, documentos, backup e perfil com prefixo `QA-AUDIT-BACKUP-[DATA-HORA]-`.
4. Restauração real, corrupção, falta de espaço, interrupção, perda de chave, desinstalação ou troca de perfil só podem ocorrer em VM, instalação ou perfil comprovadamente descartável.
5. Antes de cada cenário destrutivo, registre caminhos absolutos, PID, porta, versão, hashes, contagens, espaço, snapshot e plano de retorno.
6. Não use raiz de unidade, pasta pessoal, curinga, symlink desconhecido ou variável não resolvida como alvo.
7. Antes de restaurar, confira nome, caminho, tipo, data, schema, tamanho, hash e identificador exatos do bundle sintético.
8. Código de recuperação, senha do kit, chave do banco, segredo de recuperação, autorização e tokens nunca podem entrar em captura, console copiado, relatório, comando, URL, histórico, clipboard persistente ou artefato versionado.
9. Evidências devem mostrar apenas identificadores não reversíveis, estados, hashes de arquivos não secretos e valores sintéticos.
10. Não enfraqueça criptografia, KDF, autenticação ou validações para facilitar o teste.
11. Não force a abertura de bundle real com chave desconhecida. Falha de credencial deve ser testada apenas com material sintético.
12. Preserve o worktree e mudanças preexistentes; não reverta trabalho alheio.

## Níveis de risco

- **Nível A — leitura e interface:** status, política, histórico, Ajuda, acessibilidade, inspeção de bundle sintético e testes sem mutação.
- **Nível B — criação controlada:** backup do banco/completo, destino, retenção, integridade, scheduler e cancelamento em perfil isolado.
- **Nível C — recuperação:** teste isolado, restauração real, rollback, reinício e recuperação entre perfis/equipamentos.
- **Nível D — desastre:** interrupção abrupta, corrupção, disco cheio, perda do dispositivo/chave e atualização malsucedida. Somente VM descartável com snapshot externo.

Se não puder provar isolamento, não execute Nível C/D. Marque `BLOQUEADO`, informe o ambiente necessário e continue com verificações não destrutivas.

## Dados e ambientes mínimos

Prepare dois ambientes descartáveis independentes:

- **Dispositivo A — origem:** aplicação instalada, perfil Electron A, banco A, chave A e pasta de documentos A.
- **Dispositivo B — recuperação:** perfil novo sem chave A, banco vazio e pasta de documentos vazia. Preferencialmente outra VM ou outro usuário Windows.

No Dispositivo A, crie:

- clientes, propriedades, projetos, orçamentos, parcelas, recebimentos, despesas, tarefas, compromissos, planejamento, registros ambientais e cálculos topográficos sintéticos;
- pelo menos um registro ativo, concluído, cancelado e excluído logicamente quando o domínio suportar;
- valores financeiros em centavos com soma independente conhecida;
- relacionamentos e chaves estrangeiras suficientes para detectar perda parcial;
- configurações e modelos que devem ser preservados;
- credenciais Google exclusivamente sintéticas para provar exclusão do backup;
- documentos vazios e não vazios, pequenos e grandes, Unicode, acentos, extensão maiúscula, nomes longos, subpastas, conteúdo duplicado e hashes conhecidos;
- arquivo alterado durante a cópia, arquivo bloqueado, permissão negada e reparse point/symlink controlado, apenas se o ambiente for seguro;
- ao menos 25 versões com datas controladas para retenção recente, diária, mensal, mínima e limite de espaço;
- backup somente do banco, backup completo, bundle incompleto, legado `.db`, manifestos dos formatos suportados obtidos de fixtures oficiais e cópias corrompidas independentes.

Crie um caderno de oráculos com:

- contagem por tabela, IDs sintéticos essenciais e vínculos;
- soma de valores financeiros em centavos;
- `PRAGMA quick_check`, `foreign_key_check`, `user_version` e migrations;
- árvore relativa de documentos, quantidade, tamanho e SHA-256 de cada arquivo;
- configuração esperada e campos que devem ser excluídos;
- hash lógico antes do backup e depois da restauração;
- tempos de criação, validação, teste e restauração;
- momento da última mutação e número de alterações ainda desprotegidas.

## Invariantes obrigatórios

Comprove pelo menos:

1. O banco de origem permanece íntegro e não é alterado pela criação do backup, exceto metadados operacionais previstos e auditados.
2. WAL/SHM e transações concorrentes não produzem snapshot logicamente impossível.
3. Bundle só se torna válido depois de cópia, manifesto, hashes e validação concluídos; `PENDING` nunca é listado como versão utilizável.
4. `manifest.files`, `totals.files`, `totals.bytes`, tamanhos, hashes, tipo, schema e marcadores concordam com o conteúdo real.
5. O backup do banco não é apresentado como backup completo e não limpa pendência causada por documento.
6. O backup completo contém banco e todos os documentos autorizados exatamente uma vez, sem copiar a própria pasta de backup.
7. Nomes lógicos não escapam da raiz; caminho absoluto, `..`, NUL, link/reparse point e colisão não permitem path traversal.
8. Credenciais/tokens configurados na origem não aparecem no banco copiado, manifesto, arquivos, logs ou evidências.
9. Dados operacionais, configurações permitidas, auditoria e vínculos permanecem completos depois da exclusão de credenciais.
10. Uma mutação ocorrida durante o backup continua marcada como pendente; ela não é falsamente considerada protegida.
11. Retenção nunca remove a única cópia mais recente de cada tipo nem versões fora da regra errada; legado não é apagado automaticamente.
12. Falha/cancelamento remove somente pendentes da própria operação e preserva bundles anteriores.
13. Teste isolado não altera o banco ativo nem os documentos ativos e remove a área temporária ao terminar.
14. Restauração só usa o mesmo bundle selecionado, autorizado e testado; autorização e sessão de kit respeitam TTL e uso único.
15. Falha em qualquer ponto da restauração recupera banco e documentos anteriores ou deixa evidência `before-restore` suficiente para ação segura.
16. Depois do reinício, a interface, a API, o SQLite e os documentos correspondem ao mesmo instante recuperado.
17. Bundle portátil válido pode ser recuperado no Dispositivo B com código ou kit corretos, sem copiar a chave do Dispositivo A.
18. Código/kit incorreto, adulterado, incompleto, expirado ou pertencente a outra recuperação falha sem revelar qual segredo esteve correto.
19. Estado “protegido” só aparece quando todos os requisitos do contrato realmente foram satisfeitos; pasta sincronizada não equivale a upload remoto confirmado.
20. RPO e RTO medidos são informados como valores observados, não como garantia não comprovada.

## Fase 1 — Preparação e linha de base

1. Leia os documentos obrigatórios e extraia todos os requisitos, achados, bloqueios e promessas da interface/Ajuda.
2. Registre `git status`, commit, versão e alterações preexistentes.
3. Identifique frontend, API, Electron, database package, schema, migrations, workers, scheduler, armazenamento seguro, políticas e testes existentes.
4. Mapeie o fluxo contínuo: mutação → atividade pendente → scheduler/manual → bundle pendente → manifesto → validação → promoção → retenção → status → teste → restauração → reinício.
5. Identifique banco, WAL/SHM, documentos, destino de backup, logs, histórico, `backup-device.json`, chave do banco, chave de recuperação e resultado de restauração. Registre somente caminhos sanitizados nas evidências.
6. Confirme que a aplicação executada usa os recursos compilados que serão auditados.
7. Registre estado inicial da política, status, histórico, espaço, versões e erros existentes.
8. Crie a pasta de evidências e snapshots dos dispositivos A/B.

## Fase 2 — Inventário e rastreabilidade

Antes de testar, produza matriz com:

- ID, rota/tela/controle ou processo em background;
- ação esperada e fonte do requisito;
- componente frontend/Electron/API;
- endpoint/método, schema, código e resposta;
- serviço/helper/worker chamado;
- banco, arquivo, diretório, chave ou log afetado;
- nível de risco, pré-condição e plano de recuperação;
- cenários positivo, negativo, vazio, limite, erro, lentidão, cancelamento, concorrência, reinício e desastre;
- resultado `APROVADO`, `REPROVADO`, `BLOQUEADO` ou `NÃO APLICÁVEL`;
- evidência, achado, correção, reteste e limpeza.

Inclua ao menos os contratos atuais:

- `POST /api/sistema/backup`;
- `GET /api/sistema/backup-completo/preflight`;
- `POST /api/sistema/backup-completo`;
- `GET` e `PUT /api/sistema/backups/politica`;
- `POST /api/sistema/backups/testar-destino`;
- `GET /api/sistema/backups/status`;
- `POST /api/sistema/backups/verificar-integridade`;
- `POST /api/sistema/backups/testar-restauracao`;
- `GET /api/sistema/backups/recuperacao`;
- `POST /api/sistema/backups/recuperacao/codigo`;
- `POST /api/sistema/backups/recuperacao/kit`;
- `POST /api/sistema/backups/recuperacao/kit/validar`;
- `POST /api/sistema/restaurar-backup/preflight`;
- `POST /api/sistema/restaurar-backup/testar`;
- `POST /api/sistema/restaurar-backup`;
- status/cancelamento de operações e histórico operacional;
- IPCs Electron de selecionar/abrir pasta, selecionar bundle/kit, salvar/confirmar kit e acompanhar backup no encerramento.

## Fase 3 — Interface, status e política

1. Abra a seção pelo menu, pesquisa de Configurações, indicador global e deep links; teste refresh, voltar/avançar e foco na âncora.
2. Valide estados: carregando, vazio, primeiro backup, executando, falha, pendente, vencido, somente local, externo não verificado, recuperação pendente, teste vencido e protegido.
3. Confirme prioridade entre estados simultâneos; corrupção/falha nunca pode ser escondida por cópia recente.
4. Compare datas, próximos horários, quantidade, bytes, duração, integridade, mudanças pendentes e mensagens com API/filesystem.
5. Teste backup completo como ação principal e backup do banco como ação secundária claramente limitada.
6. Teste todos os campos da política nos mínimos, máximos, zero permitido, fora do limite, vazio, decimal, NaN e payload extra.
7. Teste formulário sujo, salvar, erro, duplo clique, reload, reinício, concorrência e auditoria da política.
8. Confirme `Intl` pt-BR, números tabulares, textos longos, caminhos longos e ausência de alegação de nuvem confirmada.
9. Valide histórico, filtros, estados, detalhes e CSV; nenhuma senha, chave, autorização ou caminho local completo pode vazar.
10. Confira `/pos-atualizacao`, Saúde e artigo de Ajuda contra o estado real e as ações realmente disponíveis.

## Fase 4 — Destino e pré-flight

1. Teste destino padrão, pasta externa local, unidade removível, rede e pasta sincronizada quando disponíveis.
2. Teste caminho absoluto, `~`, relativo, raiz de unidade, inexistente, sem permissão, somente leitura, longo, Unicode, desconectado e com pouco espaço.
3. Recuse sobreposição em qualquer direção com a pasta de documentos e backup dentro de si mesmo.
4. Valide criação/remoção do arquivo de prova; falha não pode deixar resíduo.
5. Compare espaço relatado e necessário com `statfs`, tamanho real e margem; simule mudança de espaço entre preflight e execução.
6. Ao trocar destino, confirme que histórico do destino anterior não aprova o novo e que um novo primeiro backup é exigido.
7. Desconecte o destino durante a operação em ambiente descartável; valide erro, limpeza, histórico e recuperação na reconexão.
8. Pasta sincronizada deve ser descrita como não observável enquanto não houver confirmação independente do provedor.

## Fase 5 — Backup somente do banco

1. Gere backup manual com banco vazio, parcial e completo; valide resposta, progresso, histórico, auditoria e status.
2. Mute dados durante transação, checkpoint e WAL ativo; reconcilie o snapshot por oráculo.
3. Confira clonagem criptografada, `quick_check`, FKs, schema, tabelas e contagens.
4. Verifique remoção de credenciais sintéticas e preservação do restante.
5. Valide manifesto, marcadores, hashes, tamanho, chave/envelopes, dispositivo e atomicidade da promoção.
6. Interrompa/cancele nos pontos seguros; depois da etapa não cancelável, a UI deve explicar e impedir cancelamento sem bloquear o fechamento do modal.
7. Faça duas solicitações rápidas e uma operação concorrente de manutenção; deve haver exclusão mútua sem bundle duplicado ou deadlock.
8. Confirme que backup somente do banco não protege documentos novos/alterados nem gera mensagem enganosa.

## Fase 6 — Backup completo e árvore de documentos

1. Execute preflight e compare banco, documentos, total de arquivos, bytes, espaço e decisão `canProceed`.
2. Gere backup completo com toda a matriz de arquivos; compare árvore/hashes por caminho lógico depois de descriptografar em área isolada.
3. Teste arquivo vazio, grande, Unicode, nome longo, extensão em maiúsculas, conteúdo duplicado e subpastas profundas.
4. Modifique um arquivo durante a captura; confirme retry limitado e erro acionável se ele não estabilizar.
5. Teste arquivo bloqueado/permissão negada, link/reparse point e desaparecimento durante a varredura.
6. Confirme que nomes físicos são opacos quando criptografados e que caminhos lógicos protegidos só são recuperados com chave válida.
7. Prove que nenhum documento externo à raiz é copiado e que a pasta de backup não é incluída recursivamente.
8. Verifique deduplicação de conteúdo somente se fizer parte do contrato observado; ela não pode fundir caminhos lógicos distintos.
9. Faça mutação de banco e documento durante o backup. Alterações fora do snapshot precisam permanecer pendentes.

## Fase 7 — Automação, scheduler e encerramento

1. Teste backup automático ligado/desligado e consolidação após o período configurado.
2. Teste intervalos de banco e completo nas bordas, relógio inválido, timezone, horário de verão e reinício.
3. Confirme que mutação HTTP bem-sucedida marca atividade; erro 4xx/5xx, autenticação, backup, restauração e diagnóstico não criam pendência espúria.
4. Upload/mutação de arquivo deve marcar `completeRequired`; mutação só de banco deve permitir o tipo correspondente conforme contrato.
5. Faça alteração durante backup em curso e confirme que continua pendente após o bundle terminar.
6. Teste execução no início, incluindo os atrasos previstos, sem bloquear a primeira tela.
7. Teste encerramento sem mudança, com mudança, com backup já rodando e com mudança ocorrida enquanto o Electron espera.
8. Simule falha no backup de encerramento; valide as opções “Tentar novamente”, “Voltar ao GeoGestor” e “Fechar sem backup”, foco e consequência de cada escolha.
9. Fechar sem backup deve ser explícito, auditável e não pode transformar mudanças pendentes em protegidas.
10. Suspender/retomar, perder unidade externa e encerrar Windows durante operação somente em ambiente físico descartável.

## Fase 8 — Retenção e capacidade

1. Teste mínimo de versões, janela recente, uma diária, uma mensal e máximo de armazenamento isoladamente e em combinação.
2. Use datas de borda, futuro, inválidas, empates, meses com durações diferentes e horário de verão.
3. Preserve sempre a versão mais recente de banco e completo; confirme comportamento quando o limite de espaço entra em conflito com mínimos.
4. Bundles corrompidos, `PENDING`, diretórios estranhos, symlinks e `.db` legados não podem causar exclusão fora da raiz.
5. Legados devem permanecer somente leitura e fora da limpeza automática, conforme contrato atual.
6. Simule falha ao remover uma versão; versões válidas restantes não podem ser afetadas e o erro deve ser visível/auditável.
7. Confirme espaço pelo tamanho físico real, não apenas totais manipuláveis do manifesto, quando isso afetar decisão de retenção.
8. Registre quais cópias foram mantidas/removidas, por qual regra e se a ação é recuperável.

## Fase 9 — Criptografia e recuperação de emergência

1. Prove em bytes que banco/documentos protegidos não aparecem em texto claro no bundle, temporários, logs ou resíduos.
2. Valide envelopes de dispositivo e recuperação, identificadores de chave, salts/IVs/tags e autenticação GCM sem expor segredo.
3. Gere dois backups equivalentes e confirme aleatoriedade: chaves/IVs/ciphertexts não devem ser idênticos indevidamente.
4. Teste código de recuperação correto, formatação, caixa/espaços/hífens permitidos, prefixo errado, incompleto, caractere inválido e código de outra instalação.
5. Revele o código somente após senha administrativa válida; teste erro, rate limit, `Retry-After`, bloqueio e recuperação.
6. Exporte kit com senha nos limites e forte; valide schema estrito, scrypt, AES-GCM, arquivo salvo e ausência do segredo em texto claro.
7. Teste senha incorreta, kit truncado, JSON inválido, parâmetros KDF alterados, key ID divergente, tag/ciphertext adulterado e arquivo acima do limite Electron.
8. Valide confirmação do kit local e persistência após reiniciar o Electron; confirmação da API em memória não basta.
9. Sessão derivada do kit deve ser opaca, durar somente o TTL definido, residir em memória, ser revogável/consumida uma vez e desaparecer após reinício.
10. Teste rotação de envelopes somente se houver fluxo suportado e autorizado; confirme que backups antigos continuam recuperáveis conforme política documentada.
11. Inspecione memória/logs/evidências de forma segura para comprovar ausência de segredo persistido; não imprima os valores durante a inspeção.

## Fase 10 — Validação e teste isolado

1. Valide bundle correto, `PENDING`, sem `COMPLETE`, manifesto ausente, JSON inválido, app errado, versão não suportada e schema futuro.
2. Altere separadamente tamanho, SHA-256, total, arquivo, tag GCM, envelope, caminho lógico e `credentialsExcluded`; cada violação deve falhar antes de tocar nos dados ativos.
3. Adicione arquivo extra e remova arquivo listado; determine o contrato real e registre qualquer conteúdo não coberto pelo manifesto.
4. Teste path traversal com `/`, `..`, barras Windows, UNC, drive letter, NUL, case/collision e caminho criptografado malicioso.
5. Teste banco com `quick_check` inválido, FK quebrada, chave errada e schema divergente.
6. Execute teste isolado do último backup completo e de bundle selecionado; reconcilie dados e documentos, não apenas abertura do banco.
7. Confirme que a pasta temporária é removida no sucesso, falha e cancelamento; liste resíduo se houver.
8. Verifique histórico de sucesso/falha, tempo observado e atualização do status sem recarga indevida.
9. Teste automático periódico de restauração ligado/desligado, vencido/não vencido e sem backup completo.

## Fase 11 — Restauração real no Dispositivo A

1. Faça mutações conhecidas depois do backup para diferenciar claramente estado atual e estado restaurado.
2. Selecione o bundle pelo diálogo Electron; valide autorização HMAC ligada ao caminho, TTL, adulteração, reutilização e troca do diretório após seleção.
3. Exija preflight e teste isolado do mesmo bundle. Tentar restaurar antes do teste deve falhar.
4. Teste frase vazia, caixa diferente, espaços, parcial e exata; somente a literal deve habilitar/autorizar.
5. Com espaço suficiente, inicie a restauração e valide resposta 202, parada segura da API, worker, códigos de reinício e recarga do renderer.
6. Após reinício, compare integralmente o oráculo: banco, contagens, centavos, relações, schema, documentos, configurações e credenciais excluídas.
7. Confirme que integrações com credenciais excluídas retornam a estado seguro e solicitam reconfiguração, sem token antigo.
8. Valide mensagem final, foco, histórico, auditoria, status, cache e absence de referências ao estado substituído.
9. Verifique `before-restore`, pendentes e arquivo de resultado; defina claramente quando podem ser removidos e nunca os apague antes da confirmação.
10. Restaure backup somente do banco e prove a política para documentos atuais; qualquer mistura temporal perigosa deve ser claramente impedida ou advertida.

## Fase 12 — Recuperação no Dispositivo B

1. Copie somente o bundle completo e o código ou kit autorizado. Não copie chave, perfil ou arquivo `safeStorage` do Dispositivo A.
2. Confirme que a chave do dispositivo B, sozinha, não abre o bundle A e que a mensagem orienta recuperação sem expor detalhes criptográficos.
3. Recupere uma vez com código e, em ambiente reinicializado, uma vez com kit.
4. Valide senha do kit, sessão opaca, preflight, teste isolado, confirmação literal, worker e reinício.
5. Reconcilie todo o caderno de oráculos no Dispositivo B, inclusive documentos e valores financeiros.
6. Meça RTO desde a seleção até a primeira tela íntegra e calcule RPO a partir da última mutação protegida.
7. Teste bundle anterior compatível e migrations normais depois da restauração; confirme idempotência em segundo reinício.
8. Teste perfil Windows diferente, nome de usuário/caminho diferente e pasta com acentos/espaços.
9. Sem kit/código, confirme bloqueio irrecuperável conforme o contrato, com mensagem honesta e sem criar promessa de suporte impossível.
10. Se não houver segundo ambiente real, esta decisão fica `BLOQUEADA`; teste unitário não pode substituí-la.

## Fase 13 — Falhas, interrupção e rollback

Use snapshot de VM e injete uma falha por execução:

- antes/depois de copiar o banco;
- durante documento;
- antes/depois do manifesto;
- durante promoção por rename e fallback de cópia no Windows;
- antes/depois da retenção;
- após instalar banco restaurado;
- após instalar documentos;
- antes/depois da validação final;
- durante fechamento da API e antes do reinício;
- com energia/processo interrompido entre renomes;
- com disco cheio, unidade removida, permissão alterada e arquivo bloqueado.

Para cada falha:

1. registre estado anterior, ponto, erro e resíduos;
2. reinicie o sistema sem intervenção destrutiva;
3. verifique banco/documentos ativos, `before-restore`, pendentes, histórico e status;
4. prove rollback automático ou procedimento manual seguro;
5. confirme que nenhum conjunto híbrido banco antigo/documentos novos é apresentado como íntegro;
6. repita o fluxo normal depois da recuperação.

## Fase 14 — Segurança e privacidade

1. Confirme token local, sessão, CORS e restrição a loopback em todos os endpoints.
2. Restauração real deve recusar modo não gerenciado e chamadas diretas sem seleção Electron.
3. Teste manipulação de caminho, autorização, nonce, TTL, sessão de kit, ID da operação e confirmação.
4. Faça testes seguros de brute force/rate limit do acesso ao segredo; não execute volume que afete o host real.
5. Inspecione API, console, log Electron, histórico NDJSON, auditoria, CSV, diagnósticos, crash e temporários por segredos e caminhos.
6. Verifique permissões dos bundles, arquivos de chave, kit e diretórios no Windows; outro usuário não deve obter acesso indevido por configuração criada pelo aplicativo.
7. Confirme limpeza de buffers/chaves onde tecnicamente observável e ausência de segredo em argumentos de processo.
8. Valide dependências criptográficas e parâmetros contra o contrato do projeto; qualquer mudança de algoritmo exige revisão especializada, não ajuste improvisado.
9. Não declare proteção contra ransomware, incêndio, exclusão remota ou comprometimento do usuário apenas por usar pasta sincronizada.

## Fase 15 — UX e acessibilidade WCAG 2.2 AA

1. Percorra todo o fluxo somente com teclado: indicador, modal, política, recuperação, seleção nativa, teste e confirmação.
2. Valide foco inicial, contenção, Escape, retorno de foco, foco no primeiro erro e foco depois de deep link/reinício.
3. Confirme labels, `name`, `autocomplete`, instruções, erros associados, `aria-live`, progresso e anúncios de sucesso/falha.
4. Código/kit e senhas precisam de instruções seguras sem expor valor a leitor de tela fora do momento solicitado.
5. Teste 800×520, 800×600, 1024×768, 1440 px, 320 CSS px, zoom 200%, DPI 125/150/200%, claro/escuro e alto contraste.
6. Valide alvos de ao menos 44×44 px quando exigidos, números tabulares, textos longos e caminhos quebráveis.
7. Cores de sucesso/atenção/falha devem ter texto/ícone; não depender apenas de cor.
8. Teste NVDA e Narrator no aplicativo instalado, incluindo diálogos nativos e aviso de encerramento.
9. Confirme redução de movimento, ausência de `transition: all`, foco visível e nenhuma rolagem horizontal acidental.
10. Revise português e mensagens: cada falha deve explicar ação segura seguinte, sem minimizar perda potencial.

## Fase 16 — Desempenho e confiabilidade prolongada

1. Meça criação, validação, teste e restauração com banco/documentos pequenos, médios e próximos do uso real autorizado.
2. Registre CPU, memória, I/O, espaço temporário e responsividade da interface; não bloqueie o renderer.
3. Valide streaming de arquivos grandes e limite de memória; nenhuma operação deve carregar toda a árvore sem necessidade.
4. Execute ciclos repetidos de backup e teste para detectar vazamento de handles, temporários e memória.
5. Teste milhares de arquivos pequenos, subpastas profundas e bundles numerosos.
6. Meça tempo de espera do encerramento e comportamento no limite de cinco minutos do Electron, se mantido pelo contrato atual.
7. Registre RPO/RTO observados por cenário e o ambiente; não generalize para hardware não testado.

## Fase 17 — Backend e persistência

Para cada endpoint:

1. registre payload válido e inválido, contrato, código HTTP, resposta e efeito;
2. teste ausência, tipo errado, campo extra, limite, ID inexistente, duplicidade e concorrência;
3. confirme validação no servidor e mensagens sanitizadas;
4. valide transação/atomicidade, estados operacionais e histórico;
5. recarregue e reinicie API/Electron quando aplicável;
6. confronte UI, API, SQLite, manifesto, filesystem, logs e auditoria;
7. prove que `HTTP 200/202` não é tratado como recuperação concluída antes do resultado pós-reinício.

## Fase 18 — Correção e reteste

1. Reproduza e identifique a causa raiz antes de editar.
2. Adicione teste que falhe antes da correção sempre que possível.
3. Faça a menor alteração coerente; não redesenhe o formato ou criptografia sem aprovação.
4. Não silencie erros, não diminua KDF, não remova checksums e não trate bundle parcial como válido.
5. Rode teste focado, typecheck/lint, testes web/API/Electron e E2E do backup.
6. Repita manualmente o fluxo real no aplicativo instalado.
7. Qualquer correção no formato/worker invalida os bundles de teste anteriores: gere novos e repita restauração A/B.
8. Mudança que afete compatibilidade deve incluir fixture de versão anterior e decisão explícita de migração.

## Fase 19 — Limpeza e critério de encerramento

Não encerre enquanto houver item sem situação. Para concluir:

- todos os controles, endpoints, workers, estados e formatos inventariados foram exercitados ou têm bloqueio reproduzível;
- backup do banco e completo foram reconciliados por oráculo independente;
- restauração real foi comprovada no Dispositivo A;
- recuperação portátil foi comprovada no Dispositivo B ou marcada como bloqueada;
- falhas e interrupções não deixaram estado híbrido;
- credenciais e segredos não apareceram em bundle/evidências;
- política, retenção, automação e encerramento foram testados;
- leitor de tela, escala, alto contraste e diálogos nativos foram executados ou bloqueados explicitamente;
- nenhuma falha nova relevante aparece em console, rede, logs, banco ou filesystem;
- fixtures, perfis, kits, autorizações, sessões, bundles e instalações sintéticas foram removidos com prova;
- snapshots preservados por evidência estão criptografados, identificados e têm data de descarte;
- o diff contém somente correções/evidências da auditoria.

A prontidão geral deve ser `REPROVADA` se houver:

- restauração que não preserve banco/documentos;
- corrupção, perda ou estado híbrido;
- bundle aceito com hash/tag/caminho inválido;
- segredo ou credencial exposto;
- estado “protegido” falso;
- rollback incapaz de recuperar a origem;
- backup completo que omita documento sem avisar;
- recuperação portátil prometida mas não comprovada;
- P0/P1 pendente no ciclo de backup.

Use `APROVADA COM RESSALVAS` somente para bloqueio físico claramente externo que não contradiga promessa essencial. Se o produto promete recuperação em outro computador e esse fluxo não foi executado, a decisão específica deve ser `BLOQUEADA` e a prontidão geral não pode ser plenamente aprovada.

## Classificação dos achados

- **P0:** perda/corrupção de dados, restauração destrutiva sem rollback, segredo exposto ou recuperação impossível anunciada como segura.
- **P1:** backup/restauração principal quebrado, bundle incompleto aceito, estado protegido falso, retenção removendo última cópia ou bloqueio grave de acessibilidade no fluxo de desastre.
- **P2:** política/scheduler/status/histórico incorreto, validação ausente, erro secundário ou UX que induz decisão insegura.
- **P3:** problema visual/textual menor ou melhoria não essencial.

## Entregáveis obrigatórios

1. `RELATORIO.md` com as sete decisões independentes.
2. Matriz completa de cobertura.
3. Diagrama do fluxo e fronteiras de confiança: renderer → Electron → API → worker → banco/filesystem → recuperação.
4. Especificação observada dos formatos de bundle, manifesto, envelopes, código e kit, sem segredos.
5. Caderno de oráculos antes do backup e depois de cada restauração.
6. Matriz de compatibilidade por versão/formato/schema/dispositivo.
7. Relatório do Dispositivo A e do Dispositivo B.
8. Matriz de falhas/interrupções e rollback.
9. Relatório de retenção, capacidade, RPO e RTO.
10. Relatório de segurança e privacidade.
11. Relatório de acessibilidade e homologação Windows.
12. Lista de achados com ID, gravidade, camada, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
13. Comandos e testes executados com totais e resultados exatos.
14. Relação de arquivos alterados e motivo.
15. Contagem final de aprovados, corrigidos, pendentes, bloqueados e não aplicáveis.
16. Melhorias não implementadas, separadas por benefício, esforço e risco.
17. Confirmação da limpeza ou inventário exato de resíduos com IDs, caminhos sanitizados, hashes e descarte.

## Formato obrigatório da resposta final

Comece pelo resultado real:

- **Prontidão geral para recuperação de desastre:** APROVADA, APROVADA COM RESSALVAS ou REPROVADA;
- as seis decisões componentes restantes;
- cobertura obtida em números;
- RPO e RTO observados por ambiente;
- bundles criados, validados, restaurados e recusados;
- defeitos encontrados/corrigidos/pendentes por gravidade;
- resultado no Dispositivo A e no Dispositivo B;
- testes automatizados e físicos executados;
- bloqueios e riscos residuais;
- links para relatório e evidências;
- recomendação objetiva: `PROTEÇÃO OPERACIONAL APROVADA`, `NÃO CONSIDERAR RECUPERÁVEL FORA DESTE COMPUTADOR` ou `NÃO CONFIAR NO BACKUP ATÉ CORRIGIR E RETESTAR`.

Não use “backup criado com sucesso” como conclusão. Use fatos: IDs sintéticos reconciliados, contagens, centavos, árvores, SHA-256, versões, tempos, pontos de falha e evidências pós-reinício.
