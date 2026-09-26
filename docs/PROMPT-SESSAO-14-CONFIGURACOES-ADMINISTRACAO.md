# Prompt de auditoria — Sessão 14: Configurações e Administração

Você atuará como engenheiro sênior de QA full stack, especialista em aplicações desktop/Electron, administração de sistemas locais, backup e recuperação, migração de dados, UX, acessibilidade, integridade, observabilidade e segurança. Sua tarefa é **AUDITAR, CORRIGIR E RETESTAR** somente a Sessão 14 do GeoGestor até obter evidências suficientes sobre tudo o que pertence ao escopo.

## Configuração da sessão

- Sessão atual: **14 — Configurações e Administração**.
- Módulos/menus: **Configurações**, **Importação de dados**, **Esquemas de importação**, **Qualidade dos dados**, **Verificação pós-atualização** e **Logs de auditoria**.
- Rotas principais:
  - **`/configuracoes`** — preferências, dados da empresa, arquivos, segurança, alertas, modelos, integrações, aparência, backup e manutenção;
  - **`/importacao`** — importação simples e migração completa por CSV/XLSX;
  - **`/importacao/esquemas`** — esquemas de mapeamento salvos;
  - **`/qualidade-dados`** — diagnóstico somente leitura de integridade e vínculos;
  - **`/pos-atualizacao`** — integridade do banco, qualidade e proteção por backup;
  - **`/audit-logs`** — trilha administrativa.
- Integração de instalação inicial, apenas em perfil e banco descartáveis:
  - **`/configuracoes-iniciais`** — primeiro uso, nome da empresa e pasta de dados.
- Estados de URL atuais em Configurações:
  - `secao=empresa|arquivos|seguranca|backups|alertas|modelos|integracoes|aparencia|manutencao`;
  - `foco=<id-do-controle-ou-bloco>` para navegação e foco contextual.
- Integrações imediatas permitidas:
  - Clientes, Projetos e CRM somente para comprovar importações simples, vínculos, idempotência e opções;
  - Orçamentos, Relatórios e impressão/PDF somente para comprovar o modelo empresarial e a identidade visual;
  - Tarefas e Projetos somente para comprovar criação, duplicação e aplicação de modelos de checklist;
  - Calendário e Alertas somente para comprovar configuração do Google Agenda e políticas de alerta;
  - qualquer outro módulo somente para criar fixture sintética, conferir efeito administrativo ou seguir link iniciado nas rotas desta sessão.
- Foco especial: carregamento e busca interna de Configurações; navegação por seção e foco; formulários sujos; configuração inicial; dados da empresa e logotipos; pasta de arquivos e migração; segurança local; alertas; modelos de PDF e checklist; Google Agenda; tema; política, criação, verificação, retenção, recuperação e restauração de backups; saúde, diagnóstico e histórico operacional; redefinição dos dados; importações simples e completas; esquemas; qualidade; pós-atualização; logs de auditoria; segredos, transações, concorrência, reinício, acessibilidade e limpeza.
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
  - `docs/auditorias/2026-09-14-planejamento/RELATORIO.md`;
  - `docs/auditorias/2026-09-15-cadastros-propriedades/RELATORIO.md`;
  - evidências históricas `docs/AUDITORIA-CONFIGURACOES-BACKUP-2026-08-23.md`, `docs/AUDITORIA-ACESSIBILIDADE-CONFIGURACOES-2026-08-08.md` e `docs/AUDITORIA-BACKEND-E-SEGURANCA-LOCAL-2026-08-01.md`, que servem somente como contexto e **não substituem reteste atual**.
- Observação: no momento da geração deste prompt, o relatório final da Sessão 11 ainda não foi localizado. Procure-o antes da execução; se continuar ausente, registre a lacuna sem inventar resultados.
- Riscos herdados da Sessão 13 que devem ser mantidos visíveis:
  - a suíte completa da API apresentou **186/187 testes aprovados**, com falha herdada em `financial-removal-scenarios.integration.test.ts:318`: `accountsReceivableCents` esperado `0` e obtido `3333`, e `receivedCents` obtido `6668`;
  - edição concorrente de catálogos e propriedades continua sem versionamento otimista comprovado;
  - leitor de tela real, alto contraste, zoom de 200%, offline/reconexão física, lock real do SQLite e reinício do aplicativo instalado permaneceram sem comprovação completa;
  - a publicação continua bloqueada: instaladores 1.0.2/1.0.3 não constavam do manifesto e tamanho/SHA-256 de 1.0.4 estavam divergentes;
  - não atribua esses débitos à Sessão 14, mas confirme que nenhuma correção administrativa os agrava.
- Implementar correções comprovadas: **SIM**.
- Implementar novos provedores, autenticação multiusuário, criptografia integral do SQLite, novos formatos de importação, sincronização em nuvem, novos filtros de auditoria ou mudanças de produto: **NÃO, sem aprovação expressa**.
- Diretório dos entregáveis: `docs/auditorias/[AAAA-MM-DD]-configuracoes-administracao/`.

## Objetivo

Validar de ponta a ponta cada seção, cartão, busca, formulário, seletor, upload, download, modal, confirmação, operação longa, link, filtro, tabela, exportação, aviso e ação disponível nas rotas administrativas. Comprove o resultado na interface real, na API, no SQLite, no `localStorage`, no cofre/armazenamento de segredos, no sistema de arquivos, no histórico operacional e na trilha de auditoria quando aplicável.

