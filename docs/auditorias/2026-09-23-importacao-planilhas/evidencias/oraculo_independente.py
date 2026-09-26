"""Oráculo financeiro independente para a fixture de migração sintética."""

import csv
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


source = Path(__file__).with_name("migracao-sintetica.csv")
with source.open(encoding="utf-8", newline="") as handle:
    rows = list(csv.DictReader(handle))
assert len(rows) == 1
row = rows[0]


def cents(value: str) -> int:
    return int((Decimal(value) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


unit_times_quantity = cents(row["Valor Unitário"]) * Decimal(row["Quantidade"])
expected = cents(row["Receita Esperada"])
tax = cents(row["Valor Imposto"])
total = cents(row["Receita Esperada + Imposto"])
billed = cents(row["Valor Faturado"])
expense = cents(row["Valor da Despesa"])
assert int(unit_times_quantity) == expected == 200_000
assert expected + tax == total == billed == 210_000
assert expense == 35_000

print(json.dumps({
    "file_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "source_rows": len(rows),
    "unit_times_quantity_cents": int(unit_times_quantity),
    "expected_revenue_cents": expected,
    "tax_cents": tax,
    "budget_total_cents": total,
    "billed_cents": billed,
    "expense_cents": expense,
    "historical_revenue_cents": cents(row["Receita"]),
    "historical_cost_cents": cents(row["Custo"]),
    "historical_expenses_cents": cents(row["Despesas"]),
    "historical_received_cents": cents(row["Receita Realizada"]),
}, ensure_ascii=False, sort_keys=True))
