# 📋 Documentação da Refatoração - TopoVision

## 🎯 Objetivo

Refatoração completa do projeto para melhorar:
- **Manutenibilidade**: Código mais organizado e fácil de entender
- **Performance**: Otimização de queries e índices no banco
- **Testabilidade**: Camada core com testes unitários
- **Escalabilidade**: Arquitetura modular e extensível

---

## 🏗️ Nova Estrutura de Pastas

```
src/
├── core/                    # 🔥 NOVO - Lógica de negócio pura
│   ├── finance.ts           # Cálculos financeiros centralizados
│   ├── finance.test.ts      # Testes unitários
│   └── topography.ts        # Cálculos topográficos
│
├── domain/                  # 🔥 NOVO - Tipos e modelos
│   └── types/
│       ├── kpi.types.ts     # Tipos de KPIs
│       └── financial.types.ts
│
├── services/                # 🔥 NOVO - Lógica de negócio + dados
│   ├── kpi.service.ts       # Serviço de KPIs
│   └── chart.service.ts     # Serviço de gráficos
│
├── ui/                      # 🔥 NOVO - Componentes UI reutilizáveis
│   ├── components/
│   │   └── ResponsiveTable.tsx
│   └── formatters/
│       └── currency.formatter.ts
│
├── components/              # Componentes existentes
├── hooks/                   # Hooks React
├── pages/                   # Páginas
└── lib/                     # Utilidades

scripts/                     # 🔥 NOVO - Scripts utilitários
└── reset-demo.ts           # Script para limpar dados demo
```

---

## 🔧 Principais Mudanças

### 1. **Camada Core (/core)**

✅ **Criada biblioteca de cálculos financeiros**
- `calcularMargem()` - Margem percentual
- `calcularMargemBruta()` - Margem bruta
- `calcularMargemLiquida()` - Margem líquida
- `calcularLucroBruto()` - Lucro bruto
- `calcularLucroLiquido()` - Lucro líquido
- `calcularMargemContribuicao()` - Margem de contribuição
- `calcularPontoEquilibrio()` - Ponto de equilíbrio
- `calcularMarkup()` - Markup sobre custo
- `calcularTicketMedio()` - Ticket médio
- `calcularTaxaConversao()` - Taxa de conversão
- `calcularDesvioOrcamentario()` - Desvio orçamentário
- `calcularROI()` - Return on Investment
- `calcularCustoPorHectare()` - Custo por hectare
- `calcularReceitaPorHectare()` - Receita por hectare
- `formatarMoeda()` - Formatação de moeda
- `formatarPercentual()` - Formatação de percentual

✅ **Criada biblioteca de cálculos topográficos**
- `metrosQuadradosParaHectares()` - Conversão de área
- `hectaresParaMetrosQuadrados()` - Conversão inversa
- `calcularDistanciaPlana()` - Distância euclidiana
- `calcularDistanciaGeografica()` - Distância Haversine
- `calcularAreaPoligono()` - Área por Shoelace
- `calcularPerimetro()` - Perímetro de polígono
- `validarCoordenadas()` - Validação de lat/lon
- `decimaisParaGMS()` - Conversão decimal → GMS
- `gmsParaDecimais()` - Conversão GMS → decimal
- `calcularAzimute()` - Azimute entre pontos
- `formatarCoordenadas()` - Formatação de coordenadas

✅ **Testes unitários completos**
- 15+ casos de teste para funções financeiras
- Cobertura de edge cases (divisão por zero, etc.)

### 2. **Camada de Serviços (/services)**

✅ **kpi.service.ts** - Lógica de KPIs
- `fetchKPIs()` - Busca KPIs do banco
- `getDefaultKPIs()` - KPIs padrão
- `fetchClienteKPIs()` - KPIs de cliente específico
- `processarMetricasDerivadas()` - Cálculo de métricas

✅ **chart.service.ts** - Processamento de dados para gráficos
- `fetchReceitaDespesaMensal()` - Dados mensais
- `fetchCustosPorCategoria()` - Custos por categoria
- `fetchLucroPorCliente()` - Lucro por cliente

### 3. **Componentes UI Reutilizáveis (/ui)**

