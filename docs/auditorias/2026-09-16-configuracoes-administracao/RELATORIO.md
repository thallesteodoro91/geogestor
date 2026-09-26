# Sessão 14 — Configurações e Administração

**Status: APROVADA COM RESSALVAS.** A superfície administrativa exercitada não apresentou P0 nem P1 pendente. Quatro defeitos de produto reproduzidos foram corrigidos e retestados; dois problemas do roteiro E2E também foram corrigidos. Permanecem oito bloqueios ou débitos declarados, todos externos ao encerramento funcional desta sessão ou herdados.

## Resumo executivo

- Escopo: 6 rotas administrativas, 9 seções de Configurações e a integração descartável de primeiro uso.
- Matriz final: **52 aprovados, 4 aprovados após correção, 0 reprovados pendentes, 8 bloqueados e 2 não aplicáveis** (66 itens: 26 Nível A, 22 Nível B e 18 Nível C).
- Achados: **0 P0, 3 P1, 1 P2 e 2 P3**. Os 4 achados de produto (3 P1 e 1 P2) foram corrigidos; os 2 P3 eram do teste, também corrigidos.
- Regressão focada: API **62/62**, web **37/37** antes da ampliação; suíte web final **197/197**; Electron **18/18**; E2E Configurações **7/7**; E2E Importação **6/6**.
- Regressão completa da API: **186/187**. A única falha é a mesma herdada da Sessão 13 em `financial-removal-scenarios.integration.test.ts:318` (`accountsReceivableCents`: esperado 0, obtido 3333; `receivedCents`: obtido 6668).
- `typecheck`, `lint` e build completo (contratos, banco, API, web e instalador Electron/NSIS) aprovados.
- Release: bloqueado, como já estava, por instaladores 1.0.2/1.0.3 ausentes do manifesto e tamanho/SHA-256 divergentes para 1.0.4. Nenhuma publicação foi tentada.
- Dados reais: nenhuma operação funcional foi executada contra as bases reais. Os arquivos duráveis `geogestor.db` e `-wal` mantiveram seus hashes. A abertura read-only para `PRAGMA` atualizou somente o arquivo efêmero `-shm` da base do repositório; nenhum registro ou WAL foi alterado.

## Resultado por rota

| Rota | Resultado | Evidência principal |
|---|---|---|
| `/configuracoes` | Aprovada após correções | 9 seções, URL/foco, pesquisa, estado sujo, empresa, arquivos, segurança, backup, alertas, modelos, integração, aparência e manutenção; E2E 7/7 |
| `/importacao` | Aprovada | CSV/XLSX, associação manual, validação, parcial/zero sucesso, idempotência, concorrência, rollback e migração completa |
| `/importacao/esquemas` | Aprovada após correção | persistência autoritativa, cache, exclusão, reload e JSON local corrompido; E2E 6/6 no conjunto de importação |
| `/qualidade-dados` | Aprovada | diagnóstico somente leitura, filtros, códigos de integridade e exportações CSV/PDF |
| `/pos-atualizacao` | Aprovada | saúde, qualidade, backup, precedência crítico/aviso e estados de erro/loading |
| `/audit-logs` | Aprovada após correção | paginação, ação/entidade, exclusão lógica, detalhes, XSS inerte e sanitização de legado na leitura |
| `/configuracoes-iniciais` | Aprovada em perfil descartável | primeiro uso, validação, gravação e redirecionamento; nenhuma repetição em perfil configurado |

## Correções entregues

1. **A14-01, P1 — gravação parcial de empresa/logotipo.** O logo do aplicativo passou a integrar o mesmo `PATCH /api/configuracoes` e a mesma transação SQLite da configuração e do modelo empresarial. Falha injetada na auditoria agora reverte ambos.
2. **A14-02, P1 — confirmações destrutivas toleravam normalização.** Migração da pasta, restauração e reset agora exigem o texto literal, sem `trim` ou conversão automática para maiúsculas.
3. **A14-03, P1 — auditoria legada podia devolver PII, segredo e caminho.** As duas rotas de leitura sanitizam também registros antigos e tratam JSON inválido como conteúdo redigido.
4. **A14-04, P2 — cache local inválido derrubava Esquemas.** Leitura estrutural segura do `localStorage`; entradas inválidas são ignoradas e falha de cache não converte importação já concluída em falso erro.
5. **A14-05/A14-06, P3 — teste E2E.** Expectativa de URL foi alinhada ao estado em query string e checkboxes estilizados passaram a ser operados por teclado; Segurança foi incluída no percurso e no axe.