Não aprove uma operação porque apareceu um toast, porque a API retornou HTTP 200/202 ou porque um arquivo foi criado. Verifique conteúdo, integridade, persistência após reload e reinício, efeitos colaterais, rollback, proteção de segredos e possibilidade real de recuperação. Corrija apenas defeitos reproduzidos no escopo e reteste a rota afetada e suas integrações imediatas.

## Limites funcionais e de produto

1. O GeoGestor é um aplicativo desktop local. Segurança por senha protege a abertura e operações sensíveis, mas **não equivale a criptografia integral do arquivo SQLite**. Mensagem ou relatório que sugira o contrário é defeito.
2. Não existem contas multiusuário, papéis, permissões remotas ou administração em nuvem no contrato atual. Marque-os como `NÃO APLICÁVEL`, salvo evidência nova na versão executada.
3. A Qualidade dos dados é diagnóstica e somente leitura. Não invente botão de correção automática; registre melhorias separadamente.
4. Esquemas de importação atualmente são salvos, listados, pesquisados e excluídos. Edição, renomeação, aplicação manual e importação/exportação do esquema são `NÃO APLICÁVEL` se continuarem ausentes. Se a interface prometer reutilização sem oferecer um caminho funcional, registre a divergência de produto/UX.
5. A interface atual de Logs de auditoria filtra por ação e por um conjunto limitado de entidades. Busca textual, data, usuário e exportação são `NÃO APLICÁVEL` se não existirem, mas a API e a UI devem continuar expondo corretamente todas as ações realmente suportadas, inclusive exclusão lógica.
6. Integração Google só pode usar credenciais e agenda sintéticas explicitamente autorizadas. Sem isso, teste contrato, armazenamento, estados OAuth e falhas seguras; marque a autenticação/sincronização externa como `BLOQUEADA`.
7. Notificações nativas exigem ambiente Electron e permissão do sistema. Sem suporte, cubra lógica e fallback e registre o bloqueio físico.
8. Modelos de PDF pertencem a esta sessão; conteúdo financeiro ou técnico dos relatórios continua pertencendo às sessões de origem. Valide apenas identidade, logo, cor, termos e persistência.
9. Modelos de checklist pertencem a esta sessão; o gerenciamento completo das tarefas pertence à Sessão 09. Aqui, valide CRUD, duplicação e aplicação imediata.
10. Ajuda, regressão global final, instaladores, atualização e publicação pertencem à Sessão 15. Esta sessão pode validar a tela pós-atualização e a consistência de versão, mas não deve publicar release.

## Hierarquia obrigatória de segurança

Classifique previamente cada cenário:

- **Nível A — leitura ou preferência reversível:** navegação, tema, pesquisa, filtros, dados empresariais sintéticos e alertas. Pode ser executado no perfil isolado da sessão.
- **Nível B — mutação operacional controlada:** importação, modelos, migração da pasta de arquivos, geração de backup e kit de recuperação. Exige banco, diretórios e perfil exclusivos, snapshot verificável e fixtures sintéticas.
- **Nível C — destrutivo ou recuperação:** restauração real, reset operacional, corrupção, disco cheio, interrupção do processo, incompatibilidade de schema e rollback de migração. Execute **somente** em instalação/perfil descartável criado para o cenário, sem qualquer dado real e com caminhos absolutos comprovados.

Antes de qualquer Nível B ou C:

1. identifique por PID, porta e caminho absoluto o banco, WAL/SHM, pasta de documentos, pasta de backup, perfil Electron e processo em uso;
2. prove que não são os dados reais do usuário;
3. produza snapshot/checksum verificável;
4. registre o plano de recuperação;
5. valide o nome, ID, caminho e confirmação exata antes de executar;
6. não use globs, raiz de unidade, diretório home ou variável não resolvida em operação destrutiva.

Se não puder provar isolamento, não execute: faça inspeção não destrutiva, marque `BLOQUEADO` e explique exatamente o risco.

## Invariantes administrativas

Crie um caderno de oráculos e comprove pelo menos:

- frontend, API, banco, arquivos, backups e perfil pertencem à mesma instância;
- segredos, senhas, tokens OAuth, códigos de recuperação e conteúdo sensível não aparecem em respostas, console, logs, auditoria, diagnóstico, histórico, nomes de arquivo ou evidências;
- cada operação longa possui estado único, progresso coerente, exclusão mútua, cancelamento seguro quando suportado e estado terminal após reinício;
- falha intermediária não deixa configuração pela metade, banco divergente, arquivos órfãos, diretório parcialmente migrado ou operação eternamente `running`;
- alterações persistem após reload e, quando aplicável, reinício do serviço e do desktop instalado;
- ações sensíveis exigem confirmação e autorização vigentes, ligadas ao caminho/operação exatos, com expiração e uso único;
- toda ação administrativa prevista gera histórico e auditoria sanitizados, sem impedir rollback transacional;
- `localStorage` nunca substitui silenciosamente a configuração autoritativa válida no SQLite;
- chamadas repetidas, duplo clique, retry e concorrência não duplicam importações, backups, restaurações, modelos ou registros;
- relógio, timezone, caminhos Windows, Unicode e formatos pt-BR são tratados de forma determinística;
- dados sintéticos e segredos temporários são removidos ao final sem apagar histórico real nem arquivos preexistentes.

## Dados mínimos para a Sessão 14

Crie somente em ambiente isolado, com prefixo `QA-AUDIT-S14-[DATA-HORA]-`:

