"""Gera apenas fixtures sintéticas de migração completa para a auditoria."""

import csv
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook


ROOT = Path(__file__).resolve().parent
with (ROOT / "migracao-sintetica.csv").open(encoding="utf-8", newline="") as source:
    reader = csv.DictReader(source)
    headers = list(reader.fieldnames or [])
    first = next(reader)

rows = []
for number, suffix in enumerate(("A", "B"), start=1):
    row = dict(first)
    row["Cliente"] = f"QA-IMPORT-20260924-Cliente Multilinha {suffix}"
    row["CNPJ"] = ""
    row["Nome da Propriedade"] = f"QA-IMPORT-20260924-Propriedade Multilinha {suffix}"
    row["Projeto"] = f"QA-IMPORT-20260924-Projeto Multilinha {suffix}"
    row["Valor Unitário"] = str(1000 + number * 100)
    row["Quantidade"] = "2"
    row["Receita Esperada"] = str(2000 + number * 200)
    row["Valor Imposto"] = str(100 + number * 10)
    row["Receita Esperada + Imposto"] = str(2100 + number * 210)
    row["Valor Faturado"] = row["Receita Esperada + Imposto"]
    row["Valor da Despesa"] = str(350 + number * 35)
    row["Receita"] = row["Receita Esperada"]
    row["Custo"] = str(1200 + number * 120)
    row["Despesas"] = row["Valor da Despesa"]
    rows.append(row)

with (ROOT / "migracao-multilinha.csv").open("w", encoding="utf-8", newline="") as target:
    writer = csv.DictWriter(target, fieldnames=headers)
    writer.writeheader()
    writer.writerow(rows[0])
    target.write("\r\n")
    writer.writerow(rows[1])

workbook = Workbook()
instructions = workbook.active
instructions.title = "Instruções"
instructions.append(["Fixture sintética de QA. Nenhum dado real."])
data = workbook.create_sheet("Dados")
data.append(headers)
for row in rows:
    row = {
        key: value.replace("Multilinha", "Multilinha XLSX") if key in {"Cliente", "Nome da Propriedade", "Projeto"} else value
        for key, value in row.items()
    }
    values = []
    for header in headers:
        value = row[header]
        if value == "":
            value = None
        if header in {"Valor Unitário", "Quantidade", "Receita Esperada", "Valor Imposto", "Receita Esperada + Imposto", "Valor Faturado", "Valor da Despesa", "Receita", "Custo", "Despesas", "Receita Realizada"}:
            value = int(value) if value is not None else None
        elif header in {"Data do Serviço (Início)", "Data do Serviço (Fim)", "Data_Orcamento", "Data do Faturamento", "Data da Despesa"}:
            value = datetime.fromisoformat(value) if value is not None else None
        values.append(value)
    data.append(values)
workbook.save(ROOT / "migracao-multilinha.xlsx")
