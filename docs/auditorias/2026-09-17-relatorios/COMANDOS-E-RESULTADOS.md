# Comandos e resultados

Os comandos foram executados com bancos e portas temporários quando aplicável.

| Verificação | Resultado |
| --- | --- |
| Teste focado da integração de Relatórios | 1/1; 3,482 s; caso 3,281 s |
| E2E da Sessão 11 | 2/2; 34,4 s; jornada real 20,9 s |
| Web completa | 202/202; 2.187,3969 ms |
| API completa | 188/189; 119.765,127 ms |
| Falha API isolada | Reproduzida em 3.216,9374 ms com recebível 3.333 ¢ em vez de 0 |
| Electron | 18/18; 166,6002 ms |
| Lint | Aprovado |
| Typecheck | Aprovado |
| Build desktop | Aprovado, incluindo instalador |
| Smoke da API empacotada | Aprovado |
| Inspeção de PDFs | 3 arquivos/7 páginas aprovados |
| Verificação de release | Reprovada por manifesto herdado inconsistente |

Comandos representativos:

```text
pnpm --filter api test -- session11-reports.integration.test.ts
pnpm --filter web test -- reportDocuments.test.ts
pnpm exec playwright test tests/e2e/session11-reports.spec.ts
pnpm --filter api test
pnpm --filter electron test
pnpm lint
pnpm typecheck
pnpm desktop:build
<python-bundled-do-codex> scripts/session11-inspect-pdfs.py
```

Observação: neste workspace, o comando focado do pacote web executou a suíte web completa; o resultado registrado é deliberadamente 202/202, sem inferir que apenas um arquivo foi rodado.

O protocolo PDF foi repetido no fechamento com o runtime Python empacotado no Codex, porque o alias `python` não estava no `PATH`; todas as verificações retornaram `allChecksPassed: true`.

Hashes dos binários construídos:

- instalador: `DE1C0F89C820DC94BBF2740323F5CE2062F72B05DB51305E868596CB980609D5`;
- `GeoGestor.exe` desempacotado: `D5D3E06428AF90917356BAC6F064C6527CE6FDE8D51D4A8971479300708DE952`.