- perfil Electron novo para `/configuracoes-iniciais` e perfil já configurado para as demais rotas;
- empresa/admin sintéticos, e-mail válido/inválido, logotipos PNG/JPG/WebP válidos, arquivo vazio, extensão maiúscula, tipo falso, nome longo e arquivos acima dos limites;
- pastas exclusivas de documentos, destino novo vazio, destino com conflito, caminho relativo, raiz de unidade, caminho sem permissão, espaço insuficiente simulado e árvore com arquivo, subpasta e symlink/reparse point controlado;
- política de segurança desligada e ligada, senhas temporárias únicas, tentativas incorretas, bloqueio por força bruta, mudança e desativação;
- fonte sintética para cada uma das nove categorias de alerta: projeto, tarefa, recebível, pagável, orçamento, licença, condicionante, compromisso e CRM;
- modelo empresarial completo e mínimo, com/sem logos, cores válidas/inválidas, CPF/CNPJ, telefone, e-mail, endereço, conselho, registro e termos nos limites;
- modelos de checklist ativo/inativo, com 1 e 100 etapas, prioridades, nomes duplicados normalizados, cópia e aplicação repetida;
- credenciais OAuth exclusivamente sintéticas/inválidas para testes locais; conta Google de QA apenas se previamente autorizada;
- destino de backup interno controlado e destino externo/sincronizado simulado quando tecnicamente possível; backups de banco e completos válidos, antigos, corrompidos, incompletos, incompatíveis, sem arquivo e com manifesto/checksum alterado;
- código e kit de recuperação temporários, cuja exibição nunca será capturada nem incluída no relatório;
- instalação/perfil descartável separado para restauração real e outro para reset operacional;
- CSV e XLSX simples para Clientes, Projetos e Contatos, cobrindo cabeçalho deslocado, colunas repetidas/sem título, acentos, delimitadores, dados válidos, inválidos, duplicados, parciais, 500 e 501 linhas;
- CSV/XLSX de migração completa com clientes, propriedades, projetos, orçamentos, faturamentos/notas, despesas e reconciliação financeira conhecida; arquivos repetidos, conteúdo alterado após prévia, prévia expirada e duas confirmações concorrentes;
- esquemas válidos, duplicados, data inválida e JSON corrompido somente em perfil descartável;
- dados sintéticos que disparem isoladamente cada código de qualidade aplicável, arquivos de documento ausentes e operação de filesystem com falha;
- logs de auditoria INSERT, UPDATE, DELETE e exclusão lógica, JSON válido/inválido, conteúdo aninhado/longo e campos sensíveis;
- estados vazio, parcial, loading, erro, lentidão, offline/reconexão, cancelamento, reinício e alta cardinalidade.

Nunca registre em captura, console copiado ou relatório a senha, segredo Google, token, código de recuperação ou conteúdo descriptografado do kit. Use identificadores sanitizados para provar presença/ausência.

## Fase 1 — Preparação e linha de base

1. Leia integralmente os `AGENTS.md`, as Web Interface Guidelines e todos os relatórios anteriores disponíveis.
2. Preserve o worktree existente. Registre `git status`, commit e diff; não reverta nem atribua à sessão alterações preexistentes.
3. Identifique arquitetura, versão do app/Electron/web/API/contratos/schema, sistema operacional, locale, timezone, tema, viewport, comandos de execução e suíte de testes.
4. Descubra processos e portas ativos sem encerrá-los; identifique banco, WAL/SHM, pasta de arquivos, backups, diagnósticos, logs e perfil do processo real.
5. Registre hashes/checksums, espaço livre, permissões e contagens de linha de base; confirme `PRAGMA quick_check`, `foreign_key_check`, `user_version` e migrations.
6. Registre erros existentes no console/rede/logs, operações `running`, pendências de outbox, estado de backup, política de segurança e configuração Google sem revelar segredo.
7. Crie `docs/auditorias/[AAAA-MM-DD]-configuracoes-administracao/` e separe evidências por rota e nível de risco.
8. Leia o relatório da Sessão 13 e mantenha a falha financeira, os bloqueios de concorrência e o bloqueio de release como riscos herdados.

## Fase 2 — Inventário e matriz de cobertura

Antes de testar, produza matriz contendo:

- ID, rota, seção, âncora/foco, controle, estado condicional e nível de risco;
- ação esperada, pré-condição, confirmação e resultado visível;
- componente/helper do frontend;
- endpoint/método, schema, serviço, worker, transação e autorização;
- tabela/chave de configuração, `localStorage`, cofre, arquivo/diretório, histórico e auditoria;
- integração imediata afetada;
- cenários positivo, negativo, vazio, limite, loading, erro, lentidão, cancelamento, retry, concorrência, reinício e recuperação;
- situação, evidência, achado e limpeza.

Varra a interface e o código para localizar busca interna, seções condicionais, ferramentas, botões Electron-only, operações em andamento, avisos de segurança, confirmações literais, exportações, links, estados degradados e ações que só aparecem após configurar senha, destino, Google ou kit de recuperação.

## Fase 3 — Rotas, navegação e estado da página

1. Abra todas as rotas principais pelo menu, links internos, URL direta, refresh e voltar/avançar.
2. Em `/configuracoes`, teste todos os valores válidos de `secao`, seção ausente, vazia, inválida, duplicada e codificada.
3. Teste `foco` válido em outra seção, no mesmo bloco, inexistente e combinado com busca; confirme scroll, foco visível e anúncio compreensível.
4. Use a busca interna com termos de título, descrição e palavra-chave; valide limite, ordem, acentos, caixa, vazio, teclado e destino correto.
5. Alterne de seção e abra ferramenta com formulário sujo; teste permanecer, descartar e salvar, além de fechamento da janela, refresh e navegação externa.
6. Confirme que a seção ativa e a URL nunca divergem e que não há flicker, tela branca, loop, requisição repetida ou foco perdido.
7. Teste banner de operação em andamento, atualização de progresso, ação de cancelar e persistência/recuperação depois de recarregar.
8. Em `/configuracoes-iniciais`, use apenas perfil novo; confirme que configuração já existente impede repetição indevida e que sucesso redireciona para `/`.

