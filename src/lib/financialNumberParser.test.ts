import { describe, it, expect } from "vitest";
import { parseFinancialNumber } from "./financialNumberParser";

describe("parseFinancialNumber", () => {
  it("parses BR with R$ and thousands", () => {
    expect(parseFinancialNumber("R$ 12.500,00")).toBe(12500);
    expect(parseFinancialNumber("R$1.234.567,89")).toBeCloseTo(1234567.89);
  });
  it("parses US format", () => {
    expect(parseFinancialNumber("12,500.00")).toBe(12500);
    expect(parseFinancialNumber("$1,234,567.89")).toBeCloseTo(1234567.89);
  });
  it("parses bare integer", () => {
    expect(parseFinancialNumber("12500")).toBe(12500);
    expect(parseFinancialNumber(12500)).toBe(12500);
  });
  it("parses BR thousands without decimals", () => {
    expect(parseFinancialNumber("12.500")).toBe(12500);
    expect(parseFinancialNumber("1.234.567")).toBe(1234567);
  });
  it("keeps US decimal", () => {
    expect(parseFinancialNumber("1.5")).toBe(1.5);
    expect(parseFinancialNumber("12.5")).toBe(12.5);
  });
  it("handles BR small decimal", () => {
    expect(parseFinancialNumber("1,5")).toBe(1.5);
    expect(parseFinancialNumber("0,99")).toBe(0.99);
  });
  it("handles accounting negatives", () => {
    expect(parseFinancialNumber("(1.500,00)")).toBe(-1500);
    expect(parseFinancialNumber("-R$ 50,00")).toBe(-50);
  });
  it("handles NBSP and weird spaces", () => {
    expect(parseFinancialNumber("R$\u00a012.500,00")).toBe(12500);
    expect(parseFinancialNumber("12 500,00")).toBe(12500);
  });
  it("handles k/m suffixes", () => {
    expect(parseFinancialNumber("1.2k")).toBe(1200);
    expect(parseFinancialNumber("1,5m")).toBe(1_500_000);
  });
  it("returns null for invalid", () => {
    expect(parseFinancialNumber("")).toBeNull();
    expect(parseFinancialNumber("abc")).toBeNull();
    expect(parseFinancialNumber(null)).toBeNull();
    expect(parseFinancialNumber(undefined)).toBeNull();
  });
});
