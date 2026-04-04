

## Plano: Evolucao do SmartImporter — Importacao de Nivel Premium

### Diagnostico do Estado Atual

O SmartImporter ja e robusto: mapeamento automatico com 3 niveis de confianca (exato, sinonimo, parcial), validacao por campo, sanitizacao automatica (CPF, CNPJ, telefone, moeda, datas), importacao parcial com skip de erros, download de linhas falhas, e auditoria automatica.

**Problemas identificados:**

1. **Acessibilidade limitada** — So acessivel via Configuracoes, escondido do fluxo natural do usuario
2. **Sem suporte a Servicos e Despesas** — Apenas Clientes, Propriedades e Orcamentos
3. **Sem deteccao automatica de entidade** — Usuario precisa escolher manualmente o que esta importando
4. **Preview limitado a 5 linhas** — Sem paginacao do preview
5. **Sem resumo pos-importacao acionavel** — Resultado mostra numeros mas nao guia proximo passo
6. **Sem vinculacao automatica** — Propriedades importadas nao se vinculam a clientes existentes por nome
7. **Sem deteccao de duplicatas** — Importa registros que ja existem
8. **Microcopy tecnica** — "Mapeamento", "Valor padrao", "Validar Agora" sao termos de dev
9. **Duas ferramentas de import coexistem** — CsvImportDialog e SmartImporter fazem coisas similares, confunde

### Melhorias Planejadas

---

#### 1. Importacao acessivel de cada modulo (alta prioridade)

Adicionar botao "Importar Planilha" direto nos empty states e headers de Clientes, Servicos, Orcamentos e Despesas. O usuario nao precisa ir ate Configuracoes.

**Arquivos a editar:**
- `src/pages/Clientes.tsx` — Botao no header e empty state
- `src/pages/Servicos.tsx` — Botao no header e empty state
- `src/pages/Despesas.tsx` — Botao no header e empty state
- `src/pages/ServicosOrcamentos.tsx` — Botao no header e empty state

---

#### 2. Suporte a Servicos e Despesas (alta prioridade)

Expandir o SmartImporter com 2 novas entidades: `servicos` e `despesas`. Cada uma com campos, sinonimos, validadores e batch insert proprios.

**Novos campos:**
- Servicos: nome_do_servico*, categoria, data_inicio, data_fim, situacao, receita, custo, descricao
- Despesas: valor_da_despesa*, data_da_despesa*, observacoes, status

**Novos sinonimos:**
- Servicos: "projeto"→nome, "status"→situacao, "valor"→receita
- Despesas: "gasto"→valor, "custo"→valor, "dt"→data

**Arquivos a editar:**
- `src/components/import/SmartImporter.tsx` — Adicionar SERVICO_FIELDS, DESPESA_FIELDS, sinonimos, batch handlers
- `src/modules/operations/services/servico.service.ts` — Adicionar `createServicosBatch`
- `src/modules/finance/services/despesa.service.ts` — Adicionar `createDespesasBatch`

---

#### 3. Deteccao automatica de entidade (media prioridade)

Ao fazer upload, analisar os headers do arquivo e sugerir qual entidade esta sendo importada (ex: se tem "CPF" e "telefone" → provavelmente Clientes).

Logica: pontuar cada entidade pelo numero de matches nos headers. Mostrar sugestao com opcao de trocar.

**Arquivo a editar:**
- `src/components/import/SmartImporter.tsx` — Nova funcao `detectEntityType` + UI de sugestao no step upload

---

#### 4. Deteccao de duplicatas (media prioridade)

Antes de importar, buscar registros existentes por nome (clientes) ou nome_do_servico (servicos) e alertar o usuario sobre possiveis duplicatas.

**Arquivo a editar:**
- `src/components/import/SmartImporter.tsx` — Nova etapa "dedup" entre preview e importing, com lista de possiveis duplicatas e opcao de pular

---

#### 5. Vinculacao automatica (media prioridade)

Ao importar Propriedades, se o arquivo tem coluna "Cliente", buscar por nome nos clientes existentes e vincular automaticamente via `id_cliente`. Mesma logica para Servicos e Orcamentos.

**Arquivo a editar:**
- `src/components/import/SmartImporter.tsx` — Logica de lookup por nome antes do insert

---

#### 6. Microcopy humanizada (alta prioridade)

Trocar termos tecnicos por linguagem acessivel:

| Antes | Depois |
|-------|--------|
| "Mapeamento" | "Associar Colunas" |
| "Valor padrao" | "Preencher automaticamente" |
| "Validar Agora" | "Verificar Dados" |
| "Preview" | "Conferir Dados" |
| "— Nao importar —" | "Ignorar esta coluna" |
| "Pular linhas com erro" | "Importar apenas as corretas" |

**Arquivo a editar:**
- `src/components/import/SmartImporter.tsx` — Substituicoes de texto

---

#### 7. Resumo pos-importacao acionavel (alta prioridade)

Apos importar, mostrar:
- Numero importado com sucesso
- CTA "Ver clientes importados" que leva ao modulo
- Se houve erros: "Baixar planilha corrigida" + "Importar novamente"
- Dica contextual: "Proximo passo: vincule propriedades aos seus clientes"

**Arquivo a editar:**
- `src/components/import/SmartImporter.tsx` — Refatorar step "result"

---

#### 8. Remover CsvImportDialog legado (baixa prioridade)

O SmartImporter ja cobre tudo que o CsvImportDialog faz, com melhor UX. Remover o legado para evitar confusao.

**Arquivos a editar:**
- `src/pages/Configuracoes.tsx` — Remover referencia ao CsvImportDialog
- `src/components/import/CsvImportDialog.tsx` — Deletar arquivo

---

### Resumo de Impacto

| Melhoria | Prioridade | Complexidade |
|----------|-----------|-------------|
| Botoes de import nos modulos | Alta | Baixa |
| Suporte Servicos + Despesas | Alta | Media |
| Microcopy humanizada | Alta | Baixa |
| Resumo pos-import acionavel | Alta | Baixa |
| Deteccao automatica entidade | Media | Baixa |
| Deteccao duplicatas | Media | Media |
| Vinculacao automatica | Media | Media |
| Remover CsvImportDialog | Baixa | Baixa |

### Arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `src/components/import/SmartImporter.tsx` |
| Editar | `src/pages/Clientes.tsx` |
| Editar | `src/pages/Servicos.tsx` |
| Editar | `src/pages/Despesas.tsx` |
| Editar | `src/pages/ServicosOrcamentos.tsx` |
| Editar | `src/pages/Configuracoes.tsx` |
| Editar | `src/modules/operations/services/servico.service.ts` |
| Editar | `src/modules/finance/services/despesa.service.ts` |
| Deletar | `src/components/import/CsvImportDialog.tsx` |

Nenhuma migracao de banco necessaria.