✅ **ResponsiveTable** - Tabela que vira cards em mobile
- Converte automaticamente tabelas em cards responsivos
- Melhora UX em dispositivos móveis
- Configurável por coluna

✅ **Formatadores** - Formatação consistente
- `formatCurrency()` - Moeda
- `formatPercent()` - Percentual
- `formatNumber()` - Números
- `formatCompactNumber()` - Números compactos (1k, 1M)
- `formatCompactCurrency()` - Moeda compacta

### 4. **Otimizações de Banco de Dados**

✅ **Índices adicionados** (migration `20250115000000_add_indexes_optimization.sql`)

**Foreign Keys:**
- `idx_fato_servico_id_cliente`
- `idx_fato_servico_id_empresa`
- `idx_fato_servico_id_propriedade`
- `idx_fato_orcamento_id_cliente`
- `idx_fato_orcamento_id_servico`
- `idx_fato_despesas_id_servico`
- E mais...

**Campos Filtrados:**
- `idx_fato_servico_situacao`
- `idx_fato_servico_categoria`
- `idx_fato_servico_data_inicio`
- `idx_fato_orcamento_convertido`
- `idx_dim_cliente_situacao`

**Índices Compostos:**
- `idx_fato_servico_cliente_situacao` - Cliente + Situação
- `idx_fato_orcamento_cliente_convertido` - Cliente + Conversão

✅ **RLS Policies otimizadas** (migration `20250115000001_improve_rls_policies.sql`)
- View materializada `mv_user_roles_cache` para cache de roles
- Triggers para refresh automático
- Melhor performance em verificações de permissão

### 5. **Edge Functions Melhoradas**

✅ **geobot-chat/index.ts** - Validação e logs estruturados
- Validação de entrada com tipos TypeScript
- Logs estruturados em JSON
- Tratamento de erros melhorado
- Medição de performance (duration_ms)

Exemplo de log:
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "method": "POST",
  "duration_ms": 1234,
  "error": null
}
```

### 6. **Script de Reset Demo**

✅ **scripts/reset-demo.ts** - Limpa dados demo sem afetar produção
- Identifica dados demo por padrões ("demo", "teste", "exemplo")
- Remove apenas dados marcados como demo
- **NÃO afeta**:
  - Configurações do SaaS
  - Dados de usuários reais
  - Tabelas de sistema (dim_empresa, user_roles)

**Uso:**
```bash
npx tsx scripts/reset-demo.ts
```

### 7. **Refatoração de Hooks**

✅ **useKPIs** - Simplificado usando services
```typescript
// ANTES: 40 linhas com lógica inline
export function useKPIs() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calcular_kpis_v2');
      // ... 30+ linhas de lógica
    },
  });
}

