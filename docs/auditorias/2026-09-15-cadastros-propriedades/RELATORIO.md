# Auditoria da Sessão 13 — Cadastros e Propriedades

Data de execução: 15 e 16/09/2026  
Rotas: `/cadastros` e `/propriedades`  
Commit de referência: `a16551a8b63e73f42d826297df893488e5ab88ca`  
Status: **APROVADA COM RESSALVAS**

## Resumo executivo

Os dois catálogos auxiliares e o ciclo global de propriedades foram exercitados em aplicação construída, API Fastify e bancos SQLite descartáveis. Foram corrigidos 12 achados: 3 P1, 8 P2 e 1 P3 de infraestrutura de teste. Não permaneceu P0 ou P1 conhecido no escopo exercitado.

A aprovação tem ressalvas por seis bloqueios declarados: concorrência de edição sem controle de versão em catálogos e propriedades; leitor de tela real; campanha física de offline/reconexão, lock SQLite, reinício instalado, alto contraste e zoom 200%; a falha financeira herdada da Sessão 12; e o manifesto do instalador ainda divergente. Esses itens não foram convertidos em aprovação por inferência.

## Cobertura consolidada

| Dimensão | Resultado |
|---|---:|
| Rotas principais | 2/2 |
| Catálogos | 2/2 |
| Parâmetros de URL de Cadastros | 3/3 (`aba`, `status`, `busca`) |
| Ciclos de catálogo | 2/2 criar → editar → inativar → reativar |
| CRUD lógico de propriedade | 4/4 criar, ler, atualizar e excluir logicamente |
| Identificadores registrais | 4/4: Matrícula, CAR, CCIR e ITR |
| Dependências bloqueadoras | 4/4: Projeto, Orçamento, Ambiental e Perícia |
| Transferências bloqueadas por vínculo | 4/4 |
| Paginação | 27 itens: 25 na página 1 e 2 na página 2 |
| Migrações relevantes | v7 legada + v16 de integridade |
| E2E final | 9/9 em 1,8 min |
| Matriz consolidada | 6 aprovados, 28 aprovados após correção, 0 reprovados, 6 bloqueados e 2 não aplicáveis |

## Correções implementadas

- Os contratos de catálogos agora são estritos, limitam 500 itens, preservam IDs, aceitam serviço de zero centavos e rejeitam nomes/categorias/subcategorias duplicados após normalização.
- O PUT de configurações valida o conjunto inteiro antes da gravação; a migração aceita apenas chaves conhecidas, converte arrays legados de forma determinística e mantém `first-write-wins`.
- O SQLite permanece autoritativo. Falha posterior ao gravar `localStorage` não transforma sucesso do banco em falso erro nem induz repetição destrutiva.
- O orçamento preenche também um serviço de valor sugerido zero sem sobrescrever item já preenchido.
- Propriedades passaram a exigir município, UF alfabética de duas letras e ao menos um identificador; PATCH vazio ou cujo estado final seja inválido é recusado.
- Nome normalizado por cliente e Matrícula/CAR/CCIR/ITR normalizados globalmente são protegidos por índices únicos parciais no SQLite.
- A migração v16 preserva duplicidades legadas: mantém o primeiro valor normalizado, não apaga linhas e registra conflitos em `propriedade_integridade_conflitos`.
- Busca ignora caixa e acento, pagina e ordena de modo determinístico; `/options` limita 1…50, respeita cliente, inclui `selectedId` ativo e ignora excluídos.
- Edição iniciada pelo cliente resolve o ID exato via endpoint de detalhe, inclusive fora da primeira página.
- Exclusão e transferência verificam separadamente Projeto, Orçamento, Ambiental e Perícia ativos; referências logicamente excluídas não bloqueiam.
- Importação completa grava identificadores ausentes como `NULL`, evitando colisão artificial de string vazia nos novos índices.

## Oráculos comprovados

- `QA-AUDIT-S13-Fazenda Açores` normaliza nome para `qa-audit-s13-fazenda acores`; busca `acores` retorna uma ocorrência.
- Matrícula `S13.123/ABC` e variante ` s13 123 abc ` convergem para `S13123ABC`; a segunda criação retorna 409 mesmo com cliente diferente.
- CAR, CCIR e ITR receberam o mesmo ensaio de pontuação/caixa/espaços e também retornaram 409.
- Duas criações concorrentes com o nome normalizado `qa-audit-s13-concorrente` produziram exatamente `[201, 409]` e uma linha ativa.
- Área `0` foi persistida como zero; UF `sc` voltou como `SC`; latitude `-90` e longitude `-180` foram aceitas. Latitude `91` e coordenada parcial foram recusadas.
- PATCH somente de observações preservou Matrícula; PATCH vazio, sem todos os identificadores ou com somente uma coordenada foi recusado.
- A página 1 trouxe 25 de 27 propriedades, a página 2 trouxe 2, sem duplicação ou omissão.
- Catálogo legado `['Topografia', 'Ambiental']` virou IDs determinísticos, valor `0` e estado ativo; a segunda migração não substituiu o banco.

