import assert from 'node:assert/strict';
import test from 'node:test';
import { fictitiousExecutiveReport as fixture } from './__fixtures__/executiveFictitious';
import { executiveCashCopy, executiveAlerts, executiveSummary, executiveCriteria } from './reportPresentation';
import { buildReportDocumentModel } from './reportDocumentModel';
import { createManagerialReportPdfDefinition } from './reportPdfGenerator';

for (const [name, received, paid, expected] of [
  ['sem movimento', 0, 0, 'Sem movimentação'],
  ['equilíbrio com movimento', 12345, 12345, 'equilibradas'],
  ['positivo', 12346, 10000, 'positivo em R$'],
  ['negativo', 10000, 12346, 'negativo em R$']
] as const) {
  test(`EXEMPLO FICTÍCIO: ${name}, mesma interpretação na tela, prévia e PDF`, () => {
    const report = structuredClone(fixture);
    Object.assign(report.financial.kpis, {receivedRevenue: received, paidExpenses: paid, cashResult: received - paid});
    report.financial.composition = undefined;
    const before = JSON.stringify(report);
    assert.ok(executiveCashCopy(report).includes(expected));
    assert.equal(executiveSummary(report)[0], executiveCashCopy(report));
    assert.equal(buildReportDocumentModel(report, 'executivo').summary[0], executiveCashCopy(report));
    assert.ok(JSON.stringify(createManagerialReportPdfDefinition(report, 'executivo')).includes(executiveCashCopy(report)));
    assert.equal(JSON.stringify(report), before);
  });
}
test('movimentos de valor zero não são deduzidos apenas pelo saldo', () => {
  const report = structuredClone(fixture);
  Object.assign(report.financial.kpis, {receivedRevenue:0, paidExpenses:0, cashResult:0});
  assert.match(executiveCashCopy(report), /equilibradas/);
});
test('gravidade estável sem mutação, inclusive no documento', () => {
  const report = structuredClone(fixture);
  report.financial.alerts.unshift({id:'info',code:'low_conversion',severity:'info',href:'/orcamentos'}, {id:'warning',code:'negative_cash',severity:'warning',href:'/financeiro'});
  const before = JSON.stringify(report);
  assert.deepEqual(executiveAlerts(report).map(a=>a.id), ['overdue','projects','warning','info']);
  assert.match(buildReportDocumentModel(report,'executivo').alerts[1].title, /Projetos/);
  assert.equal(JSON.stringify(report),before);
});
test('zero, null, centavos e referência temporal são preservados', () => {
  const report = structuredClone(fixture);
  report.financial.kpis.cashResult = 1234567890123;
  report.financial.kpis.conversionRate = 0;
  report.operational.kpis.activeAreaHa = 0;
  let model = buildReportDocumentModel(report,'executivo');
  assert.equal(model.sections[0].rows.find(r=>r.label==='Conversão comercial')?.value,'0%');
  assert.equal(model.sections[1].rows.at(-1)?.value,'0 ha');
  assert.match(model.sections[0].rows.find(r=>r.label==='Resultado de caixa')!.value,/12.345.678.901,23/);
  report.financial.kpis.conversionRate = null;
  report.operational.kpis.activeAreaHa = null;
  model=buildReportDocumentModel(report,'executivo');
  assert.equal(model.sections[0].rows.find(r=>r.label==='Conversão comercial')?.value,'Sem base comparável');
  assert.equal(model.sections[1].rows.at(-1)?.value,'Não informada');
  assert.ok(executiveCriteria(report).some(c=>c.includes('31/12/2025')));
});
