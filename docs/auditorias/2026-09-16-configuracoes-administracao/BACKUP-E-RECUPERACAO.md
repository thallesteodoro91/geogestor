# Backup e recuperação

## Resultado

O contrato de backup/recuperação foi aprovado em fixtures, bancos e diretórios descartáveis. Nenhuma restauração ou redefinição foi executada contra dados reais.

| Cenário | Nível | Evidência | Resultado |
|---|---:|---|---|
| Backup somente do banco | B | integração de backup, manifesto e checksum | Aprovado |
| Backup completo | B | banco + árvore de documentos, nomes Unicode e arquivos vazios | Aprovado |
| Retenção | B | recentes, diários, mensais, limite antigo | Aprovado |
| Destino/falha/interrupção | B/C | bundles incompletos não tratados como válidos | Aprovado |
| Bundle corrompido/incompatível | C | checksum, manifesto, arquivo ausente/extra e schema futuro | Aprovado |
| Teste de restauração | C | preflight e integridade em diretório temporário | Aprovado |
| Restauração real | C | instância integralmente descartável nos testes de integração | Aprovado |
| Falha durante restauração | C | backup de segurança e rollback | Aprovado |
| Reset operacional | C | backup anterior, confirmação, transação e recuperação | Aprovado |
| Reinício manual do instalado | C | exige ensaio físico fora da automação atual | Bloqueado |

## Autorizações e confirmações

- Seleção de bundle no desktop usa autorização ligada ao caminho resolvido e ao fluxo controlado.
- Preflight/teste devem aprovar o mesmo bundle antes da restauração.
- A restauração exige `RESTAURAR BACKUP DO GEOGESTOR`.
- O reset exige `APAGAR DADOS DO GEOGESTOR`.
- Depois de A14-02, variantes de caixa ou espaços não são aceitas.

## Recuperabilidade

- Backups válidos são verificados por manifesto/checksum, não apenas por existência de arquivo ou toast.
- O backup completo confronta a árvore de documentos; o backup somente do banco não é apresentado como recuperação completa dos arquivos físicos.
- O reset só prossegue após criar e validar um backup; falha dessa etapa impede exclusão.
- Falhas injetadas durante gravação/restauração/reset preservaram o estado anterior nas instâncias descartáveis.

## Bundle gerado pelo build

O build final produziu `GeoGestor Setup 1.0.4.exe`, 89.987.401 bytes, SHA-256 `82B5A758817DBCDC87AA2D836AFFE457108B6770E2015537C883B468B959D5A3`. Esse hash é evidência do artefato desta execução e não foi gravado no manifesto, pois a Sessão 14 não autoriza preparar/publicar release.
