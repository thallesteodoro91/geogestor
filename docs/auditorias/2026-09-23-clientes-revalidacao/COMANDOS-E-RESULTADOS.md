# Comandos e resultados — revalidação da Sessão 02

Executados em `C:\Users\Thalles\Documents\Codex\2026-06-22\a\work\Geogestor`, em 23/09/2026. O executor E2E inicia API Fastify e frontend reais em portas locais aleatórias, com SQLite e pasta de arquivos por spec.

| Comando | Resultado exato |
|---|---|
| `pnpm run test:e2e -- session02-clients.spec.ts` | Primeira rodada: 2/2 aprovados, 0 falhas; 48,7 s; run `run-1790206510608-40592-63dae6b5-3c64-4f3a-aca7-d45b6ebad2ae` removido pelo executor. |
| Mesmo comando após adicionar larguras/tema | Segunda rodada: 2/2 aprovados, 0 falhas; 49,9 s; run `run-1790206639541-42124-f085486a-4d41-4b60-aa85-17aa97b39597` removido pelo executor. |
| `pnpm run test:e2e -- session02-clients.spec.ts --grep persistência` após exigir links, antes da correção | 0/1; falha esperada em `getByRole('link', { name: 'Voltar para clientes' })`, linha 296, porque a UI oferecia um botão. [Captura anterior](evidencias/05-navegacao-antes.png). Run `run-1790207155306-3496-fa665b5f-8f2e-454e-a69c-a9e13a56c0a3` preservado para análise e removido depois. |
| `pnpm run test:e2e -- session02-clients.spec.ts` após S02R-F01 | **Rodada final:** 2/2 aprovados, 0 falhas, 0 ignorados, 0 instáveis; 51,5 s; run `run-1790207268420-38004-5d7f5ca7-6c3f-4cb9-afe0-cbabf7395f2d` removido pelo executor. [Resumo JSON](evidencias/e2e-summary.json), SHA-256 `D1D964C3AFE5121AE851ADAE6762F5494B126F5EC0B10BCBCE721235CDA3D674`. |
| `node (node -p "require.resolve('tsx/cli',{paths:['./apps/api']})") --test --test-force-exit apps/api/src/session02-client-lifecycle.integration.test.ts` | 1/1 aprovado; 4,92 s; HTTP 400/201/409/204/404, auditoria e exclusão lógica. Diretório temporário próprio removido. |
| `node (node -p "require.resolve('tsx/cli',{paths:['./apps/api']})") --test --test-force-exit apps/api/src/clientes.integration.test.ts apps/api/src/clientes-list.integration.test.ts` | 2/2 aprovados, 0 falhas; 10,23 s; CRUD PF/legado e busca/filtros/paginação acima de 500 clientes. Diretórios temporários próprios removidos. |
| `pnpm run typecheck` | Saída 0; `tsc -b` web e `tsc --noEmit` API concluídos sem erro. |
| `pnpm run lint` | Saída 0; ESLint web sem erro. |
| `git diff --check -- tests/e2e/session02-clients.spec.ts` | Saída 0. A spec já era não rastreada antes da rodada, portanto `git diff` não representa seu conteúdo completo. |

## Amostras da verificação integrada

- A lista começou com `clientes=0` e chegou a 32 registros isolados: 1 cadastrado pela UI e 31 inseridos no SQLite sintético para testar paginação. O E2E confirmou “32 resultados encontrados”, páginas 1 e 2, filtro por `status=Inativo` e origem Google, ordenação Z–A, URL/recarga e busca inexistente. A integração de listagem testou mais de 500 registros e verificou as respostas de paginação.
- O cadastro PF foi preenchido na UI com CPF válido, telefone, CEP, UF normalizada, endereço, origem, perfis e observações; depois foi consultado diretamente no SQLite da execução. O nome foi editado e o arquivo foi localizado pela API antes/depois da movimentação da pasta.
- A jornada de arquivo verificou `GET /api/arquivos/preview` = 200, `GET /api/arquivos/download` = 200 e tamanho idêntico ao PNG enviado, `DELETE /api/arquivos` = 200 e ausência física confirmada por `stat`.
- A exclusão foi rejeitada enquanto havia vínculos ativos (`409`). Após desativá-los somente no banco descartável, retornou sucesso; `GET /api/clientes/:id` retornou `404`. A integração confirmou `deleted_at`, histórico oculto, auditoria e `404` em nova exclusão/edição.
- Os testes E2E exigiram `consoleErrors=[]` fora das respostas 409/404 esperadas e Axe sem violações nas amostras. A lista e o detalhe foram verificados sem rolagem horizontal em 360, 768, 1024 e 1440 px. A lista passou também no modo escuro.

## Limpeza verificada

Os três caminhos exatos de execuções aprovadas `run-*` e o caminho da execução falha não existiam após a conclusão. Foram removidos apenas os bancos isolados desta rodada: `scratch/session02-client-31536`, `scratch/clientes-28364` e `scratch/clientes-list-31848`; a inexistência foi confirmada. Outros diretórios históricos de `scratch` foram preservados. O banco padrão `data/geogestor.db` manteve **2.449.408 bytes** e última modificação em **23/09/2026 18:03:10**, antes e depois da rodada. O arquivo estava aberto por outro processo, impedindo SHA-256; não houve acesso de escrita a ele.
