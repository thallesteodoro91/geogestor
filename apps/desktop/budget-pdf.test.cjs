const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createBudgetPdfService } = require('./budget-pdf.cjs');

test('exportação grava atomicamente, preserva arquivo em falha, trata cancelamento e restringe abertura', async () => {
  const scratch = path.resolve(__dirname, '../../scratch');
  await fs.mkdir(scratch, { recursive: true });
  const directory = await fs.mkdtemp(path.join(scratch, 'geogestor-orçamento '));
  const destination = path.join(directory, 'Proposta São João');
  const bytes = Buffer.from('%PDF-1.7\nTeste de gravação');
  let chosen = destination;
  let openError = '';
  const opened = [];
  const service = createBudgetPdfService({ chooseDestination: async () => chosen, openPath: async p => { opened.push(p); return openError; } });
  try {
    assert.equal(await service.save({ fileName: 'proposta.pdf', bytes }), `${destination}.pdf`);
    assert.deepEqual(await fs.readFile(`${destination}.pdf`), bytes);
    await service.open(`${destination}.pdf`);
    assert.deepEqual(opened, [`${destination}.pdf`]);
    await assert.rejects(service.open(path.join(directory, 'outro.pdf')), /Exporte/);
    openError = 'No PDF reader';
    await assert.rejects(service.open(`${destination}.pdf`), /foi salvo, mas não pôde ser aberto/);
    chosen = null;
    assert.equal(await service.save({ fileName: 'proposta.pdf', bytes }), null);
    chosen = `${destination}.pdf`;
    const replacement = Buffer.from('%PDF-1.7\nSubstituição');
    await service.save({ fileName: 'proposta.pdf', bytes: replacement });
    assert.deepEqual(await fs.readFile(chosen), replacement);
    chosen = path.join(directory, 'missing', 'falha.pdf');
    await assert.rejects(service.save({ fileName: 'proposta.pdf', bytes }), /Não foi possível salvar/);
    assert.deepEqual(await fs.readFile(`${destination}.pdf`), replacement);
    // A real rename failure (destination is a directory) must clean up staging.
    chosen = path.join(directory, 'pasta.pdf');
    await fs.mkdir(chosen);
    await assert.rejects(service.save({ fileName: 'proposta.pdf', bytes }), /Não foi possível salvar/);
    assert.ok(!(await fs.readdir(directory)).some(f => f.endsWith('.tmp')));
    chosen = path.join(directory, 'proposta.txt');
    await assert.rejects(service.save({ fileName: 'proposta.pdf', bytes }), /extensão .pdf/);
    await assert.rejects(service.save({ fileName: '../proposta.pdf', bytes }), /inválido/);
    await assert.rejects(service.save({ fileName: 'proposta.pdf', bytes: Buffer.from('Não é PDF') }), /inválido/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('seleção pendente bloqueia gravações repetidas até cancelamento', async () => {
  let release;
  const service = createBudgetPdfService({ chooseDestination: () => new Promise(resolve => { release = resolve; }), openPath: async () => '' });
  const payload = { fileName: 'proposta.pdf', bytes: Buffer.from('%PDF-1.7') };
  const operation = service.save(payload);
  await assert.rejects(service.save(payload), /em andamento/);
  release(null);
  assert.equal(await operation, null);
});
