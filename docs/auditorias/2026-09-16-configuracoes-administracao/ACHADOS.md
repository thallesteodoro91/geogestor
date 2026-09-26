# Achados

Não há achado P0/P1 pendente no escopo exercitado.

## A14-01 — P1 — Empresa e logo sem atomicidade

- Camada/rota: API e UI, `/configuracoes?secao=empresa`.
- Pré-condição: alteração conjunta de dados da empresa e logo do aplicativo.
- Reprodução: o frontend gravava a configuração e, em requisição separada, o modelo empresarial. Falha entre as chamadas deixava estado parcial.
- Esperado: um único commit ou rollback integral.
- Obtido antes: possibilidade de configuração nova com modelo/logo antigo.
- Causa raiz: fronteira transacional dividida entre endpoints.
- Correção: `appLogo` aceito no `PATCH /api/configuracoes`; upsert do modelo e atualização da configuração executados na mesma transação; cache só é atualizado após sucesso.
- Teste: falha injetada na auditoria reverte configuração e modelo; caminho de sucesso persiste ambos.
- Situação: **corrigido e retestado**.

## A14-02 — P1 — Confirmação destrutiva não literal

- Camada/rotas: UI de Arquivos, Backups/Restauro e Manutenção/Reset.
- Reprodução: `trim()`/maiúsculas faziam variantes com espaços ou caixa distinta satisfazerem a comparação.
- Esperado: frases exatas ligadas à operação perigosa.
- Causa raiz: normalização aplicada no `onChange` e/ou na comparação.
- Correção: comparação literal e armazenamento do texto digitado sem transformação.
- Teste: minúsculas e espaços extras mantêm a ação desabilitada; somente a frase exata habilita. Nenhuma ação destrutiva foi disparada no E2E.
- Situação: **corrigido e retestado**.

## A14-03 — P1 — Auditoria legada expunha dados sensíveis

- Camada/rota: API, `GET /api/audit-logs` e `GET /api/audit-logs/recent`.
- Reprodução: registros criados antes da sanitização de escrita eram devolvidos sem nova redação; JSON inválido também não tinha política segura.
- Esperado: política de sanitização uniforme, inclusive para legado.
- Causa raiz: sanitização ocorria somente na gravação.
- Correção: `sanitizeStoredAuditJson` parseia e redige na leitura; conteúdo malformado vira marcador integralmente redigido.
- Teste: fixture legada com PII, segredo e caminho não aparece nas duas respostas.
- Situação: **corrigido e retestado**.

## A14-04 — P2 — Cache de esquemas podia quebrar a rota

- Camada/rota: web, `/importacao` e `/importacao/esquemas`.
- Reprodução: JSON inválido ou estrutura não-array no `localStorage` causava exceção na inicialização.
- Esperado: SQLite/configuração operacional continua autoritativa e cache inválido é descartado com segurança.
- Causa raiz: `JSON.parse` direto e cast sem validação estrutural.
- Correção: parser seguro, filtro estrutural e persistência defensiva; erro ao salvar cache gera aviso sem reclassificar importação já concluída.
- Testes: unitários para JSON inválido/objeto/itens inválidos e E2E navegando com cache corrompido.
- Situação: **corrigido e retestado**.

## A14-05 — P3 — Expectativa E2E ignorava query string

- Camada: automação E2E.
- Reprodução: a navegação correta adicionava estado na URL e o teste exigia o caminho sem query.
- Correção: regex permite a query prevista pelo contrato.
- Situação: **corrigido**; não era defeito do produto.

## A14-06 — P3 — Checkboxes estilizados não eram acionados pelo driver

- Camada: automação E2E.
- Reprodução: `.check()` era interceptado pelo elemento visual sobreposto.
- Correção: percurso acessível por foco + Espaço e asserção do estado real; seção Segurança adicionada ao percurso e ao axe.
- Situação: **corrigido**; não era defeito do produto.

## Riscos não convertidos em achado da Sessão 14

- Falha financeira 186/187, concorrência otimista e manifesto de release são herdados da Sessão 13.
- Google externo, notificação nativa, leitor de tela/alto contraste/zoom, offline/reconexão física, lock real e reinício do instalado foram bloqueados por ambiente/autorização.
- A ausência de filtros de data, usuário, texto e exportação em Auditoria e a ausência de aplicar/editar/renomear esquemas são não aplicáveis ao contrato atual.
