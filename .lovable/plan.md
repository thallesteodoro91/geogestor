

## Plano: Garantir que Orçamentos Sempre Tenham Cliente

### Diagnóstico

Existem 4 pontos de criação de orçamentos, com tratamentos inconsistentes:

1. **`OrcamentoDialog`** — Já valida cliente obrigatório (linha 317)
2. **`OrcamentoWizard`** — Já exige cliente no primeiro passo
3. **`Orcamentos.tsx` (formulário inline)** — Permite `id_cliente: null` (linha 113). Schema Zod marca cliente como `optional().nullable()`
4. **`CompromissoDialog`** — Valida `id_cliente` no submit, mas permite enviar
5. **`orcamento.service.ts` (`createOrcamento`)** — Aceita `id_cliente` opcional no tipo
6. **SmartImporter** — Já cria clientes automaticamente durante importação

### Mudanças

#### 1. Tornar cliente obrigatório no schema Zod

**`src/lib/validations.ts`** — Alterar `id_cliente` de `optional().nullable()` para obrigatório com mensagem clara: "Selecione um cliente para o orçamento"

#### 2. Corrigir `Orcamentos.tsx` (formulário inline)

- Na mutation, rejeitar se `id_cliente` estiver vazio antes de enviar
- No formulário, mostrar alerta quando não houver clientes cadastrados: "Cadastre um cliente antes de criar orçamentos" com botão "Criar cliente" que abre `ClienteDialog`
- Adicionar `ClienteDialog` como componente disponível na página

#### 3. Corrigir `orcamento.service.ts`

- Tornar `id_cliente` obrigatório no tipo `Orcamento` (remover `?` e `null`)

#### 4. Corrigir `CompromissoDialog`

- Já valida, mas melhorar a mensagem de erro para "Selecione um cliente para criar o orçamento"

#### 5. Adicionar NOT NULL no banco

- Migration: `ALTER TABLE fato_orcamento ALTER COLUMN id_cliente SET NOT NULL` — mas primeiro verificar se existem orçamentos sem cliente

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/lib/validations.ts` |
| Editar | `src/pages/Orcamentos.tsx` |
| Editar | `src/modules/finance/services/orcamento.service.ts` |
| Editar | `src/components/calendario/CompromissoDialog.tsx` |
| Migration | `ALTER TABLE fato_orcamento ALTER COLUMN id_cliente SET NOT NULL` (após limpar dados órfãos) |

