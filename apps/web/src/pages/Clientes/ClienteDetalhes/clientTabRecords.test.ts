import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientWorkCounts, clientWorkStatus, compareClientDates, compareClientNumbers } from './clientTabRecords';

test('situações legadas e ausentes não viram andamento nem conclusões ambientais', () => {
  const records = [{status:'Em Andamento'},{status:'Concluido'},{status:'Finalizado'},{status:'Suspenso'},{status:'Pausado'},{status:'Cancelado'},{status:'Estado legado específico'},{status:null},{status:'Planejamento'}];
  const saved = JSON.stringify(records);
  const counts = clientWorkCounts(records);
  assert.deepEqual(counts, {active:1, completed:2, paused:2, cancelled:1, other:3});
  assert.equal(Object.values(counts).reduce((sum,value)=>sum+value,0), records.length);
  assert.equal(clientWorkStatus('Estado legado específico').label,'Estado legado específico');
  assert.equal(clientWorkStatus('Concluido').label,'Concluído');
  assert.equal(clientWorkStatus('Em Análise no Órgão').label,'Em Análise no Órgão');
  assert.equal(clientWorkStatus(null).label,'Situação não informada');
  for (const status of ['Cancelado','Suspenso','Pausado','Finalizado','Estado legado específico',null]) assert.equal(clientWorkStatus(status).hasActiveDeadline,false);
  assert.equal(clientWorkStatus('Em Andamento').hasActiveDeadline,true);
  assert.equal(JSON.stringify(records),saved);
});
test('ordenação conserva valores zero e coloca informações ausentes ao fim em ambas as direções', () => {
  const values = [null,100,0,NaN,50];
  assert.deepEqual([...values].sort((a,b)=>compareClientNumbers(a,b)).slice(0,3),[0,50,100]);
  assert.deepEqual([...values].sort((a,b)=>compareClientNumbers(a,b,true)).slice(0,3),[100,50,0]);
  const dates = ['2026-10-20',null,'2026-09-01','data inválida'];
  assert.deepEqual([...dates].sort((a,b)=>compareClientDates(a,b)).slice(0,2),['2026-09-01','2026-10-20']);
  assert.deepEqual([...dates].sort((a,b)=>compareClientDates(a,b,true)).slice(0,2),['2026-10-20','2026-09-01']);
  assert.equal(compareClientDates('2026-10-12 12:00:00','2026-10-12T12:00:00Z'),0);
  assert.equal(compareClientDates('2026-10-12T09:00:00-03:00','2026-10-12T12:00:00Z'),0);
});
