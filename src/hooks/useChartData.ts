import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchMonthlyFinancialData, type MonthlyFinancialRow } from "@/modules/finance/services/kpi.service";

interface MonthlyData {
  month: string;
  receita: number;
  despesa: number;
}

interface MarginData {
  month: string;
  margemBruta: number;
  margemLiquida: number;
}

interface RevenueTrendData {
  month: string;
  receitaBruta: number;
  lucroLiquido: number;
  margemPercent: number;
}

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Hook compartilhado que busca dados mensais agregados via RPC.
 * Uma única query substitui as 6 queries anteriores (2 por hook x 3 hooks).
 */
function useMonthlyFinancialData(year?: number) {
  const targetYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['monthly-financial-data', targetYear],
    queryFn: () => fetchMonthlyFinancialData(targetYear),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useRevenueChartData(year?: number) {
  const { data: raw, ...rest } = useMonthlyFinancialData(year);

  const data = useMemo((): MonthlyData[] => {
    if (!raw) return monthNames.map(m => ({ month: m, receita: 0, despesa: 0 }));
    return raw.map((r: MonthlyFinancialRow) => ({
      month: monthNames[r.mes - 1],
      receita: r.receita,
      despesa: r.total_despesas,
    }));
  }, [raw]);

  return { ...rest, data };
}

export function useProfitMarginChartData(year?: number) {
  const { data: raw, ...rest } = useMonthlyFinancialData(year);

  const data = useMemo((): MarginData[] => {
    if (!raw) return monthNames.map(m => ({ month: m, margemBruta: 0, margemLiquida: 0 }));
    return raw.map((r: MonthlyFinancialRow) => {
      const receitaLiquida = r.receita - r.impostos;
      const lucroBruto = receitaLiquida - r.custos_variaveis;
      const lucroLiquido = lucroBruto - r.despesas_fixas;

      const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
      const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

      return {
        month: monthNames[r.mes - 1],
        margemBruta: Math.max(-100, Math.min(100, margemBruta)),
        margemLiquida: Math.max(-100, Math.min(100, margemLiquida)),
      };
    });
  }, [raw]);

  return { ...rest, data };
}

export function useRevenueTrendChartData(year?: number) {
  const { data: raw, ...rest } = useMonthlyFinancialData(year);

  const data = useMemo((): RevenueTrendData[] => {
    if (!raw) return monthNames.map(m => ({ month: m, receitaBruta: 0, lucroLiquido: 0, margemPercent: 0 }));
    return raw.map((r: MonthlyFinancialRow) => {
      const receitaBruta = r.receita;
      const receitaLiquida = receitaBruta - r.impostos;
      const lucroBruto = receitaLiquida - r.custos_variaveis;
      const lucroLiquido = lucroBruto - r.despesas_fixas;
      const margemPercent = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

      return {
        month: monthNames[r.mes - 1],
        receitaBruta,
        lucroLiquido,
        margemPercent: Math.round(margemPercent * 10) / 10,
      };
    });
  }, [raw]);

  return { ...rest, data };
}
