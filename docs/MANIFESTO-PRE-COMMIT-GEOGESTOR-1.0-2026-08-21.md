# Manifesto pré-commit do GeoGestor 1.0 — 2026-08-21

## 1. Resumo executivo

O conjunto de remediação e polimento do GeoGestor 1.0 foi auditado, recebeu correções pequenas e comprovadas e passou novamente pelos gates técnicos integrais. A instalação congelada e o build Windows foram reproduzidos em uma terceira cópia curta e saneada. O candidato técnico passou pelo smoke e pelo verificador permissivo; o gate estrito recusou exclusivamente o estado `dirty: true`, resultado correto antes de existir um commit/tag autorizado e limpo.

Após essa validação, o proprietário definiu a nomenclatura definitiva do primeiro lançamento como **GeoGestor 1.0**, com versão técnica `1.0.0`. Por isso, o pacote, o hash e o SBOM quantitativos descritos abaixo permanecem somente como evidência técnica anterior à mudança de metadado e não podem ser apresentados como artefatos 1.0. A configuração atual produzirá `GeoGestor Setup 1.0.exe`, que deverá ser regenerado após o futuro commit limpo.

Não houve staging, commit, tag, push, merge, assinatura ou publicação. Nenhum `.env` ou banco real foi aberto, copiado ou alterado. O produto ainda não está liberado para publicação: permanecem as etapas humanas, jurídicas, de assinatura digital e de geração do artefato oficial a partir de commit/tag limpo.

## 2. Branch, HEAD e estado do Git

- Raiz confirmada: `<REPOSITORIO_GEOGESTOR>`.
- Branch: `main`.
- HEAD: `dad415eac8e2c4363648e2f4a7776348f4fefdcd`.
- Versão técnica canônica: `1.0.0`; apresentação comercial: `1.0`.
- Estado imediatamente antes da criação original deste documento: 184 caminhos — 97 modificados, 22 excluídos e 65 não rastreados.
- Estado atual, após o manifesto e a normalização de nomenclatura: 188 caminhos — 100 modificados, 22 excluídos e 66 não rastreados.
- Nenhum caminho estava em staging.
- As alterações preexistentes foram preservadas. As correções específicas desta tarefa estão enumeradas na seção 7.

## 3. Inventário das alterações

O diff rastreado contém 119 caminhos, com 4.066 inserções e 2.860 exclusões: 97 arquivos modificados e 22 excluídos. Há 66 arquivos não rastreados após a criação deste manifesto.

Distribuição funcional dos 65 arquivos não rastreados preexistentes:

| Categoria | Quantidade | Decisão |
|---|---:|---|
| Produto/runtime | 20 | Incluir no futuro commit |
| Testes, CI, governança e ferramentas | 26 | Incluir no futuro commit |
| Documentação de release/comercial | 17 | Incluir no futuro commit |
| Fixtures sintéticas | 2 | Incluir no futuro commit |
| Resíduo/inconclusivo | 0 | Nenhum |

Este manifesto constitui o 66º arquivo não rastreado e também deve integrar o futuro commit.

## 4. Auditoria dos arquivos excluídos

