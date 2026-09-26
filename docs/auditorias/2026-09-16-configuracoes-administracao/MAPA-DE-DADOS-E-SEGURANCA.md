# Mapa de dados e segurança

| Domínio | Autoridade | Cache/arquivo | Proteção e regra auditada |
|---|---|---|---|
| Configuração geral | SQLite/configuração operacional | React Query/UI | schema estrito; segredo nunca no DTO |
| Empresa e logo do app | configuração + `geogestor_empresa_template` | `localStorage` apenas após sucesso | uma transação; auditoria registra somente `appLogoChanged` |
| Modelo PDF | SQLite/configuração operacional | cache web | logo PDF independente do logo do app |
| Esquemas de importação | configuração operacional no SQLite | `localStorage` não autoritativo | parser estrutural; cache inválido não apaga banco |
| Segurança local | hash/política no SQLite | sessão em memória | senha não equivale a criptografia integral do banco |
| Google Agenda | segredo protegido e flags no SQLite | estado OAuth em memória | AES-256-GCM; state de uso único, TTL de 10 minutos |
| Chave de segredos | ambiente/armazenamento seguro do desktop | Windows secure storage no pacote | produção exige `GEOGESTOR_SECRET_KEY`; sem chave, modo de desenvolvimento não deve ser confundido com produção |
| Documentos | diretório absoluto configurado | filesystem | preflight, checksum, colisão, copy/move/use e rollback |
| Backups | destino configurado + histórico operacional | bundle/manifesto/checksum | `.pending` não é válido; teste precede restauração |
| Kit de recuperação | arquivo exportado | nenhum conteúdo em evidência | scrypt + AES-256-GCM; senha mínima; adulteração rejeitada |
| Importações | SQLite + histórico/linhas | arquivo de entrada temporário | hash, idempotência, transação e limpeza |
| Qualidade | consultas somente leitura | exportação CSV/PDF | sem ação de correção automática |
| Auditoria | tabela de auditoria | UI paginada | sanitização na escrita e, após A14-03, também na leitura de legado |
| Diagnóstico | dados agregados do sistema | JSON exportável | sem PII, caminhos pessoais, credenciais ou payload bruto |

## Fronteiras transacionais relevantes

- Empresa + modelo + indicação de mudança de logo + auditoria pertencem ao mesmo commit.
- Importação e migração completa revertem entidades e relações quando a auditoria transacional falha.
- Reset só avança após backup verificável e usa transação para o estado operacional.
- Migração de diretório valida origem/destino, conflitos, quantidade/bytes e checksum antes da troca de configuração.
- Backup/restauração/migração/reset compartilham exclusão mútua para impedir operações administrativas incompatíveis.

## Política de redação comprovada

São redigidos por chave sensível, inclusive de forma aninhada: senha/password, segredo/secret, token, CPF/CNPJ/documento, e-mail, telefone/celular, endereço/CEP/RG/inscrição, path/pasta/directory/folder, arquivo/filename. JSON legado malformado não é ecoado; a resposta recebe marcador redigido.

## Instâncias observadas

| Instância | Caminho | Uso nesta sessão |
|---|---|---|
| Base do repositório | `C:\Users\Thalles\Documents\Codex\2026-06-22\a\work\Geogestor\data\geogestor.db` | somente inspeção read-only; cenários mutáveis usaram cópias isoladas |
| Base do aplicativo do usuário | `C:\Users\Thalles\AppData\Roaming\geogestor-desktop\geogestor.db` | hash e metadados de arquivo; nenhum fluxo funcional |
| E2E | `scratch/commercial-e2e/run-<id>/...` | perfil, DB, documentos e portas exclusivos por execução; execuções aprovadas se autolimparam |

Nenhum segredo, token, senha, código de recuperação ou conteúdo descriptografado do kit foi copiado para estes documentos.
