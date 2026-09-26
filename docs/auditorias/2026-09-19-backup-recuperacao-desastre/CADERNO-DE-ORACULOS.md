# Caderno de oráculos

## Fixture sintética

| Oráculo | Antes do backup | Depois da mutação | Depois da restauração |
|---|---|---|---|
| Cliente protegido | `cliente-backup` | permanece | presente |
| Cliente posterior | ausente | `cliente-posterior` presente | ausente |
| Projeto | vinculado a `cliente-backup` | inalterado | vínculo preservado |
| Documento | conteúdo protegido | conteúdo alterado | conteúdo protegido |
| Google secret/refresh/access | sintéticos na origem | sintéticos na origem | `NULL`/`NULL`/`NULL` |
| `PRAGMA quick_check` | ok | ok | ok |
| `foreign_key_check` | zero | zero | zero |
| Schema | v16 observado | v16 | v16 |

O teste compara IDs e relações, bytes do documento, integridade SQLite e ausência de credenciais. O banco e o documento do rollback também foram comparados com o estado anterior.

## Oráculos criptográficos

- Texto do cliente e conteúdo do documento não aparecem em bytes no bundle.
- Formato 4 usa outra chave de dispositivo no destino B e abre somente com recuperação autorizada.
- Chave errada, bundle adulterado, arquivo extra e schema futuro falham antes da instalação.

## Limite

A fixture não cobriu todas as tabelas de negócio nem soma financeira em centavos desta sessão; essa matriz ampla depende do ensaio físico A/B e consta como bloqueio, sem reutilizar evidência antiga como aprovação atual.
