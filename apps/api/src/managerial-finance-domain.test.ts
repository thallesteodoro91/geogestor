import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateInstallmentSettlement,
  calculateReceiptCash,
  normalizeExpenseCategoryCode
} from './services/managerial-finance-domain.service';

test('calcula pagamento parcial e saldo da parcela', () => {
  assert.deepEqual(calculateInstallmentSettlement(100_000, [30_000, 20_000]), {
    valorPago: 50_000,
    saldo: 50_000,
    status: 'Parcialmente pago'
  });
  assert.deepEqual(calculateInstallmentSettlement(100_000, [100_000]), {
    valorPago: 100_000,
    saldo: 0,
    status: 'Pago'
  });
  assert.throws(() => calculateInstallmentSettlement(100_000, [100_001]), /ultrapassar/);
});

test('separa principal, acréscimos, desconto, taxa e caixa recebido', () => {
  assert.deepEqual(calculateReceiptCash({
    valorPrincipal: 100_000,
    juros: 2_000,
    multa: 1_000,
    desconto: 500,
    taxas: 250
  }), {
    valorPrincipal: 100_000,
    juros: 2_000,
    multa: 1_000,
    desconto: 500,
    taxas: 250,
    valorRecebido: 102_250
  });
});

test('normaliza categorias sem depender de acentos ou grafias da interface', () => {
  assert.equal(normalizeExpenseCategoryCode('Cartório'), 'cartorio_taxas');
  assert.equal(normalizeExpenseCategoryCode('Cartorio e taxas'), 'cartorio_taxas');
  assert.equal(normalizeExpenseCategoryCode('Hospedagem de viagem'), 'hospedagem');
});
