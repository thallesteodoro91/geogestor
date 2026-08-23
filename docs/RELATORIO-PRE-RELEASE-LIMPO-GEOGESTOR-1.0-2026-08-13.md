# Relatório de pré-release limpo — GeoGestor 1.0

Data da execução: 14/08/2026

Relatório-base: `docs/RELATORIO-FINAL-REMEDIACAO-GEOGESTOR-1.0-2026-08-13.md`

Repositório: `<REPOSITORIO_GEOGESTOR>`

> **ATUALIZAÇÃO DE NOMENCLATURA EM 21/08/2026:** o proprietário definiu o primeiro lançamento oficial como **GeoGestor 1.0** (`1.0.0` tecnicamente). O pacote, o hash e o SBOM quantitativos desta execução antecedem a normalização e permanecem apenas como evidência técnica superada. Um novo instalador 1.0 deverá ser gerado a partir do futuro commit limpo.

## 1. Resumo executivo

O GeoGestor 1.0 concluiu os gates automatizados de governança, tipos, lint, testes web, API, Electron e E2E. Uma instalação congelada e um novo build Windows foram executados em cópia curta isolada, sem reutilizar ou sobrescrever os artefatos do worktree original. O pacote técnico passou na inspeção de conteúdo, no smoke da API empacotada, na geração de hash e na geração de SBOM CycloneDX 1.6.

O instalador produzido nesta execução ainda é somente evidência técnica: ele registra `dirty: true`, e o gate estrito o recusou exclusivamente por esse motivo. Como não houve autorização para commit ou tag, o estado correto é **PRONTO PARA COMMIT E BUILD LIMPO**, não pronto para publicação.

Nenhum arquivo `.env`, banco real, backup real, credencial ou chave foi aberto ou copiado. Não houve commit, tag, staging, push, publicação ou exclusão de evidências.

## 2. Estado inicial

- Raiz confirmada: `<REPOSITORIO_GEOGESTOR>`.
- Branch: `main`.
- HEAD: `dad415eac8e2c4363648e2f4a7776348f4fefdcd`.
- Versão técnica canônica: `1.0.0`; apresentação comercial: `1.0`.
- O worktree já estava amplamente alterado antes desta frente. As mudanças preexistentes foram preservadas e não se atribui autoria histórica a elas.
- Estado final observado: 181 entradas no `git status --short --untracked-files=all`, incluindo fontes e documentos necessários ainda não rastreados.
- A execução não usou `reset`, `clean`, `restore`, `checkout --`, stash ou qualquer comando Git mutável.

## 3. Arquivos alterados nesta frente

Arquivos com ajustes de dependências e reprodução:

- `.npmrc`;
- `pnpm-workspace.yaml`;
- `package.json`;
- `pnpm-lock.yaml`;
- `apps/api/build.mjs`;
- `scripts/release-governance.test.mjs`.

Arquivos com polimento de contraste e estabilização da auditoria E2E:

- `apps/web/src/components/Layout.tsx`;
- `apps/web/src/index.css`;
- `apps/web/src/components/accessibilityRemediation.test.ts`;
- `tests/e2e/cadastros-properties.spec.ts`.

Documentos revisados ou criados:

- `docs/HOMOLOGACAO-HUMANA-WINDOWS-WCAG-2026-08-01.md`;
- `docs/commercial/AVISOS-DE-TERCEIROS.md`;
- `docs/commercial/ROTEIRO-FUTURO-AUTHENTICODE.md`;
- `docs/BACKLOG-DIVIDA-GOVERNANCA-GEOGESTOR-1.0.md`;
- este relatório.

O workflow `.github/workflows/ci.yml` foi auditado, mas não alterado nesta frente. Ele permanece não rastreado e precisa integrar o futuro commit após revisão do proprietário.

## 4. Investigação de `chart-colors.ts`

