# Achados

## Corrigidos

| ID | Gravidade | Camada | Esperado × obtido | Causa raiz | Correção e reteste |
|---|---|---|---|---|---|
| S13-001 | P1 | SQLite/API | Duplicidades concorrentes deveriam ser impossíveis; havia apenas precheck | ausência de constraint para valores normalizados | v16 adicionou colunas e cinco índices únicos parciais; concorrência resultou `[201,409]` |
| S13-002 | P1 | Banco/cache | Sucesso no SQLite deveria prevalecer; falha no cache era propagada como falha total | segundo `localStorage.setItem` fora da proteção | escrita de cache passou a ser best-effort; teste unitário aprovado |
| S13-003 | P1 | Contrato/API | Propriedade incompleta deveria falhar; API aceitava UF ausente e PATCH podia invalidar estado final | schema divergente e validação só do delta | contrato estrito + reconstrução do estado final; teste vermelho 201→400 e reteste verde |
| S13-004 | P2 | Catálogos | PUT deveria validar tudo antes do upsert; shapes extras/itens inválidos passavam | schemas permissivos e validação por chave durante gravação | schemas `.strict()` e parse integral; zero linhas após payload parcialmente inválido |
| S13-005 | P2 | Migração | `/migrar` deveria ser first-write-wins e aceitar só formato conhecido | endpoint aceitava chave/shape genéricos | coerção legada canônica, allowlist e resposta determinística; repetição migrou `[]` |
| S13-006 | P2 | UI/Orçamentos | Serviço de R$ 0,00 é válido; UI o bloqueava/ignorava | verificações `> 0` | criação aceita zero e editor usa `>= 0`; unitário/E2E verdes |
| S13-007 | P2 | Despesas | Subcategorias equivalentes deveriam ser recusadas | deduplicação literal | normalização de acento/caixa/espaço no contrato e UI; teste vermelho/verde |
| S13-008 | P2 | Navegação | Editar pelo cliente deveria abrir o ID solicitado fora da página 1 | busca apenas na coleção paginada carregada | GET de detalhe por ID e cache específico; E2E de entrada externa aprovado |
| S13-009 | P2 | Lista/opções | Busca acentuada, ordenação e seleção remota deveriam ser estáveis | comparação/ordenação incompletas | normalização, desempate por ID, limites e `selectedId`; 27 itens sem lacuna |
| S13-010 | P2 | Dependências | Soft-deleted não deve bloquear, ativo deve informar entidade correta | consultas não uniformes e mensagem genérica | quatro verificadores com `deletedAt IS NULL`, 409 específico e 404 repetido |
| S13-011 | P2 | Importação | Identificador ausente não pode colidir sob índice parcial | importador gravava string vazia normalizada | campos ausentes agora viram `NULL`; migração/importação e API focadas 8/8 |
| S13-012 | P3 | E2E/A11y | Axe deve medir o tema final, não cores interpoladas | auditoria iniciou durante transição de 240 ms | `expect.poll` espera a cor final da aba; focado 2/2 e completo 9/9 |

## Bloqueados e dívidas externas

| ID | Gravidade | Situação | Evidência / decisão necessária |
|---|---|---|---|
| S13-B01 | P2 | Catálogos continuam last-write-wins em edição concorrente | requer versão/ETag e política de merge/conflito; não alterado sem decisão de produto |
| S13-B02 | P2 | Propriedade não detecta atualização perdida entre dois PATCH válidos | índices impedem duplicidade, mas não substituem controle otimista; requer versão/ETag |
| S13-B03 | P2 herdado | KPI financeiro global ainda falha | `financial-removal-scenarios.integration.test.ts:318`, 3333 versus 0 |
| S13-B04 | P1 de release | candidato não é verificável | manifesto não contém 1.0.2/1.0.3 e diverge de 1.0.4 |
| S13-B05 | P2 de evidência | leitor de tela e campanha física desktop não executados | precisa ambiente assistivo/instalação controlada |

## Ausências documentadas, sem correção arbitrária

- Propriedades não mantêm busca/cliente/página na URL; o roteiro pediu documentar a implementação atual, não inventar deep link.
- A busca contratada cobre nome, Matrícula, CAR e município; CCIR/ITR não fazem parte da busca atual.
- Catálogos não geram audit log administrativo. A Sessão 14 deve decidir se mudanças de configuração devem entrar na trilha.
- Restauração de catálogo, exclusão física, detalhe próprio de propriedade, documentos, mapa e exportação são não aplicáveis nesta sessão.
