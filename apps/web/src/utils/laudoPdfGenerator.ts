import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { loadPdfMake } from './loadPdfMake';

export interface LaudoOptions {
  projetoNome: string;
  clienteNome: string;
  tipoLaudo: 'vistoria' | 'fauna' | 'flora' | 'outros';
  dataVistoria: string;
  tecnicoResponsavel: string;
  observacoes: string;
}

export const gerarLaudoTecnico = async (options: LaudoOptions) => {
  const pdfMake = await loadPdfMake();
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  const tituloLaudo = options.tipoLaudo === 'vistoria' ? 'LAUDO DE VISTORIA TÉCNICA' :
                      options.tipoLaudo === 'fauna' ? 'RELATÓRIO DE MONITORAMENTO DE FAUNA' :
                      options.tipoLaudo === 'flora' ? 'INVENTÁRIO FLORESTAL' : 'LAUDO AMBIENTAL';

  const docDefinition: TDocumentDefinitions = {
    info: {
      title: `Laudo_${options.projetoNome.replace(/\s+/g, '_')}`,
      author: 'Geogestor',
    },
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    
    header: function() {
      return {
        text: `GEOGESTOR - Inteligência Territorial`,
        alignment: 'right',
        fontSize: 9,
        color: '#666666',
        margin: [0, 20, 40, 0]
      };
    },

    footer: function(currentPage, pageCount) {
      return {
        columns: [
          { text: `Gerado em: ${dataAtual}`, alignment: 'left', fontSize: 9, color: '#666666' },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', fontSize: 9, color: '#666666' }
        ],
        margin: [40, 20, 40, 0]
      };
    },

    content: [
      {
        text: tituloLaudo,
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 30]
      },
      
      {
        text: '1. INFORMAÇÕES GERAIS',
        style: 'sectionHeader'
      },
      {
        table: {
          widths: ['30%', '70%'],
          body: [
            [{ text: 'Empreendimento/Projeto:', style: 'label' }, { text: options.projetoNome, style: 'value' }],
            [{ text: 'Cliente:', style: 'label' }, { text: options.clienteNome, style: 'value' }],
            [{ text: 'Data da Vistoria:', style: 'label' }, { text: options.dataVistoria, style: 'value' }],
            [{ text: 'Técnico Responsável:', style: 'label' }, { text: options.tecnicoResponsavel, style: 'value' }]
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 30]
      },

      {
        text: '2. OBJETIVO',
        style: 'sectionHeader'
      },
      {
        text: `O presente documento tem por objetivo registrar as condições ambientais constatadas in loco referentes ao projeto ${options.projetoNome}.`,
        style: 'paragraph'
      },

      {
        text: '3. DESCRIÇÃO E CONSTATAÇÕES (PARECER TÉCNICO)',
        style: 'sectionHeader'
      },
      {
        text: options.observacoes || 'Nenhuma observação técnica registrada.',
        style: 'paragraph'
      },

      {
        text: '4. ASSINATURAS',
        style: 'sectionHeader',
        margin: [0, 50, 0, 20]
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1 }] },
              { text: options.tecnicoResponsavel, alignment: 'center', margin: [0, 5, 0, 0], bold: true },
              { text: 'Responsável Técnico', alignment: 'center', fontSize: 10, color: '#666666' }
            ],
            alignment: 'center'
          }
        ]
      }
    ],

    styles: {
      header: {
        fontSize: 18,
        bold: true,
        color: '#047857' // emerald-700
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        color: '#064e3b', // emerald-900
        margin: [0, 15, 0, 10]
      },
      label: {
        bold: true,
        fillColor: '#f4f4f5',
        color: '#3f3f46',
        margin: [5, 5, 5, 5]
      },
      value: {
        margin: [5, 5, 5, 5],
        color: '#18181b'
      },
      paragraph: {
        fontSize: 12,
        lineHeight: 1.5,
        alignment: 'justify',
        margin: [0, 0, 0, 20]
      }
    }
  };

  pdfMake.createPdf(docDefinition).download(`Laudo_${options.projetoNome.replace(/\s+/g, '_')}.pdf`);
};
