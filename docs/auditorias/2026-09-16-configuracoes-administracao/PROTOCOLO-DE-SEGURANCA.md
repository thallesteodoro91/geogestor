# Protocolo de segurança da execução

## Classificação prévia

- Nível A: navegação, pesquisa, filtros, tema e inspeções read-only.
- Nível B: imports, modelos, migração de diretório, backups e kits, sempre em run isolado.
- Nível C: restauração, reset, corrupção, rollback e incompatibilidade, somente em DB/perfil/diretórios descartáveis.

## Barreiras usadas

1. A execução E2E cria um diretório `scratch/commercial-e2e/run-<id>` com manifesto de propriedade.
2. API, web, DB, WAL/SHM, perfil e documentos usam esse run e portas próprias.
3. Cenários destrutivos recebem nomes/caminhos explícitos; não se usam glob, raiz, home ou variável não resolvida.
4. O executor só remove diretórios que contêm seu manifesto e pertencem à raiz controlada.
5. Bases reais foram tratadas como read-only; restauração/reset real nelas ficou proibido.

## Baseline dos dados reais

### Base do repositório

- `geogestor.db`: 1.990.656 bytes; SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`.
- `geogestor.db-wal`: 4.132.392 bytes; SHA-256 `3A08D04EB671099DDEF1D0C6071D78598B6066CDD479BBEE1D72D3870250949E`.
- `PRAGMA quick_check`: `ok`; `foreign_key_check`: 0 violações; `user_version`: 15.
- O `-shm` é metadado efêmero do WAL. A conexão read-only de verificação o atualizou de `0915D857D11BA8916D27277DC32F47623FE6385067270D659E22DDDDB424B7AF` para `F735C95E8682A1D15A485433F26961B37C39BF897560D8338499B5E45127E01E`; DB e WAL permaneceram bit a bit iguais.

### Base do aplicativo do usuário

- `geogestor.db`: 1.163.264 bytes; SHA-256 `D4B4169A496501DD3A28746AD49792DB5CFA00CF7D096AB8744B4EE0229CF4DA`.
- `geogestor.db-wal`: 53.592 bytes; SHA-256 `E00E604FB40B70C2666C6176FBB8EF4A855474D50A52DFB19A6EFA3813BDA08D`.
- `geogestor.db-shm`: 32.768 bytes; SHA-256 `1065648C2D45D7A8B8684E548DD8563F5473AB585E07E699458D5682F9C3F81C`.
- A tentativa de inspeção SQLite foi recusada com `SQLITE_NOTADB`; nenhum fluxo funcional ou gravação foi tentado e os três hashes permaneceram iguais.

## Processos e portas

Na linha de base não havia processo GeoGestor/API/web do projeto nem porta conhecida da aplicação em escuta. Os processos iniciados pelos E2E foram filhos controlados do run e encerrados pelo executor.

## Limpeza

Execuções aprovadas removeram seus próprios runs. Três runs intermediários falhos desta sessão foram resolvidos para caminhos absolutos sob a raiz controlada e removidos permanentemente:

- `run-1789596851530-31316-17a3bd09-4d52-4062-81eb-f0855a173488`
- `run-1789597069968-39480-c7ad02d9-b0b1-4b6e-99be-2d58fdcf6400`
- `run-1789597630096-39208-5e8c7df4-51da-4802-934d-91e2dbda9982`

`Test-Path` retornou `False` para os três. Runs históricos não identificados como desta sessão foram preservados.
