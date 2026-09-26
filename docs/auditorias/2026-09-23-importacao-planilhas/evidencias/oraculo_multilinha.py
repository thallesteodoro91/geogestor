"""Calcula centavos das fixtures sem usar o código financeiro do GeoGestor."""

import csv
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent


def cents(value):
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def totals(rows):
    assert len(rows) == 2
    for row in rows:
        assert cents(row["Valor Unitário"]) * Decimal(str(row["Quantidade"])) == cents(row["Receita Esperada"])
        assert cents(row["Receita Esperada"]) + cents(row["Valor Imposto"]) == cents(row["Receita Esperada + Imposto"])
    return {
        "source_rows": len(rows),
        "budget_cents": sum(cents(row["Receita Esperada + Imposto"]) for row in rows),
        "billing_cents": sum(cents(row["Valor Faturado"]) for row in rows),
        "expense_cents": sum(cents(row["Valor da Despesa"]) for row in rows),
        "historical_revenue_cents": sum(cents(row["Receita"]) for row in rows),
        "historical_cost_cents": sum(cents(row["Custo"]) for row in rows),
    }


csv_path = ROOT / "migracao-multilinha.csv"
with csv_path.open(encoding="utf-8", newline="") as source:
    csv_rows = [row for row in csv.DictReader(source) if any(str(value or "").strip() for value in row.values())]

xlsx_path = ROOT / "migracao-multilinha.xlsx"
workbook = load_workbook(xlsx_path, read_only=True, data_only=True)
sheet = workbook["Dados"]
cells = sheet.iter_rows(values_only=True)
headers = next(cells)
xlsx_rows = [dict(zip(headers, values)) for values in cells]
workbook.close()

for source_path, rows in ((csv_path, csv_rows), (xlsx_path, xlsx_rows)):
    print(json.dumps({
        "file": source_path.name,
        "sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        **totals(rows),
    }, ensure_ascii=False, sort_keys=True))
