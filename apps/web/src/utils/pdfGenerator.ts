import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { loadPdfMake } from './loadPdfMake';

interface ProjetoPdfItem {
  nome?: string | null;
  clienteNome?: string | null;
  status?: string | null;
  tipo?: string | null;
  areaHa?: number | string | null;
  situacaoImovel?: string | null;
  matricula?: string | null;
  averbacao?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  municipio?: string | null;
  cidade?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  possuiMemorialDescritivo?: string | null;
  observacoes?: string | null;
}

export const gerarRelatorioProjeto = async (projeto: ProjetoPdfItem) => {
  const pdfMake = await loadPdfMake();
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    header: {
      text: 'GeoGestor - Sistema de Gestão Geográfica',
      margin: [40, 20],
      fontSize: 10,
      color: '#a1a1aa',
      alignment: 'right'
    },
    footer: function(currentPage: number, pageCount: number) {
      return {
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'center',
        fontSize: 10,
        margin: [0, 20],
        color: '#a1a1aa'
      };
    },
    content: [
      {
        text: 'RELATÓRIO TÉCNICO DO IMÓVEL',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 30]
      },
      {
        text: `Projeto: ${projeto.nome || 'Não Informado'}`,
        style: 'subheader',
        margin: [0, 0, 0, 20]
      },

      // --- DADOS DO CLIENTE ---
      {
        text: 'DADOS DO CLIENTE',
        style: 'sectionHeader'
      },
      {
        table: {
          widths: ['30%', '70%'],
          body: [
            [{ text: 'Nome/Razão Social:', bold: true, color: '#3f3f46' }, { text: projeto.clienteNome || 'Não informado', color: '#52525b' }],
            [{ text: 'Status Operacional:', bold: true, color: '#3f3f46' }, { text: projeto.status || 'Não informado', color: '#52525b' }],
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 30]
      },

      // --- CARACTERÍSTICAS DA PROPRIEDADE ---
      {
        text: 'CARACTERÍSTICAS DA PROPRIEDADE',
        style: 'sectionHeader'
      },
      {
        table: {
          widths: ['30%', '70%'],
          body: [
            [{ text: 'Tipo de Imóvel:', bold: true, color: '#3f3f46' }, { text: projeto.tipo || 'Não informado', color: '#52525b' }],
            [{ text: 'Área (Hectares):', bold: true, color: '#3f3f46' }, { text: projeto.areaHa ? `${projeto.areaHa} ha` : 'Não informado', color: '#52525b' }],
            [{ text: 'Situação Fundiária:', bold: true, color: '#3f3f46' }, { text: projeto.situacaoImovel || 'Não informado', color: '#52525b' }],
            [{ text: 'Matrícula:', bold: true, color: '#3f3f46' }, { text: projeto.matricula || 'Não informado', color: '#52525b' }],
            [{ text: 'Averbação:', bold: true, color: '#3f3f46' }, { text: projeto.averbacao || 'Não informado', color: '#52525b' }],
            [{ text: 'CAR:', bold: true, color: '#3f3f46' }, { text: projeto.car || 'Não informado', color: '#52525b' }],
            [{ text: 'CCIR:', bold: true, color: '#3f3f46' }, { text: projeto.ccir || 'Não informado', color: '#52525b' }],
            [{ text: 'ITR / NIRF:', bold: true, color: '#3f3f46' }, { text: projeto.itr || 'Não informado', color: '#52525b' }],
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 30]
      },

      // --- GEOLOCALIZAÇÃO ---
      {
        text: 'GEOLOCALIZAÇÃO E ENDEREÇO',
        style: 'sectionHeader'
      },
      {
        table: {
          widths: ['30%', '70%'],
          body: [
            [{ text: 'Município / UF:', bold: true, color: '#3f3f46' }, { text: `${projeto.municipio || 'N/A'} - ${projeto.cidade || 'N/A'}`, color: '#52525b' }],
            [{ text: 'Latitude:', bold: true, color: '#3f3f46' }, { text: projeto.latitude ? projeto.latitude.toString() : 'Não informado', color: '#52525b' }],
            [{ text: 'Longitude:', bold: true, color: '#3f3f46' }, { text: projeto.longitude ? projeto.longitude.toString() : 'Não informado', color: '#52525b' }],
            [{ text: 'Memorial Descritivo:', bold: true, color: '#3f3f46' }, { text: projeto.possuiMemorialDescritivo || 'Não informado', color: '#52525b' }],
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 30]
      },

      // --- OBSERVAÇÕES TÉCNICAS ---
      {
        text: 'OBSERVAÇÕES TÉCNICAS',
        style: 'sectionHeader'
      },
      {
        text: projeto.observacoes || 'Nenhuma observação técnica registrada para este imóvel.',
        color: '#52525b',
        italics: !projeto.observacoes,
        margin: [0, 0, 0, 50]
      },

      // --- ASSINATURA ---
      {
        columns: [
          {
            width: '100%',
            alignment: 'center',
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 250, y2: 0, lineWidth: 1 }] },
              { text: 'Responsável Técnico / GeoGestor', margin: [0, 10, 0, 0], bold: true, color: '#3f3f46' },
              { text: `Data de Emissão: ${dataAtual}`, color: '#a1a1aa', fontSize: 10, margin: [0, 5, 0, 0] }
            ]
          }
        ]
      }
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true,
        color: '#09090b'
      },
      subheader: {
        fontSize: 14,
        bold: true,
        color: '#52525b'
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        color: '#18181b',
        margin: [0, 0, 0, 10]
      }
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      lineHeight: 1.5
    }
  };

  // Gerar e baixar
  const pdfFilename = `Relatorio_Tecnico_${projeto.nome?.replace(/\s+/g, '_') || 'Projeto'}.pdf`;
  pdfMake.createPdf(docDefinition).download(pdfFilename);
};

