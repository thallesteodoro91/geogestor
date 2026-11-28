import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrategicPlanningSnapshot } from '@geogestor/contracts';
import { planningAlerts, planningDeletionDescription, planningReturnPath } from './planningPresentation';
import { planningAlertGroups, latestPlanningUpdate, planningTimelineDescription } from './planningPresentation';

test('agrupa causas do mesmo objetivo por maior gravidade, mantendo todos os destinos', () => {
  const data = snapshot({
    objetivos: [{ id: 'o', titulo: 'Entregas', status: 'em_risco', dataLimite: '2026-12-31' }] as StrategicPlanningSnapshot['objetivos'],
    iniciativas: [{ id: 'i', objetivoId: 'o', status: 'bloqueada', dataLimite: '2026-12-31' }] as StrategicPlanningSnapshot['iniciativas'],
    riscos: [{ id: 'r', iniciativaId: 'i', impacto: 'critico', status: 'aberto', descricao: 'Insumos' }, { id: 'geral', impacto: 'alto', status: 'aberto' }] as StrategicPlanningSnapshot['riscos']
  });
  const groups = planningAlertGroups(data);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].priority, 4);
  assert.equal(groups[0].title, 'Entregas');
  assert.deepEqual(groups[0].causes.map(item => item.recordId), ['risk-r', 'initiative-i', 'objective-o']);
});

test('atualização do indicador vem das entidades consultadas e ignora datas inválidas', () => {
  assert.equal(latestPlanningUpdate([]), null);
  assert.equal(latestPlanningUpdate([{ updatedAt: '2026-10-01T10:00:00Z' }, { updatedAt: 'inválida' }, { updatedAt: '2026-11-02T09:00:00Z' }]), '2026-11-02T09:00:00Z');
});

test('linha do tempo traduz estados e datas sem alterar narrativas do usuário', () => {
  const data = snapshot({ iniciativas: [{ id: 'i', status: 'bloqueada' }] as StrategicPlanningSnapshot['iniciativas'] });
  assert.equal(planningTimelineDescription({ id: 'iniciativa:i', tipo: 'iniciativa', descricao: '', data: '', titulo: '', status: '' }, data), 'Situação alterada para Bloqueada');
  assert.equal(planningTimelineDescription({ id: 'revisao:r', tipo: 'revisao', descricao: 'Prazo combinado 2026-12-01.', data: '', titulo: '', status: '' }, data), 'Prazo combinado 2026-12-01.');
});

const snapshot = (overrides: Partial<StrategicPlanningSnapshot> = {}) => ({
  objetivos: [], resultadosChave: [], iniciativas: [], riscos: [], checkins: [], decisoes: [], ...overrides
}) as StrategicPlanningSnapshot;

test('risco crítico permanece visível com três indicadores desatualizados e três iniciativas atrasadas', () => {
  const data = snapshot({
    resultadosChave: [1, 2, 3].map(id => ({ id: String(id), desatualizado: true, titulo: 'Indicador', fonteNome: 'Manual' })) as StrategicPlanningSnapshot['resultadosChave'],
    iniciativas: [1, 2, 3].map(id => ({ id: String(id), atrasada: true, titulo: 'Atraso', dataLimite: '2026-01-01' })) as StrategicPlanningSnapshot['iniciativas'],
    riscos: [{ id: 'critico', impacto: 'critico', status: 'aberto', descricao: 'Falta de insumo' }] as StrategicPlanningSnapshot['riscos']
  });
  const alerts = planningAlerts(data);
  assert.equal(alerts.length, 7);
  assert.equal(alerts[0].recordId, 'risk-critico');
  assert.equal(alerts[0].action, 'Abrir risco');
  assert.equal(alerts.filter(item => item.tab === 'iniciativas').length, 3);
});

test('cobre bloqueios e objetivos em risco, exclui riscos resolvidos e aceitos', () => {
  const data = snapshot({
    iniciativas: [{ id: 'i', status: 'bloqueada', dataLimite: '2026-10-31' }] as StrategicPlanningSnapshot['iniciativas'],
    objetivos: [{ id: 'o', status: 'em_risco', dataLimite: '2026-10-31' }] as StrategicPlanningSnapshot['objetivos'],
    riscos: [{ id: 'r1', impacto: 'critico', status: 'aceito' }, { id: 'r2', impacto: 'critico', status: 'resolvido' }] as StrategicPlanningSnapshot['riscos']
  });
  assert.deepEqual(planningAlerts(data).map(item => item.recordId), ['initiative-i', 'objective-o']);
});

test('exclusão explica dependentes removidos e vínculos preservados, sem contar risco duas vezes', () => {
  const data = snapshot({
    resultadosChave: [{ objetivoId: 'o' }] as StrategicPlanningSnapshot['resultadosChave'],
    iniciativas: [{ id: 'i', objetivoId: 'o' }] as StrategicPlanningSnapshot['iniciativas'],
    riscos: [{ objetivoId: 'o', iniciativaId: 'i' }] as StrategicPlanningSnapshot['riscos'],
    checkins: [{ objetivoId: 'o' }] as StrategicPlanningSnapshot['checkins'],
    decisoes: [{ objetivoId: 'o', checkinId: 'c' }] as StrategicPlanningSnapshot['decisoes']
  });
  const text = planningDeletionDescription('objective', 'o', data);
  assert.match(text, /1 resultado-chave e 1 iniciativa/);
  assert.match(text, /preservados 1 risco, 1 revisão e 1 decisão/);
  assert.match(text, /Projetos e tarefas vinculados serão preservados/);
  assert.match(planningDeletionDescription('checkin', 'c', data), /decisões vinculadas \(1\) serão preservadas/);
});

test('retorno aceita somente Planejamento local com filtros, rejeitando destinos externos e outras rotas', () => {
  assert.equal(planningReturnPath('/planejamento?ciclo=um&aba=iniciativas'), '/planejamento?ciclo=um&aba=iniciativas');
  for (const value of ['https://example.com/planejamento', '//evil.test/planejamento', '/tarefas', '/planejamento-malicioso', 'javascript:alert(1)']) assert.equal(planningReturnPath(value), null);
});
