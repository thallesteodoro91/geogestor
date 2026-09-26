# Índice de evidências sanitizadas

## Evidência automatizada reexecutável

- `apps/api/src/session13-catalog-properties.integration.test.ts`: payloads sintéticos `QA-AUDIT-S13-*`, respostas HTTP, paginação 25+2, quatro dependências, auditoria e limpeza.
- `apps/api/src/runtime-migrations-v16.integration.test.ts`: banco legado descartável, conflitos, índices, idempotência e `PRAGMA quick_check`.
- `apps/web/src/services/auxiliaryCatalogs.test.ts`: legado, JSON inválido, duplicidade e falha do cache após sucesso do SQLite.
- `apps/web/src/pages/propertyForm.test.ts`: normalização, obrigatórios, UF e coordenadas.
- `tests/e2e/cadastros-properties.spec.ts`: UI construída, rede/API real isolada, URL, consumidores, rascunho, modais, foco, 390 px, claro/escuro e Axe.

## Evidência resumida preservada

- [Comandos e resultados](../COMANDOS-E-RESULTADOS.md): contagens, tempos, falha herdada e hashes.
- [Caderno de oráculos](../CADERNO-DE-ORACULOS.md): entradas e saídas determinísticas.
- [Protocolo de migração](../PROTOCOLO-DE-MIGRACAO.md): estado estrutural antes/depois.
- [Protocolo de integridade](../PROTOCOLO-DE-INTEGRIDADE.md): transações, índices, soft delete e concorrência.

## Privacidade e retenção

Nenhuma captura ou resposta contendo dados reais foi copiada para o dossiê. As capturas/traces das quatro execuções E2E falhas desta sessão foram usados para diagnosticar corrida de reload, validação e transição de tema; depois foram removidos junto com seus diretórios, conforme o requisito de limpeza. O run final aprovado foi removido pelo próprio harness. Os dados documentados são exclusivamente sintéticos.

## Resíduos

- IDs `QA-AUDIT-S13-*` nas bases reais: zero por construção; essas bases não foram abertas para escrita.
- Chaves de cache em perfil real: nenhuma criada ou alterada.
- Bancos descartáveis S13: removidos nos blocos `finally`.
- Diretórios E2E falhos desta sessão removidos: quatro, após resolução absoluta e validação de confinamento em `scratch/commercial-e2e`.
- Resíduos históricos de outras sessões: preservados e não atribuídos à Sessão 13.
