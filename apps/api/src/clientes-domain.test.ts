import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ClientePatchPayloadSchema,
  ClientePayloadSchema,
  isValidBrazilianPhone,
  isValidCep,
  isValidCnpj,
  isValidCpf
} from '@geogestor/contracts';

const basePayload = {
  nome: 'Maria de Souza',
  tipoPessoa: 'PF' as const,
  cpf: '529.982.247-25',
  celular: '(48) 99999-9999',
  situacao: 'Ativo'
};

test('valida CPF e rejeita sequências ou dígitos verificadores incorretos', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCpf('529.982.247-24'), false);
});

test('valida CNPJ e rejeita sequências ou dígitos verificadores incorretos', () => {
  assert.equal(isValidCnpj('11.222.333/0001-81'), true);
  assert.equal(isValidCnpj('00.000.000/0000-00'), false);
  assert.equal(isValidCnpj('11.222.333/0001-80'), false);
});

test('aceita telefones brasileiros com 10 ou 11 dígitos e CEP com 8 dígitos', () => {
  assert.equal(isValidBrazilianPhone('(48) 3333-4444'), true);
  assert.equal(isValidBrazilianPhone('(48) 99999-4444'), true);
  assert.equal(isValidBrazilianPhone('9999-4444'), false);
  assert.equal(isValidCep('88000-000'), true);
  assert.equal(isValidCep('8800-000'), false);
});

test('rejeita individualmente qualquer telefone informado com formato incompleto', () => {
  const invalidCell = ClientePayloadSchema.safeParse({
    ...basePayload,
    celular: '(48) 9999',
    telefone: '(48) 3333-4444'
  });
  assert.equal(invalidCell.success, false);
  if (!invalidCell.success) assert.equal(invalidCell.error.issues[0].path[0], 'celular');

  const invalidAdditional = ClientePayloadSchema.safeParse({
    ...basePayload,
    telefone: '(48) 3333'
  });
  assert.equal(invalidAdditional.success, false);
  if (!invalidAdditional.success) assert.equal(invalidAdditional.error.issues[0].path[0], 'telefone');
});

test('aceita cadastro de pessoa física com contato principal', () => {
  const result = ClientePayloadSchema.safeParse(basePayload);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.tipoPessoa, 'PF');
});

test('alterna as exigências documentais para pessoa jurídica', () => {
  const valid = ClientePayloadSchema.safeParse({
    ...basePayload,
    nome: 'SkyGeo Serviços Geográficos Ltda.',
    tipoPessoa: 'PJ',
    cpf: null,
    cnpj: '11.222.333/0001-81'
  });
  assert.equal(valid.success, true);

  const invalid = ClientePayloadSchema.safeParse({ ...basePayload, tipoPessoa: 'PJ', cnpj: '12.345.678/0001-00' });
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.equal(invalid.error.issues[0].path[0], 'cnpj');
});

test('exige a descrição da origem condicional e quem indicou', () => {
  const missingOtherDetail = ClientePayloadSchema.safeParse({ ...basePayload, origemPrincipal: 'Outro' });
  assert.equal(missingOtherDetail.success, false);

  const missingReferrer = ClientePayloadSchema.safeParse({ ...basePayload, origemPrincipal: 'Indicação' });
  assert.equal(missingReferrer.success, false);

  assert.equal(ClientePayloadSchema.safeParse({ ...basePayload, origemPrincipal: 'Outro', origemDetalhe: 'Feira regional' }).success, true);
  assert.equal(ClientePayloadSchema.safeParse({ ...basePayload, origemPrincipal: 'Indicação', indicadoPor: 'João' }).success, true);
});

test('mantém PATCH retrocompatível para consumidores que atualizam apenas campos antigos', () => {
  const result = ClientePatchPayloadSchema.safeParse({ categoria: 'Produtor Rural' });
  assert.equal(result.success, true);
});

test('valida campos estruturados quando eles forem enviados em PATCH', () => {
  assert.equal(ClientePatchPayloadSchema.safeParse({ cpf: '111.111.111-11' }).success, false);
  assert.equal(ClientePatchPayloadSchema.safeParse({ cep: '8800-000' }).success, false);
  assert.equal(ClientePatchPayloadSchema.safeParse({ origemPrincipal: 'Outro' }).success, false);
});
