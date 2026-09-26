# Comandos e resultados

Ambiente: Windows 10.0.26200, Node 24.17.0, pnpm 11.8, locale pt-BR, timezone America/Sao_Paulo (UTC-03), branch `main`, commit inicial `a16551a8b63e73f42d826297df893488e5ab88ca`.

| Comando | Resultado |
|---|---|
| `pnpm test:api` | **186/187**; única falha herdada em `financial-removal-scenarios.integration.test.ts:318`; 117242,8269 ms |
| seleção focada do runner de API para Configurações/Administração | **62/62** |
| `pnpm test:web` | **197/197** após os novos testes de cache |
| seleção focada do runner web para Configurações/Administração | **37/37** antes da ampliação final |
| `pnpm test:electron` | **18/18** |
| `pnpm test:e2e -- tests/e2e/settings-audit.spec.ts` | **7/7**, 1,3 min; run aprovado autolimpou |
| `pnpm test:e2e -- tests/e2e/importacao-associacao-manual.spec.ts` | **6/6**, 1,2 min; run aprovado autolimpou |
| `pnpm typecheck` | aprovado |
| `pnpm lint` | aprovado |
| `pnpm run build` | aprovado: contracts, database, API, web e desktop/NSIS |
| `pnpm release:verify-candidate` | **exit 1**: manifesto sem 1.0.2/1.0.3; tamanho e SHA divergentes para 1.0.4 |

## Red-green-retest

- A14-01: o teste de atomicidade falhou inicialmente porque `appLogo` era campo desconhecido (HTTP 400); passou depois da transação unificada.
- A14-03: a fixture legada demonstrou PII/segredo/caminho na resposta antes da correção; passou após sanitização na leitura.
- A14-04: testes unitários e E2E cobrem JSON inválido e estrutura errada; ambos passaram depois do parser defensivo.
- E2E combinado inicial: 14 aprovados/1 falhou por rótulo de teste desatualizado; após correção, Configurações 7/7 e Importação 6/6.

## Integridade e artefato

- Leitura SQLite isolada da base do repositório: `quick_check=ok`, 0 violações de foreign key, `user_version=15`.
- O formato da base do aplicativo do usuário recusou a inspeção via `libsql` com `SQLITE_NOTADB`; hashes foram usados como barreira e nenhum write foi tentado.
- Instalador final: 89.987.401 bytes; SHA-256 `82B5A758817DBCDC87AA2D836AFFE457108B6770E2015537C883B468B959D5A3`.

## Resultado exato da barreira de release

```text
Instalador ausente no manifesto de hashes: GeoGestor Setup 1.0.2.exe
Instalador ausente no manifesto de hashes: GeoGestor Setup 1.0.3.exe
Tamanho divergente do manifesto: GeoGestor Setup 1.0.4.exe
SHA-256 divergente do manifesto: GeoGestor Setup 1.0.4.exe
```

Nenhum comando de publicação, migração de base real, restauração real ou reset real foi executado.