| Arquivo excluído | Classificação | Evidência/justificativa |
|---|---|---|
| `apps/api/fix-db.js` | Resíduo obsoleto | Script pontual não referenciado; manutenção coberta por migrações canônicas. |
| `apps/api/fix_any.mjs` | Resíduo obsoleto | Script de correção ad hoc sem consumidor no produto ou nos gates. |
| `apps/api/refactor.mjs` | Resíduo obsoleto | Ferramenta pontual de refatoração, não usada no runtime/build. |
| `apps/api/revert_unknown.mjs` | Resíduo obsoleto | Script ad hoc sem referência ativa. |
| `apps/api/src/migrate-fields.ts` | Substituída por implementação canônica | Migrações históricas e runtime migrations versionadas assumem a função. |
| `apps/api/src/migrate-interacoes.ts` | Substituída por implementação canônica | Migração pontual substituída pelo pipeline versionado. |
| `apps/api/src/migrate-oportunidades.ts` | Substituída por implementação canônica | Migração pontual substituída pelo pipeline versionado. |
| `apps/api/src/scratch-db-compromissos.ts` | Resíduo obsoleto | Script de scratch, sem uso produtivo. |
| `apps/api/src/scratch-db.ts` | Resíduo obsoleto | Script de scratch, sem uso produtivo. |
| `apps/web/scratch-check.cjs` | Resíduo obsoleto | Verificação local temporária, sem referência. |
| `apps/web/scratch-check.js` | Resíduo obsoleto | Verificação local temporária, sem referência. |
| `apps/web/src/App.css` | Intencional e segura | Estilos migrados para a folha global/camada utilitária; sem import ativo. |
| `apps/web/src/assets/hero.png` | Intencional e segura | Asset sem consumidor na aplicação consolidada. |
| `apps/web/src/assets/react.svg` | Intencional e segura | Asset padrão do scaffold, sem consumidor. |
| `apps/web/src/assets/vite.svg` | Intencional e segura | Asset padrão do scaffold, sem consumidor. |
| `apps/web/src/components/ResponsiveTable.tsx` | Substituída por implementação canônica | Componente sem import ativo; tabelas atuais usam implementações consolidadas. |
| `apps/web/src/components/form-controls/index.ts` | Intencional e segura | Barrel sem consumidores; imports diretos permanecem válidos. |
| `apps/web/src/core/finance.ts` | Substituída por implementação canônica | Regras financeiras consolidadas nos serviços/contratos atuais e cobertas por testes. |
| `apps/web/src/pages/Financeiro/financeForm.test.ts` | Substituída por implementação canônica | Teste do módulo removido; cobertura financeira atual permanece aprovada. |
| `apps/web/src/pages/Financeiro/financeForm.ts` | Substituída por implementação canônica | Fluxo absorvido pela implementação financeira atual. |
| `fix-db.js` | Resíduo obsoleto | Script pontual na raiz, não referenciado. |
| `fix-fetch.js` | Resíduo obsoleto | Script pontual na raiz, não referenciado. |

Busca de referências, typecheck, lint, testes e build não identificaram código utilizado, teste obrigatório, migração histórica, asset consumido, contrato público ou compatibilidade ainda dependente desses arquivos. As 22 exclusões são intencionais e seguras para o futuro commit.

## 5. Manifesto dos arquivos não rastreados obrigatórios

### Produto e runtime — 20

- `apps/api/src/services/geospatial/crs-detection.service.ts`
- `apps/api/src/services/geospatial/geometry-validation.service.ts`
- `apps/api/src/services/geospatial/geospatial-audit.service.ts`
- `apps/api/src/services/geospatial/geospatial-import.service.ts`
- `apps/api/src/services/geospatial/geospatial-types.ts`
- `apps/api/src/services/geospatial/mbtiles.service.ts`
- `apps/api/src/services/geospatial/safe-archive.service.ts`
- `apps/api/src/services/geospatial/topology-validation.service.ts`
- `apps/api/src/services/geospatial/vector-upload-policy.service.ts`
- `apps/api/src/services/geospatial/visualization-cache.service.ts`
- `apps/api/src/services/runtime-migrations/v12-geospatial-layers.ts`
- `apps/api/src/services/runtime-migrations/v13-geospatial-polish.ts`
- `apps/api/src/types/shapefile.d.ts`
- `apps/web/src/data/chart-colors.ts`
- `apps/web/src/pages/Configuracoes/GeoGestorHealthPanel.tsx`
- `apps/web/src/pages/NotFound.tsx`
- `apps/web/src/services/budgets.ts`
- `apps/web/src/services/projectFolders.ts`
- `apps/web/src/utils/geospatialFilePolicy.ts`
- `packages/contracts/src/app-navigation.ts`

### Testes, CI, governança e ferramentas — 26

