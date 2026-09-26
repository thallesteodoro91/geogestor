"""Gera somente a fixture XLSX sintética usada nesta auditoria."""

from pathlib import Path
import csv
from openpyxl import Workbook


target = Path(__file__).with_name("contato-sintetico.xlsx")
book = Workbook()
instructions = book.active
instructions.title = "Instruções"
instructions.append(["Exemplo sintético de importação"])

contacts = book.create_sheet("Contatos")
contacts.append(["Cadastro de contatos — teste sintético"])
contacts.append(["Nome", "Email"])
contacts.append(["QA-IMPORT-20260923-2320-Contato XLSX", "qa.xlsx@example.test"])

book.save(target)
print(target)

full_csv = Path(__file__).with_name("migracao-sintetica.csv")
headers = [
    "Cliente", "CNPJ", "Nome da Propriedade", "Cidade", "Área_ha", "Projeto",
    "Categoria do Projeto", "Situação do Serviço", "Data do Serviço (Início)",
    "Data do Serviço (Fim)", "Valor Unitário", "Quantidade", "Receita Esperada",
    "Valor Imposto", "Receita Esperada + Imposto", "Data_Orcamento",
    "Orçamento Convertido", "Valor Faturado", "Data do Faturamento",
    "Situação do Pagamento", "Forma de Pagamento", "Categoria de Gasto",
    "Valor da Despesa", "Data da Despesa", "Receita", "Custo", "Despesas",
    "Receita Realizada",
]
values = [
    "QA-IMPORT-20260923-2320-Cliente Migração", "45.723.174/0001-10",
    "QA-IMPORT-20260923-2320-Propriedade", "Florianópolis", "12,5",
    "QA-IMPORT-20260923-2320-Projeto", "Topografia", "Concluído",
    "2026-09-01", "2026-09-10", "1000", "2", "2000", "100", "2100",
    "2026-08-28", "Sim", "2100", "2026-09-11", "Faturado", "Pix",
    "Deslocamento", "350", "2026-09-05", "2000", "1200", "350", "0",
]
with full_csv.open("w", newline="", encoding="utf-8") as handle:
    writer = csv.writer(handle, lineterminator="\n")
    writer.writerow(headers)
    writer.writerow(values)
print(full_csv)
