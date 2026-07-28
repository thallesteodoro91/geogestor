import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPayablePayload,
  buildRevenuePayload,
  financialInputToCents,
  payableFormFingerprint,
  revenueFormFingerprint,
  validatePayableForm,
  validateRevenueForm,
  type PayableFormValues,
  type RevenueFormValues
} from './financeForm';

test('converte valores financeiros para centavos com arredondamento determinístico', () => {
  assert.equal(financialInputToCents('1250.45'), 125_045);
  assert.equal(financialInputToCents('19.999'), 2_000);
});

test('preserva ajustes, imposto, datas e vínculos no payload de recebimento', () => {
  const payload = buildRevenuePayload({
    clienteId: 'cliente-1',
    projetoId: 'projeto-1',
    valorTotal: '2500.75',
    status: 'Aprovado',
    descricao: 'Levantamento cadastral',
    anotacoes: 'Cobrança conforme contrato.',
    formaDePagamento: 'Pix',
    desconto: '100.25',
    codigoOrcamento: 'REC-2026-001',
    dataCompetencia: '2026-07-01',
    dataPagamento: '2026-07-25',
    impostoValor: '75.10',
    impostoRetido: true,
    centroCusto: 'Serviços'
  });

  assert.deepEqual(payload, {
    clienteId: 'cliente-1',
    projetoId: 'projeto-1',
    valorTotal: 250_075,
    status: 'Aprovado',
    descricao: 'Levantamento cadastral',
    anotacoes: 'Cobrança conforme contrato.',
    formaDePagamento: 'Pix',
    desconto: 10_025,
    codigoOrcamento: 'REC-2026-001',
    dataCompetencia: '2026-07-01',
    dataPagamento: '2026-07-25',
    impostoValor: 7_510,
    impostoRetido: true,
    centroCusto: 'Serviços'
  });
});

test('preserva classificação, reembolso e observações no payload de conta a pagar', () => {
  const payload = buildPayablePayload({
    clienteId: '',
    projetoId: '',
    descricao: 'Combustível de campo',
    fornecedor: 'Posto Central',
    numeroDocumento: 'NF-123',
    valor: '432.18',
    data: '2026-07-31',
    dataCompetencia: '',
    dataPagamento: '',
    categoria: 'Combustível',
    tipoCusto: 'Variável de campo',
    centroCusto: 'Campo',
    reembolsavel: true,
    observacoes: 'Reembolsar na próxima medição.',
    status: 'Pendente',
    formaPagamento: 'Cartão'
  });

  assert.equal(payload.valor, 43_218);
  assert.equal(payload.clienteId, null);
  assert.equal(payload.projetoId, null);
  assert.equal(payload.dataCompetencia, '2026-07-31');
  assert.equal(payload.reembolsavel, true);
  assert.equal(payload.observacoes, 'Reembolsar na próxima medição.');
});

test('validação de receita não seleciona cliente implicitamente e usa mensagens em português', () => {
  const values: RevenueFormValues = {
    clienteId: '',
    projetoId: '',
    valorTotal: '',
    status: 'Em Análise',
    descricao: '',
    anotacoes: '',
    formaDePagamento: 'Pix',
    desconto: '',
    codigoOrcamento: '',
    dataCompetencia: '2026-02-30',
    dataPagamento: '',
    impostoValor: '',
    impostoRetido: false,
    centroCusto: 'Serviços'
  };
  const errors = validateRevenueForm(values);
  assert.equal(errors.clienteId, 'Selecione o cliente responsável pela receita.');
  assert.equal(errors.valorTotal, 'Informe o valor da receita.');
  assert.equal(errors.descricao, 'Informe a descrição da receita.');
  assert.equal(errors.dataCompetencia, 'Informe uma data de competência válida.');
  assert.doesNotMatch(JSON.stringify(errors), /Expected number|nan/i);

  assert.equal(validateRevenueForm({ ...values, clienteId: 'cliente-2', descricao: 'Serviço', valorTotal: '0' }).valorTotal, 'O valor da receita deve ser maior que zero.');
  assert.equal(validateRevenueForm({ ...values, clienteId: 'cliente-2', descricao: 'Serviço', valorTotal: '-1' }).valorTotal, 'O valor da receita não pode ser negativo.');
  assert.match(validateRevenueForm({ ...values, clienteId: 'cliente-2', descricao: 'Serviço', valorTotal: '999999999999' }).valorTotal || '', /excede o limite/);
});

test('validação de conta a pagar diferencia formato, zero e data inválida', () => {
  const values: PayableFormValues = {
    clienteId: '',
    projetoId: '',
    descricao: 'Taxa',
    fornecedor: '',
    numeroDocumento: '',
    valor: 'abc',
    data: '2026-13-01',
    dataCompetencia: '',
    dataPagamento: '',
    categoria: 'Taxas',
    tipoCusto: 'Operacional',
    centroCusto: 'Administrativo',
    reembolsavel: false,
    observacoes: '',
    status: 'Pendente',
    formaPagamento: 'Pix'
  };
  const errors = validatePayableForm(values);
  assert.match(errors.valor || '', /formato válido/);
  assert.equal(errors.data, 'Informe uma data de vencimento válida.');
});

test('fingerprint de rascunho muda somente quando os dados do formulário mudam', () => {
  const revenue = {
    clienteId: '',
    projetoId: '',
    valorTotal: '',
    status: 'Em Análise',
    descricao: '',
    anotacoes: '',
    formaDePagamento: 'Pix',
    desconto: '',
    codigoOrcamento: '',
    dataCompetencia: '2026-07-26',
    dataPagamento: '',
    impostoValor: '',
    impostoRetido: false,
    centroCusto: 'Serviços'
  };
  assert.notEqual(revenueFormFingerprint(revenue), revenueFormFingerprint({ ...revenue, clienteId: 'cliente-2' }));

  const payable = {
    clienteId: '',
    projetoId: '',
    descricao: '',
    fornecedor: '',
    numeroDocumento: '',
    valor: '',
    data: '2026-07-26',
    dataCompetencia: '2026-07-26',
    dataPagamento: '',
    categoria: 'Combustível',
    tipoCusto: 'Variável de campo',
    centroCusto: 'Campo',
    reembolsavel: false,
    observacoes: '',
    status: 'Pendente',
    formaPagamento: 'Pix'
  };
  assert.notEqual(payableFormFingerprint(payable), payableFormFingerprint({ ...payable, valor: '10' }));
});
