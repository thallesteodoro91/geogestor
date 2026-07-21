# ADR-003 — Migrações do banco da aplicação desktop

## Status

Aceito.

## Decisão

As migrações executadas por `runRuntimeMigrations`, antes da abertura da API local, são a fonte operacional de verdade para bancos instalados da aplicação desktop.

Os arquivos em `packages/database/drizzle` permanecem como histórico versionado do schema, apoio ao desenvolvimento e criação de bancos controlados. Eles não substituem a migração em tempo de execução, porque uma instalação desktop pode partir de diferentes versões legadas e não mantém necessariamente o diário completo do Drizzle.

## Regras de segurança

- Migrações de instalações existentes devem ser aditivas sempre que possível.
- Nenhuma migração pode excluir dados sem uma rotina explícita de cópia, comparação de contagem e rollback.
- Novas colunas opcionais devem aceitar `NULL` para preservar registros anteriores.
- O processo deve ser idempotente e poder ser executado novamente sem duplicar estrutura ou dados.
- Ao final, `PRAGMA foreign_key_check` deve retornar vazio. Caso contrário, a inicialização é interrompida com uma mensagem que orienta a restauração de um backup válido.
- Mudanças estruturais relevantes devem incluir um teste sobre um banco no formato anterior.

## Conversão de leads

A partir da migração `0006_crm-conversion-integrity`, `contatos.cliente_convertido_id` preserva o cliente usado na conversão e `contatos.convertido_em` preserva a data do evento. Os campos são opcionais para manter compatibilidade com leads existentes.