## Persistência, auditoria e histórico

O banco de configurações é a verdade autoritativa e o cache local é apenas fallback/migração. Defaults só são usados na ausência de fonte válida. Configuração corrompida gera evento operacional de aviso e não apaga a outra chave válida. Catálogos continuam sem audit log administrativo, conforme o contrato atual; isso é explicitado, não ocultado.

Criação, atualização e exclusão lógica de propriedade executam a mutação e `AuditLogService.log` dentro da mesma transação. O teste confirmou eventos `INSERT` e `DELETE (SOFT)` para a mesma propriedade. Registros excluídos não aparecem em lista, detalhe ou opções e deixam de participar dos índices únicos parciais.

## Regressão e release

| Comando/suíte | Resultado |
|---|---|
| Teste de integração S13 focado final | 1/1, 10.924,558 ms |
| Testes focados de API/migração/importação | 8/8, 28,2 s |
| Web | 195/195, ~1,64 s |
| Electron | 18/18 |
| E2E Cadastros/Propriedades | 9/9, 1,8 min |
| API completa final | 186/187, 116.989,189 ms |
| Lint web | aprovado, 25,33 s |
| Typecheck web + API | aprovado, ~30,5 s |
| Build completo | aprovado; Vite 2,82 s; NSIS `GeoGestor Setup 1.0.4.exe` gerado e assinado |
| `release:verify-candidate` | falhou em 1,45 s por manifesto herdado |

A única falha da API completa continua em `financial-removal-scenarios.integration.test.ts:318`: esperado `{ accountsReceivableCents: 0, receivedCents: 6668 }`, obtido `{ accountsReceivableCents: 3333, receivedCents: 6668 }`. O resultado é igual ao da Sessão 12 e não envolve arquivos desta sessão.

O verificador de candidato ainda relata instaladores 1.0.2 e 1.0.3 ausentes do manifesto e tamanho/SHA-256 divergentes para 1.0.4. A publicação permanece bloqueada.

## Segurança dos dados e limpeza

As bases reais foram somente lidas. Tamanho, `LastWriteTime` e SHA-256 permaneceram iguais antes e depois:

- `data/geogestor.db`: 1.990.656 bytes; `2026-08-30 14:12:58`; SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`.
- `%APPDATA%/geogestor-desktop/geogestor.db`: 1.163.264 bytes; `2026-09-10 18:39:37`; SHA-256 `D4B4169A496501DD3A28746AD49792DB5CFA00CF7D096AB8744B4EE0229CF4DA`.

As fixtures S13 foram criadas apenas em bancos descartáveis e removidas pelos `finally`/harnesses. Quatro diretórios preservados por execuções E2E falhas desta sessão foram validados como filhos de `scratch/commercial-e2e` e removidos; a remoção é definitiva. Resíduos antigos e alterações preexistentes do worktree foram preservados.

## Riscos e recomendação

O relatório final da Sessão 11 continua ausente em `docs/auditorias/*-relatorios/RELATORIO.md`. A Sessão 14 pode começar para Configurações e Administração, desde que: (1) não autorize publicação; (2) mantenha a falha financeira e o manifesto como dívidas externas; e (3) trate versionamento/concorrência e auditoria de catálogos como decisões explícitas de produto.

## Artefatos

- [Matriz de cobertura](./MATRIZ-DE-COBERTURA.md)
- [Achados](./ACHADOS.md)
- [Caderno de oráculos](./CADERNO-DE-ORACULOS.md)
- [Matriz de catálogos](./MATRIZ-DE-CATALOGOS.md)
- [Matriz de dependências](./MATRIZ-DE-DEPENDENCIAS.md)
- [Protocolo de migração](./PROTOCOLO-DE-MIGRACAO.md)
- [Protocolo de integridade](./PROTOCOLO-DE-INTEGRIDADE.md)
- [Comandos e resultados](./COMANDOS-E-RESULTADOS.md)
- [Arquivos alterados](./ARQUIVOS-ALTERADOS.md)
- [Melhorias não implementadas](./MELHORIAS-NAO-IMPLEMENTADAS.md)
- [Índice de evidências](./evidencias/README.md)
