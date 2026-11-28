"""Check closed technical frames and continuation titles in actual PDF vectors."""
import json
import sys
from pathlib import Path
from pypdf import PdfReader


def rgb(hex_color):
    return [int(hex_color[i:i+2], 16) / 255 for i in [1, 3, 5]]


def matches(a, b):
    return len(a) == 3 and all(abs(x - y) < .001 for x, y in zip(a, b))


def frames_and_lines(page):
    fill, stroke, weight = [0, 0, 0], [0, 0, 0], 1
    stack, rectangles, lines = [], [], []
    rectangle, start, end = None, None, None
    for args, op in page.get_contents().operations:
        if op == b'q':
            stack.append((fill[:], stroke[:], weight))
        elif op == b'Q':
            fill, stroke, weight = stack.pop()
        elif op in [b'scn', b'rg'] and len(args) == 3:
            fill = list(map(float, args))
        elif op in [b'SCN', b'RG'] and len(args) == 3:
            stroke = list(map(float, args))
        elif op == b'w':
            weight = float(args[0])
        elif op == b're':
            rectangle = list(map(float, args))
        elif op in [b'f', b'f*']:
            if rectangle and rectangle[2] > 500 and any(matches(fill, rgb(c)) for c in ['#f4f4f5', '#fafafa']):
                rectangles.append(rectangle)
            rectangle = None
        elif op == b'm':
            start = list(map(float, args))
        elif op == b'l':
            end = list(map(float, args))
        elif op == b'S':
            if start and end and matches(stroke, rgb('#a1a1aa')) and weight >= .5:
                lines.append((start, end))
            start, end = None, None

    fragments = []
    for x, y, w, h in sorted(rectangles, key=lambda rect: rect[1]):
        bounds = [x, y, x + w, y + h]
        if fragments and y <= fragments[-1][3] + 1:
            previous = fragments[-1]
            previous[0] = min(previous[0], bounds[0])
            previous[2] = max(previous[2], bounds[2])
            previous[3] = max(previous[3], bounds[3])
        else:
            fragments.append(bounds)
    return fragments, lines


def horizontal_rule(lines, left, right, y):
    return any(abs(a[1] - b[1]) < .01 and abs(a[1] - y) < 1
               and min(a[0], b[0]) <= left + 1 and max(a[0], b[0]) >= right - 1
               for a, b in lines)


def vertical_rules(lines, x, top, bottom):
    intervals = sorted((min(a[1], b[1]), max(a[1], b[1])) for a, b in lines
                       if abs(a[0] - b[0]) < .01 and abs(a[0] - x) < 1)
    covered = top
    for start, end in intervals:
        if start <= covered + 1:
            covered = max(covered, end)
    return covered >= bottom - 1


directory = Path(sys.argv[1])
reports = []
for file in sorted(directory.glob('*.pdf')):
    reader = PdfReader(file)
    fragments_checked = []
    for number, page in enumerate(reader.pages, start=1):
        fragments, lines = frames_and_lines(page)
        for left, top, right, bottom in fragments:
            assert 41 <= top < bottom <= float(page.mediabox.height) - 54, (file, number, top, bottom)
            assert horizontal_rule(lines, left, right, top), (file, number, 'open top')
            assert horizontal_rule(lines, left, right, bottom), (file, number, 'open bottom')
            assert vertical_rules(lines, left, top, bottom), (file, number, 'open left')
            assert vertical_rules(lines, right, top, bottom), (file, number, 'open right')
            fragments_checked.append({'page': number, 'top_pt': round(top, 2), 'bottom_pt': round(bottom, 2)})
    if file.stem == 'opcionais-vazios':
        assert not fragments_checked, file
    else:
        assert fragments_checked, file
    if file.stem == 'tecnica-extensa':
        text = '\n'.join(p.extract_text() or '' for p in reader.pages)
        for heading in ['DESCRIÇÃO DO ESCOPO', 'METODOLOGIA', 'ENTREGÁVEIS']:
            assert text.count(heading) >= 2, (file, 'Missing continuation title', heading)
    reports.append({'file': file.name, 'closed_frames': fragments_checked})

(directory / 'quebras-tecnicas.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(reports)} PDFs: quadros técnicos fechados nas quatro bordas; títulos de continuação preservados.')