## Fase 4 — Empresa, configuração inicial e arquivos

### A. Configuração inicial e dados da empresa

1. Teste nome da empresa e pasta de dados vazios, espaços, limites, Unicode, caminhos válidos/inválidos e erro do servidor; confirme foco no primeiro erro.
2. Em Empresa e usuário, teste nome da empresa, nome do administrador e e-mail; compare validação da UI e da API, trimming, limites e persistência.
3. Faça upload, substituição e remoção dos logotipos suportados; valide assinatura real do arquivo, MIME, tamanho, dimensões/preview, base64 e persistência.
4. Confirme que logo do aplicativo e logo do PDF não se sobrescrevem e que salvar dados da empresa preserva todos os demais campos do modelo.
5. Simule falha entre o PATCH da configuração e a gravação do modelo empresarial; prove atomicidade ou registre o commit parcial com causa raiz.
6. Recarregue e reinicie; confronte UI, `/api/configuracoes`, configuração operacional, cache e identidade exibida na navegação/PDF.
7. Confirme que a API nunca devolve hash de senha, segredo Google, refresh token ou access token; apenas sinalização booleana permitida.

### B. Pasta de arquivos e migração

1. Confirme o caminho absoluto efetivamente usado e a ação de abrir pasta no Electron.
2. Execute preflight para estratégias `copy`, `move` e `use`; confira quantidade, bytes, conflitos, arquivos rastreados ausentes/externos, permissões e espaço livre.
3. Rejeite caminho relativo, raiz de unidade, sobreposição com banco, diretório interno ou backups e destinos conflitantes.
4. Confirme que symlinks/reparse points não permitem escapar do destino nem são copiados silenciosamente.
5. Exija a frase exata `ALTERAR PASTA DE DADOS DO GEOGESTOR`; teste erro de caixa/espaço e duplo clique.
6. Em cópia e movimento, compare SHA-256 e tamanho de cada arquivo, referências dos documentos no banco e configuração final.
7. Injete falha após parte das cópias e antes/depois da transação; prove rollback e remoção apenas dos arquivos criados pela operação.
8. Cancele durante fase segura; confirme histórico `cancelled`, origem/destino coerentes e ausência de referência quebrada.
9. Reinicie durante operação em perfil descartável; confirme recuperação explícita, sem operação eterna nem uso ambíguo das duas pastas.
10. Em `use`, comprove que só é permitido quando não há documentos ou quando todos já existem no destino correto.

## Fase 5 — Segurança local, alertas, aparência e integração Google

### A. Segurança local

1. Teste ativar senha, desbloquear, bloquear, alterar e desativar; inclua senha curta, limite máximo, confirmação divergente, senha atual incorreta e espaços.
2. Confirme proteção contra força bruta, código HTTP, `Retry-After`, contador, expiração e recuperação após a janela.
3. Após ativação/mudança/desativação, prove revogação das sessões antigas, validade somente da nova sessão e comportamento em duas janelas.
4. Teste timeout por inatividade, atividade que renova e operação longa que não deve ser corrompida pelo bloqueio.
5. Confirme que operações de recuperação sensíveis continuam pedindo senha administrativa conforme contrato, mesmo com abertura automática.
6. Verifique auditoria sem senha/hash e mensagem explícita de que a proteção não criptografa integralmente o SQLite.

### B. Alertas

1. Teste habilitação global, notificações nativas e as nove categorias suportadas.
2. Para cada categoria, teste ativação, antecedência `0..365`, recorrência diária/intervalo/uma vez, intervalo `1..90`, aviso no vencimento e manutenção de vencidos.
3. Valide bordas de data civil e timezone usando uma fixture por categoria; prove ocorrência, deduplicação, atualização e remoção após mutação da origem.
4. Teste restaurar padrões, salvar, cancelar, erro, retry, reload e reinício; compare SQLite e cache legado `geogestor_alerta_dias`.
5. Em Electron autorizado, valide permissão, notificação nativa e fallback; sem suporte, registre o bloqueio físico.

### C. Aparência

1. Teste claro, escuro e sistema; confira `localStorage` `geogestor_theme`, classe do documento e `color-scheme`.
2. Reinicie, altere o tema do sistema e teste valor corrompido/legado; confirme fallback determinístico.
3. Teste restaurar padrão e cancelar confirmação; valide todas as seções nos dois temas, alto contraste e redução de movimento.

### D. Google Agenda

1. Teste Client ID e Client Secret vazios, limites, espaços, mascaramento e substituição; o segredo nunca deve voltar da API.
2. Confirme armazenamento protegido local e ausência do segredo/tokens em SQLite legível, resposta, auditoria, logs, diagnóstico e backups.
3. Teste geração da URL OAuth e `state` aleatório, com expiração de 10 minutos, uso único, replay, ausência, erro e callback inválido.
4. Teste polling, timeout, fechamento da janela, offline e reconexão sem deixar interface autenticada falsamente.
5. Com conta Google de QA autorizada, valide autenticação, sincronização, paginação, idempotência e desconexão; sem ela, marque o E2E externo como `BLOQUEADO`.
6. Desconectar deve limpar tokens e estado de sincronização sem apagar compromissos locais.

