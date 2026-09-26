import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEnvironmentalReserve, parseEnvironmentalArea, type EnvironmentalCalculationInput } from './environmentalCalculation';

const scenario = (overrides: Partial<EnvironmentalCalculationInput> = {}): EnvironmentalCalculationInput => ({
  region: 'demais_regioes',
  totalArea: '100',
  appArea: '10',
  nativeOutsideApp: '15',
  fiscalModules: '',
  nativeOn2008: '',
  propertyExistedOn2008: false,
  carRequested: false,
  appProtected: false,
  noNewConversion: false,
  historicalCompliance: false,
  ...overrides
});

test('aceita vírgula decimal e rejeita notação científica ou texto', () => {
  assert.equal(parseEnvironmentalArea('100,50'), 100.5);
  assert.ok(Number.isNaN(parseEnvironmentalArea('1e4')));
  assert.ok(Number.isNaN(parseEnvironmentalArea('dez')));
});

test('aplica os percentuais territoriais do art. 12', () => {
  const expected = new Map<EnvironmentalCalculationInput['region'], number>([
    ['demais_regioes', 20], ['amazonia_floresta', 80], ['amazonia_cerrado', 35], ['amazonia_campos', 20]
  ]);
  for (const [region, requiredArea] of expected) {
    const result = calculateEnvironmentalReserve(scenario({ region, appArea: '0', nativeOutsideApp: '0' }));
    assert.equal(result.valid, true);
    if (result.valid) assert.equal(result.requiredArea, requiredArea);
  }
});

test('só computa APP quando as três condições do art. 15 são satisfeitas', () => {
  const ineligible = calculateEnvironmentalReserve(scenario());
  const eligible = calculateEnvironmentalReserve(scenario({ carRequested: true, appProtected: true, noNewConversion: true }));
  assert.equal(ineligible.valid, true);
  assert.equal(eligible.valid, true);
  if (ineligible.valid && eligible.valid) {
    assert.equal(ineligible.countableVegetation, 15);
    assert.equal(ineligible.deficit, 5);
    assert.equal(eligible.countableVegetation, 25);
    assert.equal(eligible.potentialExcess, 5);
  }
});

test('art. 67 reduz a exigência apenas para imóvel de até quatro módulos existente em 2008', () => {
  const applied = calculateEnvironmentalReserve(scenario({ fiscalModules: '4', nativeOn2008: '10', propertyExistedOn2008: true, appArea: '0', nativeOutsideApp: '8' }));
  const notApplied = calculateEnvironmentalReserve(scenario({ fiscalModules: '4,01', nativeOn2008: '10', propertyExistedOn2008: true, appArea: '0', nativeOutsideApp: '8' }));
  assert.equal(applied.valid, true);
  assert.equal(notApplied.valid, true);
  if (applied.valid && notApplied.valid) {
    assert.equal(applied.article67Applied, true);
    assert.equal(applied.requiredArea, 10);
    assert.equal(applied.deficit, 2);
    assert.equal(notApplied.article67Applied, false);
    assert.equal(notApplied.requiredArea, 20);
  }
});

test('preserva precisão de centésimos no limite sem arredondar o cálculo', () => {
  const deficit = calculateEnvironmentalReserve(scenario({ appArea: '0', nativeOutsideApp: '19,99' }));
  const excess = calculateEnvironmentalReserve(scenario({ appArea: '0', nativeOutsideApp: '20,01' }));
  assert.equal(deficit.valid, true);
  assert.equal(excess.valid, true);
  if (deficit.valid && excess.valid) {
    assert.ok(Math.abs(deficit.deficit - 0.01) < Number.EPSILON * 10);
    assert.ok(Math.abs(excess.potentialExcess - 0.01) < Number.EPSILON * 10);
  }
});

test('bloqueia totais nulos, negativos, NaN e somas fisicamente impossíveis', () => {
  for (const input of [
    scenario({ totalArea: '0' }),
    scenario({ totalArea: '-1' }),
    scenario({ totalArea: '1e4' }),
    scenario({ appArea: '70', nativeOutsideApp: '40' })
  ]) {
    const result = calculateEnvironmentalReserve(input);
    assert.equal(result.valid, false);
  }
});
