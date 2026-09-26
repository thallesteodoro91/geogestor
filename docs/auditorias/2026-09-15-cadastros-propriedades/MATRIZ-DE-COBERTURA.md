# Matriz de cobertura

Legenda: `AP` = aprovado; `AC` = aprovado após correção; `BL` = bloqueado; `NA` = não aplicável.

| ID | Rota/camada | Controle ou invariante | Evidência principal | Situação |
|---|---|---|---|---|
| CAT-01 | `/cadastros` | Entrada, URL direta, abas, busca, status e histórico | E2E restaura `aba`, `status` e `busca` com voltar/avançar | AP |
| CAT-02 | `/cadastros` | Tablist, setas, Home/End, painel e foco | E2E por teclado | AC |
| CAT-03 | Serviços | Criar, editar, inativar, cancelar e reativar com ID estável | E2E + contrato | AC |
| CAT-04 | Serviços | Nome/categoria/ID/limites, duplicidade normalizada e zero centavos | unitário + integração | AC |
| CAT-05 | Orçamentos | Apenas ativos; descrição e centavos; não sobrescrever; zero válido | E2E + `BudgetEditor` | AC |
| CAT-06 | Despesas | Categoria, descrição, até 100 subcategorias, separadores e deduplicação | unitário + E2E | AC |
| CAT-07 | Despesas | Inativo some de novas escolhas e histórico permanece legível | E2E de consumidores + revisão do fluxo | AC |
| CAT-08 | Persistência | SQLite autoritativo; cache divergente/corrompido/fallback/default | testes de serviço web | AC |
| CAT-09 | PUT | Validação integral e atomicidade de duas chaves | PUT inválido deixou 0 configurações | AC |
| CAT-10 | `/migrar` | Chaves permitidas, legado, IDs determinísticos, zero, first-write-wins | integração S13 | AC |
| CAT-11 | Integrações | Alteração de catálogo não modifica dados históricos ou fontes automáticas | consumidor + regressão completa | AP |
| CAT-12 | Concorrência | Duas janelas editando a mesma versão do catálogo | sem ETag/versão; decisão de produto | BL |
| PROP-01 | `/propriedades` | Lista global, criação, leitura, edição e exclusão lógica | E2E + API | AP |
| PROP-02 | Formulário | Cliente ativo, nome, município e UF obrigatórios | contrato/API/UI | AC |
| PROP-03 | Formulário | Ao menos um identificador; cada identificador isolado/todos | integração + E2E | AC |
| PROP-04 | Duplicidade | Nome por cliente e quatro identificadores globais normalizados | índices v16 + API 409 | AC |
| PROP-05 | Números | Área nula/zero/positiva; coordenadas em par e limites | integração S13 | AC |
| PROP-06 | PATCH | Parcial preserva omitidos; vazio/estado final inválido falha | integração S13 | AC |
| PROP-07 | Cliente | Cliente ausente/excluído não autoriza criação/transferência | integração S13 | AC |
| PROP-08 | Busca | Nome, Matrícula, CAR e município; caixa/acento; `q` ≤ 200 | integração S13 | AC |
| PROP-09 | Paginação | 25 por página, total 27, ordenação determinística | 25 + 2 itens, sem lacuna | AC |
| PROP-10 | `/options` | `q`, cliente, `selectedId`, limite 1/50 e recusa 51 | integração S13 | AC |
| PROP-11 | Cliente rápido | Preserva rascunho, seleciona cliente e retorna foco | E2E real | AC |
| PROP-12 | Entrada externa | Edita ID exato fora da página corrente | endpoint de detalhe + invalidação | AC |
| PROP-13 | Soft delete | Excluído some da lista/detalhe/opções e não bloqueia unicidade | integração S13 | AP |
| PROP-14 | Formulário | Erros associados, rascunho/retry, duplo envio e descarte | E2E dos modais | AC |
| DEP-01 | Projeto | vínculo ativo bloqueia exclusão e transferência; edição comum permitida | 409 específico | AC |
| DEP-02 | Orçamento | vínculo ativo bloqueia exclusão e transferência | 409 específico | AC |
| DEP-03 | Ambiental | vínculo ativo bloqueia exclusão e transferência | 409 específico | AC |
| DEP-04 | Perícia | vínculo ativo bloqueia exclusão e transferência | 409 específico | AC |
| MIG-01 | Runtime v16 | backfill, conflitos, índices, ledger, idempotência e `quick_check` | teste v16 | AC |
| MIG-02 | Runtime v7 | propriedade legada/reutilização de matrícula e referências | suíte de migrações/importação | AP |
| INT-01 | Auditoria | mutação e log de propriedade na mesma transação | `INSERT` e `DELETE (SOFT)` no teste | AP |
| INT-02 | Concorrência | duas criações iguais não geram duplicidade | respostas `[201,409]` | AC |
| INT-03 | Concorrência | duas edições do mesmo registro sem perda silenciosa | não há coluna de versão/ETag | BL |
| A11Y-01 | UI | reflow 390 px, temas, modais, foco, Axe A/AA | E2E 9/9 | AC |
| A11Y-02 | Assistiva | leitor de tela real | não operado neste ambiente | BL |
| ENV-01 | Desktop | offline/reconexão física, lock, reinício instalado, zoom 200% e alto contraste | campanha manual não disponível | BL |
| REG-01 | API global | regressão completa | 186/187; falha financeira herdada | BL |
| REG-02 | Release | build e manifesto | build passa; manifesto falha | BL |
| NA-01 | Catálogos | exclusão física/restauração | recurso não existe por contrato | NA |
| NA-02 | Propriedades | detalhe próprio, documentos, mapa, import/export | fora do produto/escopo atual | NA |

## Contagem final

| Situação | Quantidade |
|---|---:|
| APROVADO | 6 |
| APROVADO APÓS CORREÇÃO | 28 |
| REPROVADO | 0 |
| BLOQUEADO | 6 |
| NÃO APLICÁVEL | 2 |
| Total | 42 |

## Estados adicionais exercitados

- Cache válido, ausente, legado, corrompido e indisponível após sucesso do banco.
- Estado degradado com salvamento bloqueado; erro e retry sem perda de rascunho.
- Lista vazia/filtrada, ativos/inativos/todos, 390 px, claro/escuro e movimento reduzido do harness.
- IDs inexistentes/excluídos, PATCH vazio, query longa, limite 51 e cliente excluído.
- Conteúdo HTML/JavaScript tratado como texto por React; schemas estritos recusam campos extras.
