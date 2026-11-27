const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// Paths are selected by the native dialog. The renderer can only open PDFs
// successfully saved by this service during the current application session.
function createBudgetPdfService({ chooseDestination, openPath }) {
  const savedPaths = new Set();
  let saving = false;
  return {
    async save(payload) {
      if (saving) throw new Error('Aguarde a exportação do orçamento em andamento.');
      const { fileName, bytes } = payload || {};
      if (typeof fileName !== 'string' || !/^[a-zA-Z0-9_-]{1,160}\.pdf$/.test(fileName)
        || !(bytes instanceof Uint8Array) || bytes.length < 5 || bytes.length > 50 * 1024 * 1024
        || Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') {
        throw new Error('O arquivo do orçamento é inválido. Gere o PDF novamente.');
      }
      saving = true;
      let temporaryPath;
      try {
        const selected = await chooseDestination(fileName);
        if (!selected) return null;
        if (!path.isAbsolute(selected)) throw new Error('Selecione um destino válido para o orçamento.');
        const destination = path.extname(selected) ? selected : `${selected}.pdf`;
        if (path.extname(destination).toLowerCase() !== '.pdf') throw new Error('Salve o orçamento com a extensão .pdf.');
        // Never truncate an existing PDF if generation/writing fails.
        temporaryPath = path.join(path.dirname(destination), `.geogestor-budget-${crypto.randomUUID()}.tmp`);
        await fs.writeFile(temporaryPath, bytes, { flag: 'wx' });
        await fs.rename(temporaryPath, destination);
        temporaryPath = undefined;
        savedPaths.add(destination);
        return destination;
      } catch (error) {
        if (error.message?.startsWith('Selecione') || error.message?.startsWith('Salve')) throw error;
        throw new Error('Não foi possível salvar o orçamento. Confira a pasta, as permissões e o espaço disponível e tente novamente.', { cause: error });
      } finally {
        if (temporaryPath) await fs.rm(temporaryPath, { force: true }).catch(() => {});
        saving = false;
      }
    },
    async open(destination) {
      if (!savedPaths.has(destination)) throw new Error('Exporte o orçamento antes de abrir o arquivo.');
      try {
        const stat = await fs.stat(destination);
        if (!stat.isFile()) throw new Error('Arquivo indisponível');
        const message = await openPath(destination);
        if (message) throw new Error(message);
      } catch {
        throw new Error('O PDF foi salvo, mas não pôde ser aberto. Confira se você possui um leitor de PDF instalado.');
      }
    }
  };
}

module.exports = { createBudgetPdfService };
