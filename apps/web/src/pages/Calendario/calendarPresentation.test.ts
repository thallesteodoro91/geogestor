import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {appointmentTextErrors,appointmentRequestError,calendarTypes,calendarStatuses,normalizeCalendarFilter} from './calendarPresentation';

describe('Agenda — critérios independentes da coleção',()=>{
 for(const value of calendarTypes)it(`preserva o tipo ${value} em meses vazios, carregando ou com falha`,()=>{
  assert.equal(normalizeCalendarFilter(value,calendarTypes),value);
 });
 for(const value of calendarStatuses)it(`preserva a situação ${value} sem depender de tarefas carregadas`,()=>{
  assert.equal(normalizeCalendarFilter(value,calendarStatuses),value);
 });
 it('distingue valores de URL desconhecidos',()=>{
  assert.equal(normalizeCalendarFilter('Reuniao',calendarTypes),'Todos');
  assert.equal(normalizeCalendarFilter('Todos',calendarTypes),'Todos');
  assert.equal(normalizeCalendarFilter('Cancelado',calendarStatuses),'Todos');
 });
});
describe('Compromisso — limites do contrato e recuperação',()=>{
 it('aceita os limites do contrato após trim',()=>{
  assert.deepEqual(appointmentTextErrors(' '+ 'a'.repeat(180)+' ',' '+ 'b'.repeat(4000)+' '),{});
 });
 it('rejeita campos acima dos limites e título vazio',()=>{
  assert.ok(appointmentTextErrors('a'.repeat(181),'b'.repeat(4001)).titulo);
  assert.ok(appointmentTextErrors('a'.repeat(181),'b'.repeat(4001)).descricao);
  assert.ok(appointmentTextErrors('   ','').titulo);
 });
 it('diferencia comunicação de resposta recusada e orienta nova tentativa',()=>{
  assert.match(appointmentRequestError(new TypeError('Failed to fetch')),/comunicar/);
  assert.match(appointmentRequestError(new Error('Projeto indisponível.')),/Projeto indisponível/);
  assert.match(appointmentRequestError(new Error('Projeto indisponível.')),/campos foram mantidos/);
 });
});
