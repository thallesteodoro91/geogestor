"""Gera workbook sintético para testar escolha manual de cabeçalho."""

from pathlib import Path
from openpyxl import Workbook


target = Path(__file__).with_name("contato-cabecalho-ambiguo.xlsx")
book = Workbook()
sheet = book.active
sheet.title = "Contatos"
sheet.append(["Nome", None, "Email"])
sheet.append([
    "QA-IMPORT-20260923-2320-Contato XLSX Cabeçalho",
    "Coluna ignorada",
    "cabecalho.xlsx@example.test",
])
book.save(target)
print(target)