- `apps/web/src/data/chart-colors.ts` existe.
- `git check-ignore -q` retornou código 1: o arquivo não está ignorado.
- O arquivo aparece no status como `??`, portanto é versionável, mas ainda não rastreado.
- `.gitignore` mantém a exclusão do diretório operacional `data/` e abre somente `apps/web/src/data/` e `apps/web/src/data/**`.
- A cópia isolada incluiu esse diretório de código e o build web foi aprovado.
- A varredura final encontrou zero candidatos a fonte obrigatória ignorada, desconsiderando saídas de build, dependências, scratch, restaurações históricas e dados operacionais.

Conclusão: o arquivo deixou de ser um risco de exclusão acidental, mas deve ser incluído no futuro commit para que um checkout novo seja autocontido.

## 5. Decisão sobre `better-sqlite3` e Node

A investigação não encontrou import ou uso real de `better-sqlite3` no runtime, nos testes ou nos scripts necessários. O desktop e a API utilizam `@libsql/client`/libSQL. A ocorrência era a materialização de um peer opcional legado de `drizzle-orm`.

Decisão mínima adotada:

- manter Node 24, com `engines` em `>=24 <25`;
- fixar `packageManager` em `pnpm@11.8.0`;
- impedir a materialização dos peers opcionais `better-sqlite3` e `@types/better-sqlite3` por override do pnpm;
- retirar a aprovação de build e o `external` legado que já não correspondiam a uma dependência utilizada;
- regenerar o lockfile sem a árvore nativa de `better-sqlite3`/`node-gyp`.

Provas:

- instalação congelada: 716 pacotes, código 0, sem falha nativa silenciosa;
- diretórios `better-sqlite3` na instalação isolada: 0;
- SHA-256 do lockfile na fonte e na cópia: `42BAA36AC31414BA1DF2219AD414D31537AB3F0FF96C482ED4C1FFC796E36FA8`;
- API compilada e testes de runtime/migração/geoespacial aprovados;
- teste de governança específico impede a reintrodução da materialização legada.

## 6. Revisão da CI

O workflow Windows está coerente com o ambiente local e contém:

- Node 24 e pnpm 11.8.0;
- instalação com lockfile congelado;
- governança, typecheck, lint, web, API e Electron;
- testes de integridade/SBOM e `git diff --check`;
- E2E em raiz gerenciada com dados sintéticos e prévia não destrutiva;
- build Windows, SBOM, hashes, smoke e gate estrito sem `--allow-dirty`;
- Authenticode apenas informativo;
- permissões somente de leitura e ausência de publicação automática do instalador.

Não foram encontrados segredos nem caminhos locais do usuário no workflow. A barreira automatizada de CI passou em 16/16 testes de governança. O arquivo ainda precisa ser incluído no futuro commit.

## 7. Revisão jurídica e licenças

Os sete documentos comerciais contêm o aviso obrigatório:

> MINUTA TÉCNICA — REVISÃO JURÍDICA OBRIGATÓRIA ANTES DA PUBLICAÇÃO

Evidências locais registradas em `docs/commercial/AVISOS-DE-TERCEIROS.md`:

- Geist: OFL-1.1;
- Phosphor Icons: MIT;
- Leaflet: BSD-2-Clause;
- React-Leaflet e `@react-leaflet/core`: Hippocratic-2.1;
- pdfmake, React e React DOM: MIT;
- OpenStreetMap: atribuição registrada; termos operacionais do provedor continuam pendentes de revisão;
- Roboto VFS: quatro fontes foram comparadas byte a byte com os TTF locais, com hashes documentados; os metadados locais apontam para `googlefonts/roboto-classic` e OFL-1.1.

Não foi emitida interpretação jurídica. Permanecem obrigatórias a revisão por profissional habilitado, a revisão do SBOM/transitivos e a incorporação dos textos aplicáveis no material final.

## 8. Checklist humano

O checklist foi ampliado para instalação limpa, desinstalação, atualização com preservação, backup/recuperação, teclado, NVDA, foco, alto contraste, zoom/reflow, escalas, resoluções pequenas, textos/estados/erros, operação offline e revisão visual.

São 19 itens, todos mantidos exatamente como `PENDENTE DE HOMOLOGAÇÃO HUMANA`. Os testes Axe são evidência automatizada WCAG 2.2 A/AA e não foram tratados como homologação humana.

