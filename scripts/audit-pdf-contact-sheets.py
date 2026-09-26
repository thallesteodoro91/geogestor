from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def main() -> None:
    evidence_root = Path(sys.argv[1]).resolve()
    render_root = evidence_root / "renderizados"
    output_root = evidence_root / "folhas-de-contato"
    output_root.mkdir(parents=True, exist_ok=True)

    for document_directory in sorted(path for path in render_root.iterdir() if path.is_dir()):
        pages = sorted(document_directory.glob("page-*.png"))
        if not pages:
            continue
        for batch_index in range(math.ceil(len(pages) / 4)):
            batch = pages[batch_index * 4:(batch_index + 1) * 4]
            canvas = Image.new("RGB", (1240, 1760), "#d4d4d8")
            draw = ImageDraw.Draw(canvas)
            for slot, page_path in enumerate(batch):
                page = Image.open(page_path).convert("RGB")
                page.thumbnail((590, 820))
                x = 20 + (slot % 2) * 610
                y = 60 + (slot // 2) * 850
                canvas.paste(page, (x, y))
                draw.text((x, y - 28), f"{document_directory.name} — {page_path.stem}", fill="#18181b")
            output_path = output_root / f"{document_directory.name}-folha-{batch_index + 1:02d}.png"
            canvas.save(output_path)
            print(output_path)


if __name__ == "__main__":
    main()
