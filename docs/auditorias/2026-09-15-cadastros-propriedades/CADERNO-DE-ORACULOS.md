# Caderno de oráculos

Todos os IDs UUID foram aleatórios e descartados com o banco de teste. Os identificadores abaixo são valores sintéticos estáveis usados para comparação.

## Normalização

| Entrada | Campo | Forma canônica | Resultado esperado | Resultado |
|---|---|---|---|---|
| `QA-AUDIT-S13-Fazenda Açores` | nome | `qa-audit-s13-fazenda acores` | busca `acores`; único por cliente | aprovado |
| `S13.123/ABC` | Matrícula | `S13123ABC` | único globalmente | aprovado |
| ` s13 123 abc ` | Matrícula | `S13123ABC` | 409 em outro cliente | aprovado |
| `S13-CAR-001` / ` s13 car 001 ` | CAR | `S13CAR001` | segunda criação 409 | aprovado |
| `S13-CCIR-001` / variante | CCIR | `S13CCIR001` | segunda criação 409 | aprovado |
| `S13-ITR-001` / variante | ITR | `S13ITR001` | segunda criação 409 | aprovado |
| `Combustível` / ` combustivel ` | categoria/subcategoria | `combustivel` | duplicidade recusada | aprovado |

Nome igual é permitido em clientes diferentes; identificadores equivalentes não são. Edição do próprio registro conserva o mesmo valor sem falso positivo porque o precheck exclui o ID atual e o índice permanece satisfeito.

## Valores e localização

| Caso | Oráculo | Resultado |
|---|---|---|
| serviço zero | `valorSugerido=0` centavos; exibir R$ 0,00; preencher item vazio | aprovado após correção |
| serviço padrão georreferenciamento | `450000` centavos = R$ 4.500,00, uma conversão | aprovado |
| área zero | `areaHa=0`, sem converter para nulo | aprovado |
| área negativa/NaN/infinita | HTTP 400/erro de formulário | aprovado |
| UF `sc` | persistir/responder `SC` | aprovado |
| UF vazia, 1/3 caracteres ou não alfabética | HTTP 400 e erro associado | aprovado após correção |
| coordenadas mínimas | `latitude=-90`, `longitude=-180` | aprovado |
| coordenadas máximas | `latitude=90`, `longitude=180` | aprovado |
| latitude 91 ou longitude 181 | HTTP 400 | aprovado |
| somente latitude/longitude | HTTP 400 | aprovado |

## PATCH e concorrência

- PATCH `{ observacoes: 'Atualização parcial...' }` preservou `matricula='S13.123/ABC'`.
- PATCH `{}` retornou 400.
- PATCH anulando Matrícula, CAR, CCIR e ITR retornou 400 porque o estado final ficaria sem identificação.
- PATCH anulando somente longitude retornou 400 por coordenadas incompletas.
- Duas criações simultâneas com nome `QA-AUDIT-S13-Concorrente` resultaram em uma criação e um conflito: `[201, 409]`; total final `1`.

## Paginação e opções

| Consulta | Oráculo | Resultado |
|---|---|---|
| cliente B + `q=paginacao`, página 1, limite 25 | total 27; 25 itens | aprovado |
| mesma consulta, página 2 | 2 itens | aprovado |
| ordenação | nome `pt-BR`/NOCASE e ID como desempate, sem repetição | aprovado |
| options `limit=1` | 1 item | aprovado |
| options `limit=51` | HTTP 400 | aprovado |
| busca sem resultado + `selectedId` ativo | retorna apenas o selecionado | aprovado |
| `selectedId` excluído | não retorna | aprovado |
| `q` com 201 caracteres | HTTP 400 | aprovado |

## Vínculos

| Fixture | Relação | Exclusão | Troca de cliente |
|---|---|---|---|
| `QA-AUDIT-S13-Vínculo PROJETO` | Projeto ativo | 409 com “projeto” | 409 |
| `QA-AUDIT-S13-Vínculo ORCAMENTO` | Orçamento ativo | 409 com “orçamento” | 409 |
| `QA-AUDIT-S13-Vínculo AMBIENTAL` | Ambiental ativo | 409 com “ambiental” | 409 |
| `QA-AUDIT-S13-Vínculo PERICIA` | Perícia ativa | 409 com “perícia” | 409 |
| `QA-AUDIT-S13-Vínculo removido` | Projeto com `deletedAt` | 204 | não bloqueia |

## Migração e cache

- Entrada legada de serviços: `['Topografia', 'Ambiental']`.
- Saída: `legacy-service-0-topografia` e `legacy-service-1-ambiental`, categoria `Serviços`, `valorSugerido=0`, `ativo=true`.
- Segunda chamada com `['Valor obsoleto']`: `migrated=[]`; banco permaneceu com os dois primeiros itens.
- Falha de `localStorage.setItem` após PUT do banco: a operação é considerada persistida; na próxima leitura o banco válido repara o cache.

## Comparação com GeoGestor

Os oráculos acima são derivados dos contratos versionados e das regras declaradas no prompt, não de uma planilha paralela. O frontend, a API e os índices v16 usam as mesmas funções `normalizeCatalogLabel`, `normalizePropertyName` e `normalizePropertyIdentifier`, evitando três definições concorrentes da mesma verdade.