## 9. Backlog de governança

O backlog registra risco, impacto, esforço, dependências, recomendação e classificação para:

- 71 links internos literais, todos ainda cobertos pela baseline;
- 26 recursos visuais sem consumidor comprovado;
- 119 ocorrências de endpoints repetidos, 88 padrões em produção e 20 candidatos priorizados;
- área histórica `temp-lovable`.

A dívida histórica não foi refatorada amplamente. A baseline continua impedindo novos casos. Uma possível credencial histórica em `temp-lovable` requer decisão e eventual rotação externa; o conteúdo não foi aberto nesta execução.

## 10. Comandos e verificações executados

No worktree original:

- confirmação da raiz, branch, HEAD e status;
- auditoria de ignore/versionamento de fontes;
- `governance:check`;
- `governance:test`;
- `typecheck`;
- `lint`;
- `test:web`;
- `test:api`;
- `test:electron`;
- `test:e2e`;
- `git diff --check`;
- `e2e:cleanup:preview`.

Na cópia `<COPIA_ISOLADA_BUILD>`:

- instalação com `--frozen-lockfile` e store isolado;
- build pela implementação canônica `scripts/build.mjs`;
- `release:evidence`;
- `release:smoke-package`;
- verificação técnica com `--allow-dirty`, usada apenas para diagnóstico de conteúdo;
- `release:verify-package` estrito, mantido como autoridade final;
- `release:verify-signature` com o Windows PowerShell do sistema.

## 11. Contagem dos testes

| Gate | Resultado |
|---|---:|
| Governança | 16/16 |
| Web | 99/99 |
| API | 133/133 |
| Electron | 16/16 |
| E2E comercial | 54/54 |
| Typecheck | aprovado |
| Lint | aprovado |
| `git diff --check` | aprovado; somente avisos informativos LF/CRLF |

O aumento de 15 para 16 testes de governança corresponde à nova proteção de Node/pnpm/peer SQLite.

## 12. Falhas encontradas e correções

- A primeira instalação na cópia foi bloqueada pelo acesso de rede do sandbox (`EACCES`). A tentativa foi interrompida e repetida com autorização; o mesmo lockfile foi instalado com código 0. Classificação: limitação ambiental.
- A primeira execução do build via ambiente encapsulado não conseguiu identificar o Git; a execução direta avançou e então o sandbox bloqueou a leitura dos próprios fontes pelo esbuild. O build foi repetido fora do sandbox, com `safe.directory` limitado ao processo e à cópia isolada, e passou. Classificação: limitação ambiental.
- O E2E encontrou contraste real insuficiente em campos de modal no tema escuro. Os tokens compartilhados foram ajustados para fundo preto e texto/placeholder branco, com teste unitário atualizado.
- Uma segunda leitura Axe ocorreu durante a animação de saída do modal e uma troca de tema foi medida no meio da interpolação de cores. O teste passou a aguardar a remoção real do portal e as animações reais do diálogo, sem filtros, skips ou relaxamento das regras. O arquivo focado passou 9/9 e, depois, a suíte integral passou 54/54.
- Tentativas E2E vermelhas e uma execução anteriormente interrompida foram preservadas como evidência; a execução final verde removeu somente seus próprios resíduos gerenciados.

## 13. Resultado do build

- Cópia final: `<COPIA_ISOLADA_BUILD>`.
- Nome configurado para o próximo instalador: `GeoGestor Setup 1.0.exe`; o artefato medido abaixo antecede a normalização e está superado.
- Tamanho: 89.752.865 bytes.
- Build dos contratos, banco, API, web e desktop: aprovado.
- API empacotada: smoke aprovado com banco sintético criptografado, acesso protegido, dados operacionais vazios e auditoria sem exposição de segredo.
- Gate técnico de conteúdo com `--allow-dirty`: aprovado, 184 arquivos e 350.037.048 bytes inspecionados.
- Gate estrito: reprovado somente por `dirty: true`.

O artefato não deve ser publicado nem confundido com release final.

## 14. Versão e commit

