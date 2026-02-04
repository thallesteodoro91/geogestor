

# Plano: Corrigir Importação CSV e Adicionar Colunas

## Problemas Identificados

### 1. Tela Preta ao Abrir CSV Import
O `CsvImportDialog` usa `z-[1000]` no `DialogContent`, mas o componente `DialogOverlay` padrão usa `z-[2000]` com fundo `bg-black/80`. Isso causa um conflito onde o overlay escuro fica sobre o conteúdo do dialog, resultando em uma "tela preta".

**Solução**: Remover o z-index customizado do CsvImportDialog, pois o componente Dialog já tem os z-indexes corretos configurados globalmente.

### 2. Colunas Faltantes para Clientes
Comparando a tabela `dim_cliente` no banco com as colunas disponíveis no CSV Import:

| Campo BD | Disponível no CSV Import | Ação |
|----------|-------------------------|------|
| nome | Sim | - |
| cpf | Sim | - |
| cnpj | Sim | - |
| endereco | Sim | - |
| telefone | Sim | - |
| celular | Sim | - |
| email | Sim | - |
| categoria | Sim | - |
| origem | Sim | - |
| situacao | Sim | - |
| **anotacoes** | **NÃO** | Adicionar |
| **data_cadastro** | **NÃO** | Adicionar |
| **idade** | **NÃO** | Adicionar |

### 3. Explicação das Colunas de Métricas
Adicionar descrições nas colunas para facilitar o entendimento do usuário. As colunas com métricas que precisam de explicação são aquelas relacionadas a valores financeiros e datas.

---

## Implementação

### Arquivo: `src/components/import/CsvImportDialog.tsx`

**Mudança 1**: Remover `z-[1000]` do DialogContent (linha 288)
```tsx
// DE:
<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col z-[1000]">

// PARA:
<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
```

**Mudança 2**: Adicionar novas colunas para clientes com descrições
```typescript
clientes: {
  tableName: "dim_cliente",
  displayName: "Clientes",
  columns: [
    { name: "nome", required: true, label: "Nome *", description: "Nome completo do cliente" },
    { name: "cpf", required: false, label: "CPF", description: "Cadastro de Pessoa Física (formato: 000.000.000-00)" },
    { name: "cnpj", required: false, label: "CNPJ", description: "Cadastro de Pessoa Jurídica (formato: 00.000.000/0000-00)" },
    { name: "endereco", required: false, label: "Endereço", description: "Endereço completo do cliente" },
    { name: "telefone", required: false, label: "Telefone", description: "Telefone fixo (formato: (00) 0000-0000)" },
    { name: "celular", required: false, label: "Celular", description: "Celular/WhatsApp (formato: (00) 00000-0000)" },
    { name: "email", required: false, label: "Email", description: "Email para contato" },
    { name: "categoria", required: false, label: "Categoria", description: "Tipo de cliente (Governo, Pessoa Física, Pessoa Jurídica)" },
    { name: "origem", required: false, label: "Origem", description: "Canal de prospecção (Indicação, Site, Evento, Rede Social)" },
    { name: "situacao", required: false, label: "Situação", description: "Status do relacionamento (Ativo, Inativo, Pendente)" },
    // NOVAS COLUNAS:
    { name: "anotacoes", required: false, label: "Observações", description: "Notas e anotações sobre o cliente" },
    { name: "data_cadastro", required: false, label: "Data de Cadastro", description: "Data de entrada do cliente (formato: AAAA-MM-DD)" },
    { name: "idade", required: false, label: "Idade", description: "Idade do cliente em anos" },
  ],
},
```

**Mudança 3**: Atualizar interface e UI para mostrar descrições
- Adicionar campo `description` na interface de colunas
- Mostrar ícone de informação com tooltip nas colunas que têm descrição
- Adicionar tratamento para campo `data_cadastro` (parse de data) e `idade` (número)

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/import/CsvImportDialog.tsx` | Corrigir z-index, adicionar colunas e descrições |

## Fluxo Visual

```text
┌──────────────────────────────────────────────────────────────┐
│  ANTES: Dialog com z-[1000] → Overlay z-[2000] sobrepõe     │
│                                                              │
│  ████████████████████  ← Overlay escuro (z-2000)            │
│  ┌─────────────────┐                                        │
│  │   Conteúdo     │  ← Dialog (z-1000) - ATRÁS do overlay  │
│  └─────────────────┘                                        │
├──────────────────────────────────────────────────────────────┤
│  DEPOIS: Dialog sem z-index customizado → Usa padrão        │
│                                                              │
│  ████████████████████  ← Overlay escuro (z-2000)            │
│  ┌─────────────────┐                                        │
│  │   Conteúdo     │  ← Dialog (z-2001) - NA FRENTE         │
│  └─────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

## Novas Colunas com Descrições

```text
┌─────────────────────────────────────────────────────────────────┐
│  Colunas esperadas para Clientes                                │
│                                                                 │
│  [Nome *] [CPF ℹ️] [CNPJ ℹ️] [Endereço] [Telefone ℹ️]          │
│  [Celular ℹ️] [Email] [Categoria ℹ️] [Origem ℹ️] [Situação ℹ️] │
│  [Observações ℹ️] [Data de Cadastro ℹ️] [Idade ℹ️]  ← NOVAS    │
│                                                                 │
│  ℹ️ = Tooltip com descrição do campo                           │
└─────────────────────────────────────────────────────────────────┘
```

