# Protocolo de integridade

## Transações e auditoria

| Operação | Transação | Auditoria | Resultado |
|---|---:|---|---|
| criar propriedade | sim | `INSERT`, entidade `Propriedade`, depois sanitizado | aprovado |
| atualizar propriedade | sim | `UPDATE`, antes/depois | aprovado |
| excluir propriedade | sim | `DELETE (SOFT)`, antes | aprovado |
| PUT de duas configurações | sim | sem audit log por contrato | aprovado após correção |
| migração first-write-wins | sim | resposta lista apenas chaves efetivamente migradas | aprovado |

O serviço de auditoria recebe o mesmo cliente transacional da mutação. A suíte global conserva o teste de falha sintética de auditoria que devolve 500 e reverte a mutação.

## Constraints e normalização

- Nome: `normalizePropertyName`, único por `(cliente_id, nome_normalizado)` em linhas ativas.
- Matrícula/CAR/CCIR/ITR: `normalizePropertyIdentifier`, cada coluna única globalmente em linhas ativas.
- Índices parciais ignoram `deleted_at IS NOT NULL` e valores normalizados `NULL`.
- UF é validada por regex de duas letras e convertida a maiúsculas.
- Área é número finito não negativo; coordenadas têm limites geográficos e devem formar par.
- O cliente é revalidado como ativo em POST e no estado final de PATCH.

## Soft delete e referências

- Lista, detalhe, opções e verificações de duplicidade operam somente sobre propriedades ativas.
- Projeto, Orçamento, Ambiental e Perícia ativos bloqueiam transferência/exclusão.
- Relações com `deletedAt` não bloqueiam; a política foi exercitada em banco descartável.
- DELETE/PATCH de propriedade excluída ou inexistente retorna 404; nova exclusão não recria audit log.

## Concorrência

A proteção estrutural foi provada com duas criações simultâneas: uma recebeu 201 e outra 409. O banco, não o precheck, é a última linha de defesa. Isso cobre colisões de nome e identificadores sob os índices v16.

Permanece bloqueada a detecção de lost update quando duas edições válidas alteram o mesmo registro ou catálogo. Não há `version`, `If-Match` ou compare-and-swap. A adição exige regra de produto e mudança de contrato.

## Integridade estrutural

- `PRAGMA foreign_keys=1` é estabelecido pela inicialização do banco de teste.
- `PRAGMA quick_check` foi validado na migração v16.
- A tabela de conflitos torna duplicidades legadas observáveis, sem deleção automática.
- Importação evita string normalizada vazia usando `NULL`.
- Busca e listagem usam ordenação determinística para não repetir/omitir itens entre páginas.

## Limpeza

O harness fechou Fastify e o cliente SQLite antes de remover cada pasta S13. Quatro runs E2E falhos foram removidos por caminhos absolutos previamente resolvidos como filhos de `scratch/commercial-e2e`. Runs e backups históricos fora desta sessão foram preservados. As duas bases reais permaneceram byte a byte inalteradas.
