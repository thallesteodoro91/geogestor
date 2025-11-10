import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrcamentoData {
  id_orcamento: string;
  data_orcamento: string;
  valor_unitario: number;
  quantidade: number;
  desconto: number;
  valor_imposto: number | null;
  receita_esperada: number | null;
  forma_de_pagamento: string | null;
  situacao_do_pagamento: string | null;
}

interface ClienteData {
  nome: string;
  email: string | null;
  telefone: string | null;
}

interface ServicoData {
  nome_do_servico: string;
}

interface TemplateConfig {
  header: {
    numero: { x: number; y: number; size: number };
    data: { x: number; y: number; size: number };
  };
  cliente: {
    nome: { x: number; y: number; size: number };
    contato: { x: number; y: number; size: number };
  };
  tabela: {
    inicio_x: number;
    inicio_y: number;
    altura_linha: number;
    colunas: {
      descricao: number;
      qtd: number;
      valor_unit: number;
      desconto: number;
      total: number;
    };
  };
  totais: {
    x: number;
    subtotal_y: number;
    impostos_y: number;
    total_y: number;
  };
  rodape: {
    observacoes: { x: number; y: number; size: number };
    pagamento: { x: number; y: number; size: number };
    validade: { x: number; y: number; size: number };
  };
}

export async function generateOrcamentoPDF(
  orcamento: OrcamentoData,
  cliente: ClienteData | null,
  servico: ServicoData | null,
  templateUrl: string,
  config: TemplateConfig
): Promise<void> {
  try {
    // 1. Carregar o template PDF
    const templateBytes = await fetch(templateUrl).then((res) => {
      if (!res.ok) throw new Error('Falha ao carregar template PDF');
      return res.arrayBuffer();
    });

    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // 2. Carregar fontes
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const blackColor = rgb(0, 0, 0);

    // 3. Adicionar cabeçalho
    const orcamentoNumero = orcamento.id_orcamento.slice(0, 8).toUpperCase();
    const dataFormatada = format(new Date(orcamento.data_orcamento), "dd/MM/yyyy", { locale: ptBR });

    firstPage.drawText(`ORÇAMENTO Nº ${orcamentoNumero}`, {
      x: config.header.numero.x,
      y: config.header.numero.y,
      size: config.header.numero.size,
      font: helveticaBold,
      color: blackColor,
    });

    firstPage.drawText(`Data: ${dataFormatada}`, {
      x: config.header.data.x,
      y: config.header.data.y,
      size: config.header.data.size,
      font: helveticaFont,
      color: blackColor,
    });

    // 4. Adicionar dados do cliente
    if (cliente) {
      firstPage.drawText(`CLIENTE: ${cliente.nome}`, {
        x: config.cliente.nome.x,
        y: config.cliente.nome.y,
        size: config.cliente.nome.size,
        font: helveticaBold,
        color: blackColor,
      });

      const contatoInfo = [cliente.email, cliente.telefone].filter(Boolean).join(' | ');
      if (contatoInfo) {
        firstPage.drawText(contatoInfo, {
          x: config.cliente.contato.x,
          y: config.cliente.contato.y,
          size: config.cliente.contato.size,
          font: helveticaFont,
          color: blackColor,
        });
      }
    }

    // 5. Adicionar cabeçalhos da tabela
    const tabelaY = config.tabela.inicio_y;
    const colunas = config.tabela.colunas;

    firstPage.drawText('Descrição', {
      x: colunas.descricao,
      y: tabelaY,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });

    firstPage.drawText('Qtd', {
      x: colunas.qtd,
      y: tabelaY,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });

    firstPage.drawText('Vlr Unit.', {
      x: colunas.valor_unit,
      y: tabelaY,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });

    firstPage.drawText('Desc.', {
      x: colunas.desconto,
      y: tabelaY,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });

    firstPage.drawText('Total', {
      x: colunas.total,
      y: tabelaY,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });

    // 6. Adicionar linha do serviço
    const linhaY = tabelaY - config.tabela.altura_linha;
    const descricaoServico = servico?.nome_do_servico || 'Serviço de Topografia';
    const valorUnitario = orcamento.valor_unitario;
    const quantidade = orcamento.quantidade;
    const desconto = orcamento.desconto || 0;
    const totalLinha = (valorUnitario * quantidade) - desconto;

    firstPage.drawText(descricaoServico, {
      x: colunas.descricao,
      y: linhaY,
      size: 9,
      font: helveticaFont,
      color: blackColor,
      maxWidth: 250,
    });

    firstPage.drawText(quantidade.toString(), {
      x: colunas.qtd,
      y: linhaY,
      size: 9,
      font: helveticaFont,
      color: blackColor,
    });

    firstPage.drawText(formatCurrency(valorUnitario), {
      x: colunas.valor_unit,
      y: linhaY,
      size: 9,
      font: helveticaFont,
      color: blackColor,
    });

    firstPage.drawText(formatCurrency(desconto), {
      x: colunas.desconto,
      y: linhaY,
      size: 9,
      font: helveticaFont,
      color: blackColor,
    });

    firstPage.drawText(formatCurrency(totalLinha), {
      x: colunas.total,
      y: linhaY,
      size: 9,
      font: helveticaFont,
      color: blackColor,
    });

    // 7. Calcular e adicionar totais
    const subtotal = totalLinha;
    const impostos = orcamento.valor_imposto || (subtotal * 0.12);
    const totalGeral = orcamento.receita_esperada || (subtotal + impostos);

    firstPage.drawText(`Subtotal: ${formatCurrency(subtotal)}`, {
      x: config.totais.x,
      y: config.totais.subtotal_y,
      size: 10,
      font: helveticaFont,
      color: blackColor,
    });

    firstPage.drawText(`Impostos (12%): ${formatCurrency(impostos)}`, {
      x: config.totais.x,
      y: config.totais.impostos_y,
      size: 10,
      font: helveticaFont,
      color: blackColor,
    });

    firstPage.drawText(`TOTAL: ${formatCurrency(totalGeral)}`, {
      x: config.totais.x,
      y: config.totais.total_y,
      size: 14,
      font: helveticaBold,
      color: blackColor,
    });

    // 8. Adicionar informações do rodapé
    firstPage.drawText('OBSERVAÇÕES:', {
      x: config.rodape.observacoes.x,
      y: config.rodape.observacoes.y + 30,
      size: config.rodape.observacoes.size,
      font: helveticaBold,
      color: blackColor,
    });

    firstPage.drawText('Validade do orçamento: 30 dias', {
      x: config.rodape.validade.x,
      y: config.rodape.validade.y,
      size: config.rodape.validade.size,
      font: helveticaFont,
      color: blackColor,
    });

    if (orcamento.forma_de_pagamento) {
      firstPage.drawText(`Forma de pagamento: ${orcamento.forma_de_pagamento}`, {
        x: config.rodape.pagamento.x,
        y: config.rodape.pagamento.y,
        size: config.rodape.pagamento.size,
        font: helveticaFont,
        color: blackColor,
      });
    }

    // 9. Salvar e fazer download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const nomeCliente = cliente?.nome.replace(/\s+/g, '_') || 'Cliente';
    link.download = `Orcamento_${orcamentoNumero}_${nomeCliente}_${format(new Date(), 'dd-MM-yyyy')}.pdf`;
    link.click();
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Falha ao gerar o PDF do orçamento');
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
