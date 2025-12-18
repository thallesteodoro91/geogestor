import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrcamentoItem {
  id_servico: string | null;
  quantidade: number;
  valor_unitario: number;
  desconto: number | null;
  nome_servico?: string;
}

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
  incluir_marco?: boolean;
  marco_quantidade?: number;
  marco_valor_unitario?: number;
  marco_valor_total?: number;
  itens?: OrcamentoItem[];
}

interface ClienteData {
  nome: string;
  email: string | null;
  telefone: string | null;
}

interface ServicoData {
  nome_do_servico: string;
}

interface EmpresaData {
  nome?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
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

// Default configuration for A4 page (595 x 842 points)
const DEFAULT_CONFIG: TemplateConfig = {
  header: {
    numero: { x: 50, y: 780, size: 16 },
    data: { x: 450, y: 780, size: 10 },
  },
  cliente: {
    nome: { x: 50, y: 720, size: 12 },
    contato: { x: 50, y: 700, size: 10 },
  },
  tabela: {
    inicio_x: 50,
    inicio_y: 640,
    altura_linha: 25,
    colunas: {
      descricao: 50,
      qtd: 300,
      valor_unit: 350,
      desconto: 420,
      total: 490,
    },
  },
  totais: {
    x: 400,
    subtotal_y: 500,
    impostos_y: 480,
    total_y: 450,
  },
  rodape: {
    observacoes: { x: 50, y: 380, size: 10 },
    pagamento: { x: 50, y: 340, size: 10 },
    validade: { x: 50, y: 360, size: 10 },
  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function mergeConfig(custom: Partial<TemplateConfig> | null): TemplateConfig {
  if (!custom) return DEFAULT_CONFIG;
  
  return {
    header: {
      numero: { ...DEFAULT_CONFIG.header.numero, ...custom.header?.numero },
      data: { ...DEFAULT_CONFIG.header.data, ...custom.header?.data },
    },
    cliente: {
      nome: { ...DEFAULT_CONFIG.cliente.nome, ...custom.cliente?.nome },
      contato: { ...DEFAULT_CONFIG.cliente.contato, ...custom.cliente?.contato },
    },
    tabela: {
      ...DEFAULT_CONFIG.tabela,
      ...custom.tabela,
      colunas: { ...DEFAULT_CONFIG.tabela.colunas, ...custom.tabela?.colunas },
    },
    totais: { ...DEFAULT_CONFIG.totais, ...custom.totais },
    rodape: {
      observacoes: { ...DEFAULT_CONFIG.rodape.observacoes, ...custom.rodape?.observacoes },
      pagamento: { ...DEFAULT_CONFIG.rodape.pagamento, ...custom.rodape?.pagamento },
      validade: { ...DEFAULT_CONFIG.rodape.validade, ...custom.rodape?.validade },
    },
  };
}

// Draw a horizontal line
function drawLine(page: PDFPage, x1: number, y: number, x2: number, color = rgb(0.8, 0.8, 0.8)) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 1,
    color,
  });
}

/**
 * Generate a professional PDF from scratch (no template required)
 */
