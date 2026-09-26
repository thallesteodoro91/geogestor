# Arquivos alterados pela Sessão 10

## Produção

| Arquivo | Motivo |
|---|---|
| `apps/web/src/core/topography.ts` | Parser numérico/GMS estrito, sinais/hemisférios e carry de 60″ |
| `apps/web/src/core/topographySpatial.ts` | Borda de fuso, faixas espaciais e fator de escala UTM |
| `apps/web/src/core/topographyImport.ts` | Detecção/mapeamento/aspas/ambiguidade e limites de importação |
| `apps/web/src/core/topographyExchange.ts` | Validação geométrica, parser legado e contratos CSV/GeoJSON/KML/DXF |
| `apps/web/src/core/topographyReport.ts` | Metadados de vértice no relatório técnico |
| `apps/web/src/pages/Topografia/CalculadoraTopografica.tsx` | Gates espaciais, restauração, busca SRC, mensagens, preservação de metadados e zoom acessível |
| `apps/web/src/pages/Topografia/VertexImportPreview.tsx` | Semântica de lista com anúncio ARIA preservado |
| `apps/web/src/components/CalculationHistory.tsx` | Trava síncrona contra duplo submit, erro limpo e informação 20/N |
| `apps/api/src/routes/operational-data.routes.ts` | JSON objeto estrito, vínculo, legado e ordenação determinística |

## Testes e utilitários

| Arquivo | Motivo |
|---|---|
| `apps/web/src/core/topographyAdvanced.test.ts` | Limites GMS e normalização |
| `apps/web/src/core/topographySpatial.test.ts` | Projeção, fuso e metadados UTM |
| `apps/web/src/core/topographyImport.test.ts` | Importação adversarial e volume |
| `apps/web/src/core/topographyExchange.test.ts` | Topologia, fechamento e metadados dos formatos |
| `apps/web/src/core/topographyReport.test.ts` | Conteúdo técnico do PDF |
| `apps/api/src/operational-data.integration.test.ts` | Contratos de histórico existentes ajustados à validação reforçada |
| `apps/api/src/session10-topography.integration.test.ts` | Vínculo, schema, legado, deletedAt, auditoria e rollback em DB isolado |
| `tests/e2e/session10-topography.spec.ts` | Três fluxos UI, downloads, PDF, histórico, offline, Axe e capturas |
| `scripts/session10-oracles.py` | Oráculos PROJ/GeographicLib/Shapely |
| `scripts/session10-compare.ts` | Comparação GeoGestor × oráculos e amostras técnicas |
| `scripts/session10-validate-artifacts.py` | Reabertura externa dos arquivos e renderização PDF |

## Documentação/evidências

Todo o diretório `docs/auditorias/2026-09-13-topografia/` pertence a esta sessão. Artefatos de `dist/` foram reconstruídos para o teste, mas são saídas geradas/ignoradas e não são atribuídos como edição-fonte.

Não houve commit, push, reset ou reversão de alterações preexistentes.
