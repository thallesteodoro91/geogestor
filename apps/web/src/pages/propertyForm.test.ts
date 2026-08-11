import assert from 'node:assert/strict';
import test from 'node:test';
import { propertyFormToPayload, type PropertyFormState } from './propertyForm';

const validForm: PropertyFormState = {
  clienteId: '11111111-1111-4111-8111-111111111111',
  nome: '  Fazenda   Modelo  ',
  matricula: ' 12.345 ',
  car: '',
  ccir: '',
  itr: '',
  areaHa: '42,5',
  cidade: 'Distrito Norte',
  municipio: 'Florianópolis',
  uf: 'SC',
  situacaoImovel: 'Regular',
  latitude: '-27,5949',
  longitude: '-48,5482',
  observacoes: ''
};

test('normaliza o cadastro de propriedade antes da persistência', () => {
  const parsed = propertyFormToPayload(validForm);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.nome, 'Fazenda Modelo');
  assert.equal(parsed.data.areaHa, 42.5);
  assert.equal(parsed.data.matricula, '12.345');
});

test('exige identificação, município e par completo de coordenadas', () => {
  const parsed = propertyFormToPayload({
    ...validForm,
    matricula: '',
    municipio: '',
    longitude: ''
  });
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  const paths = parsed.error.issues.map((issue) => issue.path[0]);
  assert.ok(paths.includes('matricula'));
  assert.ok(paths.includes('municipio'));
  assert.ok(paths.includes('longitude'));
});
