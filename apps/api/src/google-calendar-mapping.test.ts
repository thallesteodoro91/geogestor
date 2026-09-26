import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGoogleCalendarEvent,
  googleEventStartToLocal,
  nextCivilDay
} from './services/google-calendar-mapping';

test('mapeia dia inteiro com fim exclusivo inclusive nas bordas civis', () => {
  assert.equal(nextCivilDay('2024-02-29'), '2024-03-01');
  assert.equal(nextCivilDay('2026-12-31'), '2027-01-01');
  assert.deepEqual(buildGoogleCalendarEvent({ titulo: 'Dia inteiro', data: '2024-02-29', tipo: 'Outro' }), {
    summary: '[GeoGestor] Dia inteiro',
    description: 'Tipo: Outro',
    start: { date: '2024-02-29' },
    end: { date: '2024-03-01' }
  });
});

test('preserva hora local e duração de uma hora ao atravessar meia-noite', () => {
  assert.deepEqual(buildGoogleCalendarEvent({ titulo: 'Virada', descricao: 'QA', data: '2026-12-31', hora: '23:59' }), {
    summary: '[GeoGestor] Virada',
    description: 'QA',
    start: { dateTime: '2026-12-31T23:59:00', timeZone: 'America/Sao_Paulo' },
    end: { dateTime: '2027-01-01T00:59:00', timeZone: 'America/Sao_Paulo' }
  });
});

test('converte dateTime externo para o dia civil de São Paulo', () => {
  assert.deepEqual(googleEventStartToLocal({ dateTime: '2026-09-13T01:30:00Z' }), { data: '2026-09-12', hora: '22:30' });
  assert.deepEqual(googleEventStartToLocal({ dateTime: '2026-09-12T23:59:00-03:00' }), { data: '2026-09-12', hora: '23:59' });
  assert.deepEqual(googleEventStartToLocal({ date: '2024-02-29' }), { data: '2024-02-29', hora: null });
});
