/**
 * @fileoverview Testes unitários para funções financeiras
 */

import { describe, it, expect } from 'vitest';
import {
  calcularMargem,
  calcularMargemBruta,
  calcularMargemLiquida,
  calcularLucroBruto,
  calcularLucroLiquido,
  calcularMargemContribuicao,
  calcularPontoEquilibrio,
  calcularMarkup,
  calcularTicketMedio,
  calcularTaxaConversao,
  calcularDesvioOrcamentario,
  calcularROI,
  calcularCustoPorHectare,
  calcularReceitaPorHectare,
  calcularVariacaoPercentual,
} from './finance';

describe('Cálculos Financeiros', () => {
  describe('calcularMargem', () => {
    it('deve calcular margem corretamente', () => {
      expect(calcularMargem(100, 1000)).toBe(10);
      expect(calcularMargem(250, 1000)).toBe(25);
    });

    it('deve retornar 0 quando receita for 0', () => {
      expect(calcularMargem(100, 0)).toBe(0);
    });
  });

  describe('calcularMargemBruta', () => {
    it('deve calcular margem bruta corretamente', () => {
      expect(calcularMargemBruta(1000, 600)).toBe(40);
    });
  });

  describe('calcularMargemLiquida', () => {
    it('deve calcular margem líquida corretamente', () => {
      expect(calcularMargemLiquida(1000, 500, 200)).toBe(30);
    });
  });

  describe('calcularLucroBruto', () => {
    it('deve calcular lucro bruto corretamente', () => {
      expect(calcularLucroBruto(1000, 600)).toBe(400);
    });
  });

  describe('calcularLucroLiquido', () => {
    it('deve calcular lucro líquido corretamente', () => {
      expect(calcularLucroLiquido(1000, 500, 200)).toBe(300);
    });
  });

  describe('calcularMargemContribuicao', () => {
    it('deve calcular margem de contribuição corretamente', () => {
      expect(calcularMargemContribuicao(1000, 400)).toBe(60);
    });
  });

  describe('calcularPontoEquilibrio', () => {
    it('deve calcular ponto de equilíbrio corretamente', () => {
      expect(calcularPontoEquilibrio(3000, 60)).toBe(5000);
    });

    it('deve retornar 0 quando margem for 0', () => {
      expect(calcularPontoEquilibrio(3000, 0)).toBe(0);
    });
  });

  describe('calcularMarkup', () => {
    it('deve calcular markup corretamente', () => {
      expect(calcularMarkup(100, 50)).toBe(150);
      expect(calcularMarkup(100, 100)).toBe(200);
    });
  });

  describe('calcularTicketMedio', () => {
    it('deve calcular ticket médio corretamente', () => {
      expect(calcularTicketMedio(10000, 5)).toBe(2000);
    });

    it('deve retornar 0 quando quantidade for 0', () => {
      expect(calcularTicketMedio(10000, 0)).toBe(0);
    });
  });

  describe('calcularTaxaConversao', () => {
    it('deve calcular taxa de conversão corretamente', () => {
      expect(calcularTaxaConversao(30, 100)).toBe(30);
      expect(calcularTaxaConversao(68, 100)).toBe(68);
    });

    it('deve retornar 0 quando total de orçamentos for 0', () => {
      expect(calcularTaxaConversao(10, 0)).toBe(0);
    });
  });

  describe('calcularDesvioOrcamentario', () => {
    it('deve calcular desvio orçamentário positivo', () => {
      expect(calcularDesvioOrcamentario(1000, 1100)).toBe(10);
    });

    it('deve calcular desvio orçamentário negativo', () => {
      expect(calcularDesvioOrcamentario(1000, 900)).toBe(-10);
    });

    it('deve retornar 0 quando orçado for 0', () => {
      expect(calcularDesvioOrcamentario(0, 1000)).toBe(0);
    });
  });

  describe('calcularROI', () => {
    it('deve calcular ROI corretamente', () => {
      expect(calcularROI(1500, 1000)).toBe(50);
    });

    it('deve retornar 0 quando investimento for 0', () => {
      expect(calcularROI(1000, 0)).toBe(0);
    });
  });

  describe('calcularCustoPorHectare', () => {
    it('deve calcular custo por hectare corretamente', () => {
      expect(calcularCustoPorHectare(10000, 50)).toBe(200);
    });

    it('deve retornar 0 quando área for 0', () => {
      expect(calcularCustoPorHectare(10000, 0)).toBe(0);
    });
  });

  describe('calcularReceitaPorHectare', () => {
    it('deve calcular receita por hectare corretamente', () => {
      expect(calcularReceitaPorHectare(20000, 50)).toBe(400);
    });

    it('deve retornar 0 quando área for 0', () => {
      expect(calcularReceitaPorHectare(20000, 0)).toBe(0);
    });
  });

  describe('calcularVariacaoPercentual', () => {
    it('deve calcular variação positiva', () => {
      expect(calcularVariacaoPercentual(110, 100)).toBe(10);
    });

    it('deve calcular variação negativa', () => {
      expect(calcularVariacaoPercentual(90, 100)).toBe(-10);
    });

    it('deve retornar 100 quando valor anterior for 0 e valor atual positivo', () => {
      expect(calcularVariacaoPercentual(100, 0)).toBe(100);
    });

    it('deve retornar 0 quando ambos valores forem 0', () => {
      expect(calcularVariacaoPercentual(0, 0)).toBe(0);
    });
  });
});
