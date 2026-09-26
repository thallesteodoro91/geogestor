# Matriz de dependências

| Origem | Estado da relação | Pode trocar cliente? | Pode excluir propriedade? | Evidência |
|---|---|---:|---:|---|
| Cliente proprietário | cliente ativo | sim, se não houver vínculo bloqueador | sim, se não houver vínculo | validação de existência e `deletedAt IS NULL` |
| Cliente proprietário | cliente excluído/inexistente | não | não autoriza nova relação | HTTP 400 |
| Projeto | ativo | não | não | PATCH/DELETE 409, mensagem “projeto” |
| Projeto | logicamente excluído | sim | sim | DELETE 204 em fixture descartável |
| Orçamento | ativo | não | não | PATCH/DELETE 409, mensagem “orçamento” |
| Orçamento | logicamente excluído | não bloqueia segundo consulta vigente | não bloqueia | filtro `deletedAt IS NULL` |
| Demanda Ambiental | ativa | não | não | PATCH/DELETE 409, mensagem “ambiental” |
| Demanda Ambiental | logicamente excluída | não bloqueia | não bloqueia | filtro `deletedAt IS NULL` |
| Perícia | ativa | não | não | PATCH/DELETE 409, mensagem “perícia” |
| Perícia | logicamente excluída | não bloqueia | não bloqueia | filtro `deletedAt IS NULL` |
| Opção de Projeto/Orçamento | propriedade ativa e cliente compatível | seleção permitida | — | options filtradas + validação de salvamento |
| Opção de Projeto/Orçamento | propriedade excluída ou cliente incompatível | não | — | ausente de options; servidor revalida relação |

## Política comprovada

Uma relação ativa impede tanto a exclusão lógica quanto a transferência, mas não impede editar observações ou outros campos da propriedade. A API identifica a primeira família bloqueadora com mensagem específica e não altera a propriedade. Uma relação logicamente excluída é tratada como histórico e não bloqueia o ciclo atual.

Não há cascata física: propriedade sem vínculo recebe `deletedAt`; audit log é gravado na mesma transação. Uma segunda exclusão ou acesso ao detalhe retorna 404. O índice parcial libera o valor normalizado da propriedade excluída para uma futura propriedade ativa.