- `.github/workflows/ci.yml`
- `apps/api/src/drizzle-journal-bootstrap.integration.test.ts`
- `apps/api/src/legacy-upload-security.integration.test.ts`
- `apps/api/src/runtime-migrations-v11.integration.test.ts`
- `apps/api/src/services/geospatial/geospatial-import.test.ts`
- `apps/api/src/services/geospatial/vector-upload-policy.test.ts`
- `apps/web/src/components/accessibilityRemediation.test.ts`
- `apps/web/src/services/projectFolders.test.ts`
- `apps/web/src/utils/appNavigation.test.ts`
- `apps/web/src/utils/geospatialFilePolicy.test.ts`
- `governance/compatibility-registry.json`
- `governance/hardcoded-navigation-baseline.json`
- `scripts/benchmark-geospatial.mjs`
- `scripts/e2e-artifacts.mjs`
- `scripts/e2e-artifacts.test.mjs`
- `scripts/governance-checks.mjs`
- `scripts/governance-checks.test.mjs`
- `scripts/preview-e2e-cleanup.mjs`
- `scripts/release-governance.test.mjs`
- `scripts/run-governance.mjs`
- `scripts/sbom.mjs`
- `scripts/sbom.test.mjs`
- `tests/e2e/accessibility-navigation.spec.ts`
- `tests/e2e/deep-link-records.spec.ts`
- `tests/e2e/setup-initial.spec.ts`
- `tests/e2e/strategic-planning-flow.spec.ts`

### Documentação — 17 preexistentes mais este manifesto

- `docs/AUDITORIA-ROTAS-E-RESIDUOS-2026-08-11.md`
- `docs/BACKLOG-DIVIDA-GOVERNANCA-GEOGESTOR-1.0.md`
- `docs/CHECKLIST-GOVERNANCA.md`
- `docs/GOVERNANCA-PERMANENTE-2026-08-11.md`
- `docs/GOVERNANCA-PREVENTIVA-2026-08-11.md`
- `docs/NOTAS-DE-VERSAO-v1.0.md`
- `docs/POLIMENTO-TECNICO-2026-08-11.md`
- `docs/RELATORIO-FINAL-REMEDIACAO-GEOGESTOR-1.0-2026-08-13.md`
- `docs/RELATORIO-PRE-RELEASE-LIMPO-GEOGESTOR-1.0-2026-08-13.md`
- `docs/architecture/ADR-005-governanca-de-release.md`
- `docs/commercial/AVISOS-DE-TERCEIROS.md`
- `docs/commercial/POLITICA-DE-PRIVACIDADE-MINUTA.md`
- `docs/commercial/PROCEDIMENTO-DE-ATUALIZACAO-MANUAL.md`
- `docs/commercial/PROCEDIMENTO-DE-BACKUP-E-RECUPERACAO.md`
- `docs/commercial/PROCEDIMENTO-DE-SUPORTE.md`
- `docs/commercial/ROTEIRO-FUTURO-AUTHENTICODE.md`
- `docs/commercial/TERMOS-DE-USO-E-EULA-MINUTA.md`
- `docs/MANIFESTO-PRE-COMMIT-GEOGESTOR-1.0-2026-08-21.md`

### Fixtures sintéticas — 2

- `apps/api/src/services/geospatial/fixtures/florianopolis.geojson`
- `apps/api/src/services/geospatial/fixtures/florianopolis.kml`

Todos os arquivos necessários estão livres para versionamento, foram incluídos na cópia saneada, compilaram e não apresentaram segredos, caminhos locais ou dados reais. Em especial, `apps/web/src/data/chart-colors.ts` existe, não está ignorado, foi copiado e participou do build.

## 6. Arquivos inconclusivos

Nenhum. Os 65 não rastreados preexistentes foram classificados como necessários e as 22 exclusões foram justificadas. O manifesto e os documentos renomeados para GeoGestor 1.0 também são obrigatórios.

## 7. Correções realizadas

1. `start-dev.cmd`: removida a dependência de caminho absoluto para o cache de um usuário; o launcher agora localiza `pnpm.cmd` pelo ambiente e falha com mensagem clara quando indisponível.
2. Serviço de arquivos recuperáveis: validação defensiva do manifesto persistido, hash, tamanho, estado, diretórios físicos, payload e symlinks; rollback passou a revalidar a raiz de dados. Foi adicionado teste hostil que comprova que um manifesto adulterado não alcança arquivo externo.
3. Build da API: a ausência do binding nativo libSQL para Windows agora interrompe o build; a falha não é mais convertida em aviso. O teste de governança de release cobre esse comportamento.
4. Relatórios de release: caminhos absolutos locais foram substituídos por marcadores portáveis.
5. Nomenclatura do primeiro lançamento: versão técnica sincronizada em `1.0.0`, apresentação comercial definida como GeoGestor 1.0, instalador configurado como `GeoGestor Setup 1.0.exe` e documentos atuais renomeados sem reaproveitar artefatos antigos.