## Backup, recuperação e reset

- Backups de banco e completos: checksum, manifesto, árvore, arquivos Unicode/vazios, retenção e estados operacionais cobertos em banco/perfis descartáveis.
- Restauração: preflight, autorização vinculada ao caminho, bundle corrompido, schema futuro, teste de restauração e restauração real cobertos pela integração isolada.
- Reset: confirmação literal, backup obrigatório anterior, rollback por falha injetada, preservação de configurações/arquivos prevista pelo contrato e recuperação do snapshot cobertos em instância descartável.
- Não houve restauração/reset em dados reais nem reinício manual do aplicativo instalado. O último permanece bloqueio físico.

## Importação e reconciliação

- Importação simples de Clientes, Projetos e Contatos coberta para CSV/XLSX, cabeçalhos, automapeamento/manual, limites, inválidos, duplicados, parcial, zero sucesso e histórico.
- `Idempotency-Key`, replay divergente, duas confirmações concorrentes e rollback por auditoria foram cobertos por integração.
- Migração completa coberta para prévia, digest, expiração/uso único, entidades relacionadas e reconciliação em centavos.
- Esquemas permanecem autoritativos no SQLite; o `localStorage` é cache tolerante a corrupção. Aplicar/editar/renomear esquema continua não aplicável ao produto atual.

## Segurança e privacidade

- Respostas de configuração não devolvem hash de senha, segredo Google ou tokens; expõem apenas indicadores de configuração.
- Credenciais protegidas usam AES-256-GCM quando `GEOGESTOR_SECRET_KEY` está disponível; produção exige a chave. O desktop empacotado mantém a chave no armazenamento seguro do Windows, conforme testes Electron.
- Auditoria sanitiza senha, segredo, token, documentos, e-mail, telefone, endereço, caminhos e nomes de arquivo tanto na escrita quanto na leitura de legado.
- Google OAuth externo não foi autenticado por ausência de credenciais/agenda de QA autorizadas. Contrato, estado de uso único/TTL e falhas seguras foram cobertos localmente.
- A senha local protege abertura e operações sensíveis; não foi descrita como criptografia integral do SQLite.

## Ressalvas e decisão para a Sessão 15

Pode-se **iniciar a Sessão 15 — Ajuda, regressão global e release**, mas não publicar. Antes de qualquer release é obrigatório: corrigir a falha financeira herdada, decidir/implementar a estratégia de concorrência otimista pendente, executar os ensaios físicos ainda bloqueados e regenerar/validar o manifesto dos instaladores. O relatório da Sessão 11 continuou ausente e foi tratado como lacuna documental, sem resultados inventados.

## Índice de evidências

- [Matriz de cobertura](./MATRIZ-DE-COBERTURA.md)
- [Achados](./ACHADOS.md)
- [Mapa de dados e segurança](./MAPA-DE-DADOS-E-SEGURANCA.md)
- [Backup e recuperação](./BACKUP-E-RECUPERACAO.md)
- [Importações](./IMPORTACOES.md)
- [Caderno de oráculos](./CADERNO-DE-ORACULOS.md)
- [Protocolo de segurança](./PROTOCOLO-DE-SEGURANCA.md)
- [Comandos e resultados](./COMANDOS-E-RESULTADOS.md)
- [Arquivos alterados](./ARQUIVOS-ALTERADOS.md)
- [Melhorias não implementadas](./MELHORIAS-NAO-IMPLEMENTADAS.md)
- [Inventário de evidências](./evidencias/README.md)
