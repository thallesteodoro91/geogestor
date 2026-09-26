# Inventário de evidências sanitizadas

Esta pasta funciona como índice. Não foram preservadas capturas contendo senha, segredo Google, token, código de recuperação, kit descriptografado ou dados pessoais.

| Evidência | Local |
|---|---|
| Resultado e decisão | `../RELATORIO.md` |
| 66 itens e contagem final | `../MATRIZ-DE-COBERTURA.md` |
| Reproduções e retestes | `../ACHADOS.md` |
| Banco, filesystem, cache, cofre e redação | `../MAPA-DE-DADOS-E-SEGURANCA.md` |
| Backups, restauração, reset e artefato | `../BACKUP-E-RECUPERACAO.md` |
| CSV/XLSX, migração e esquemas | `../IMPORTACOES.md` |
| Invariantes e reconciliação | `../CADERNO-DE-ORACULOS.md` |
| Hashes, isolamento e limpeza | `../PROTOCOLO-DE-SEGURANCA.md` |
| Saídas exatas e contagens | `../COMANDOS-E-RESULTADOS.md` |

As evidências executáveis permanecem nos testes versionáveis:

- `apps/api/src/release-blockers.integration.test.ts`
- `apps/web/src/services/importSchemas.test.ts`
- `tests/e2e/settings-audit.spec.ts`
- `tests/e2e/importacao-associacao-manual.spec.ts`

O E2E usa evidência efêmera dentro do run e apaga o próprio perfil, DB e documentos quando aprovado. Isso evita deixar cópias sintéticas ou segredos temporários no repositório.