As correções foram precedidas por falhas reproduzíveis nos testes focados correspondentes e seguidas pelos gates integrais. Nenhum gate foi relaxado.

## 8. Comandos executados

Principais comandos de auditoria e validação, com caminhos locais substituídos por marcadores:

```powershell
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --untracked-files=all
git check-ignore -v <arquivo>
git diff --check
pnpm.cmd --config.verify-deps-before-run=false run governance:check
pnpm.cmd --config.verify-deps-before-run=false run governance:test
pnpm.cmd --config.verify-deps-before-run=false run typecheck
pnpm.cmd --config.verify-deps-before-run=false run lint
pnpm.cmd --config.verify-deps-before-run=false run test:web
pnpm.cmd --config.verify-deps-before-run=false run test:api
pnpm.cmd --config.verify-deps-before-run=false run test:electron
pnpm.cmd --config.verify-deps-before-run=false run test:e2e
node --test scripts/release-integrity.test.mjs scripts/sbom.test.mjs
node apps/desktop/prepare-app.mjs
pnpm.cmd install --frozen-lockfile
pnpm.cmd run build
pnpm.cmd run release:evidence
pnpm.cmd run release:smoke-package
pnpm.cmd run release:verify-candidate
pnpm.cmd run release:verify-package
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-authenticode.ps1
node scripts/preview-e2e-cleanup.mjs
```

O comando `pnpm e2e:cleanup:preview` tentou revalidar dependências sem TTY e foi abortado pelo próprio pnpm antes do script. O script exato foi então executado diretamente em modo de prévia; nenhum arquivo foi removido.

## 9. Contagem dos testes

| Gate | Resultado novo |
|---|---:|
| Governança | 18/18 |
| Web | 99/99 |
| API | 134/134 |
| Electron | 16/16 |
| E2E comercial | 54/54 |
| Integridade de release e SBOM, suplementar | 3/3 |
| Typecheck | Aprovado |
| Lint | Aprovado |
| `git diff --check` | Aprovado; somente avisos de normalização LF/CRLF |

São 321 testes aprovados na suíte obrigatória e 324 quando incluídos os 3 testes suplementares. O `governance:check` também foi aprovado: 71 links no baseline, zero novo achado e 26 recursos ambientais classificados como inconclusivos, sem leitura de conteúdo proibido. Axe permanece evidência automatizada e não substitui homologação humana.

Na validação posterior à criação deste manifesto, uma primeira rodada E2E encontrou timeout isolado de 10 segundos ao conectar ao serviço local durante um desbloqueio: 48 passaram, 1 falhou e 5 não executaram por encadeamento serial. Screenshot, contexto e trace foram preservados na pasta identificada da execução. Sem alteração de código ou critério, a repetição integral seguinte aprovou 54/54 em 4,0 minutos e encerrou os serviços de forma graciosa. O cenário antes afetado passou em 2,8 segundos, caracterizando instabilidade ambiental isolada, não regressão funcional.

## 10. Instalação congelada

A instalação final foi executada em uma terceira cópia nova e curta, `<COPIA_ISOLADA_BUILD>`, após rejeição conservadora de duas cópias intermediárias que ainda continham diretórios de scratch/dados históricos. As cópias rejeitadas foram preservadas como evidência e não foram reutilizadas.

- `pnpm install --frozen-lockfile`: aprovado, 716 pacotes.
- Node: `v24.17.0`.
- pnpm: `11.8.0`.
- SHA-256 do lockfile antes/depois: `42BAA36AC31414BA1DF2219AD414D31537AB3F0FF96C482ED4C1FFC796E36FA8`.
- Lockfile inalterado.
- Zero pacote/diretório materializado de `better-sqlite3` no store virtual ou nos links do workspace.
- A ocorrência nominal `drizzle-orm/better-sqlite3` é apenas o adaptador-fonte interno distribuído pelo Drizzle, não o pacote nativo instalado.
- A cópia final continha zero diretório/arquivo proibido antes da instalação e preservou `apps/web/src/data` e os ícones de build.

