# ADR-004 — Restauração coordenada do banco desktop

## Status

Aceito para implementação controlada.

## Contexto

O serviço de backup já cria bundles completos com manifesto, SHA-256 e verificação de integridade, mas a API mantém o banco SQLite aberto durante toda a execução. Substituir o arquivo nesse estado não é seguro no Windows. O renderer também não deve receber acesso arbitrário ao filesystem nem executar a restauração diretamente.

## Decisão

- O renderer solicita ao Electron a seleção de um diretório de backup.
- A API aceita somente bundles localizados dentro da pasta de backups da instalação e exige a frase `RESTAURAR BACKUP DO GEOGESTOR`.
- Antes de interromper o processo, a API valida manifesto, checksums, `quick_check`, chaves estrangeiras e compatibilidade da versão do schema.
- Depois de responder que a operação foi aceita, a API encerra agendadores e conexões HTTP, fecha o cliente do banco e executa a restauração.
- O banco anterior e a pasta anterior de documentos são movidos para caminhos de segurança antes da instalação dos dados restaurados.
- Qualquer falha tenta remover a instalação parcial e recolocar os caminhos de segurança.
- O processo da API termina com um código reservado. O Electron reinicia a API e recarrega a janela somente depois do resultado.
- Backups legados isolados em `.db`, sem manifesto e checksums, são recusados com orientação explícita. Eles não serão convertidos ou restaurados automaticamente nesta fase.

## Consequências

A restauração fica indisponível no modo web/dev não gerenciado e depende do ciclo de vida do Electron. Em caso de desligamento físico exatamente entre renomes, os caminhos `before-restore` permanecem como evidência recuperável; não são apagados automaticamente. A atualização de um backup antigo compatível ocorre pelas migrations normais após o reinício.