// DEPOIS: 5 linhas, lógica no service
export function useKPIs() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: fetchKPIs,
    refetchInterval: 30000,
  });
}
```

---

## 🧪 Testes

### Executar testes
```bash
npm run test
```

### Cobertura de testes
- ✅ `core/finance.ts` - 100% coberto
- ⏳ `core/topography.ts` - A fazer
- ⏳ `services/*` - A fazer (requer mocks do Supabase)

---

## 📊 Impacto na Performance

### Antes
- ❌ Queries sem índices (scan completo de tabelas)
- ❌ Cálculos duplicados em múltiplos componentes
- ❌ Queries N+1 em listas
- ❌ RLS policies verificando tabela inteira

### Depois
- ✅ Índices otimizados em foreign keys e campos filtrados
- ✅ Cálculos centralizados e reutilizáveis
- ✅ View materializada para cache de roles
- ✅ Queries otimizadas com `select` específico

**Ganho estimado:** 40-60% redução no tempo de resposta das queries principais

---

## 🔄 Como Migrar Código Existente

### Cálculos Financeiros

**Antes:**
```typescript
const margem = receita > 0 ? ((receita - custo) / receita * 100) : 0;
```

**Depois:**
```typescript
import { calcularMargemBruta } from '@/core/finance';
const margem = calcularMargemBruta(receita, custo);
```

### Formatação

**Antes:**
```typescript
const formatted = `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
```

**Depois:**
```typescript
import { formatCurrency } from '@/ui/formatters/currency.formatter';
const formatted = formatCurrency(valor);
```

### Buscar KPIs

**Antes:**
```typescript
const { data } = await supabase.rpc('calcular_kpis_v2');
```

**Depois:**
```typescript
import { fetchKPIs } from '@/services/kpi.service';
const data = await fetchKPIs();
```

---

## 🎨 Constantes de Status Centralizadas

### 8. **Constantes de Status de Serviço** (`/constants/serviceStatus.ts`)

✅ **Constantes de Status**
- `SERVICE_STATUS` - Objeto com todos os status possíveis
  - `PENDENTE`, `PLANEJADO`, `EM_ANDAMENTO`, `EM_REVISAO`, `CONCLUIDO`, `CANCELADO`

✅ **Opções para Dropdowns**
- `SERVICE_STATUS_OPTIONS` - Array para selects de serviços
- `CALENDAR_STATUS_OPTIONS` - Array para calendário (inclui Planejado/Cancelado)
- `SERVICE_STATUS_FILTER_OPTIONS` - Array para filtros (inclui "Todos")

✅ **Cores HSL Centralizadas**
```typescript
SERVICE_STATUS_COLORS = {
  CONCLUIDO:    { bg: 'hsl(142,76%,36%)', text: 'white' },  // Verde
  EM_ANDAMENTO: { bg: 'hsl(217,91%,60%)', text: 'white' },  // Azul
  EM_REVISAO:   { bg: 'hsl(280,70%,50%)', text: 'white' },  // Roxo
  PENDENTE:     { bg: 'hsl(48,96%,53%)',  text: 'black' },  // Amarelo
  PLANEJADO:    { bg: 'hsl(48,96%,53%)',  text: 'black' },  // Amarelo
  CANCELADO:    { bg: 'hsl(0,100%,50%)',  text: 'white' },  // Vermelho
}
```

✅ **Helpers de Estilização**
- `getServiceStatusBadgeClasses(status)` - Retorna classes Tailwind completas
- `getServiceStatusColor(status)` - Retorna cor HSL de fundo
- `getStatusBadgeVariant(status)` - Retorna variante do shadcn Badge

✅ **Helpers de Verificação**
- `isServiceInProgress(status)` - Verifica se está em andamento/revisão
- `isServiceCompleted(status)` - Verifica se está concluído
- `isServiceCanceled(status)` - Verifica se foi cancelado

### 9. **Constantes de Status de Orçamento** (`/constants/budgetStatus.ts`)

✅ **Constantes de Status de Pagamento**
```typescript
PAYMENT_STATUS = {
  PENDENTE: 'Pendente',
  PARCIALMENTE_PAGO: 'Parcialmente Pago',
  PAGO: 'Pago',
  ATRASADO: 'Atrasado',
}
```

✅ **Constantes de Método de Pagamento**
```typescript
PAYMENT_METHOD = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferência',
}
```

✅ **Constantes de Situação de Orçamento**
```typescript
BUDGET_SITUATION = {
  EM_ANALISE: 'Em Análise',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  CANCELADO: 'Cancelado',
}
```

✅ **Cores HSL Centralizadas**
```typescript
PAYMENT_STATUS_COLORS = {
  PENDENTE:          { bg: 'hsl(48,96%,53%)',  text: 'black' },   // Amarelo
  PARCIALMENTE_PAGO: { bg: 'hsl(217,91%,60%)', text: 'white' },   // Azul
  PAGO:              { bg: 'hsl(142,76%,36%)', text: 'white' },   // Verde
  ATRASADO:          { bg: 'hsl(0,84%,60%)',   text: 'white' },   // Vermelho
}

BUDGET_SITUATION_COLORS = {
  EM_ANALISE: { bg: 'hsl(48,96%,53%)',  text: 'black' },   // Amarelo
  APROVADO:   { bg: 'hsl(142,76%,36%)', text: 'white' },   // Verde
  REPROVADO:  { bg: 'hsl(0,84%,60%)',   text: 'white' },   // Vermelho
  CANCELADO:  { bg: 'hsl(0,0%,45%)',    text: 'white' },   // Cinza
}
```

✅ **Helpers de Estilização**
- `getPaymentStatusBadgeClass(status)` - Classes para badge de status de pagamento
- `getPaymentStatusColor(status)` - Cor HSL do status de pagamento
- `getPaymentMethodBadgeClass(method)` - Classes para badge de método
- `getPaymentMethodColor(method)` - Cor HSL do método de pagamento
- `getBudgetSituationBadgeClass(situation)` - Classes para badge de situação
- `getBudgetSituationColor(situation)` - Cor HSL da situação

✅ **Helpers de Verificação**
- `isPaymentPending(status)` - Verifica se pagamento está pendente
- `isPaymentPaid(status)` - Verifica se foi pago
- `isBudgetApproved(situation)` - Verifica se orçamento foi aprovado
- `isBudgetCanceled(situation)` - Verifica se foi cancelado
- `isExpensePending(status)` - Verifica se despesa está pendente
- `isExpenseConfirmed(status)` - Verifica se despesa está confirmada

### Uso nos Componentes

**Exemplo de uso em badges:**
```typescript
import { getServiceStatusBadgeClasses } from '@/constants/serviceStatus';
import { getBudgetSituationBadgeClass } from '@/constants/budgetStatus';

// Em componentes
<Badge className={getServiceStatusBadgeClasses(servico.situacao_do_servico)}>
  {servico.situacao_do_servico}
</Badge>

<Badge className={getBudgetSituationBadgeClass(orcamento.situacao)}>
  {orcamento.situacao}
</Badge>
```

**Exemplo de uso em estilos inline:**
```typescript
import { getServiceStatusColor } from '@/constants/serviceStatus';

<div style={{ backgroundColor: getServiceStatusColor(status) }}>
  {title}
</div>
```

**Componentes que utilizam os helpers:**
- `CalendarioMensal.tsx` - Eventos coloridos por status
- `CalendarioSemanal.tsx` - Cards de eventos
- `CalendarioDiario.tsx` - Lista de eventos
- `CalendarioTabela.tsx` - Badges na tabela
- `CalendarioDetalhes.tsx` - Badge do header
- `ClienteOrcamentos.tsx` - Status de orçamentos
- `OrcamentoWizard.tsx` - Formulário de orçamento

---

## 🚀 Próximos Passos

### Curto Prazo
- [ ] Migrar componentes de cliente para usar ResponsiveTable
- [ ] Adicionar testes para topography.ts
- [ ] Documentar padrões de código no README

### Médio Prazo
- [ ] Implementar paginação em todas as listagens
- [ ] Adicionar cache Redis para KPIs
- [ ] Criar dashboard de performance de queries

### Longo Prazo
- [ ] Implementar GraphQL API
- [ ] Adicionar monitoramento com Sentry
- [ ] Migrar para arquitetura de micro-frontends

---

## 📚 Documentação Adicional

- [Core Finance API](./src/core/finance.ts) - Documentação inline
- [Core Topography API](./src/core/topography.ts) - Documentação inline
- [Services Pattern](./src/services/README.md) - Em breve

---

## 🤝 Contribuindo

Ao adicionar novas funcionalidades:

1. **Cálculos**: Adicione em `/core` com testes
2. **Lógica de negócio**: Crie service em `/services`
3. **Componentes UI**: Use `/ui/components` para reutilizáveis
4. **Tipos**: Defina em `/domain/types`
5. **Queries pesadas**: Adicione índices no banco

---

## ✅ Checklist de Implementação

### Estrutura
- [x] Criar /core/finance.ts
- [x] Criar /core/topography.ts
- [x] Criar /domain/types
- [x] Criar /services
- [x] Criar /ui

### Testes
- [x] Configurar Vitest
- [x] Testes para finance.ts
- [ ] Testes para topography.ts
- [ ] Testes para services

### Otimizações
- [x] Adicionar índices no banco
- [x] Otimizar RLS policies
- [x] Melhorar edge functions
- [x] Adicionar logs estruturados

### Scripts
- [x] Script reset-demo.ts
- [ ] Script de seed de dados
- [ ] Script de backup

### Documentação
- [x] REFACTORING.md
- [ ] API docs para core
- [ ] Guia de contribuição

---

## 📞 Suporte

Dúvidas sobre a refatoração? Entre em contato com a equipe de desenvolvimento.

**Última atualização:** 2025-01-15