## Fase 6 — Modelos empresariais e de checklist

### A. Modelo empresarial/PDF

1. Teste todos os campos, limites, normalização, CPF/CNPJ opcional válido/inválido, telefone, e-mail, cor hexadecimal e termos longos.
2. Teste logo PNG/JPG/WebP até 2 MB, tipo incompatível, conteúdo falso, arquivo vazio e base64 acima do limite operacional.
3. Confirme fonte autoritativa `geogestor_empresa_template` no SQLite e comportamento do cache local em ausência, erro, divergência e corrupção.
4. Gere ao menos um orçamento/relatório sintético e inspecione PDF fora do gerador: logo, razão social, contatos, conselho, cor, termos, quebra de página, contraste e ausência de dados antigos.
5. Teste gravações concorrentes entre Empresa e Modelo PDF; nenhum painel pode sobrescrever silenciosamente campo atualizado pelo outro.

### B. Modelos de checklist

1. Complete criar, localizar, abrir, editar, salvar, recarregar, duplicar, ativar/inativar, cancelar exclusão e excluir.
2. Teste nome, tipo de projeto, descrição, 1 e 100 etapas; título/descrição da etapa, prioridade, ordem, remoção e limites.
3. Confirme transação do modelo e etapas, exclusão lógica, preservação de aplicações/tarefas e auditoria.
4. Duplicar deve criar cópia independente e inativa; edição da cópia não altera a origem.
5. Aplicar a projeto cria somente tarefas necessárias, deriva vínculos corretos e não duplica títulos equivalentes por caixa, acento e espaços.
6. Reaplique, duplique submissão e injete falha intermediária; comprove idempotência e rollback.

## Fase 7 — Backup, proteção e recuperação

### A. Política e destino

1. Teste defaults e todos os campos: automático, debounce `1..1440` min, banco `1..720` h, completo `1..365` dias, retenção `1..365`, recentes `1..720` h, diários `1..3650` dias, mensais `1..120`, quota, tolerância `0..720` h, startup, shutdown, teste de restauração e intervalo `1..365` dias.
2. Teste destino absoluto, `~/`, raiz, relativo, sobreposição com documentos, sem permissão, inexistente, removível/desconectado e espaço insuficiente.
3. A sonda de escrita deve ser exclusiva, removida no final e não pode sobrescrever arquivo existente.
4. Confirme persistência transacional, auditoria sanitizada e execução do scheduler após reinício.

### B. Criação, manifesto, integridade e retenção

1. Crie backup do banco e backup completo. Identifique exatamente o conteúdo esperado de cada tipo.
2. Valide snapshot consistente do SQLite inclusive WAL/SHM, `quick_check`, chaves estrangeiras, versão do schema, manifesto, tamanho e SHA-256.
3. Confirme criptografia e exclusão de credenciais/tokens; não capture material de recuperação.
4. No backup completo, compare árvore de documentos, nomes Unicode, arquivos vazios/grandes, quantidade e bytes. Links não podem escapar da raiz.
5. Teste mutação concorrente durante backup e prove ponto consistente sem arquivo/banco híbrido.
6. Teste retenção por cópias recentes, diárias e mensais, limite antigo e quota; preserve sempre o conjunto necessário para recuperação.
7. Teste destino indisponível, disco cheio, arquivo bloqueado, interrupção, cancelamento e reinício; nenhum `.pending` pode ser tratado como backup válido.
8. Confira estados `current`, `overdue`, `incomplete`, `failed` e `running`, alterações ainda não protegidas, cópia externa, integridade, kit e teste de restauração.

### C. Código, kit e sessão de recuperação

1. Gere e confirme código de recuperação sem registrá-lo em evidência; teste senha administrativa errada e rate limit.
2. Exporte kit com senha de ao menos 12 caracteres; valide formato, versão, scrypt e AES-256-GCM sem expor conteúdo sensível.
3. Teste kit correto, senha incorreta, alteração de salt/IV/tag/ciphertext/key ID, arquivo truncado e finalidade `restore|confirm`.
4. Confirme expiração/invalidação da sessão em memória, limpeza da UI após inatividade e uso único quando aplicável.
5. Prove que código/kit não aparecem em backup, diagnóstico, auditoria, log operacional ou arquivo temporário residual.

### D. Preflight, teste e restauração real

1. Selecione o backup pelo Electron; a autorização deve ser HMAC, ligada ao caminho resolvido exato, nonce único, expiração e uso único.
2. Teste caminho adulterado, autorização ausente/expirada/reutilizada e chamada fora do desktop gerenciado.
3. Execute preflight e teste de restauração; compare tipo, data, schema, arquivos, bytes, criptografia, integridade, checksums, credenciais excluídas e espaço necessário.
4. Rejeite bundle corrompido, checksum divergente, manifesto malformado, arquivo ausente/extra, schema futuro e recuperação incorreta.
5. A autorização não pode restaurar antes de o mesmo bundle ser testado e marcado como apto.
6. Em instalação **totalmente descartável**, exija `RESTAURAR BACKUP DO GEOGESTOR`, execute restauração real, aguarde reinício e compare banco e arquivos item a item.
7. Injete falha em cada estágio crítico; prove backup de segurança, rollback e retorno à instalação original íntegra.
8. Restauração em dados reais ou ambiente não isolado deve permanecer `BLOQUEADA`.

## Fase 8 — Manutenção, diagnóstico, histórico e reset

