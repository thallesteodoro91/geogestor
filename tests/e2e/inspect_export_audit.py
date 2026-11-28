import json
import re
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageOps, ImageDraw


def inspect(directory):
    reports = []
    for file in sorted(directory.glob('*.pdf')):
        reader = PdfReader(file)
        texts = [page.extract_text() or '' for page in reader.pages]
        text = '\n'.join(texts)
        (directory / (file.stem + '.txt')).write_text(text, encoding='utf-8')
        rendered = pdfium.PdfDocument(file)
        thumbs = []
        for index in range(len(rendered)):
            page = rendered[index].render(scale=1.3).to_pil().convert('RGB')
            page.save(directory / f'{file.stem}-pagina-{index+1:02}.png')
            page.thumbnail((298, 421))
            tile = Image.new('RGB', (308, 445), 'lightgray')
            tile.paste(page, (5, 18))
            ImageDraw.Draw(tile).text((8, 2), f'{file.stem} - {index+1}', fill='black')
            thumbs.append(tile)
        contact = Image.new('RGB', (308 * min(4, len(thumbs)), 445 * ((len(thumbs)+3)//4)), 'white')
        for index, tile in enumerate(thumbs):
            contact.paste(tile, ((index % 4)*308, (index//4)*445))
        contact.save(directory / f'{file.stem}-contato.png')
        fixture_path = directory / (file.stem + '.json')
        report = {'file': str(file.resolve()), 'pages': len(texts), 'page_characters': [len(t) for t in texts]}
        if fixture_path.exists():
            fixture = json.loads(fixture_path.read_text(encoding='utf-8'))
            budget = fixture['budget']
            # Remove repeated page furniture before joining a cell continued
            # across pages; extraction places headers between its text runs.
            body = '\n'.join(line for line in text.splitlines() if 'página ' not in line and line.strip() != 'Descrição Qtd. / unidade Subtotal Ajustes Total')
            endings = [int(match) for match in re.findall(r'ITEM-\s*([1-9]\d*)\b', body)]
            report['missing_item_ends'] = [i for i in range(1, len(budget['items'])+1) if i not in endings]
            report['duplicated_item_ends'] = [i for i in range(1, len(budget['items'])+1) if endings.count(i) > 1]
            report['missing_text_ends'] = [marker for marker in ['FIM-OBSERVACOES', 'FIM-TERMOS'] if marker in json.dumps(budget) and marker not in text]
            report['internal_leaks'] = [token for token in ['SIGILO_NOTAS', 'SIGILO_CUSTO', 'SIGILO_JUSTIFICATIVA', 'NOTA_ITEM_INTERNA_NAO_EXPORTAR', 'CONTA_INTERNA_NAO_EXPORTAR', 'OUTRO_CLIENTE_NAO_EXPORTAR', 'ORCAMENTO_OUTRO_CLIENTE_NAO_EXPORTAR'] if token in text]
            def rounded(value):
                return int(value.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
            def adjustment(base, a):
                return rounded(Decimal(base) * Decimal(a['value'].replace(',', '.')) / 100) if a['type'] == 'percentual' else int(a['value'])
            item_totals = []
            for item in budget['items']:
                quantity = Decimal(item['quantity'].replace(',', '.')).quantize(Decimal('.000001'), rounding=ROUND_HALF_UP)
                sub = rounded(Decimal(item['unitPriceCents']) * quantity)
                item_totals.append(sub - adjustment(sub, item['discount']) + adjustment(sub, item['addition']))
            services = sum(total for item, total in zip(budget['items'], item_totals) if not item['optional'])
            billable = services + sum(c['amountCents'] for c in budget['costs'] if c['classification'] != 'custo_proprio')
            discount = adjustment(billable, {'type': budget['descontoGlobalTipo'], 'value': budget['descontoGlobalValor']})
            addition = adjustment(billable, {'type': budget['acrescimoGlobalTipo'], 'value': budget['acrescimoGlobalValor']})
            taxable = services + sum(c['amountCents'] for c in budget['costs'] if c['classification'] != 'custo_proprio' and c['taxable'])
            base = taxable - (rounded(Decimal(discount)*taxable/billable) if billable else 0) + (rounded(Decimal(addition)*taxable/billable) if billable else 0)
            adjusted_services = services - (rounded(Decimal(discount)*services/billable) if billable else 0) + (rounded(Decimal(addition)*services/billable) if billable else 0)
            tax_amounts = []
            outside = 0
            cumulative_base = base
            for tax in budget['taxes']:
                tax_base = adjusted_services if tax['calculationBase'] == 'servicos' else billable-discount+addition if tax['calculationBase'] == 'total' else sum(c['amountCents'] for c in budget['costs'] if c['classification'] == 'taxa_repassada') if tax['calculationBase'] == 'taxas' else cumulative_base
                rate = Decimal(tax['ratePercent']).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
                amount = rounded(Decimal(max(0, tax_base))*rate/(100+rate if tax['includedInPrice'] else 100)) + tax.get('manualAdjustmentCents', 0)
                amount = max(0, amount)
                tax_amounts.append(amount)
                if not tax['includedInPrice']:
                    outside += amount
                    if tax.get('cumulative'):
                        cumulative_base += amount
            expected = billable - discount + addition + outside
            value = f'{expected/100:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
            report.update(independent_total_cents=expected, persisted_total_cents=budget['valorTotal'], expected_total_in_pdf=value in text, item_totals=item_totals)
            report['independent_tax_amounts'] = tax_amounts
            report['persisted_tax_amounts'] = [tax['amountCents'] for tax in budget['taxes']]
            report['client_name_in_pdf'] = ''.join(budget['clientName'].split()) in ''.join(text.split())
            report['scope_in_pdf'] = ''.join(budget['descricao'].split()) in ''.join(text.split())
            report['watermark_correct'] = ('RASCUNHO — NÃO ENVIAR' in text) == (budget['status'] == 'rascunho')
        report['footers_correct'] = all(f'página {index+1} de {len(texts)}' in page for index, page in enumerate(texts))
        report['a4'] = all(abs(float(page.mediabox.width)-595.28) < 1 and abs(float(page.mediabox.height)-841.89) < 1 for page in reader.pages)
        reports.append(report)
    (directory / 'inspecao.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(reports, ensure_ascii=False, indent=2))
    if '--assert' in sys.argv:
        for report in reports:
            assert report['a4'] and report['footers_correct'], report
            if 'independent_total_cents' in report:
                assert report['independent_total_cents'] == report['persisted_total_cents'], report
                assert report['independent_tax_amounts'] == report['persisted_tax_amounts'], report
                assert report['expected_total_in_pdf'] and report['client_name_in_pdf'] and report['scope_in_pdf'] and report['watermark_correct'], report
                assert not report['missing_item_ends'] and not report['duplicated_item_ends'] and not report['missing_text_ends'] and not report['internal_leaks'], report


if __name__ == '__main__':
    inspect(Path(sys.argv[1]))
