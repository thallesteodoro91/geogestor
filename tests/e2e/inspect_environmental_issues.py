import json
from pathlib import Path
import pdfplumber
import pypdfium2

output = Path(__file__).resolve().parents[2] / 'docs/auditorias/2026-10-12-emissoes-documentais/evidencias'
headings = ['Síntese do acompanhamento', 'Finalidade do registro', 'Documentos considerados', 'Registros do acompanhamento', 'Pendências e próximos passos', 'Responsabilidade pelo registro']
findings = []
for file in sorted(output.glob('*.pdf')):
    with pdfplumber.open(file) as document:
        texts = [page.extract_text() or '' for page in document.pages]
        normalized = ' '.join(' '.join(texts).split())
        overflow = []
        orphan_headings = []
        for number, page in enumerate(document.pages, 1):
            for char in page.chars:
                if char['text'].strip() and (char['x0'] < 43 or char['x1'] > page.width - 43):
                    overflow.append({'page': number, 'text': char['text'], 'x0': char['x0'], 'x1': char['x1']})
            lines = (page.crop((44, 55, page.width - 44, page.height - 56)).extract_text() or '').splitlines()
            if lines and lines[-1] in headings:
                orphan_headings.append(number)
            assert f'Página {number} de {len(document.pages)}' in texts[number - 1]
        if 'Extenso' in file.name:
            assert all(marker in normalized for marker in ['FIM-DOCUMENTOS', 'FIM-REGISTROS', 'FIM-PROXIMOS-PASSOS'])
        if 'Com_Empresa_E_Sintese' in file.name:
            assert 'Empresa fictícia' in normalized and 'Síntese do acompanhamento' in normalized
            assert len(document.pages) == 1
            assert len(document.pages[0].images) == 1
        if 'Empresa_Sem_Logo' in file.name:
            assert 'Síntese do acompanhamento' not in normalized and len(document.pages) == 1
            assert not document.pages[0].images
        assert not overflow, (file.name, overflow[:3])
        assert not orphan_headings, (file.name, orphan_headings)
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
(output / 'inspecao-pdfs.json').write_text(json.dumps(findings, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps([{'file': item['file'], 'pages': item['pages'], 'overflow': len(item['overflow']), 'orphan_headings': len(item['orphan_headings'])} for item in findings]))
