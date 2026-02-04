

# Plano: Filtro de Data Dinâmico na Gestão Operacional

## Objetivo

Adicionar controle de filtro de data na página Gestão Operacional para que os KPIs (Tempo Médio de Conclusão, Produtividade, Ticket Médio) e gráficos reflitam dados do período selecionado pelo usuário.

## Situação Atual

A página `/operacional` atualmente:
- Usa **dados mock estáticos** (não conectados ao banco de dados)
- Possui filtros individuais por serviço em cada gráfico
- Tem um seletor de período apenas para o gráfico "Tempo Médio por Serviço"
- Os KPIs exibem valores fixos, sem relação com filtros de data

## Solução Proposta

### 1. Integrar o TimeGranularityControl

Reutilizar o componente `TimeGranularityControl` existente (já usado na página de Despesas) para permitir ao usuário selecionar:

- **Granularidade**: Mês, Trimestre ou Ano
- **Navegação**: Avançar/retroceder entre períodos
- **Reset**: Voltar ao período atual

```text
+--------------------------------------------------------+
|  Gestão Operacional                                    |
|  Análise de produtividade, tempo e eficiência          |
|                                                        |
|  [Mês] [Trimestre] [Ano]   < Fevereiro de 2026 >  ↺   |
+--------------------------------------------------------+
```

### 2. Conectar KPIs aos Dados Reais Filtrados

| KPI | Fonte de Dados | Cálculo Filtrado |
|-----|----------------|------------------|
| Tempo Médio Conclusão | `fato_servico` | `AVG(data_do_servico_fim - data_do_servico_inicio)` onde status = "Concluído" no período |
| Produtividade | `fato_servico` | `(Concluídos / Total) * 100` no período |
| Ticket Médio | `fato_servico` + `fato_orcamento` | `SUM(receita_servico) / COUNT(servicos)` no período |

### 3. Gráficos Filtrados por Período

| Gráfico | Dados Filtrados |
|---------|-----------------|
| Tempo Médio por Serviço | Serviços concluídos no período, agrupados por categoria |
| Status dos Serviços | Contagem de serviços por situação no período |
| Ticket Médio por Serviço | Receita média por categoria no período |
| Custo vs Receita | Custos e receitas de serviços no período |

### 4. Story Cards Dinâmicos

Os insights textuais serão gerados dinamicamente com base nos dados filtrados.

## Arquitetura

```text
                    ChartSettingsContext
                          │
                          ▼
     ┌────────────────────────────────────────┐
     │        TimeGranularityControl          │
     │  (granularity + periodOffset)          │
     └────────────────────────────────────────┘
                          │
                          ▼
     ┌────────────────────────────────────────┐
     │      useOperationalMetrics Hook        │
     │  - Calcula dateRange                   │
     │  - Busca fato_servico filtrado         │
     │  - Calcula KPIs e dados de gráficos    │
     └────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
      KPICards        Charts        StoryCards
```

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useOperationalMetrics.ts` | **Criar** - Hook para buscar e calcular métricas operacionais |
| `src/pages/Operacional.tsx` | **Modificar** - Integrar TimeGranularityControl e dados reais |

## Detalhes Técnicos

### Hook useOperationalMetrics

```typescript
// src/hooks/useOperationalMetrics.ts
export function useOperationalMetrics(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['operational-metrics', startDate, endDate],
    queryFn: async () => {
      // 1. Buscar serviços no período
      const { data: servicos } = await supabase
        .from('fato_servico')
        .select('*')
        .gte('data_do_servico_inicio', startDate)
        .lte('data_do_servico_inicio', endDate);

      // 2. Calcular métricas
      const concluidos = servicos.filter(s => s.situacao_do_servico === 'Concluído');
      const tempoMedioDias = calcularTempoMedio(concluidos);
      const produtividade = (concluidos.length / servicos.length) * 100;
      const ticketMedio = calcularTicketMedio(servicos);

      // 3. Agrupar para gráficos
      const tempoPorCategoria = agruparTempoPorCategoria(concluidos);
      const statusDistribuicao = contarPorStatus(servicos);
      const ticketPorCategoria = agruparTicketPorCategoria(servicos);

      return {
        kpis: { tempoMedioDias, produtividade, ticketMedio },
        charts: { tempoPorCategoria, statusDistribuicao, ticketPorCategoria },
        totals: { total: servicos.length, concluidos: concluidos.length }
      };
    }
  });
}
```

### Integração no Operacional.tsx

```typescript
// Adicionar imports
import { TimeGranularityControl } from "@/components/controls/TimeGranularityControl";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { useOperationalMetrics } from "@/hooks/useOperationalMetrics";

// Dentro do componente
const { granularity, periodOffset } = useChartSettings();

// Calcular range de datas (reutilizar lógica de Despesas.tsx)
const { dataInicio, dataFim } = getDateRangeByGranularity(granularity, periodOffset);

// Buscar dados filtrados
const { data: metrics, isLoading } = useOperationalMetrics(dataInicio, dataFim);

// Renderizar KPIs com dados reais
<KPICard
  title="Tempo Médio Conclusão"
  value={`${metrics?.kpis.tempoMedioDias || 0} dias`}
  icon={Clock}
/>
```

### Cálculo do Tempo Médio

```typescript
function calcularTempoMedio(servicosConcluidos: Servico[]): number {
  const servicosComDatas = servicosConcluidos.filter(
    s => s.data_do_servico_inicio && s.data_do_servico_fim
  );
  
  if (servicosComDatas.length === 0) return 0;
  
  const totalDias = servicosComDatas.reduce((sum, s) => {
    const inicio = new Date(s.data_do_servico_inicio!);
    const fim = new Date(s.data_do_servico_fim!);
    const dias = differenceInDays(fim, inicio);
    return sum + dias;
  }, 0);
  
  return Math.round(totalDias / servicosComDatas.length);
}
```

## Experiência do Usuário

1. O usuário acessa a página Gestão Operacional
2. Por padrão, vê dados do **mês atual**
3. Pode alternar para visualização trimestral ou anual
4. Navega entre períodos com as setas (ex: "Janeiro de 2026" → "Dezembro de 2025")
5. Todos os KPIs e gráficos atualizam automaticamente
6. Insights nos Story Cards refletem o período selecionado

## Manutenção da Coerência

- **Filtros individuais por serviço**: Mantidos nos gráficos para análise detalhada
- **Período global**: Aplicado a todos os componentes da página
- **Lógica de cálculo**: Centralizada no hook, evitando duplicação
- **Padrão visual**: Reutiliza o mesmo controle de outras páginas (Despesas)