1. Valide `/api/sistema/diagnostico`: `quick_check`, foreign keys, schema, contagens, tabelas residuais, relações, diretórios, outbox, performance e logging.
2. Gere diagnóstico e examine o JSON/arquivo independentemente; prove ausência de nomes de clientes, documentos, caminhos pessoais, e-mails, tokens, senhas e segredos.
3. Teste falha de escrita, arquivo temporário, retry e abertura da pasta pelo Electron.
4. Valide histórico operacional dos tipos `backup_database`, `backup_complete`, `restore_test`, `restore`, `data_migration`, `operational_reset`, `integrity_check` e `diagnostic_export`; teste limite até 500, ordem determinística e CSV.
5. Compare histórico, operação ativa, log e auditoria: IDs, início/fim, progresso, resultado, erro sanitizado e duração.
6. Teste exclusão mútua entre backup, restauração, migração da pasta e reset; conflito deve falhar com mensagem segura, não executar em paralelo.
7. Em perfil descartável, teste reset com confirmação incorreta, cancelada e exata `APAGAR DADOS DO GEOGESTOR`.
8. Antes de apagar, o reset deve criar e validar backup recuperável; falha do backup impede qualquer exclusão.
9. Conte todas as tabelas antes/depois. Confirme exatamente o que é removido e preservado, inclusive configurações, alertas, auditoria, histórico, modelos de checklist e arquivos físicos.
10. Investigue explicitamente se documentos removidos do banco deixam arquivos órfãos e se o backup somente do banco é suficiente para a promessa de recuperação; classifique qualquer divergência.
11. Injete falha no meio da transação e prove rollback integral; teste concorrência, dupla confirmação, invalidação de cache e estado vazio após reinício.
12. Restaure o backup do reset em ambiente descartável e comprove recuperação; sem isso, não aceite a alegação de reversibilidade.

## Fase 9 — Importação simples

1. Teste modos e entidades atuais: Clientes, Projetos e Contatos. Não invente importação simples de outras entidades.
2. Envie CSV e XLSX por seletor e arrastar/soltar; valide extensão, conteúdo, arquivo vazio, 20 MB, 20.000 linhas/300 colunas globais e limite simples de 500 linhas.
3. Teste cabeçalho nas primeiras 20 linhas, aba escolhida no XLSX, colunas repetidas, sem título, vazias, acentuadas e ordem variável.
4. Valide automapeamento, troca manual, campos obrigatórios, coluna sem uso, preview, confirmação de revisão e foco no primeiro bloqueio.
5. Clientes exigem nome, telefone conforme contrato e pelo menos CPF ou CNPJ mapeado; teste PF/PJ, documento inválido/duplicado e validação por linha.
6. Projetos exigem nome e referência de cliente; teste associação por documento, nome exato, ID interno e manual, além de ausente, ambígua, inválida, cliente inativo e projeto duplicado no mesmo lote.
7. Contatos devem normalizar e validar os campos atuais sem aceitar silenciosamente objeto aninhado ou tipo incompatível.
8. Compare resultado por linha: lidas, importadas, atualizadas, reutilizadas, ignoradas, falhas e pendentes; valide `completed`, `completed_with_warnings`, `partial` e `failed`.
9. Use `Idempotency-Key`: replay do mesmo payload retorna o mesmo resultado, conteúdo diferente retorna 409 e duas submissões concorrentes criam uma única importação.
10. Simule falha de auditoria e filesystem outbox; prove rollback ou `completed_with_warnings` conforme o contrato, sem meia entidade.
11. Confira `/api/importacoes/historico`, `/:id`, `/:id/linhas`, filtro de erros e `/:id/erros.csv`; dados pessoais não devem vazar no resumo.
12. Após sucesso, confira os registros nos módulos consumidores, banco, pastas e auditoria; depois remova somente as fixtures da sessão.

## Fase 10 — Migração completa e esquemas

### A. Prévia e confirmação da migração completa

1. Calcule SHA-256 do arquivo e valide `fileName`, `fileHash`, aba, cabeçalhos, primeira linha, colunas, mapeamento e tempos do cliente.
2. Confira detecção exata/semântica/manual, confiança, reconhecidas, não reconhecidas, ignoradas e aliases duplicados.
3. Recalcule a prévia: clientes criados/atualizados, documentos inválidos/duplicados, propriedades, projetos, orçamentos, faturamentos, recebíveis, recebimentos, despesas, parciais, avisos e bloqueios.
4. Recalcule a reconciliação financeira com oráculo independente em centavos e documente limitações/históricos.
5. Altere mapeamento e confirme que uma nova prévia invalida a confirmação anterior e atualiza todos os totais.
6. Confirmação exige `previewId`, mesmo digest, prévia pronta, não expirada e não utilizada; teste conteúdo alterado, replay, expiração e uso concorrente.
7. Apenas uma importação pesada pode processar por vez; segunda tentativa deve receber conflito claro.
8. Valide fila, polling, estágio, progresso monotônico, conclusão, falha, parcial, cancelamento e recuperação de execução interrompida após reinício.
9. Prove transação integral e idempotência: falha de auditoria ou gravação reverte todas as entidades e relações; reimportação não duplica.
10. Compare UI, API, SQLite, outbox, arquivos, histórico, auditoria e consumidores. Nenhum total pode ser aceito sem reconciliação independente.

### B. Esquemas de importação

1. Confirme criação automática após sucesso simples e completo, campos mapeados, entidade, data e persistência em configuração operacional/cache.
2. Teste busca por nome/entidade, vazio, Unicode, data inválida, texto longo, muitos esquemas e responsividade da tabela.
3. Cancele e confirme exclusão; prove remoção autoritativa, atualização do cache e persistência após reload/reinício.
4. Teste JSON ausente, corrompido e estrutura inválida somente em perfil descartável; a rota não pode quebrar inteira nem apagar silenciosamente dados válidos do banco.
5. Verifique se há caminho real para reutilizar um esquema. Se não houver, marque aplicar/editar/renomear como `NÃO APLICÁVEL` e registre qualquer promessa conflitante na interface.