## 11. Resultado do build técnico

O build completo foi aprovado na cópia final saneada: contratos, banco, API, Web, Electron x64, diretório `win-unpacked`, instalador NSIS e blockmap. O binding `@libsql/win32-x64-msvc` foi exigido e copiado para o pacote. O smoke da API empacotada foi aprovado com banco sintético criptografado, acesso protegido, dados operacionais vazios e auditoria sem exposição de segredos.

O verificador técnico permissivo aprovou 184 arquivos e 350.040.726 bytes. O gate estrito reprovou somente `dirty: true`, sem outro erro técnico.

Essas métricas pertencem à evidência técnica imediatamente anterior à normalização da versão. Elas comprovam o fluxo de build, mas não constituem um pacote GeoGestor 1.0.

## 12. Versão, commit e estado `dirty`

- Versão técnica canônica atual: `1.0.0`; nomenclatura comercial configurada: `1.0`.
- Commit registrado: `dad415eac8e2c4363648e2f4a7776348f4fefdcd`.
- `dirty`: `true`.
- Interpretação: o artefato medido antecede a normalização e é válido apenas como evidência do fluxo técnico; não é o instalador GeoGestor 1.0.

## 13. SHA-256

- Nome esperado no próximo build: `GeoGestor Setup 1.0.exe`.
- Tamanho: 89.753.790 bytes.
- SHA-256: `864F84DF03CF09BF657538193B897ADD9F1FA2026461331863A6FDBE49012E2A`.
- O hash calculado independentemente corresponde à evidência anterior em `artifact-hashes.json`, mas não deve ser atribuído ao futuro instalador 1.0.

## 14. SBOM

- Formato: CycloneDX.
- Versão da especificação: 1.6.
- Componentes: 294.
- Evidências: `sbom.cdx.json` e `sbom.json`, ambos com 358.738 bytes.
- Os testes específicos de SBOM e integridade passaram 3/3.
- O SBOM quantitativo deverá ser regenerado com a versão técnica `1.0.0` no mesmo build limpo do instalador.

## 15. Inspeção de conteúdo

Foram confirmados no pacote `server.js`, `release-metadata.json`, `web/index.html` e o binding nativo libSQL. O verificador percorreu 184 arquivos e 350.040.726 bytes. A inspeção nominal recursiva não encontrou `.env`, banco, WAL/SHM, chave, certificado, credencial ou segredo no pacote. Migrações/journal, contratos e ativos Web necessários foram validados pelo build, pelos testes de integração e pelo gate do candidato.

## 16. Processos e resíduos

Após o smoke, não permaneceu processo `GeoGestor.exe` ou `node.exe` associado à cópia final. A prévia de limpeza E2E não removeu nada: identificou 20 execuções com propriedade comprovada que poderiam ser avaliadas no futuro, incluindo a falha ambiental preservada desta auditoria, e preservou outras 186 sem propriedade comprovada. Nenhuma evidência, store ou cópia isolada foi excluída.

## 17. Pendências humanas

- Revisar e autorizar o conjunto exato do futuro commit.
- Homologar instalação e desinstalação em Windows.
- Homologar atualização real com preservação de dados.
- Testar NVDA e Narrador.
- Testar alto contraste real do Windows.
- Avaliar SmartScreen.
- Validar escalas físicas, resoluções e múltiplos monitores.
- Executar uso prolongado e cenário de interrupção elétrica.
- Realizar revisão visual humana e confirmar os critérios WCAG não automatizáveis.

## 18. Pendências jurídicas

- Revisão jurídica de EULA, política de privacidade, avisos de terceiros e procedimentos comerciais.
- Decisão do proprietário e/ou assessoria sobre a validade e compatibilidade das licenças.
- Aprovação formal das minutas comerciais.
- Compra e custódia de certificado de assinatura de código.
- Assinatura Authenticode e definição do processo de publicação.

