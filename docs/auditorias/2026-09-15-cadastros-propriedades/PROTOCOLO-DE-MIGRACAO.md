# Protocolo de migração

## Versões

| Item | Antes | Depois |
|---|---|---|
| schema runtime | 15 | 16 |
| nome da nova migração | — | `property-integrity-2026-09-15` |
| backup máximo reconhecido | 15 | 16 |
| ledger esperado | versões 1…15 | versões 1…16 |

## Procedimento v16 em banco descartável

1. Detectar a tabela `propriedades`; banco sem a tabela é tolerado.
2. Adicionar, se ausentes, `nome_normalizado`, `matricula_normalizada`, `car_normalizado`, `ccir_normalizado` e `itr_normalizado`.
3. Ler somente propriedades ativas em ordem `created_at, id`.
4. Normalizar nome por cliente e identificadores globalmente.
5. Para grupos legados duplicados, manter o valor normalizado apenas na primeira linha; deixar `NULL` nas posteriores, sem apagar ou reassociar dados.
6. Registrar cada grupo em `propriedade_integridade_conflitos`, com hash determinístico, campo, valor, cliente quando aplicável, quantidade e JSON de IDs.
7. Criar os cinco índices únicos parciais de propriedades ativas e o índice determinístico de listagem.
8. Registrar sucesso no ledger e atualizar `PRAGMA user_version=16` pelo orquestrador.

## Índices criados

- `uq_propriedades_active_cliente_nome_normalizado`
- `uq_propriedades_active_matricula_normalizado`
- `uq_propriedades_active_car_normalizado`
- `uq_propriedades_active_ccir_normalizado`
- `uq_propriedades_active_itr_normalizado`
- `idx_propriedades_active_nome_id`
- `idx_propriedade_conflitos_campo`

## Idempotência e segurança

O teste `runtime-migrations-v16.integration.test.ts` executou a migração em base com conflitos legados, verificou preservação das linhas, tabela de conflitos, criação dos índices e bloqueio de nova colisão. A segunda execução não mudou contagens ou IDs. `PRAGMA quick_check` retornou integridade válida.

A v7 continua responsável pela migração da propriedade embutida de projetos para a entidade global e reutiliza matrícula normalizada para o mesmo cliente. A suíte de importação/runtime confirmou referências e versões atualizadas sem órfãos.

## Rollback

Não existe down migration destrutiva. O rollback operacional é restauração de backup compatível. A atualização do limite em `backup.service.ts` permite validar schema 16. Conflitos legados não são resolvidos automaticamente; permanecem observáveis até decisão humana.

## Bases reais e resíduos

Nenhuma migração foi executada nas bases reais. SHA-256, tamanho e horário de escrita ficaram idênticos. Os bancos `session13.db` e da migração v16 foram criados sob `scratch` e excluídos no `finally`; não restaram IDs `QA-AUDIT-S13-*` em bases reais.
