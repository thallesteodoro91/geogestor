"""Checks on real PDF output, supplementing visual inspection of rendered pages."""
import json
import sys
from pathlib import Path
from pypdf import PdfReader

directory = Path(sys.argv[1])
headings = {'CLIENTE', 'IMÓVEL E SERVIÇO', 'ESCOPO, METODOLOGIA E ENTREGÁVEIS',
            'ITENS E INVESTIMENTO', 'TRIBUTOS', 'CONDIÇÕES DE PAGAMENTO',
            'OBSERVAÇÕES AO CLIENTE', 'TERMOS E CONDIÇÕES', 'ACEITE DA PROPOSTA'}
reports = []
for file in sorted(directory.glob('*.pdf')):
    reader = PdfReader(file)
    orphaned = []
    for index, page in enumerate(reader.pages):
        lines = [line.strip() for line in (page.extract_text() or '').splitlines()
                 if line.strip() and 'página ' not in line and not line.startswith('Empresa')
                 and 'RASCUNHO — NÃO ENVIAR' not in line]
        if lines and lines[-1] in headings:
            orphaned.append({'page': index + 1, 'heading': lines[-1]})
    images = []
    matrix = None
    for operands, operator in reader.pages[0].get_contents().operations:
        if operator == b'cm':
            matrix = [float(value) for value in operands]
        if operator == b'Do' and matrix:
            image = reader.pages[0]['/Resources']['/XObject'][operands[0]].get_object()
            if image.get('/Subtype') != '/Image':
                continue
            width, height = abs(matrix[0]), abs(matrix[3])
            image_ratio = float(image['/Width']) / float(image['/Height'])
            assert abs(width / height - image_ratio) < .001, (file, matrix, image_ratio)
            assert width <= 120.01 and height <= 56.01 and matrix[4] > 297, (file, matrix)
            images.append({'width_pt': width, 'height_pt': height, 'x_pt': matrix[4],
                           'top_pt': matrix[5] - height, 'ratio': image_ratio})
    assert not orphaned, (file, orphaned)
    if file.stem.startswith('logo-'):
        assert len(images) == 1, file
    if file.stem == 'sem-logo':
        assert not images, file
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    fixture = directory / (file.stem + '.json')
    if fixture.exists():
        optional = [item for item in json.loads(fixture.read_text(encoding='utf-8'))['budget']['items'] if item.get('optional')]
        if optional and len(optional[0]['description']) < 500:
            first_item = ''.join(optional[0]['description'].split())
            for page in reader.pages:
                page_text = page.extract_text() or ''
                if 'ITENS OPCIONAIS' in page_text:
                    assert first_item in ''.join(page_text.split()), (file, 'Cabeçalho opcional sem primeiro item')
    assert 'não informado dia(s)' not in text, file
    if file.stem == 'opcionais-vazios':
        assert all(label not in text for label in ['Matrícula', 'Pontos de apoio', 'Estação base', 'OBSERVAÇÕES AO CLIENTE', 'Prazo previsto:']), file
    reports.append({'file': file.name, 'pages': len(reader.pages), 'orphaned_headings': orphaned, 'images': images})
(directory / 'paginacao-e-logos.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(reports)} PDFs: sem títulos órfãos; logos à direita, proporções e limites preservados.')
