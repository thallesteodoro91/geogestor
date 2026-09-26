# Arquivos alterados pela Sessão 14

O worktree já estava intensamente modificado antes desta sessão. A lista abaixo identifica somente arquivos tocados intencionalmente nesta auditoria; não atribui à Sessão 14 os demais itens de `git status`. Em arquivos já sujos, apenas os hunks descritos pertencem a esta sessão.

| Arquivo | Alteração desta sessão |
|---|---|
| `apps/api/src/core-access.routes.ts` | `appLogo` no contrato e upsert transacional do modelo empresarial |
| `apps/api/src/release-blockers.integration.test.ts` | teste de rollback/sucesso para empresa + logo |
| `apps/api/src/services/audit.service.ts` | sanitização exportada para JSON armazenado |
| `apps/api/src/routes/audit.routes.ts` | sanitização nas duas respostas de leitura |
| `apps/web/src/pages/Configuracoes.tsx` | save atômico da empresa/cache pós-sucesso e confirmações literais |
| `apps/web/src/services/companyTemplate.ts` | helper explícito para cache após commit |
| `apps/web/src/services/importSchemas.ts` | novo parser/leitor seguro de esquemas |
| `apps/web/src/services/importSchemas.test.ts` | testes de cache inválido/estrutura inválida |
| `apps/web/src/pages/Importacao/EsquemasImportacao.tsx` | leitura/persistência defensiva do cache |
| `apps/web/src/pages/Importacao/ImportacaoDados.tsx` | cache seguro; falha local vira aviso após importação concluída |
| `tests/e2e/settings-audit.spec.ts` | Segurança, axe, confirmação literal e ajustes de interação |
| `tests/e2e/importacao-associacao-manual.spec.ts` | URL com query, interação de checkbox e cache corrompido |
| `docs/auditorias/2026-09-16-configuracoes-administracao/*` | entregáveis desta auditoria |

## Artefatos gerados

- `apps/web/dist/*`, `apps/api/dist/*`, pacotes compilados e `apps/desktop/dist/*` foram regenerados pelo build.
- `apps/desktop/dist/GeoGestor Setup 1.0.4.exe` foi reconstruído; o candidato não foi publicado.
- Diretórios de runs E2E aprovados foram autolimpados. Três runs falhos desta sessão foram removidos explicitamente após validação do caminho.

## Alterações preexistentes

O status final ainda contém um conjunto grande de arquivos modificados e não rastreados de sessões anteriores. Eles foram preservados, sem reset, checkout ou limpeza abrangente. A exclusão preexistente de `apps/web/src/pages/Projetos/ProjetosMap.tsx` e todos os demais arquivos fora da tabela acima não são autoria desta sessão.
