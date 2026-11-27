import json
from pathlib import Path
import pdfplumber
import pypdfium2

output = Path(__file__).resolve().parents[2] / 'docs/auditorias/2026-10-12-relatorio-acompanhamento/evidencias'
findings = []
for file in sorted(output.glob('*.pdf')):
    with pdfplumber.open(file) as document:
        texts = [page.extract_text() or '' for page in document.pages]
        overflow = []
        orphan_headings = []
        for number, page in enumerate(document.pages, 1):
            for char in page.chars:
                if char['text'].strip() and (char['x0'] < 43 or char['x1'] > page.width - 43 or char['top'] < 15 or char['bottom'] > page.height - 15):
                    overflow.append({'page': number, 'text': char['text'], 'x0': char['x0'], 'x1': char['x1'], 'top': char['top'], 'bottom': char['bottom']})
            lines = (page.crop((44, 55, page.width - 44, page.height - 56)).extract_text() or '').splitlines()
            if lines and lines[-1] in ['Finalidade do registro', 'Documentos considerados', 'Registros do acompanhamento', 'Pendências e próximos passos', 'Responsabilidade pelo registro']:
                orphan_headings.append(number)
        joined = '\n'.join(texts)
        normalized = ' '.join(joined.split())
        assert all('GEOGESTOR' in text and f'Página {index + 1} de {len(texts)}' in text for index, text in enumerate(texts)), 'Repeated header or pagination missing'
        if 'Exemplo' in file.name or 'Sem_Registros' in file.name:
            assert len(texts) == 1, 'Short record should fit on one page'
        if 'Extenso' in file.name:
            assert all(marker in joined for marker in ['FIM-DOCUMENTOS', 'FIM-REGISTROS', 'FIM-PROXIMOS-PASSOS']), 'Long text lost'
        if 'Sem_Registros' in file.name:
            assert 'ausência de registro não indica' in normalized
            assert 'Documentos considerados' not in joined
        assert not overflow, f'Content exceeds page bounds: {file.name} {overflow[:3]}'
        assert not orphan_headings, f'Heading stranded: {file.name} {orphan_headings}'
        findings.append({'file': file.name, 'pages': len(texts), 'overflow': overflow, 'orphan_headings': orphan_headings, 'text': texts})
    renderer = pypdfium2.PdfDocument(str(file))
    for number in range(len(renderer)):
        page = renderer[number]
        bitmap = page.render(scale=1.5)
        rendered = bitmap.to_pil().copy()
        rendered.save(output / f'{file.stem}-page-{number + 1:02d}.png')
        rendered.close()
        bitmap.close()
        page.close()
    renderer.close()
(output / 'pdf-inspection.json').write_text(json.dumps(findings, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps([{'file': item['file'], 'pages': item['pages'], 'overflow': len(item['overflow']), 'orphan_headings': len(item['orphan_headings'])} for item in findings], ensure_ascii=False))