- Versão técnica canônica atual: `1.0.0`; o pacote quantitativo desta execução antecede a normalização e não é candidato 1.0.
- Runtime do build: Node `v24.17.0`.
- Commit incorporado ao metadado: `dad415eac8e2c4363648e2f4a7776348f4fefdcd`.
- Nome canônico configurado para o próximo build: `GeoGestor Setup 1.0.exe`.

## 15. Estado `dirty`

O metadado do pacote registra `dirty: true`. O comando estrito respondeu:

> O pacote foi gerado a partir de worktree sujo; gere o release final a partir de commit/tag limpo.

Esse é o único bloqueio do gate de pacote. Não foi contornado. A obtenção de `dirty: false` depende de revisão, staging, commit e opcionalmente tag pelo proprietário ou com autorização expressa.

## 16. SHA-256

SHA-256 da evidência técnica anterior, sem validade como instalador GeoGestor 1.0:

`ae9371c35e32bedcc2b18961c790cbeea45cc1dc6ab1eeb3dfeaddc9eaa1a802`

O valor calculado corresponde ao registrado em `artifact-hashes.json` para o mesmo arquivo de 89.752.865 bytes.

## 17. SBOM

- Formato: CycloneDX.
- Especificação: 1.6.
- Aplicação esperada na regeneração: `geogestor` 1.0.0 (GeoGestor 1.0); o SBOM desta execução está superado para fins de release.
- Componentes: 294.
- Dependências: 295.
- Arquivos gerados: `sbom.cdx.json` e `sbom.json`.

A geração técnica foi aprovada; a interpretação e a revisão jurídica dos componentes transitivos continuam pendentes.

## 18. Inspeção de conteúdo

- A cópia sanitizada continha zero arquivos com padrões `.env*`, banco, WAL/SHM, certificado ou chave privada antes do build.
- A cópia não recebeu o diretório operacional `data/`, mas preservou `apps/web/src/data`.
- `node_modules`, `dist`, `scratch`, backups, dados operacionais e `temp-lovable` foram excluídos da origem da cópia; dependências e artefatos foram gerados novamente.
- O verificador do pacote aprovou conteúdo, identidade e integridade de 184 arquivos.
- Nenhum `.env`, banco, backup, chave, log, source map ou dado real foi identificado no pacote aprovado pelo gate técnico.

## 19. Processos e resíduos

- Após o smoke, a inspeção de processos por linha de comando encontrou zero processos restantes associados à cópia final.
- A prévia E2E não removeu nenhum arquivo.
- 19 execuções com propriedade comprovada foram listadas como candidatas a avaliação futura de limpeza.
- 186 execuções sem propriedade comprovada foram preservadas.
- Cópias isoladas mantidas: `b\dci114-019ffd93` (prova de dependências) e `b\g114p-fefa` (build final desta etapa).
- Store isolado mantido: `b\pnpm-store-fefa`.

Qualquer remoção futura exige autorização expressa.

## 20. Riscos residuais

- worktree não consolidado em commit/tag e grande quantidade de arquivos não rastreados necessários;
- homologação humana integralmente pendente;
- revisão jurídica, termos operacionais do OpenStreetMap e revisão de transitivos/SBOM pendentes;
- possível credencial histórica em `temp-lovable`, que requer decisão e rotação externa sem inspeção nesta tarefa;
- dívida gradual de links, recursos e endpoints registrada no backlog;
- **Assinatura digital: não implementada por decisão do proprietário — risco residual aceito.** O Windows confirmou o estado `NotSigned`;
- SmartScreen pode alertar enquanto não houver assinatura e reputação;
- o instalador desta execução é evidência técnica e não deve ser distribuído.

## 21. Veredito

# PRONTO PARA COMMIT E BUILD LIMPO

Os bloqueios técnicos de código, dependências, testes, build, smoke, hash, SBOM e conteúdo estão resolvidos. A publicação permanece bloqueada até que o proprietário revise o conjunto de alterações e arquivos não rastreados, autorize o commit/tag e um novo build isolado produza `dirty: false` e passe no gate estrito sem exceção.

Após esse novo build, homologação humana e revisão jurídica continuam sendo condições de negócio antes da distribuição comercial.
