import assert from 'node:assert/strict';
import test from 'node:test';
import { LICENSE_STATUSES, type LicenseListItem } from '@geogestor/contracts/src/environmental';
import { formatLicenseDate, getLicenseExpirationPresentation, getSafeLicenseReturnTo, licenseDaysUntilDate, licenseDetailPath, parseLicensePage } from './licensePresentation';

const now = new Date('2026-10-11T15:00:00Z');
const state = (status: LicenseListItem['status'], dataVencimento: string, statusRegistrado: string = status) => ({ status, dataVencimento, statusRegistrado, statusRegistradoReconhecido: true });

test('administrative state never becomes valid just because its date is distant', () => {
  for (const status of LICENSE_STATUSES) {
    for (const date of ['2026-10-10', '2026-10-11', '2026-11-10', '2027-02-08', '2027-06-01']) {
      const result = getLicenseExpirationPresentation(state(status, date), now);
      if (status !== 'Válida') assert.doesNotMatch(result.message, /Licença válida/);
      if (status === 'Em análise') { assert.match(result.message, /em análise/); assert.equal(result.tone, 'info'); }
      if (status === 'Suspensa' || status === 'Vencida') assert.equal(result.tone, 'danger');
      if (status === 'Encerrada') assert.equal(result.tone, 'neutral');
    }
  }
});

test('expired renewal keeps both facts visible and urgent', () => {
  const result = getLicenseExpirationPresentation(state('Vencida', '2026-10-10', 'Em renovação'), now);
  assert.match(result.message, /vencida há 1 dia/);
  assert.match(result.message, /Renovação em andamento/);
  assert.equal(result.tone, 'danger');
  assert.match(getLicenseExpirationPresentation(state('Válida', '2026-10-11'), now).message, /vence hoje/);
  assert.equal(getLicenseExpirationPresentation(state('Válida', '2026-11-10'), now).tone, 'danger');
  assert.equal(getLicenseExpirationPresentation(state('Válida', '2027-02-08'), now).tone, 'warning');
});

test('invalid dates and unrecognized legacy statuses ask for review', () => {
  assert.equal(licenseDaysUntilDate('2026-02-31', now), null);
  assert.match(formatLicenseDate('2026-02-31'), /inválida/);
  assert.match(getLicenseExpirationPresentation(state('Válida', 'invalid'), now).message, /inválida/);
  const legacy = { ...state('Válida', '2027-06-01'), statusRegistrado: 'DESCONHECIDO', statusRegistradoReconhecido: false };
  assert.match(getLicenseExpirationPresentation(legacy, now).message, /não foi reconhecida/);
});

test('day boundaries follow São Paulo instead of the machine timezone', () => {
  assert.equal(licenseDaysUntilDate('2026-10-11', new Date('2026-10-12T01:00:00Z')), 0);
  assert.equal(licenseDaysUntilDate('2026-10-11', new Date('2026-10-12T04:00:00Z')), -1);
});

test('pagination rejects unsafe, infinite, fractional and negative pages', () => {
  for (const value of [null, '', '0', '-2', '1.5', 'Infinity', 'NaN', '9007199254740992']) assert.equal(parseLicensePage(value), 1);
  assert.equal(parseLicensePage('3'), 3);
});

test('return context preserves only licensing filters and cannot navigate outside the list', () => {
  const list = '/ambiental?tab=licenciamento&lic_q=Órgão&lic_status=Válida&lic_tipo=LO&lic_vencimento=120d&lic_page=3&action=new';
  const safe = getSafeLicenseReturnTo(list);
  assert.equal(safe, '/ambiental?tab=licenciamento&lic_q=%C3%93rg%C3%A3o&lic_status=V%C3%A1lida&lic_tipo=LO&lic_vencimento=120d&lic_page=3');
  const detail = new URL(licenseDetailPath('license-id', safe), 'https://geogestor.invalid');
  assert.equal(detail.searchParams.get('retorno'), safe);
  for (const input of ['https://example.com/ambiental', '//example.com/ambiental', '/ambiental/other', '/ambiental\\@example.com', '/clientes', 'javascript:alert(1)']) {
    assert.equal(getSafeLicenseReturnTo(input), '/ambiental?tab=licenciamento');
  }
});
