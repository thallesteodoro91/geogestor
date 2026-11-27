"""Checks the information order and commercial references in actual PDFs.

Run after inspect_export_audit.py --assert (independent financial checks and
rendering) and inspect_budget_refinement.py (page breaks and image geometry).
"""
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader

directory = Path(sys.argv[1])
reports = []
headings = {'CLIENTE', 'OBJETO DA PROPOSTA', 'RESUMO COMERCIAL',
            'DETALHAMENTO TÉCNICO',
            'DESCRIÇÃO DO ESCOPO', 'CARACTERIZAÇÃO TÉCNICA', 'METODOLOGIA',
            'ENTREGÁVEIS', 'ITENS E INVESTIMENTO', 'TRIBUTOS',
            'OBSERVAÇÕES AO CLIENTE', 'TERMOS E CONDIÇÕES', 'ACEITE DA PROPOSTA'}


def compact(text):
    return ''.join(text.split())


for file in sorted(directory.glob('*.pdf')):
    fixture = json.loads(file.with_suffix('.json').read_text(encoding='utf-8'))
    budget, company = fixture['budget'], fixture['company']
    reader = PdfReader(file)
    pages = [p.extract_text() or '' for p in reader.pages]
    text, first = '\n'.join(pages), pages[0]
    # Paragraphs use 9.5 pt; repeated captions use 9 pt and footers 8 pt.
    # Filter by rendered typography rather than deleting matching words:
    # a user paragraph may contain a line identical to a subsection title.
    paragraph_runs, last_sizes = [], []
    for page in reader.pages:
        last_size = [None]
        def collect(text, cm, tm, font, size):
            if abs(size - 9.5) < .01:
                paragraph_runs.append(text)
            if text.strip() and abs(size - 8) > .01:
                last_size[0] = size
        page.extract_text(visitor_text=collect)
        last_sizes.append(last_size[0])
    flow_text = ''.join(paragraph_runs)
    value = f"{budget['valorTotal']/100:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    first_checks = {
        'company': compact(company['razao']) in compact(first),
        'number_version': budget['codigoOrcamento'] in first and 'versão 1' in first,
        'issue_date': '10/10/2026' in first,
        'client': compact(budget['clientName']) in compact(first),
        'title': compact(budget['descricao']) in compact(first),
        'service_type': compact(budget['servicoTipo']) in compact(first),
        'total': value in first,
        'validity': '09/11/2026' in first,
        'payment': 'Forma de pagamento' in first and 'PIX' in first,
    }
    if budget.get('imovelNome'):
        first_checks['property'] = budget['imovelNome'] in first
        first_checks['location'] = 'Florianópolis / SC' in first
    if budget.get('prazoExecucaoDias') is not None:
        first_checks['execution'] = 'Prazo de execução' in first
    # Deliberately extreme names/types cannot all fit without reducing type
    # or discarding content. Record this limit, never silently truncate them.
    if file.stem != 'textos-extremos':
        assert all(first_checks.values()), (file, first_checks)
    assert text.index('RESUMO COMERCIAL') < text.index('ITENS E INVESTIMENTO'), file
    assert text.count('Investimento total') == 1, file
    assert len(re.findall(r'\bValidade\b', text)) == 1, file
    assert 'Investimento:' not in text and 'Validade:' not in text, file
    assert 'Metodologia a detalhar' not in text and 'Termos não informados' not in text, file
    assert str(reader.metadata['/Author'].get_object()) == company['razao'], file
    acceptance = text[text.index('ACEITE DA PROPOSTA'):]
    assert budget['codigoOrcamento'] in acceptance and 'versão 1' in acceptance, file
    assert 'Local e data:' in acceptance and budget['responsavelTecnico'] in acceptance, file
    assert 'CREA-SC 000000-0' in acceptance, file
    assert compact(budget['clientName']) in compact(acceptance), file
    assert 'R$' not in acceptance and 'Validade' not in acceptance, file
    if file.stem == 'opcionais-vazios':
        assert all(label not in text for label in ['Área estimada', 'Imóvel', 'Localização', 'METODOLOGIA', 'ENTREGÁVEIS', 'DETALHAMENTO TÉCNICO']), file
    else:
        assert text.index('Parcelas e vencimentos') < text.index('DETALHAMENTO TÉCNICO') < text.index('ITENS E INVESTIMENTO'), file
    if file.stem == 'tecnica-extensa':
        assert text.count('DETALHAMENTO TÉCNICO') > 1, file
        for field in ['metodologia', 'entregaveis']:
            assert compact(budget[field]) in compact(flow_text), (file, field)
    if file.stem in ['simples-parcelado', 'extensa-parcelado']:
        assert re.search(r'40%\s*\(R\$.*?\), na aprovação', first), file
        assert re.search(r'60%\s*\(R\$.*?\), 30 dias após a aprovação', first), file
        assert '15 dias após o pagamento inicial' in first, file
    if file.stem == 'simples':
        assert '15 dias após a aprovação' in first, file
    if file.stem == 'parcelas-centavos':
        assert '50%(R$617,29)' in compact(first) and '50%(R$617,28)' in compact(first), file
    if file.stem == 'parcelas-valores':
        assert '10/11/2026' in first and '10/12/2026' in first, file
        assert compact(budget['characterization']['executionStart']['description']) in compact(first), file
    if file.stem == 'textos-extremos':
        assert 'FIM-PAGAMENTO' in compact(text), file
    for page, last_size in zip(pages, last_sizes):
        lines = [line.strip() for line in page.splitlines() if line.strip() and 'página ' not in line]
        assert not (lines[-1] in headings and last_size == 9), (file, lines[-1])
    reports.append({'file': file.name, 'pages': len(pages), 'first_page': first_checks,
                    'first_page_complete': all(first_checks.values()), 'short_acceptance': True,
                    'single_commercial_summary': True, 'scope_preserved': not budget.get('characterization', {}).get('scopeDescription') or compact(budget['characterization']['scopeDescription']) in compact(flow_text)})
    assert reports[-1]['scope_preserved'], file

(directory / 'organizacao.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(reports)} PDFs: ordem comercial, aceite, assinaturas e conteúdo conferidos.')
