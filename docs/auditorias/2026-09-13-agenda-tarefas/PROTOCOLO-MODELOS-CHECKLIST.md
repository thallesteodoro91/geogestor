# Protocolo — modelos de checklist

## Contrato do modelo

- Nome: obrigatório, 1–160 caracteres.
- Descrição: opcional, até 1.000 caracteres.
- Tipo de projeto: opcional, até 120 caracteres.
- Ativo: booleano explícito.
- Etapas: entre 1 e 100.
- Título da etapa: obrigatório, 1–180 caracteres.
- Descrição da etapa: opcional, até 1.000 caracteres.
- Prioridade: `Baixa`, `Média` ou `Alta`.
- Campos desconhecidos são rejeitados em todos os níveis.

## Ciclo de vida

| Operação | Resultado esperado |
|---|---|
| Criar | Modelo e etapas persistidos juntos; auditoria `INSERT ModeloChecklist`. |
| Editar | Modelo atualizado, etapas anteriores soft-deleted e nova ordem persistida na mesma transação. |
| Duplicar | Nova identidade, sufixo `— cópia`, inativo por padrão, etapas independentes. |
| Excluir | Soft delete do modelo; aplicações e tarefas históricas permanecem. |
| Aplicar | Somente modelo ativo e projeto ativo; tarefas herdam projeto/cliente e ficam `A Fazer`. |

## Idempotência e duplicidade

O título é normalizado por NFD, remoção de diacríticos, trim, compressão de espaços e caixa minúscula. Assim, `Conferir matrícula` e `  conferir   matricula ` representam a mesma etapa no mesmo projeto.

Cada aplicação cria um registro em `checklistModeloAplicacoes`, inclusive quando todas as etapas são ignoradas. O retorno informa `criadas`, `ignoradas`, `tarefas` e `aplicacaoId`.

## Fronteira atômica

A transação contém:

1. leitura do projeto;
2. leitura do modelo e etapas;
3. leitura de títulos existentes;
4. criação das tarefas ainda ausentes;
5. auditoria de cada tarefa;
6. registro da aplicação;
7. auditoria `AplicacaoModeloChecklist`;
8. evento de jornada do cliente.

Qualquer exceção rejeita a requisição e reverte toda a unidade de trabalho. A suíte global também mantém um teste sintético de falha obrigatória de auditoria que comprova o comportamento transacional do serviço de auditoria.

## Cenário executado

- Modelo criado pela interface com duas etapas.
- Duplicação criou cópia inativa e abriu editor.
- Primeira aplicação em projeto vazio: 2 criadas, 0 ignoradas.
- Segunda aplicação: 0 criadas, 2 ignoradas.
- Exclusão do modelo original: removido da listagem ativa; tarefas, aplicação e auditorias preservadas.
