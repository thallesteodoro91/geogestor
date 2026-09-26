# Matriz de catálogos

## Contrato persistido

| Catálogo | Chave SQLite/cache | Limites e campos | Normalização de unicidade | Consumidores |
|---|---|---|---|---|
| Tipos de serviço | `geogestor_tipos_servico` | até 500; `id` 1–120; `nome` 1–200; `categoria` 1–120; `valorSugerido` inteiro 0…MAX_SAFE_INTEGER; `ativo` | nome sem acento, caixa ou espaços excedentes | Cadastros, novo item de Orçamento, filtros/edição histórica |
| Categorias de despesa | `geogestor_tipos_despesa` | até 500; `id` 1–120; `categoria` 1–120; `descricao` 1–500; até 100 subcategorias de 1–120; `ativo` | categoria e subcategoria sem acento, caixa ou espaços excedentes | Cadastros, novo formulário de Despesa, filtros/edição histórica |

`valorSugerido` é sempre centavos no contrato e no banco. O formulário apresenta reais e converte uma única vez na borda.

## Precedência e reparo

| Banco | Cache | Resultado | Situação |
|---|---|---|---|
| válido | válido divergente | banco vence; cache recebe cópia canônica | aprovado |
| válido | ausente/corrompido | banco vence; cache é reparado best-effort | aprovado após correção |
| ausente | legado válido | coerção determinística e PUT `/migrar` first-write-wins | aprovado após correção |
| ausente | canônico válido | migração controlada; banco passa a ser autoritativo | aprovado |
| ausente | ausente/inválido | defaults explícitos, sem sobrescrever dado real | aprovado |
| indisponível | válido | leitura degradada identificada; escrita bloqueada | aprovado |
| PUT banco bem-sucedido | `localStorage` falha | sucesso preservado; sem retry destrutivo | aprovado após correção |
| JSON corrompido no banco descartável | outra chave válida | chave inválida omitida + aviso operacional; outra preservada | aprovado após correção |

## Ciclo lógico e histórico

- Criar e editar mantêm o mesmo `id`.
- Inativar/reativar muda apenas `ativo`; não existe DELETE de catálogo.
- Itens inativos deixam de aparecer em novas escolhas.
- Orçamentos e despesas já persistidos conservam descrição, categoria, subcategoria e valor; nenhum catálogo reescreve registros operacionais.
- Catálogos não geram `audit_logs` no contrato atual. A ausência foi confirmada e reservada à decisão administrativa da Sessão 14.

## URL e interface

`/cadastros` canoniza `aba=servicos|despesas`, `status=ativos|inativos|todos` e `busca=<texto>`. Parâmetros inválidos voltam a uma combinação válida. A busca considera nome/categoria em serviços e categoria/descrição/subcategorias em despesas, ignorando caixa e acento. Contadores são derivados do catálogo canônico, não do cache cru.

## Concorrência residual

O endpoint impede payload inválido e `/migrar` é first-write-wins, inclusive quando repetido. Já a edição comum do catálogo não carrega `version`/ETag; duas janelas que salvem versões válidas ainda seguem last-write-wins. A solução exige decisão de produto sobre rejeição 409 ou merge.
