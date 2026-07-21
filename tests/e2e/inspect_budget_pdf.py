import json
import sys
from pathlib import Path

import pypdfium2 as pdfium
from pypdf import PdfReader


def inspect(pdf_path: Path, output_directory: Path) -> None:
    output_directory.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(pdf_path))
    page_texts = [(page.extract_text() or "") for page in reader.pages]
    full_text = "\n".join(page_texts)
    page_count = len(reader.pages)

    assert page_count >= 4, f"O PDF extenso deveria ocupar ao menos 4 páginas; gerou {page_count}."
    for index, page in enumerate(reader.pages, start=1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        assert abs(width - 595.28) < 2 and abs(height - 841.89) < 2, (
            f"Página {index} não está em A4: {width:.2f} x {height:.2f}."
        )
        assert page_texts[index - 1].strip(), f"Página {index} ficou sem texto extraível."
        assert f"página {index} de {page_count}" in page_texts[index - 1], (
            f"Rodapé ausente ou incorreto na página {index}."
        )

    for required in (
        "SkyGeo Topografia e Cartografia",
        "01 — Etapa técnica",
        "34 — Etapa técnica",
        "Encerramento metodológico.",
        "Pacote final assinado digitalmente.",
        "Fim dos termos comerciais.",
    ):
        assert required in full_text, f"Conteúdo obrigatório ausente: {required}"

    for forbidden in (
        "CONTEUDO_INTERNO_NAO_DEVE_APARECER",
        "CUSTO_INTERNO_NAO_DEVE_APARECER",
    ):
        assert forbidden not in full_text, f"Conteúdo interno vazou para o PDF: {forbidden}"

    rendered_pdf = pdfium.PdfDocument(str(pdf_path))
    rendered_pages = []
    for index in range(len(rendered_pdf)):
        output_path = output_directory / f"page-{index + 1:02d}.png"
        rendered_pdf[index].render(scale=2.0).to_pil().save(output_path)
        rendered_pages.append(str(output_path.resolve()))

    report = {
        "pdf": str(pdf_path.resolve()),
        "pages": page_count,
        "a4": True,
        "footers": True,
        "required_content": True,
        "internal_content_hidden": True,
        "rendered_pages": rendered_pages,
    }
    (output_directory / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    inspect(Path(sys.argv[1]), Path(sys.argv[2]))
