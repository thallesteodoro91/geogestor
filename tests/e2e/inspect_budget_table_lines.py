"""Measure the header dividers in rendered PDF vectors, not source constants."""
import json
import sys
from pathlib import Path
from pypdf import PdfReader


def luminance(rgb):
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    return sum(v * w for v, w in zip(linear, [0.2126, 0.7152, 0.0722]))


def contrast(a, b):
    x, y = luminance(a), luminance(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


directory = Path(sys.argv[1])
reports = []
for file in sorted(directory.glob('*.pdf')):
    fixture = json.loads(file.with_suffix('.json').read_text(encoding='utf-8'))
    accent = fixture['company']['cor'].lstrip('#')
    background = [int(accent[i:i+2], 16) / 255 for i in [0, 2, 4]]
    ratios = []
    for page in PdfReader(file).pages:
        fill, stroke, width = [0, 0, 0], [0, 0, 0], 1
        stack, rectangles, lines = [], [], []
        rectangle, start, end = None, None, None
        for args, op in page.get_contents().operations:
            if op == b'q':
                stack.append((fill[:], stroke[:], width))
            elif op == b'Q':
                fill, stroke, width = stack.pop()
            elif op in [b'scn', b'rg'] and len(args) == 3:
                fill = list(map(float, args))
            elif op in [b'SCN', b'RG'] and len(args) == 3:
                stroke = list(map(float, args))
            elif op == b'w':
                width = float(args[0])
            elif op == b're':
                rectangle = list(map(float, args))
            elif op in [b'f', b'f*']:
                if rectangle and all(abs(a-b) < 0.001 for a, b in zip(fill, background)):
                    x, y, w, h = rectangle
                    if w >= 50 and 10 <= h <= 60:
                        rectangles.append(rectangle)
                rectangle = None
            elif op == b'm':
                start = list(map(float, args))
            elif op == b'l':
                end = list(map(float, args))
            elif op == b'S':
                if start and end:
                    lines.append((start, end, stroke[:], width))
                start, end = None, None
        for x, y, w, h in rectangles:
            for a, b, color, weight in lines:
                if abs(a[0]-b[0]) < 0.01 and x-1 <= a[0] <= x+w+1 and abs(a[1]-y) < 1 and abs(b[1]-(y+h)) < 1:
                    assert weight >= 0.5, (file, weight)
                    ratio = contrast(color, background)
                    assert ratio >= 4.5, (file, color, ratio)
                    ratios.append(ratio)
    assert ratios, (file, 'No header dividers found')
    reports.append({'file': file.name, 'header_dividers_measured': len(ratios), 'minimum_contrast': round(min(ratios), 3)})
(directory / 'contraste-linhas.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(reports)} PDFs: divisórias dos cabeçalhos com contraste mínimo de 4,5:1.')
