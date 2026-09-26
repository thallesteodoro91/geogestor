# Sessão 15 — Ajuda, navegação global, homologação e release

Execução técnica iniciada em 18/09/2026 e consolidada em 19/09/2026. Repositório auditado: GeoGestor, branch `main`, HEAD inicial `a16551a8b63e73f42d826297df893488e5ab88ca`. Versão canônica observada: `1.0.4`.

## Resumo executivo

A Central de Ajuda, o catálogo canônico de rotas, os aliases legados e a pesquisa global foram auditados e corrigidos. A Ajuda contém 20 artigos em seis categorias, todos com versão mínima `1.0.4`, links internos válidos e três jornadas E2E aprovadas. A navegação possui 29 rotas canônicas, nove aliases controlados e fallback 404. A pesquisa global cobre seis tipos e passou a excluir registros removidos e filhos de pais removidos, com ordenação determinística, limite de oito resultados por tipo e 30 no agregado.

Os gates unitários e estáticos ficaram verdes: Web 202/202, API 190/190, Electron 18/18, governança 18/18, lint e typecheck. O E2E integral executou 90 casos: 56 passaram, 13 falharam e 21 não rodaram por dependências seriais. Duas falhas reais de interface foram corrigidas e aprovadas em retestes focados; as demais expuseram principalmente contaminação do banco compartilhado e fixtures dependentes da data. A suíte integral não foi novamente executada após os ajustes, portanto não há base para promover o produto a release.

Nenhum banco real foi aberto ou alterado. Nenhum commit, tag, staging, push, build de candidato, instalação, desinstalação ou publicação foi realizado.

## Quatro decisões independentes

| Decisão | Veredicto | Fundamento |
|---|---|---|
| Escopo funcional da Sessão 15 | **APROVADO COM RESSALVAS** | Ajuda, rotas e pesquisa global têm cobertura estática, unitária, integrada e E2E focada verde. Restam benchmark de alta cardinalidade e homologação humana. |
| Produto integrado | **REPROVADO PARA RELEASE** | A execução E2E integral terminou com 13 falhas e 21 casos não executados. As falhas reais corrigidas passaram isoladamente, mas o gate integral não foi refeito e a arquitetura de estado compartilhado continua produzindo resultados não confiáveis. |
| Candidato técnico instalável | **BLOQUEADO** | O worktree está amplamente sujo; `release:verify-source` recusou a origem. Não foi produzido candidato limpo, nem testada instalação/atualização/desinstalação. Artefatos anteriores em `dist/` não representam o estado auditado. |
| Publicação | **NÃO EXECUTADA** | Não houve autorização nem pré-condições para commit, tag, push, release, upload ou distribuição. |

Essas decisões não são intercambiáveis: a aprovação funcional restrita não aprova o produto integrado, não cria um candidato e não autoriza publicação.

## Escopo e método

- Reconciliação dos relatórios das sessões anteriores e documentos de pré-release.
- Inspeção estática do catálogo de ajuda, rotas, aliases, links profundos e shell Electron.
- Testes de pesquisa global com banco temporário e registros ativos/removidos.
- Gates Web, API, Electron, lint, typecheck e governança.
- E2E comercial integral em raiz gerenciada temporária e retestes focados também isolados.
- Inventário somente leitura dos bancos e artefatos existentes.
- Avaliação documental dos 19 ensaios humanos obrigatórios.

## Correções realizadas

1. A versão mínima comum dos artigos de ajuda foi alinhada a `1.0.4`.
2. O nome do instalador passou a usar a versão do pacote: `${productName} Setup ${version}.${ext}`.
3. Foram criadas notas de versão verdadeiras para `1.0.4`, explicitando homologação e ausência de publicação.
4. Links internos literais foram substituídos por construtores canônicos de cliente, projeto, demanda ambiental e financeiro.
5. A pesquisa global passou a excluir clientes, projetos, orçamentos, tarefas e compromissos removidos, além de documentos de clientes removidos; a ordenação passou a ser determinística.
6. Foi criado teste integrado isolado para os seis tipos da pesquisa, limites, ordenação, links profundos e exclusões.
7. O acionador da pesquisa global passou a estar disponível em telas móveis com alvo de 40 × 40 px e nome acessível.
8. A fixture financeira dependente do calendário passou a usar data futura relativa.
9. Filtros de cabeçalho receberam altura efetiva de 40 px; o título de toast de sucesso foi escurecido para preservar contraste mesmo quando empilhado.
10. Testes E2E foram atualizados para o combobox compartilhado e para seletores textuais exatos; o mock da Central de Alertas passou a distinguir resumo e página e a sincronizar a retentativa pela resposta HTTP.

## Evidência automatizada consolidada

| Gate | Resultado final disponível |
|---|---|
| `pnpm run test:web` | 202/202 aprovados |
| `pnpm run test:api` | 190/190 aprovados |
| `pnpm run test:electron` | 18/18 aprovados |
| `pnpm run governance:test` | 18/18 aprovados |
| `pnpm run governance:check` | aprovado; baseline 70, atual 60, zero novos, dez removidos |
| `pnpm run lint` | aprovado |
| `pnpm run typecheck` | aprovado |
| E2E integral | 56 aprovados, 13 falharam, 21 não executados |
| Ajuda E2E | 3/3 aprovados dentro da execução integral |
| Reteste focado de acessibilidade/cabeçalhos/Sessão 06 | defeitos reais corrigidos; 11/12 passaram na execução conjunta, e o único cenário remanescente passou em nova execução 2/2 incluindo setup |
| Relatórios focado | seletor corrigido aprovado na execução focada |

Os diretórios das execuções vermelhas foram preservados em `scratch/commercial-e2e/`. A execução verde final removeu somente o próprio resíduo gerenciado, conforme o runner.

## Ressalvas e riscos residuais

- A suíte E2E integral usa um banco compartilhado entre specs. Cenários que esperam estado vazio, contagens fixas ou datas absolutas são contaminados por cenários anteriores. Isso precisa ser resolvido por isolamento por spec, reset transacional ou fixtures idempotentes antes de usar a suíte como gate de release.
- A pesquisa global ainda lê coleções amplas antes de filtrar e limitar; funcionalmente correta, mas sem benchmark de alta cardinalidade.
- Permanecem 60 links internos literais cobertos pela baseline de governança, 28 ativos visuais inconclusivos, endpoints repetidos e a área histórica `temp-lovable`.
- Os 19 ensaios de homologação humana seguem pendentes.
- Revisão jurídica e revisão de licenças/transitivos continuam obrigatórias antes de publicação.
- A verificação Authenticode não pôde ser concluída no ambiente atual; a fonte não implementa assinatura.

Assinatura digital: não implementada por decisão do proprietário — risco residual aceito.

## Condições para reabrir o gate de release

1. Isolar o estado dos specs E2E e substituir fixtures absolutas dependentes de data.
2. Reexecutar os 90 casos com zero falhas e zero casos bloqueados não justificados.
3. Concluir os 19 ensaios humanos no instalador final e registrar evidência por hash.
4. Revisar e consolidar o worktree, então obter origem limpa autorizada.
5. Gerar um candidato `1.0.4` novo, verificar conteúdo, SBOM, hash, smoke empacotado, instalação, atualização e desinstalação.
6. Submeter documentos comerciais e licenças à revisão humana competente.

Até o cumprimento dessas condições, qualquer `GeoGestor Setup 1.0.4.exe` já existente é evidência histórica, não candidato aprovado.
