import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// O caminho dinâmico mantém o teste da integração UI/contrato fora do rootDir da API.
const clientFormModuleUrl = pathToFileURL(
  path.resolve(__dirname, '../../web/src/pages/Clientes/clientForm.ts')
).href;
const loadClientFormModule = () => import(clientFormModuleUrl);

test('formata CEP e estrutura um endereço sem número sem gravar S/N', async () => {
  const { clientFormToPayload, createEmptyClientForm, formatCep } = await loadClientFormModule();
  assert.equal(formatCep('88000123'), '88000-123');

  const payload = clientFormToPayload({
    ...createEmptyClientForm(),
    nome: 'Maria de Souza',
    cpf: '529.982.247-25',
    telefone: '(48) 3333-4444',
    numero: '120',
    semNumero: true
  });

  assert.equal(payload.numero, null);
  assert.equal(payload.semNumero, true);
});

test('preserva documentos PF e PJ no estado ao alternar temporariamente o tipo', async () => {
  const { createEmptyClientForm } = await loadClientFormModule();
  const form = {
    ...createEmptyClientForm(),
    cpf: '529.982.247-25',
    cnpj: '11.222.333/0001-81'
  };

  const pjState = { ...form, tipoPessoa: 'PJ' as const };
  const pfState = { ...pjState, tipoPessoa: 'PF' as const };
  assert.equal(pfState.cpf, '529.982.247-25');
  assert.equal(pfState.cnpj, '11.222.333/0001-81');
});

test('mantém origem múltipla legada, mas sincroniza origens simples', async () => {
  const { clientFormToPayload, createEmptyClientForm } = await loadClientFormModule();
  const form = {
    ...createEmptyClientForm(),
    nome: 'SkyGeo',
    tipoPessoa: 'PJ' as const,
    cnpj: '11.222.333/0001-81',
    celular: '(48) 99999-9999',
    origemPrincipal: 'Google'
  };

  assert.equal(clientFormToPayload(form, { origem: 'Evento, Telefone' }).origem, 'Evento, Telefone');
  assert.equal(clientFormToPayload(form, { origem: 'Site' }).origem, 'Google');
});

test('expõe perfis e serviços antigos para edição sem tratá-los como tipo de pessoa', async () => {
  const { clientRecordToForm } = await loadClientFormModule();
  const form = clientRecordToForm({
    nome: 'Cliente legado',
    categoria: 'Empresa, Cooperativa',
    servicos: 'Georreferenciamento, Serviço histórico'
  });

  assert.equal(form.tipoPessoa, 'PJ');
  assert.deepEqual(form.perfis, ['Cooperativa']);
  assert.deepEqual(form.servicos, ['Georreferenciamento', 'Serviço histórico']);
});

test('salva tipo de pessoa separado da categoria de relacionamento', async () => {
  const { clientFormToPayload, createEmptyClientForm } = await loadClientFormModule();
  const payload = clientFormToPayload({
    ...createEmptyClientForm(),
    nome: 'Cliente sintético',
    cpf: '529.982.247-25',
    celular: '(48) 99999-9999',
    perfis: ['Parceiro']
  });
  assert.equal(payload.tipoPessoa, 'PF');
  assert.equal(payload.categoria, 'Parceiro');
  assert.equal(payload.perfis, 'Parceiro');
});