Este documento não constitui parecer jurídico.

## 19. Riscos residuais

1. O worktree permanece propositalmente sujo até autorização, staging e commit; por isso não existe ainda evidência `dirty: false`.
2. O instalador técnico está `NotSigned`; o Authenticode foi apenas verificado, não implementado.
3. A homologação humana e jurídica ainda pode produzir ajustes antes da publicação.
4. Existem 20 resíduos E2E com propriedade comprovada elegíveis para avaliação de limpeza, além de 186 preservados por falta de prova de propriedade; nenhum afeta o build e nenhum foi removido.
5. Avisos LF/CRLF são informativos no Windows; `git diff --check` passou.
6. O pacote, o hash e o SBOM quantitativos produzidos antes da normalização da versão estão superados para fins de release; o conjunto 1.0 deverá ser regenerado após o futuro commit limpo.

Não foi identificada falha técnica real remanescente no escopo solucionável pelo Codex.

## 20. Lista exata sugerida para o futuro commit

Incluir os 188 caminhos abaixo, preservando exatamente as modificações e exclusões auditadas. A letra indica a ação atual no Git.

### Modificados — 100

```text
M .gitignore
M .npmrc
M README.md
M apps/api/build.mjs
M apps/api/package.json
M apps/api/src/database-security-worker.ts
M apps/api/src/database-security.integration.test.ts
M apps/api/src/deadline-alerts.integration.test.ts
M apps/api/src/local-auth.integration.test.ts
M apps/api/src/operational-data.integration.test.ts
M apps/api/src/recoverable-file.service.test.ts
M apps/api/src/routes/arquivos.routes.ts
M apps/api/src/runtime-migrations-fast-path.integration.test.ts
M apps/api/src/runtime-migrations-safety.integration.test.ts
M apps/api/src/runtime-migrations-v3.integration.test.ts
M apps/api/src/server.ts
M apps/api/src/services/backup.service.ts
M apps/api/src/services/deadline-alerts.service.ts
M apps/api/src/services/import-run.service.ts
M apps/api/src/services/local-session.service.ts
M apps/api/src/services/recoverable-file.service.ts
M apps/api/src/services/runtime-migrations.service.ts
M apps/api/src/services/runtime-migrations/v11-import-runs.ts
M apps/api/src/strategic-planning.integration.test.ts
M apps/desktop/main.js
M apps/desktop/main.test.cjs
M apps/desktop/package.json
M apps/desktop/prepare-app.mjs
M apps/web/README.md
M apps/web/package.json
M apps/web/src/App.tsx
M apps/web/src/components/BackupPolicyPanel.tsx
M apps/web/src/components/GlobalSearch.tsx
M apps/web/src/components/Layout.tsx
M apps/web/src/components/Modal.tsx
M apps/web/src/components/ModalAdicionarNota.tsx
M apps/web/src/components/Sidebar.tsx
M apps/web/src/components/UnifiedNotificationCenter.tsx
M apps/web/src/components/form-controls/NumericInput.tsx
M apps/web/src/components/maps/MapBaseNotice.tsx
M apps/web/src/index.css
M apps/web/src/pages/Ajuda/helpContent.test.ts
M apps/web/src/pages/Ajuda/helpContent.ts
M apps/web/src/pages/CRM/CRM.tsx
M apps/web/src/pages/Cadastros.tsx
M apps/web/src/pages/Clientes/ClienteDetalhes.tsx
M apps/web/src/pages/Configuracoes.tsx
M apps/web/src/pages/Contatos/Contatos.tsx
M apps/web/src/pages/Despesas/Despesas.tsx
M apps/web/src/pages/Faturas/Faturas.tsx
M apps/web/src/pages/Financeiro/Financeiro.tsx
M apps/web/src/pages/Financeiro/financeConsolidation.test.ts
M apps/web/src/pages/Licenciamento/LicencaDetalhes.tsx
M apps/web/src/pages/Projetos/ListagemProjetos.tsx
M apps/web/src/pages/Projetos/ProjetoDetalhes.tsx
M apps/web/src/pages/Projetos/ProjetosMap.tsx
M apps/web/src/pages/Relatorios/Relatorios.tsx
M apps/web/src/pages/Relatorios/ReportTabs.tsx
M apps/web/src/pages/Tarefas/Tarefas.tsx
M apps/web/src/services/apiClient.test.ts
M apps/web/src/services/apiClient.ts
M apps/web/src/services/companyTemplate.ts
M apps/web/src/utils/filterStyles.ts
M apps/web/src/utils/mapTiles.ts
M apps/web/vite.config.ts
M docs/HOMOLOGACAO-HUMANA-WINDOWS-WCAG-2026-08-01.md
M docs/NOTAS-DE-VERSAO-v1.1.3.md
M package.json
M packages/contracts/package.json
M packages/contracts/src/index.ts
M packages/database/drizzle/0000_opposite_senator_kelly.sql
M packages/database/drizzle/0001_magical_karma.sql
M packages/database/drizzle/0007_ambiental_operacional.sql
M packages/database/drizzle/0010_strategic_planning.sql
M packages/database/drizzle/0011_strategic_governance.sql
M packages/database/drizzle/0014_import_runs.sql
M packages/database/drizzle/meta/_journal.json
M packages/database/package.json
M packages/database/src/database-security.ts
M packages/database/src/schema.ts
M playwright.config.ts
M pnpm-lock.yaml
M pnpm-workspace.yaml
M scripts/release-candidate.mjs
M scripts/release-evidence.mjs
M scripts/release-integrity.mjs
M scripts/release-integrity.test.mjs
M scripts/release-verify.mjs
M scripts/run-api-tests.mjs
M scripts/run-commercial-e2e.mjs
M scripts/smoke-packaged-api.mjs
M scripts/verify-authenticode.ps1
M start-dev.cmd
M tests/e2e/cadastros-properties.spec.ts
M tests/e2e/commercial-critical.spec.ts
M tests/e2e/header-standardization.spec.ts
M tests/e2e/help-center.spec.ts
M tests/e2e/layout-persistence.spec.ts
M tests/e2e/reports-managerial.spec.ts
M tests/e2e/settings-audit.spec.ts
```