export async function generateStandardPDF(
  orcamento: OrcamentoData,
  cliente: ClienteData | null,
  servico: ServicoData | null,
  empresa: EmpresaData | null
): Promise<void> {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const { width, height } = page.getSize();
    const margin = 50;
    const primaryColor = rgb(0.15, 0.4, 0.75); // Professional blue
    const textColor = rgb(0.1, 0.1, 0.1);
    const mutedColor = rgb(0.4, 0.4, 0.4);
    
    let currentY = height - margin;
    
    // ===== HEADER =====
    // Company name or default
    const nomeEmpresa = empresa?.nome || 'Sua Empresa';
    page.drawText(nomeEmpresa.toUpperCase(), {
      x: margin,
      y: currentY,
      size: 20,
      font: helveticaBold,
      color: primaryColor,
    });
    
    // Budget number and date on the right
    const orcamentoNumero = orcamento.id_orcamento.slice(0, 8).toUpperCase();
    const dataFormatada = format(new Date(orcamento.data_orcamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    page.drawText(`ORÇAMENTO Nº ${orcamentoNumero}`, {
      x: width - margin - 200,
      y: currentY,
      size: 12,
      font: helveticaBold,
      color: textColor,
    });
    
    currentY -= 18;
    page.drawText(dataFormatada, {
      x: width - margin - 200,
      y: currentY,
      size: 10,
      font: helvetica,
      color: mutedColor,
    });
    
    // Company contact info
    currentY = height - margin - 20;
    if (empresa?.endereco) {
      page.drawText(empresa.endereco, {
        x: margin,
        y: currentY,
        size: 9,
        font: helvetica,
        color: mutedColor,
      });
      currentY -= 12;
    }
    
    if (empresa?.telefone || empresa?.email) {
      const contato = [empresa.telefone, empresa.email].filter(Boolean).join(' | ');
      page.drawText(contato, {
        x: margin,
        y: currentY,
        size: 9,
        font: helvetica,
        color: mutedColor,
      });
    }
    
    // Separator line
    currentY -= 30;
    drawLine(page, margin, currentY, width - margin, primaryColor);
    
    // ===== CLIENT SECTION =====
    currentY -= 30;
    page.drawText('CLIENTE', {
      x: margin,
      y: currentY,
      size: 11,
      font: helveticaBold,
      color: primaryColor,
    });
    
    currentY -= 20;
    const clienteNome = cliente?.nome || 'Cliente não informado';
    page.drawText(clienteNome, {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
      color: textColor,
    });
    
    if (cliente) {
      currentY -= 15;
      const clienteContato = [cliente.email, cliente.telefone].filter(Boolean).join(' | ');
      if (clienteContato) {
        page.drawText(clienteContato, {
          x: margin,
          y: currentY,
          size: 10,
          font: helvetica,
          color: mutedColor,
        });
      }
    }
    
    // ===== SERVICES TABLE =====
    currentY -= 40;
    
    // Table header background
    page.drawRectangle({
      x: margin,
      y: currentY - 5,
      width: width - 2 * margin,
      height: 25,
      color: rgb(0.95, 0.95, 0.95),
    });
    
    // Table headers
    const colDescricao = margin + 10;
    const colQtd = margin + 280;
    const colUnitario = margin + 330;
    const colDesconto = margin + 400;
    const colTotal = margin + 470;
    
    page.drawText('DESCRIÇÃO', { x: colDescricao, y: currentY, size: 9, font: helveticaBold, color: textColor });
    page.drawText('QTD', { x: colQtd, y: currentY, size: 9, font: helveticaBold, color: textColor });
    page.drawText('UNIT.', { x: colUnitario, y: currentY, size: 9, font: helveticaBold, color: textColor });
    page.drawText('DESC.', { x: colDesconto, y: currentY, size: 9, font: helveticaBold, color: textColor });
    page.drawText('TOTAL', { x: colTotal, y: currentY, size: 9, font: helveticaBold, color: textColor });
    
    // Table rows - use itens if available
    currentY -= 30;
    let subtotal = 0;
    
    if (orcamento.itens && orcamento.itens.length > 0) {
      // Render each item from budget
      for (const item of orcamento.itens) {
        const descricaoServico = item.nome_servico || 'Serviço';
        const valorUnitario = item.valor_unitario || 0;
        const quantidade = item.quantidade || 1;
        const desconto = item.desconto || 0;
        const totalLinha = (valorUnitario * quantidade) * (1 - desconto / 100);
        subtotal += totalLinha;
        
        // Truncate description if too long
        const maxDescLength = 40;
        const descricaoDisplay = descricaoServico.length > maxDescLength 
          ? descricaoServico.substring(0, maxDescLength) + '...' 
          : descricaoServico;
        
        page.drawText(descricaoDisplay, { x: colDescricao, y: currentY, size: 10, font: helvetica, color: textColor });
        page.drawText(quantidade.toString(), { x: colQtd, y: currentY, size: 10, font: helvetica, color: textColor });
        page.drawText(formatCurrency(valorUnitario), { x: colUnitario, y: currentY, size: 10, font: helvetica, color: textColor });
        page.drawText(`${desconto}%`, { x: colDesconto, y: currentY, size: 10, font: helvetica, color: textColor });
        page.drawText(formatCurrency(totalLinha), { x: colTotal, y: currentY, size: 10, font: helveticaBold, color: textColor });
        
        currentY -= 20;
      }
    } else {
      // Fallback to single row
      const descricaoServico = servico?.nome_do_servico || 'Serviço de Topografia';
      const valorUnitario = orcamento.valor_unitario;
      const quantidade = orcamento.quantidade;
      const desconto = orcamento.desconto || 0;
      const totalLinha = (valorUnitario * quantidade) - desconto;
      subtotal = totalLinha;
      
      const maxDescLength = 40;
      const descricaoDisplay = descricaoServico.length > maxDescLength 
        ? descricaoServico.substring(0, maxDescLength) + '...' 
        : descricaoServico;
      
      page.drawText(descricaoDisplay, { x: colDescricao, y: currentY, size: 10, font: helvetica, color: textColor });
      page.drawText(quantidade.toString(), { x: colQtd, y: currentY, size: 10, font: helvetica, color: textColor });
      page.drawText(formatCurrency(valorUnitario), { x: colUnitario, y: currentY, size: 10, font: helvetica, color: textColor });
      page.drawText(formatCurrency(desconto), { x: colDesconto, y: currentY, size: 10, font: helvetica, color: textColor });
      page.drawText(formatCurrency(totalLinha), { x: colTotal, y: currentY, size: 10, font: helveticaBold, color: textColor });
      
      currentY -= 20;
    }
    
    // Add marcos geodésicos if included
    if (orcamento.incluir_marco && orcamento.marco_quantidade && orcamento.marco_quantidade > 0) {
      const marcoValorUnit = orcamento.marco_valor_unitario || 0;
      const marcoQtd = orcamento.marco_quantidade;
      const marcoTotal = orcamento.marco_valor_total || (marcoValorUnit * marcoQtd);
      subtotal += marcoTotal;
      
      page.drawText('Marcos Geodésicos', { x: colDescricao, y: currentY, size: 10, font: helvetica, color: textColor });
      page.drawText(marcoQtd.toString(), { x: colQtd, y: currentY, size: 10, font: helvetica, color: textColor });
      page.drawText(formatCurrency(marcoValorUnit), { x: colUnitario, y: currentY, size: 10, font: helvetica, color: textColor });
      page.drawText('0%', { x: colDesconto, y: currentY, size: 10, font: helvetica, color: textColor });
      page.drawText(formatCurrency(marcoTotal), { x: colTotal, y: currentY, size: 10, font: helveticaBold, color: textColor });
      
      currentY -= 20;
    }
    
    // Line below table
    currentY -= 5;
    drawLine(page, margin, currentY, width - margin);
    
    // ===== TOTALS SECTION (sem impostos) =====
    currentY -= 30;
    const totalGeral = orcamento.receita_esperada || subtotal;
    
    const totalsX = width - margin - 180;
    
    page.drawText('Subtotal:', { x: totalsX, y: currentY, size: 10, font: helvetica, color: mutedColor });
    page.drawText(formatCurrency(subtotal), { x: totalsX + 80, y: currentY, size: 10, font: helvetica, color: textColor });
    
    currentY -= 25;
    drawLine(page, totalsX, currentY + 10, width - margin);
    page.drawText('TOTAL:', { x: totalsX, y: currentY, size: 12, font: helveticaBold, color: primaryColor });
    page.drawText(formatCurrency(totalGeral), { x: totalsX + 80, y: currentY, size: 12, font: helveticaBold, color: primaryColor });
    
    // ===== CONDITIONS SECTION =====
    currentY -= 60;
    page.drawText('CONDIÇÕES', {
      x: margin,
      y: currentY,
      size: 11,
      font: helveticaBold,
      color: primaryColor,
    });
    
    currentY -= 20;
    const conditions = [
      'Validade do orçamento: 30 dias',
      orcamento.forma_de_pagamento ? `Forma de pagamento: ${orcamento.forma_de_pagamento}` : null,
      orcamento.situacao_do_pagamento ? `Situação do pagamento: ${orcamento.situacao_do_pagamento}` : null,
      'Prazo de execução: A combinar',
    ].filter(Boolean);
    
    conditions.forEach(condition => {
      if (condition) {
        page.drawText(`• ${condition}`, {
          x: margin + 10,
          y: currentY,
          size: 10,
          font: helvetica,
          color: textColor,
        });
        currentY -= 15;
      }
    });
    
    // ===== FOOTER =====
    const footerY = margin + 30;
    drawLine(page, margin, footerY + 20, width - margin, primaryColor);
    
    page.drawText('Este orçamento foi gerado automaticamente pelo sistema SkyGeo 360.', {
      x: margin,
      y: footerY,
      size: 8,
      font: helvetica,
      color: mutedColor,
    });
    
    // Download
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
    console.error('Erro ao gerar PDF padrão:', error);
    throw new Error('Falha ao gerar o PDF do orçamento');
  }
}

/**
 * Generate PDF using a custom template
 */
export async function generateOrcamentoPDF(
  orcamento: OrcamentoData,
  cliente: ClienteData | null,
  servico: ServicoData | null,
  templateUrl: string | null,
  config: Partial<TemplateConfig> | null,
  empresa?: EmpresaData | null
): Promise<void> {
  // If no template URL, generate a standard PDF
  if (!templateUrl) {
    return generateStandardPDF(orcamento, cliente, servico, empresa || null);
  }

  try {
    // Merge with default config
    const finalConfig = mergeConfig(config);
    
    // Load template PDF
    const templateBytes = await fetch(templateUrl).then((res) => {
      if (!res.ok) throw new Error('Falha ao carregar template PDF');
      return res.arrayBuffer();
    });

    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const blackColor = rgb(0, 0, 0);

    // Add header
    const orcamentoNumero = orcamento.id_orcamento.slice(0, 8).toUpperCase();
    const dataFormatada = format(new Date(orcamento.data_orcamento), "dd/MM/yyyy", { locale: ptBR });

    firstPage.drawText(`ORÇAMENTO Nº ${orcamentoNumero}`, {
      x: finalConfig.header.numero.x,
      y: finalConfig.header.numero.y,
      size: finalConfig.header.numero.size,
      font: helveticaBold,
      color: blackColor,
    });

    firstPage.drawText(`Data: ${dataFormatada}`, {
      x: finalConfig.header.data.x,
      y: finalConfig.header.data.y,
      size: finalConfig.header.data.size,
      font: helveticaFont,
      color: blackColor,
    });

    // Add client data
    if (cliente) {
      firstPage.drawText(`CLIENTE: ${cliente.nome}`, {
        x: finalConfig.cliente.nome.x,
        y: finalConfig.cliente.nome.y,
        size: finalConfig.cliente.nome.size,
        font: helveticaBold,
        color: blackColor,
      });

      const contatoInfo = [cliente.email, cliente.telefone].filter(Boolean).join(' | ');
      if (contatoInfo) {
        firstPage.drawText(contatoInfo, {
          x: finalConfig.cliente.contato.x,
          y: finalConfig.cliente.contato.y,
          size: finalConfig.cliente.contato.size,
          font: helveticaFont,
          color: blackColor,
        });
      }
    }

    // Add table headers
    let tabelaY = finalConfig.tabela.inicio_y;
    const colunas = finalConfig.tabela.colunas;

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

    // Add service rows
    let linhaY = tabelaY - finalConfig.tabela.altura_linha;
    let subtotal = 0;
    const maxDescLength = 35;

    if (orcamento.itens && orcamento.itens.length > 0) {
      for (const item of orcamento.itens) {
        const descricaoServico = item.nome_servico || 'Serviço';
        const valorUnitario = item.valor_unitario || 0;
        const quantidade = item.quantidade || 1;
        const desconto = item.desconto || 0;
        const totalLinha = (valorUnitario * quantidade) * (1 - desconto / 100);
        subtotal += totalLinha;

        const descricaoDisplay = descricaoServico.length > maxDescLength
          ? descricaoServico.substring(0, maxDescLength) + '...'
          : descricaoServico;

        firstPage.drawText(descricaoDisplay, {
          x: colunas.descricao,
          y: linhaY,
          size: 9,
          font: helveticaFont,
          color: blackColor,
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

        firstPage.drawText(`${desconto}%`, {
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

        linhaY -= finalConfig.tabela.altura_linha;
      }
    } else {
      // Fallback single row
      const descricaoServico = servico?.nome_do_servico || 'Serviço de Topografia';
      const valorUnitario = orcamento.valor_unitario;
      const quantidade = orcamento.quantidade;
      const desconto = orcamento.desconto || 0;
      const totalLinha = (valorUnitario * quantidade) - desconto;
      subtotal = totalLinha;

      const descricaoDisplay = descricaoServico.length > maxDescLength
        ? descricaoServico.substring(0, maxDescLength) + '...'
        : descricaoServico;

      firstPage.drawText(descricaoDisplay, {
        x: colunas.descricao,
        y: linhaY,
        size: 9,
        font: helveticaFont,
        color: blackColor,
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

      linhaY -= finalConfig.tabela.altura_linha;
    }

    // Add marcos geodésicos if included
    if (orcamento.incluir_marco && orcamento.marco_quantidade && orcamento.marco_quantidade > 0) {
      const marcoValorUnit = orcamento.marco_valor_unitario || 0;
      const marcoQtd = orcamento.marco_quantidade;
      const marcoTotal = orcamento.marco_valor_total || (marcoValorUnit * marcoQtd);
      subtotal += marcoTotal;

      firstPage.drawText('Marcos Geodésicos', {
        x: colunas.descricao,
        y: linhaY,
        size: 9,
        font: helveticaFont,
        color: blackColor,
      });

      firstPage.drawText(marcoQtd.toString(), {
        x: colunas.qtd,
        y: linhaY,
        size: 9,
        font: helveticaFont,
        color: blackColor,
      });

      firstPage.drawText(formatCurrency(marcoValorUnit), {
        x: colunas.valor_unit,
        y: linhaY,
        size: 9,
        font: helveticaFont,
        color: blackColor,
      });

      firstPage.drawText('0%', {
        x: colunas.desconto,
        y: linhaY,
        size: 9,
        font: helveticaFont,
        color: blackColor,
      });

      firstPage.drawText(formatCurrency(marcoTotal), {
        x: colunas.total,
        y: linhaY,
        size: 9,
        font: helveticaFont,
        color: blackColor,
      });
    }

    // Calculate and add totals (sem impostos)
    const totalGeral = orcamento.receita_esperada || subtotal;

    firstPage.drawText(`Subtotal: ${formatCurrency(subtotal)}`, {
      x: finalConfig.totais.x,
      y: finalConfig.totais.subtotal_y,
      size: 10,
      font: helveticaFont,
      color: blackColor,
    });

    firstPage.drawText(`TOTAL: ${formatCurrency(totalGeral)}`, {
      x: finalConfig.totais.x,
      y: finalConfig.totais.total_y,
      size: 14,
      font: helveticaBold,
      color: blackColor,
    });

    // Add footer info
    firstPage.drawText('OBSERVAÇÕES:', {
      x: finalConfig.rodape.observacoes.x,
      y: finalConfig.rodape.observacoes.y + 30,
      size: finalConfig.rodape.observacoes.size,
      font: helveticaBold,
      color: blackColor,
    });

    firstPage.drawText('Validade do orçamento: 30 dias', {
      x: finalConfig.rodape.validade.x,
      y: finalConfig.rodape.validade.y,
      size: finalConfig.rodape.validade.size,
      font: helveticaFont,
      color: blackColor,
    });

    if (orcamento.forma_de_pagamento) {
      firstPage.drawText(`Forma de pagamento: ${orcamento.forma_de_pagamento}`, {
        x: finalConfig.rodape.pagamento.x,
        y: finalConfig.rodape.pagamento.y,
        size: finalConfig.rodape.pagamento.size,
        font: helveticaFont,
        color: blackColor,
      });
    }

    if (orcamento.situacao_do_pagamento) {
      firstPage.drawText(`Situação do pagamento: ${orcamento.situacao_do_pagamento}`, {
        x: finalConfig.rodape.pagamento.x,
        y: finalConfig.rodape.pagamento.y - 15,
        size: finalConfig.rodape.pagamento.size,
        font: helveticaFont,
        color: blackColor,
      });
    }

    // Save and download
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
    console.error('Erro ao gerar PDF com template:', error);
    // Fallback to standard PDF if template fails
    console.log('Gerando PDF padrão como fallback...');
    return generateStandardPDF(orcamento, cliente, servico, empresa || null);
  }
}