## Fase 11 — Qualidade dos dados e pós-atualização

### A. Qualidade dos dados

1. Reproduza isoladamente os códigos existentes:
   - `projectsWithoutActiveClient`;
   - `projectsWithForeignProperty`;
   - `budgetsWithForeignProject`;
   - `budgetsWithForeignProperty`;
   - `approvedBudgetsWithoutProject`;
   - `approvedBudgetsWithoutInstallments`;
   - `installmentTotalsMismatch`;
   - `installmentOverpayments`;
   - `tasksWithForeignProject`;
   - `documentsWithForeignProject`;
   - `invoicesWithForeignLinks`;
   - `projectsWithoutProperty`;
   - `legacyPropertyData`;
   - `missingDocumentFiles`;
   - `failedFilesystemOperations`.
2. Injete relações inválidas apenas em cópia descartável e restaure/limpe depois; não corrompa a base normal de QA.
3. Compare gravidade, módulo, título, descrição, recomendação, contagem e até 200 registros amostrados.
4. Teste filtros de módulo e gravidade isolados/combinados, `clienteId` pela API, valores inválidos, zero, muitos registros e módulo que desaparece do conjunto filtrado.
5. Confirme `status=degraded` somente na presença de crítico e totais por ocorrência, não por cartão.
6. Exporte CSV e PDF com filtros; valide BOM, separador, acentos, fórmulas neutralizadas, conteúdo, paginação e ausência de dados fora do filtro.
7. Prove que a inspeção é somente leitura e que falha/ausência de tabela legada é tratada sem esconder erro atual relevante.

### B. Verificação pós-atualização

1. Valide aplicação, schema, `quick_check`, foreign keys, tabelas residuais, violações de relação, contagens preservadas, qualidade e backups.
2. Reproduza avaliações `ok`, `warning` e `critical` com combinações conhecidas.
3. São críticos: saúde degradada, qualidade crítica, backup vencido/incompleto/falho, integridade não verificada e alterações pendentes sem proteção.
4. São avisos: ausência de cópia externa confirmada e kit de recuperação não configurado/confirmado, quando não houver crítico.
5. Confirme precedência do crítico sobre aviso, pluralização, datas, estados de backup e links para Qualidade/Backups.
6. Teste loading, falha parcial de uma das três APIs, retry, resposta fora de ordem e mudança de estado após backup/correção.
7. Confronte `APP_VERSION`, versões de `package.json` e versão exibida; apenas registre divergência, sem produzir release nesta sessão.

## Fase 12 — Logs de auditoria

1. Gere mutações sintéticas INSERT, UPDATE, DELETE e exclusão lógica nos recursos desta sessão.
2. Teste paginação, limite `1..100`, filtro por ação, filtro por entidade, combinação, vazio, IDs inexistentes, ordem e empates de timestamp.
3. Confirme se `DELETE (SOFT)` é armazenado, exibido e filtrável sem sumir da trilha; alinhe contrato, API e UI ou registre o defeito.
4. Compare métricas e total com o conjunto filtrado, não apenas com a página atual.
5. Abra detalhes com `before`/`after`, campos criados/alterados/removidos, JSON nulo, inválido, legado, aninhado, arrays longos e texto truncado.
6. Prove sanitização no banco e na UI para senha, segredo, token, autorização, cookie, credencial, CPF/CNPJ, documento, e-mail, telefone, endereço, caminho e arquivos.
7. Insira conteúdo HTML/JavaScript inerte e confirme ausência de XSS persistente/refletido.
8. Falha da auditoria dentro da transação deve reverter a mutação; falha de log não transacional deve aparecer no log operacional sem expor payload.
9. Verifique todas as entidades administrativas, mesmo que o seletor atual liste apenas Cliente, Projeto, Orçamento e Despesa; ausência de opção para entidade existente é achado de cobertura/UX, não prova de ausência do log.

## Fase 13 — UX, acessibilidade e responsividade

1. Percorra todas as rotas apenas com teclado: Tab, Shift+Tab, Enter, Espaço, setas, Home/End e Escape.
2. Confirme foco visível, ordem lógica, foco inicial/retorno em modal, contenção, foco após erro, mudança de seção/rota e operação concluída.
3. Verifique landmarks, títulos, listas, tabelas, `details`, labels, descrições, `aria-live`, `role=alert`, nomes dos botões por ícone e ícones decorativos.
4. Teste temas claro/escuro, larguras 360/768/1024/1440 px, zoom 200%, reflow, textos longos, barras fixas, modais e ausência de rolagem horizontal acidental.
5. Em operações longas, valide progresso textual, estado ocupado, cancelamento acessível e não dependência exclusiva de cor/ícone.
6. Revise contraste, alvos de toque, hover/active/focus/disabled, redução de movimento, leitor de tela e alto contraste do sistema.
7. Sinalize `transition: all`, `outline-none` sem reposição, `div/span` clicável, campo sem label, botão sem `aria-label`, formato fixo não `Intl`, bloqueio de paste e `autoFocus` injustificado.
8. Execute a suíte automatizada de acessibilidade disponível, mas mantenha Narrator/leitor real, zoom e alto contraste como testes manuais separados.

## Fase 14 — Backend, persistência e segurança