interface OrcamentoServicoItemPdf {
  quantidade?: string | number;
  descricao?: string;
  valorUnitario?: string | number;
  descontoPct?: string | number;
  total?: string | number;
}

interface OrcamentoPdfItem {
  id?: string | null;
  clienteNome?: string | null;
  status?: string | null;
  valorTotal: number;
  descricao?: string | null;
  anotacoes?: string | null;
  formaDePagamento?: string | null;
  desconto?: number | null;
  codigoOrcamento?: string | null;
  dataOrcamento?: string | null;
  itensJson?: string | OrcamentoServicoItemPdf[] | null;
  possuiMarco?: boolean | null;
  marcoQtd?: number | string | null;
  marcoValor?: number | string | null;
  possuiImposto?: boolean | null;
  impostoPorcentagem?: number | string | null;
  titulo?: string | null;
  validadeDias?: number | string | null;
  condicoesPagamento?: string | null;
  itens?: OrcamentoServicoItemPdf[] | null;
}

export const gerarOrcamentoPDF = async (orcamento: OrcamentoPdfItem) => {
  const pdfMake = await loadPdfMake();
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orcamento.valorTotal / 100);

  // Read company template from localStorage
  let empresaConfig: {
    logo?: string;
    razao?: string;
    cnpj?: string;
    telefone?: string;
    email?: string;
    endereco?: string;
    cor?: string;
    termos?: string;
  } = {};
  try {
    empresaConfig = JSON.parse(localStorage.getItem('geogestor_empresa_template') || '{}');
  } catch {
    // ignore parse error
  }

  const corDestaque = empresaConfig.cor || '#059669'; // Emerald default

  const parsedItens = orcamento.itens
    || (orcamento.itensJson
      ? (typeof orcamento.itensJson === 'string' ? JSON.parse(orcamento.itensJson) : orcamento.itensJson)
      : []);

  const tableBody: TableCell[][] = [
    [
      { text: 'Item / Descrição', bold: true, fillColor: corDestaque, color: '#ffffff' },
      { text: 'Qtd.', bold: true, fillColor: corDestaque, color: '#ffffff', alignment: 'center' },
      { text: 'Un.', bold: true, fillColor: corDestaque, color: '#ffffff', alignment: 'center' },
      { text: 'Vl. Unit.', bold: true, fillColor: corDestaque, color: '#ffffff', alignment: 'right' },
      { text: 'Total', bold: true, fillColor: corDestaque, color: '#ffffff', alignment: 'right' }
    ]
  ];

  let calculatedSubtotal = 0;

  if (parsedItens && parsedItens.length > 0) {
    parsedItens.forEach((item: OrcamentoServicoItemPdf) => {
      const qty = typeof item.quantidade === 'string' ? parseFloat(item.quantidade) : (item.quantidade || 0);
      const unitVal = typeof item.valorUnitario === 'string' ? parseFloat(item.valorUnitario) : (item.valorUnitario || 0);
      const disc = typeof item.descontoPct === 'string' ? parseFloat(item.descontoPct) : (item.descontoPct || 0);
      const itemTotal = qty * unitVal * (1 - disc / 100);
      calculatedSubtotal += itemTotal;

      tableBody.push([
        { text: item.descricao || 'Serviço Técnico', color: '#3f3f46', bold: true },
        { text: qty.toString(), alignment: 'center', color: '#52525b' },
        { text: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitVal / 100), alignment: 'right', color: '#52525b' },
        { text: `${disc}%`, alignment: 'center', color: '#52525b' },
        { text: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemTotal / 100), alignment: 'right', color: '#3f3f46', bold: true }
      ]);
    });
  } else {
    const fallbackVal = orcamento.desconto ? orcamento.valorTotal + orcamento.desconto : orcamento.valorTotal;
    calculatedSubtotal = fallbackVal;
    tableBody.push([
      { text: orcamento.titulo || orcamento.descricao || 'Serviço Especializado de Topografia', color: '#3f3f46', bold: true },
      { text: '1', alignment: 'center', color: '#52525b' },
      { text: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fallbackVal / 100), alignment: 'right', color: '#52525b' },
      { text: '0%', alignment: 'center', color: '#52525b' },
      { text: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fallbackVal / 100), alignment: 'right', color: '#3f3f46', bold: true }
    ]);
  }

  if (orcamento.possuiMarco) {
    const qty = typeof orcamento.marcoQtd === 'number' ? orcamento.marcoQtd : parseFloat(String(orcamento.marcoQtd ?? '0')) || 0;
    const unitVal = typeof orcamento.marcoValor === 'number' ? orcamento.marcoValor : parseFloat(String(orcamento.marcoValor ?? '0')) || 0;
    const itemTotal = qty * unitVal;
    calculatedSubtotal += itemTotal;

    tableBody.push([
      { text: 'Marco Geodésico Homologado (Adicional)', color: '#52525b', italics: true },
      { text: qty.toString(), alignment: 'center', color: '#52525b' },
      { text: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitVal / 100), alignment: 'right', color: '#52525b' },
      { text: '0%', alignment: 'center', color: '#52525b' },
      { text: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemTotal / 100), alignment: 'right', color: '#52525b' }
    ]);
  }

  if (orcamento.possuiImposto) {
    const taxPct = typeof orcamento.impostoPorcentagem === 'number' ? orcamento.impostoPorcentagem : parseFloat(String(orcamento.impostoPorcentagem ?? '0')) || 0;
    const taxVal = calculatedSubtotal * (taxPct / 100);

    tableBody.push([
      { text: `Impostos & Tributos (${taxPct}%)`, color: '#71717a', bold: true, colSpan: 4 },
      {}, {}, {},
      { text: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(taxVal / 100), alignment: 'right', color: '#71717a', bold: true }
    ]);
  }

  // Final Total Row
  tableBody.push([
    { text: 'INVESTIMENTO TOTAL ESTIMADO', color: '#09090b', bold: true, colSpan: 4 },
    {}, {}, {},
    { text: valorFormatado, alignment: 'right', color: corDestaque, bold: true, fontSize: 12 }
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headerLeftColumn: any[] = [];
  if (empresaConfig.logo) {
    headerLeftColumn.push({ image: empresaConfig.logo, width: 120, margin: [0, 0, 0, 8] });
  }
  headerLeftColumn.push({ text: empresaConfig.razao || 'GeoGestor - Soluções em Geotecnologia', fontSize: 14, bold: true, color: '#09090b' });
  if (empresaConfig.endereco) headerLeftColumn.push({ text: empresaConfig.endereco, fontSize: 8, color: '#71717a', margin: [0, 2, 0, 0] });

  const contatosStr = [
    empresaConfig.cnpj ? `CNPJ: ${empresaConfig.cnpj}` : '',
    empresaConfig.telefone || '',
    empresaConfig.email || ''
  ].filter(Boolean).join('\n');

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    footer: function(currentPage: number, pageCount: number) {
      return {
        columns: [
          { text: empresaConfig.razao || 'GeoGestor', fontSize: 8, color: '#a1a1aa', margin: [40, 20] },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', fontSize: 8, margin: [40, 20], color: '#a1a1aa' }
        ]
      };
    },
    content: [
      // Company Header Box
      {
        columns: [
          { width: '65%', stack: headerLeftColumn },
          { 
            width: '35%', 
            alignment: 'right', 
            stack: [
              { text: 'PROPOSTA COMERCIAL', fontSize: 14, bold: true, color: corDestaque, characterSpacing: 1 },
              { text: `Ref: ${orcamento.codigoOrcamento || 'ORC-001'}`, fontSize: 10, bold: true, color: '#3f3f46', margin: [0, 4, 0, 0] },
              { text: `Emissão: ${dataAtual}`, fontSize: 9, color: '#71717a', margin: [0, 2, 0, 6] },
              { text: contatosStr, fontSize: 8, color: '#52525b', lineHeight: 1.3 }
            ]
          }
        ],
        margin: [0, 0, 0, 25]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: corDestaque }] },
      { text: '', margin: [0, 0, 0, 15] },

      // Client Box
      {
        table: {
          widths: ['100%'],
          body: [
            [
              {
                fillColor: '#fafafa',
                border: [false, false, false, false],
                stack: [
                  { text: 'DESTINATÁRIO / CLIENTE', fontSize: 8, bold: true, color: corDestaque, margin: [0, 0, 0, 4] },
                  { text: orcamento.clienteNome || 'Cliente não especificado', fontSize: 12, bold: true, color: '#18181b' },
                  { text: `Título da Proposta: ${orcamento.titulo || orcamento.descricao || 'Serviços Topográficos'}`, fontSize: 9, color: '#52525b', margin: [0, 2, 0, 0] }
                ],
                margin: [10, 8, 10, 8]
              }
            ]
          ]
        },
        margin: [0, 0, 0, 25]
      },

      { text: ' ESCOPO & ESPECIFICAÇÃO DOS SERVIÇOS', fontSize: 11, bold: true, color: '#18181b', margin: [0, 0, 0, 10] },
      {
        table: {
          widths: ['*', '10%', '20%', '12%', '22%'],
          body: tableBody
        },
        layout: {
          hLineWidth: function(i: number, node: { table: { body: unknown[][] } }) {
            return (i === 0 || i === node.table.body.length) ? 1.5 : 0.5;
          },
          vLineWidth: function() { return 0; },
          hLineColor: function(i: number, node: { table: { body: unknown[][] } }) {
            return (i === 0 || i === node.table.body.length) ? corDestaque : '#e4e4e7';
          },
          paddingTop: function() { return 7; },
          paddingBottom: function() { return 7; }
        },
        margin: [0, 0, 0, 25]
      },

      { text: ' ANOTAÇÕES TÉCNICAS', fontSize: 10, bold: true, color: '#18181b', margin: [0, 0, 0, 6] },
      {
        text: orcamento.anotacoes || 'Execução sob rigoroso padrão técnico geodésico e normas vigentes.',
        color: '#52525b',
        fontSize: 9,
        italics: !orcamento.anotacoes,
        margin: [0, 0, 0, 20]
      },

      // Terms & Conditions Block
      {
        table: {
          widths: ['100%'],
          body: [
            [
              {
                fillColor: '#fcfcfc',
                border: [true, true, true, true],
                borderColor: ['#f4f4f5', '#f4f4f5', '#f4f4f5', '#f4f4f5'],
                stack: [
                  { text: 'TERMOS COMERCIAIS & CONDIÇÕES GERAIS', fontSize: 8, bold: true, color: '#71717a', margin: [0, 0, 0, 4] },
                  { text: `• Validade desta proposta: ${orcamento.validadeDias || '15'} dias corridos.`, fontSize: 8.5, color: '#3f3f46' },
                  { text: `• Condições de Pagamento: ${orcamento.condicoesPagamento || orcamento.formaDePagamento || 'A combinar / 50% Entrada + 50% Entrega'}.`, fontSize: 8.5, color: '#3f3f46', margin: [0, 2, 0, 4] },
                  { text: empresaConfig.termos || '', fontSize: 8, color: '#71717a', leadingIndent: 0 }
                ],
                margin: [10, 8, 10, 8]
              }
            ]
          ]
        },
        margin: [0, 0, 0, 40]
      },

      // Signature Block
      {
        columns: [
          { width: '20%', text: '' },
          {
            width: '60%',
            alignment: 'center',
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 260, y2: 0, lineWidth: 1, lineColor: '#a1a1aa' }] },
              { text: empresaConfig.razao || 'GeoGestor Responsável Técnico', margin: [0, 8, 0, 0], bold: true, fontSize: 10, color: '#18181b' },
              { text: 'DE ACORDO (ASSINATURA DO CLIENTE)', fontSize: 8, color: '#71717a', margin: [0, 4, 0, 0] }
            ]
          },
          { width: '20%', text: '' }
        ],
        unbreakable: true
      }
    ],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      lineHeight: 1.4
    }
  };

  const cleanName = orcamento.clienteNome?.replace(/\s+/g, '_') || 'Cliente';
  const pdfFilename = `Orcamento_${cleanName}_Ref_${orcamento.codigoOrcamento || '001'}.pdf`;
  pdfMake.createPdf(docDefinition).download(pdfFilename);
};
