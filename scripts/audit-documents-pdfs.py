from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

import pypdfium2 as pdfium
from pypdf import PdfReader


FORBIDDEN_MARKERS = (
    "CONTEUDO_INTERNO",
    "CONFIDENCIAL-QA",
    "CUSTO_INTERNO",
    "CONTA_INTERNA",
    "CONTA_FINANCEIRA",
    "SIGILO_INTERNO",
    "MARGEM_INTERNA",
    "MARKUP_INTERNO",
)

ACTIVE_PDF_TOKENS = (
    b"/JavaScript",
    b"/JS",
    b"/Launch",
    b"/EmbeddedFile",
    b"/OpenAction",
    b"/AcroForm",
)


def safe_key(relative: Path) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", relative.as_posix()).strip("_")


def inspect_pdf(pdf_path: Path, evidence_root: Path) -> dict[str, object]:
    relative = pdf_path.relative_to(evidence_root)
    key = safe_key(relative.with_suffix(""))
    payload = pdf_path.read_bytes()
    reader = PdfReader(str(pdf_path), strict=True)
    catalog = reader.trailer["/Root"]
    if hasattr(catalog, "get_object"):
        catalog = catalog.get_object()
    texts: list[str] = []
    dimensions: list[dict[str, object]] = []
    resources: list[dict[str, int]] = []

    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        texts.append(text)
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        dimensions.append({
            "page": index,
            "widthPt": round(width, 2),
            "heightPt": round(height, 2),
            "a4": abs(width - 595.28) < 2 and abs(height - 841.89) < 2,
            "textCharacters": len(text),
            "hasText": bool(text.strip()),
        })
        page_resources = page.get("/Resources") or {}
        if hasattr(page_resources, "get_object"):
            page_resources = page_resources.get_object()
        fonts = page_resources.get("/Font") if hasattr(page_resources, "get") else None
        xobjects = page_resources.get("/XObject") if hasattr(page_resources, "get") else None
        if hasattr(fonts, "get_object"):
            fonts = fonts.get_object()
        if hasattr(xobjects, "get_object"):
            xobjects = xobjects.get_object()
        resources.append({
            "page": index,
            "fonts": len(fonts or {}),
            "xObjects": len(xobjects or {}),
        })

    full_text = "\n\n--- PAGE BREAK ---\n\n".join(texts)
    metadata_text = json.dumps(
        {str(key): str(value) for key, value in (reader.metadata or {}).items()},
        ensure_ascii=False,
    )
    latin_payload = payload.decode("latin-1", errors="ignore")
    marker_results = {
        marker: {
            "text": marker in full_text,
            "rawBytes": marker in latin_payload,
            "metadata": marker in metadata_text,
        }
        for marker in FORBIDDEN_MARKERS
    }
    active_tokens = [token.decode("ascii") for token in ACTIVE_PDF_TOKENS if token in payload]

    text_directory = evidence_root / "pdf-texto"
    render_directory = evidence_root / "renderizados" / key
    text_directory.mkdir(parents=True, exist_ok=True)
    render_directory.mkdir(parents=True, exist_ok=True)
    text_path = text_directory / f"{key}.txt"
    text_path.write_text(full_text, encoding="utf-8")

    rendered = pdfium.PdfDocument(str(pdf_path))
    render_files: list[str] = []
    for page_index in range(len(rendered)):
        output_path = render_directory / f"page-{page_index + 1:02d}.png"
        rendered[page_index].render(scale=2.0).to_pil().save(output_path)
        render_files.append(output_path.relative_to(evidence_root).as_posix())

    is_draft = "rascunho" in relative.as_posix().lower()
    draft_watermark_pages = [
        index for index, text in enumerate(texts, start=1)
        if "RASCUNHO — NÃO ENVIAR" in text
    ]
    checks = {
        "pdfHeader": payload.startswith(b"%PDF-"),
        "hasPages": len(reader.pages) > 0,
        "allPagesA4": all(bool(page["a4"]) for page in dimensions),
        "allPagesHaveExtractableText": all(bool(page["hasText"]) for page in dimensions),
        "noForbiddenMarkers": not any(any(result.values()) for result in marker_results.values()),
        "noActiveContent": not active_tokens,
        "draftWatermark": (len(draft_watermark_pages) == len(reader.pages)) if is_draft else not draft_watermark_pages,
        "renderCountMatches": len(render_files) == len(reader.pages),
    }

    return {
        "file": relative.as_posix(),
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "pdfVersion": payload.splitlines()[0].decode("ascii", errors="replace"),
        "pages": len(reader.pages),
        "dimensions": dimensions,
        "resources": resources,
        "metadata": {str(key): str(value) for key, value in (reader.metadata or {}).items()},
        "accessibility": {
            "tagged": "/StructTreeRoot" in catalog,
            "language": str(catalog.get("/Lang")) if catalog.get("/Lang") else None,
            "title": str((reader.metadata or {}).get("/Title")) if (reader.metadata or {}).get("/Title") else None,
        },
        "activeTokens": active_tokens,
        "forbiddenMarkers": marker_results,
        "draftWatermarkPages": draft_watermark_pages,
        "textFile": text_path.relative_to(evidence_root).as_posix(),
        "renderFiles": render_files,
        "checks": checks,
        "passed": all(checks.values()),
    }


def main() -> None:
    evidence_root = Path(sys.argv[1]).resolve()
    pdfs = sorted(evidence_root.rglob("*.pdf"))
    if not pdfs:
        raise SystemExit("Nenhum PDF encontrado para inspeção.")
    documents = [inspect_pdf(pdf, evidence_root) for pdf in pdfs]
    result = {
        "tool": "pypdf + pypdfium2",
        "documents": documents,
        "pdfCount": len(documents),
        "pageCount": sum(int(document["pages"]) for document in documents),
        "allChecksPassed": all(bool(document["passed"]) for document in documents),
    }
    output = evidence_root / "protocolo-pdfs.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "pdfCount": result["pdfCount"],
        "pageCount": result["pageCount"],
        "allChecksPassed": result["allChecksPassed"],
        "files": [{"file": document["file"], "pages": document["pages"], "passed": document["passed"]} for document in documents],
    }, ensure_ascii=False, indent=2))
    if not result["allChecksPassed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
