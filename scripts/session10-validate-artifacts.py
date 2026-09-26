from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

import pypdfium2 as pdfium
from pypdf import PdfReader
from shapely.geometry import shape


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs" / "auditorias" / "2026-09-13-topografia" / "evidencias"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


checks: list[dict[str, object]] = []


def check(name: str, passed: bool, detail: object) -> None:
    checks.append({"check": name, "status": "APROVADO" if passed else "REPROVADO", "detail": detail})


csv_path = EVIDENCE / "ui-amostra.csv"
lines = csv_path.read_text(encoding="utf-8-sig").splitlines()
rows = list(csv.reader([line for line in lines if not line.startswith("#")], delimiter=";"))
check("CSV legível e quatro vértices", len(rows) == 5 and len(rows[0]) == 8, {"rows": len(rows), "columns": len(rows[0])})
check("CSV preserva metadados e neutraliza fórmula", rows[1][3] == "'=QA-V1" and "<b>inerte</b>" in rows[1][4], rows[1][3:])

geojson_path = EVIDENCE / "ui-amostra.geojson"
geojson = json.loads(geojson_path.read_text(encoding="utf-8"))
geometry = shape(geojson["geometry"])
ring = geojson["geometry"]["coordinates"][0]
vertex_meta = geojson["properties"]["vertices"][0]
check("GeoJSON válido, polígono fechado e não vazio", geometry.is_valid and not geometry.is_empty and ring[0] == ring[-1] and len(ring) == 5, {"valid": geometry.is_valid, "positions": len(ring), "area_degrees2": geometry.area})
check("GeoJSON preserva metadados", vertex_meta.get("code") == "=QA-V1" and vertex_meta.get("altitude") == -1.25, vertex_meta)

kml_path = EVIDENCE / "ui-amostra.kml"
kml_root = ET.parse(kml_path).getroot()
ns = {"k": "http://www.opengis.net/kml/2.2"}
kml_coordinates = kml_root.findtext(".//k:coordinates", namespaces=ns).split()
extended = {
    element.attrib["name"]: element.findtext("k:value", namespaces=ns)
    for element in kml_root.findall(".//k:ExtendedData/k:Data", ns)
}
kml_vertex_meta = json.loads(extended["vertexMetadata"])[0]
check("KML XML válido e anel fechado", len(kml_coordinates) == 5 and kml_coordinates[0] == kml_coordinates[-1], {"positions": len(kml_coordinates)})
check("KML preserva SRC e metadados escapados", extended.get("epsg") == "EPSG:4326" and extended.get("sourceEpsg") == "EPSG:31982" and kml_vertex_meta.get("description") == "Marco sintético Açores <b>inerte</b>", {"epsg": extended.get("epsg"), "sourceEpsg": extended.get("sourceEpsg"), "vertex": kml_vertex_meta})

dxf_path = EVIDENCE / "ui-amostra.dxf"
dxf = dxf_path.read_text(encoding="utf-8")
vertices = len(re.findall(r"\r?\nVERTEX\r?\n", dxf))
closed = bool(re.search(r"\r?\n70\r?\n1\r?\n", dxf))
check("DXF ASCII tem quatro VERTEX e flag fechada", vertices == 4 and closed, {"vertices": vertices, "closedFlag": closed})
check("DXF preserva SRC, código, descrição e altitude", "EPSG:31982" in dxf and "Codigo: =QA-V1" in dxf and "Descricao: Marco sintético Açores <b>inerte</b>" in dxf and bool(re.search(r"\r?\n30\r?\n-1\.25\r?\n", dxf)), {"sha256": sha256(dxf_path)})

pdf_path = EVIDENCE / "relatorio-topografia.pdf"
reader = PdfReader(pdf_path)
pdf_text = "\n\n--- PÁGINA ---\n\n".join((page.extract_text() or "") for page in reader.pages)
(EVIDENCE / "pdf-texto-extraido.txt").write_text(pdf_text, encoding="utf-8")
required_pdf_terms = ["Memória técnica", "EPSG:31982", "QA Automatizado", "=QA-V1", "Marco sintético Açores", "100 m²", "40 m"]
missing_pdf_terms = [term for term in required_pdf_terms if term not in pdf_text]
check("PDF abre e contém os dados técnicos", len(reader.pages) >= 1 and not missing_pdf_terms, {"pages": len(reader.pages), "missingTerms": missing_pdf_terms, "textCharacters": len(pdf_text)})

pdf = pdfium.PdfDocument(pdf_path)
rendered = []
for index in range(len(pdf)):
    output = EVIDENCE / f"pdf-pagina-{index + 1}.png"
    pdf[index].render(scale=2).to_pil().save(output)
    rendered.append({"page": index + 1, "file": output.name, "bytes": output.stat().st_size, "sha256": sha256(output)})
check("PDF renderiza todas as páginas", len(rendered) == len(reader.pages) and all(item["bytes"] > 0 for item in rendered), rendered)

files = {}
for path in sorted(EVIDENCE.glob("ui-amostra.*")) + [pdf_path]:
    files[path.name] = {"bytes": path.stat().st_size, "sha256": sha256(path)}

result = {
    "validator": {
        "python": "3.12",
        "pypdf": "6.0.0",
        "pypdfium2": "4.30.0",
        "shapely": "2.1.2",
    },
    "summary": {
        "total": len(checks),
        "approved": sum(item["status"] == "APROVADO" for item in checks),
        "failed": sum(item["status"] == "REPROVADO" for item in checks),
    },
    "checks": checks,
    "files": files,
}
(EVIDENCE / "validacao-arquivos-independente.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result["summary"], ensure_ascii=False))
if result["summary"]["failed"]:
    raise SystemExit(1)