### Excluídos — 22

```text
D apps/api/fix-db.js
D apps/api/fix_any.mjs
D apps/api/refactor.mjs
D apps/api/revert_unknown.mjs
D apps/api/src/migrate-fields.ts
D apps/api/src/migrate-interacoes.ts
D apps/api/src/migrate-oportunidades.ts
D apps/api/src/scratch-db-compromissos.ts
D apps/api/src/scratch-db.ts
D apps/web/scratch-check.cjs
D apps/web/scratch-check.js
D apps/web/src/App.css
D apps/web/src/assets/hero.png
D apps/web/src/assets/react.svg
D apps/web/src/assets/vite.svg
D apps/web/src/components/ResponsiveTable.tsx
D apps/web/src/components/form-controls/index.ts
D apps/web/src/core/finance.ts
D apps/web/src/pages/Financeiro/financeForm.test.ts
D apps/web/src/pages/Financeiro/financeForm.ts
D fix-db.js
D fix-fetch.js
```

### Não rastreados — 66

```text
?? .github/workflows/ci.yml
?? apps/api/src/drizzle-journal-bootstrap.integration.test.ts
?? apps/api/src/legacy-upload-security.integration.test.ts
?? apps/api/src/runtime-migrations-v11.integration.test.ts
?? apps/api/src/services/geospatial/crs-detection.service.ts
?? apps/api/src/services/geospatial/fixtures/florianopolis.geojson
?? apps/api/src/services/geospatial/fixtures/florianopolis.kml
?? apps/api/src/services/geospatial/geometry-validation.service.ts
?? apps/api/src/services/geospatial/geospatial-audit.service.ts
?? apps/api/src/services/geospatial/geospatial-import.service.ts
?? apps/api/src/services/geospatial/geospatial-import.test.ts
?? apps/api/src/services/geospatial/geospatial-types.ts
?? apps/api/src/services/geospatial/mbtiles.service.ts
?? apps/api/src/services/geospatial/safe-archive.service.ts
?? apps/api/src/services/geospatial/topology-validation.service.ts
?? apps/api/src/services/geospatial/vector-upload-policy.service.ts
?? apps/api/src/services/geospatial/vector-upload-policy.test.ts
?? apps/api/src/services/geospatial/visualization-cache.service.ts
?? apps/api/src/services/runtime-migrations/v12-geospatial-layers.ts
?? apps/api/src/services/runtime-migrations/v13-geospatial-polish.ts
?? apps/api/src/types/shapefile.d.ts
?? apps/web/src/components/accessibilityRemediation.test.ts
?? apps/web/src/data/chart-colors.ts
?? apps/web/src/pages/Configuracoes/GeoGestorHealthPanel.tsx
?? apps/web/src/pages/NotFound.tsx
?? apps/web/src/services/budgets.ts
?? apps/web/src/services/projectFolders.test.ts
?? apps/web/src/services/projectFolders.ts
?? apps/web/src/utils/appNavigation.test.ts
?? apps/web/src/utils/geospatialFilePolicy.test.ts
?? apps/web/src/utils/geospatialFilePolicy.ts
?? docs/AUDITORIA-ROTAS-E-RESIDUOS-2026-08-11.md
?? docs/BACKLOG-DIVIDA-GOVERNANCA-GEOGESTOR-1.0.md
?? docs/CHECKLIST-GOVERNANCA.md
?? docs/GOVERNANCA-PERMANENTE-2026-08-11.md
?? docs/GOVERNANCA-PREVENTIVA-2026-08-11.md
?? docs/MANIFESTO-PRE-COMMIT-GEOGESTOR-1.0-2026-08-21.md
?? docs/NOTAS-DE-VERSAO-v1.0.md
?? docs/POLIMENTO-TECNICO-2026-08-11.md
?? docs/RELATORIO-FINAL-REMEDIACAO-GEOGESTOR-1.0-2026-08-13.md
?? docs/RELATORIO-PRE-RELEASE-LIMPO-GEOGESTOR-1.0-2026-08-13.md
?? docs/architecture/ADR-005-governanca-de-release.md
?? docs/commercial/AVISOS-DE-TERCEIROS.md
?? docs/commercial/POLITICA-DE-PRIVACIDADE-MINUTA.md
?? docs/commercial/PROCEDIMENTO-DE-ATUALIZACAO-MANUAL.md
?? docs/commercial/PROCEDIMENTO-DE-BACKUP-E-RECUPERACAO.md
?? docs/commercial/PROCEDIMENTO-DE-SUPORTE.md
?? docs/commercial/ROTEIRO-FUTURO-AUTHENTICODE.md
?? docs/commercial/TERMOS-DE-USO-E-EULA-MINUTA.md
?? governance/compatibility-registry.json
?? governance/hardcoded-navigation-baseline.json
?? packages/contracts/src/app-navigation.ts
?? scripts/benchmark-geospatial.mjs
?? scripts/e2e-artifacts.mjs
?? scripts/e2e-artifacts.test.mjs
?? scripts/governance-checks.mjs
?? scripts/governance-checks.test.mjs
?? scripts/preview-e2e-cleanup.mjs
?? scripts/release-governance.test.mjs
?? scripts/run-governance.mjs
?? scripts/sbom.mjs
?? scripts/sbom.test.mjs
?? tests/e2e/accessibility-navigation.spec.ts
?? tests/e2e/deep-link-records.spec.ts
?? tests/e2e/setup-initial.spec.ts
?? tests/e2e/strategic-planning-flow.spec.ts
```

Não incluir `node_modules`, `dist`, `scratch`, `temp-lovable`, bancos, backups, `.env`, chaves, certificados, credenciais, stores E2E ou cópias isoladas.

## 21. Veredito

**PRONTO PARA AUTORIZAÇÃO DE COMMIT**

Todo o trabalho técnico solucionável pelo Codex neste escopo foi concluído. A próxima etapa depende de autorização expressa do proprietário para preparar o staging e criar o commit da lista exata da seção 20. Depois do commit, ainda será necessário autorizar a tag e um novo build oficial em checkout limpo, comprovar `dirty: false`, aprovar o gate estrito e concluir as homologações humana e jurídica antes de qualquer publicação.
