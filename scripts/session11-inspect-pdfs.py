from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs" / "auditorias" / "2026-09-17-relatorios" / "evidencias"
RENDERS = EVIDENCE / "pdf-renders"
PDFS = sorted(EVIDENCE.glob("geogestor-*-2026-09-18-2026-09-18.pdf"))


def inspect(pdf: Path) -> dict[str, object]:
    payload = pdf.read_bytes()
    reader = PdfReader(pdf)
    pages = []
    extracted = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        extracted.append(text)
        pages.append({"page": index, "textCharacters": len(text), "hasText": bool(text.strip())})

    text_path = EVIDENCE / f"{pdf.stem}.txt"
    text_path.write_text("\n\n--- PAGE BREAK ---\n\n".join(extracted), encoding="utf-8")

    render_prefix = RENDERS / pdf.stem
    for stale_render in RENDERS.glob(f"{pdf.stem}-*.png"):
        stale_render.unlink()
    subprocess.run(
        ["pdftoppm", "-png", "-r", "110", str(pdf), str(render_prefix)],
        check=True,
        capture_output=True,
        text=True,
    )
    render_files = sorted(RENDERS.glob(f"{pdf.stem}-*.png"))
    all_text = "\n".join(extracted)
    return {
        "file": pdf.name,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "pages": len(reader.pages),
        "pageChecks": pages,
        "renderFiles": [item.relative_to(EVIDENCE).as_posix() for item in render_files],
        "checks": {
            "pdfHeader": payload.startswith(b"%PDF-"),
            "companyIdentity": "Empresa QA GeoGestor" in all_text and "qa@geogestor.test" in all_text,
            "period": "18/09/2026" in all_text or "2026-09-18" in all_text,
            "criteria": "Critérios e metodologia" in all_text,
            "htmlLikeInputIsInertText": "onerror=alert(1)" in all_text if "financeiro" not in pdf.name else True,
        },
    }


def main() -> None:
    if len(PDFS) != 3:
        raise SystemExit(f"Esperados 3 PDFs recentes, encontrados {len(PDFS)}")
    RENDERS.mkdir(parents=True, exist_ok=True)
    results = [inspect(pdf) for pdf in PDFS]
    protocol = {
        "audit": "Sessão 11 — Relatórios",
        "source": "Playwright + Chromium, aplicação/API/SQLite isolados",
        "documents": results,
        "allChecksPassed": all(all(item["checks"].values()) for item in results),
    }
    (EVIDENCE / "protocolo-pdfs.json").write_text(
        json.dumps(protocol, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(protocol, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
