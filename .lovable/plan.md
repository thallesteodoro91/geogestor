
# Plano: Simular 50 Clientes com Dados Completos

## Objetivo
Criar uma funcionalidade na página de Configurações que permite gerar 50 clientes fictícios com todos os campos preenchidos aleatoriamente, incluindo propriedades e orçamentos associados para popular os gráficos do sistema.

## Arquitetura da Solução

### 1. Novo Serviço: `src/services/demo-data-generator.service.ts`

Criar um serviço dedicado para geração de dados demo que inclui:

```typescript
// Dados aleatórios para cada campo
const NOMES = ["João Silva", "Maria Santos", "Pedro Oliveira", ...]; // 100+ nomes
const SOBRENOMES = ["Ferreira", "Almeida", "Costa", ...];
const CIDADES = ["São Paulo", "Curitiba", "Porto Alegre", ...];
const ORIGENS = ["Indicação", "Site", "Evento", "Rede Social", "Visita", "Cold Call"];
const CATEGORIAS = ["Produtor Rural", "Governo", "Empresa Privada", "Pessoa Física"];
const SITUACOES = ["Ativo", "Inativo", "Pendente", "Prospecto"];
```

**Funções principais:**
- `generateRandomCPF()` - Gera CPF formatado válido
- `generateRandomCNPJ()` - Gera CNPJ formatado válido  
- `generateRandomPhone()` - Gera telefone no formato (XX) XXXXX-XXXX
- `generateRandomDate(startYear, endYear)` - Gera data aleatória
- `generateRandomCliente()` - Monta objeto cliente completo
- `generateDemoClientes(quantidade: number)` - Gera N clientes
- `insertDemoData(tenantId: string)` - Insere todos os dados de demo

### 2. Estrutura de Dados Gerados

Para cada cliente:
```typescript
{
  nome: "João da Silva Pereira",
  email: "joao.pereira@email.com",
  telefone: "(11) 3456-7890",
  celular: "(11) 98765-4321",
  cpf: "123.456.789-00" | null,
  cnpj: "12.345.678/0001-90" | null,
  endereco: "Rua das Flores, 123 - Centro",
  categoria: "Produtor Rural",
  situacao: "Ativo",
  origem: "Indicação",
  anotacoes: "Cliente demonstração - gerado automaticamente",
  data_cadastro: "2025-03-15",
  idade: 45
}
```

### 3. Dados Relacionados (para gráficos)

Para cada cliente, gerar também:

| Entidade | Quantidade | Propósito |
|----------|------------|-----------|
| Propriedade | 1-3 por cliente | Popular mapa e análises |
| Orçamento | 1-5 por cliente | Alimentar gráficos financeiros |
| Despesas | 2-8 por orçamento | Mostrar custos e margens |

**Propriedades:**
```typescript
{
  nome_da_propriedade: "Fazenda São José",
  area_ha: 150.5,
  cidade: "Londrina",
  municipio: "Londrina",
  situacao: "Ativo",
  latitude: -23.310453,
  longitude: -51.169449
}
```

**Orçamentos:**
```typescript
{
  data_orcamento: "2026-01-15",
  quantidade: 100,
  valor_unitario: 150.00,
  receita_esperada: 15000.00,
  percentual_imposto: 12,
  valor_imposto: 1800.00,
  situacao: "Aprovado" | "Em Análise" | "Fechado",
  faturamento: true | false
}
```

**Despesas:**
```typescript
{
  data_da_despesa: "2026-01-20",
  valor_da_despesa: 2500.00,
  status: "Pago" | "Pendente"
}
```

### 4. Atualização da Página de Configurações

Adicionar novo Card na página `/configuracoes`:

```text
┌─────────────────────────────────────────────────────────────┐
│ 🧪 Dados de Demonstração                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Gerar dados fictícios para testar o sistema e             │
│  visualizar os gráficos com informações realistas.         │
│                                                             │
│  ⚠️ Os dados gerados serão marcados como "demo" e podem    │
│     ser removidos posteriormente.                           │
│                                                             │
│  [Gerar 50 Clientes Demo]  [Remover Dados Demo]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5. Identificação de Dados Demo

Todos os dados demo terão:
- Campo `anotacoes` contendo "[DEMO]" no início
- Permite fácil identificação e remoção posterior

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/services/demo-data-generator.service.ts` | **Criar** - Lógica de geração |
| `src/pages/Configuracoes.tsx` | **Modificar** - Adicionar Card e botões |

## Fluxo de Execução

```text
1. Usuário clica "Gerar 50 Clientes Demo"
           │
           ▼
2. ConfirmDialog: "Isso criará 50 clientes fictícios..."
           │
           ▼
3. generateDemoData(tenantId) executa:
   a) Gera 50 clientes com dados aleatórios
   b) Para cada cliente, gera 1-3 propriedades
   c) Para cada cliente, gera 1-5 orçamentos (datas em 2025-2026)
   d) Para cada orçamento, gera 2-8 despesas
           │
           ▼
4. Insere tudo no banco em lotes (batch insert)
           │
           ▼
5. Invalida queries do React Query
           │
           ▼
6. Toast: "50 clientes demo criados com sucesso!"
```

## Detalhes Técnicos

### Distribuição de Datas
- Orçamentos distribuídos entre Jan/2025 e Fev/2026
- Maior concentração em 2026 para testar seletor de ano
- Despesas com datas próximas aos orçamentos

### Valores Financeiros
```text
Receita por orçamento: R$ 5.000 a R$ 50.000
Imposto: 8% a 15% da receita
Despesas: 30% a 60% da receita (para margem realista)
```

### Performance
- Inserção em lotes de 20 registros
- Progress indicator durante geração
- Estimativa: ~5 segundos para 50 clientes completos

---

## Benefícios

1. **Testes visuais**: Gráficos mostrarão dados realistas
2. **Demonstração**: Fácil apresentação do sistema
3. **Desenvolvimento**: Depuração de features com dados reais
4. **Reversível**: Dados podem ser removidos a qualquer momento