Para cada fluxo de leitura ou gravação:

1. registre método, endpoint, query, headers, payload sanitizado, status e contrato;
2. teste válido, inválido, ausente, campo extra, limite, ID inexistente, duplicado e tipos incorretos;
3. confira códigos HTTP, mensagens seguras, schema estrito e ausência de stack trace/caminho/segredo;
4. confirme validação no servidor, transação, timestamps, normalização, unicidade, foreign keys e auditoria;
5. recarregue e reinicie quando relevante;
6. teste duas submissões rápidas, concorrência, retry e idempotência;
7. teste autorização local, manipulação de ID/caminho, path traversal, symlink, CSV injection, XSS e upload hostil de forma não destrutiva;
8. confira permissões de arquivos, temporários, atomic rename, limpeza e ausência de órfãos;
9. avalie consultas, limites, paginação, N+1, arquivos grandes e desempenho perceptível;
10. confirme que backup, diagnóstico, exportações e logs aplicam a mesma política de sanitização.

## Fase 15 — Correção, regressão e limpeza

1. Reproduza cada defeito e determine causa raiz antes de editar.
2. Adicione teste automatizado que falhe antes da correção quando tecnicamente razoável.
3. Faça a menor alteração coerente; não silencie erro, não enfraqueça validação e não crie comportamento especial para fixture.
4. Rode teste focado, lint/typecheck/build relevante e regressão das rotas/serviços afetados.
5. Repita manualmente o fluxo na aplicação real e atualize a evidência.
6. Se a correção exigir regra sobre recuperação, retenção, exclusão, segredo ou produto, documente proposta e aguarde aprovação.
7. Remova apenas dados, esquemas, arquivos, backups, diagnósticos, credenciais e perfis sintéticos identificados pelo prefixo da sessão.
8. Confirme no SQLite, `localStorage`, filesystem, cofre e APIs que não restaram resíduos; se algo não puder ser removido, liste ID e caminho exatos.
9. Revise o Git diff e separe alterações preexistentes das realizadas na sessão.
10. Execute a regressão completa disponível e compare a falha financeira herdada; qualquer nova falha bloqueia aprovação.

## Critério de encerramento

Não encerre enquanto houver item sem situação. Para concluir:

- todas as rotas, seções e ferramentas foram exercitadas ou têm bloqueio reproduzível;
- operações Nível C foram executadas somente em ambiente descartável ou marcadas como bloqueadas;
- cada configuração foi comprovada na UI, API e persistência aplicável;
- backups foram inspecionados, testados e, se seguro, restaurados de verdade;
- importações foram reconciliadas por linha, entidade e valor;
- qualidade, pós-atualização, histórico e auditoria foram confrontados com fixtures conhecidas;
- segredos não apareceram em nenhuma evidência;
- correções foram retestadas e não criaram nova falha;
- dados e arquivos sintéticos foram limpos;
- limitações físicas/externas foram declaradas com precisão.

## Classificação dos achados

- **P0** — perda/corrupção de dados, restauração/reset inseguro, vazamento de segredo, backup irrecuperável apresentado como válido ou aplicativo inutilizável;
- **P1** — fluxo administrativo principal quebrado, importação/backup incorreto, integridade falsa, falha séria de autorização ou bloqueio grave de acessibilidade;
- **P2** — função secundária incorreta, validação/observabilidade ausente, estado inconsistente ou UX bastante prejudicada;
- **P3** — problema visual/textual menor ou melhoria recomendada.

## Entregáveis obrigatórios

1. Relatório Markdown com resumo executivo e status real.
2. Matriz completa de cobertura por rota, seção, ferramenta, endpoint e persistência.
3. Mapa de dados e segurança: banco, pastas, backups, cofre, caches, segredos e autorizações.
4. Lista de achados com ID, gravidade, camada, rota, pré-condição, passos, esperado, obtido, evidência, causa raiz, arquivos/endpoints, correção e reteste.
5. Evidências sanitizadas: capturas, logs mínimos, requisições/respostas, consultas, hashes, manifestos e árvore de arquivos, sem segredos.
6. Relatório de backup/recuperação com cada bundle, tipo, checksum, teste, restauração e resultado.
7. Relatório de importação com arquivo/hash, prévia, reconciliação, resultado por linha, histórico e limpeza.
8. Relação de arquivos alterados e motivo.
9. Comandos executados e resultados exatos.
10. Contagem final: aprovados, aprovados após correção, reprovados pendentes, bloqueados e não aplicáveis.
11. Riscos residuais e itens para a Sessão 15.
12. Melhorias não implementadas, priorizadas por benefício, esforço e risco.
13. Confirmação da limpeza ou inventário exato dos resíduos.

## Formato da resposta final

Comece pelo resultado real, não pelo processo. Informe:

- status da sessão: **APROVADA**, **APROVADA COM RESSALVAS** ou **REPROVADA**;
- cobertura em números por rota, seção, ferramenta e nível de risco;
- defeitos encontrados por gravidade e quantos foram corrigidos;
- resultado de backup, restauração, reset e importações;
- pendências, bloqueios e segredos comprovadamente protegidos;
- testes executados e resultados exatos, incluindo a regressão completa;
- links para relatório e evidências;
- confirmação da limpeza;
- recomendação objetiva sobre iniciar ou não a **Sessão 15 — Ajuda, regressão global e release**.

Não use “parece funcionar”, “em geral está bom” ou “a maioria foi testada”. Use fatos, números, IDs, hashes sanitizados e evidências. Não revele senha, segredo, token, código ou kit de recuperação na resposta.
