import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';


export interface LaudoOptions {
  projetoNome: string;
  clienteNome: string;
  tipoLaudo: 'acompanhamento' | 'vistoria' | 'fauna' | 'flora' | 'outros';
  dataVistoria: string;
  tecnicoResponsavel: string;
  observacoes: string;
  tipoDemanda?: string;
  propriedadeNome?: string;
  protocolo?: string;
  orgaoAmbiental?: string;
  finalidade?: string;
  documentosConsiderados?: string;
  proximosPassos?: string;
  situacaoTrabalho?: string;
  faseAmbiental?: string;
  sintese?: string;
  empresa?: { razao?: string; logo?: string; telefone?: string; email?: string; endereco?: string };
  emissao?: { codigo: string; revisao: number };
  preview?: boolean;
}

export const sanitizeLaudoFileName = (projectName: string) => {
  const sanitized = projectName
    .normalize('NFC')
    .split('')
    .map((character) => character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? ' ' : character)
    .join('')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/[. ]+$/g, '')
    .slice(0, 100);
  return sanitized || 'projeto';
};

const referenceDateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short' });
export const formatLaudoDate = (dateKey: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) return dateKey;
  return referenceDateFormatter.format(date);
};

// Allow long protocol codes and other unspaced values to wrap without clipping.
const wrapPdfText = (text: string) => text.replace(/\S{24,}/gu, word =>
  Array.from(word).map((character, index) => index > 0 && index % 20 === 0 ? `\u200b${character}` : character).join(''));

export const createLaudoPdfDefinition = (options: LaudoOptions, emittedAt = new Date()): TDocumentDefinitions => {
  const dataAtual = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(emittedAt);
  const documentary = options.tipoLaudo === 'acompanhamento';
  const car = /^(?:CAR|Cadastro Ambiental Rural\s*(?:\(CAR\))?)$/i.test(options.tipoDemanda?.trim() || '');
  const tituloLaudo = documentary ? `Relatório de Acompanhamento Documental${car ? ' — CAR' : ''}` :
    options.tipoLaudo === 'vistoria' ? 'Laudo de Vistoria Técnica' :
    options.tipoLaudo === 'fauna' ? 'Relatório de Monitoramento de Fauna' :
    options.tipoLaudo === 'flora' ? 'Inventário Florestal' : 'Laudo Ambiental';
  const rows = [
    ['Trabalho', options.projetoNome], ['Cliente', options.clienteNome],
    ['Serviço', options.tipoDemanda], ['Propriedade', options.propriedadeNome],
    ['Protocolo / processo', options.protocolo], ['Órgão ambiental', options.orgaoAmbiental],
    ...(documentary ? [['Situação do trabalho', options.situacaoTrabalho], ['Fase ambiental registrada', options.faseAmbiental]] : []),
    [options.tipoLaudo === 'vistoria' ? 'Data da vistoria' : 'Data de referência', formatLaudoDate(options.dataVistoria)],
    ['Responsável', options.tecnicoResponsavel]
  ].filter(([, value]) => value?.trim());
  const section = (title: string, text: string): Content => ({
    // Keep the heading with the start of its text; long text remains free to paginate.
    stack: [{ text: title, style: 'sectionHeader' }, { text: wrapPdfText(text), style: 'paragraph' }],
    margin: [0, 16, 0, 0]
  });
  const content: Content[] = [
    ...(options.empresa?.razao || options.empresa?.logo || options.empresa?.email || options.empresa?.telefone || options.empresa?.endereco ? [{
      columns: [
        ...(options.empresa.logo ? [{ image: options.empresa.logo, fit: [80, 44], width: 92 }] : []),
        { width: '*', stack: [
          ...(options.empresa.razao ? [{ text: wrapPdfText(options.empresa.razao), bold: true, fontSize: 12 }] : []),
          ...([options.empresa.email, options.empresa.telefone, options.empresa.endereco].filter(Boolean).map(text => ({ text: wrapPdfText(text!), fontSize: 9, color: '#52525b', margin: [0, 2, 0, 0] })))
        ] }
      ], margin: [0, 0, 0, 12]
    } as Content] : []),
    { text: tituloLaudo, style: 'header', margin: [0, 0, 0, 8] },
    ...(options.tipoDemanda?.trim() ? [{ text: car ? documentary ? 'Cadastro Ambiental Rural' : 'Cadastro Ambiental Rural (CAR)' : wrapPdfText(options.tipoDemanda.trim()), color: '#064e3b', fontSize: 12, bold: true, margin: [0, 0, 0, 8] } as Content] : []),
    ...(options.emissao || options.preview ? [{ text: options.emissao ? `${options.emissao.codigo} · Revisão ${options.emissao.revisao}` : 'Pré-visualização · Identificação atribuída ao emitir', fontSize: 9, color: '#52525b', margin: [0, 0, 0, 8] } as Content] : []),
    ...(documentary && options.sintese?.trim() ? [section('Síntese do acompanhamento', options.sintese.trim())] : []),
    { text: 'Identificação', style: 'sectionHeader', margin: [0, 12, 0, 8] },
    {
      table: {
        widths: [136, '*'], dontBreakRows: true,
        body: rows.map(([label, value]) => [{ text: label!, style: 'label' }, { text: wrapPdfText(value!.trim()), style: 'value' }])
      },
      layout: {
        hLineWidth: (index, node) => index === 0 || index === node.table.body.length ? 0 : 0.5,
        hLineColor: () => '#d4d4d8', vLineWidth: () => 0,
        paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6
      }
    },
    section(documentary ? 'Finalidade do registro' : 'Objetivo', options.finalidade?.trim() || (documentary
      ? 'Registrar o acompanhamento documental e os encaminhamentos informados pelo responsável, para consulta do cliente e histórico do trabalho.'
      : 'Reunir a identificação do trabalho e as observações técnicas informadas pelo responsável.')),
    ...(options.documentosConsiderados?.trim() ? [section('Documentos considerados', options.documentosConsiderados.trim())] : []),
    section(documentary ? 'Registros do acompanhamento' : 'Descrição e constatações', options.observacoes.trim() || (documentary
      ? 'Não há observações do acompanhamento registradas nesta emissão. A ausência de registro não indica inexistência de pendências.'
      : 'Não há observações técnicas registradas nesta emissão; este documento não apresenta constatações técnicas.')),
    ...(options.proximosPassos?.trim() ? [section('Pendências e próximos passos', options.proximosPassos.trim())] : []),
    {
      unbreakable: true, margin: [0, 20, 0, 0],
      stack: [
        { text: 'Responsabilidade pelo registro', fontSize: 12.5, bold: true, color: '#064e3b', margin: [0, 0, 0, 8] },
        {
          columns: [
            { width: '*', text: '' },
            { width: 240, stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 240, y2: 0, lineWidth: 0.7, lineColor: '#52525b' }], margin: [0, 36, 0, 6] },
              { text: wrapPdfText(options.tecnicoResponsavel), alignment: 'center', bold: true },
              { text: documentary ? 'Responsável pelo acompanhamento' : 'Responsável técnico', alignment: 'center', fontSize: 10, color: '#52525b', margin: [0, 3, 0, 0] }
            ] },
            { width: '*', text: '' }
          ]
        }
      ]
    }
  ];
  // Keep the last passage with responsibility; avoid a page with signature alone.
  const signature = content.pop()!;
  const closing = content.pop()! as { stack: [{ text: string; style: string }, { text: string; style: string }]; margin: [number, number, number, number] };
  const lastText = closing.stack[1].text;
  if (lastText.length <= 360) content.push({ unbreakable: true, stack: [closing, signature] });
  else {
    const split = lastText.lastIndexOf(' ', lastText.length - 220);
    const characters = Array.from(lastText);
    const prefix = split > 0 ? lastText.slice(0, split) : characters.slice(0, -220).join('');
    const tail = split > 0 ? lastText.slice(split + 1) : characters.slice(-220).join('');
    content.push({ ...closing, stack: [closing.stack[0], { text: prefix, style: 'paragraph' }] });
    content.push({ unbreakable: true, stack: [{ text: tail, style: 'paragraph', margin: [0, 3, 0, 0] }, signature] });
  }
  return {
    info: {
      title: `${tituloLaudo} — ${options.projetoNome.trim()}`,
      author: options.empresa?.razao || 'Geogestor',
    },
    pageSize: 'A4',
    pageMargins: [44, 60, 44, 56],
    defaultStyle: { font: 'Roboto', fontSize: 11.5, color: '#18181b' },
    // Prevent a section heading from being stranded at the bottom of a page.
    pageBreakBefore: (node, container) => Boolean(node.style === 'sectionHeader' && container.getFollowingNodesOnPage().length === 0),
    
    header: function() {
      return {
        text: `GEOGESTOR - Inteligência Territorial`,
        alignment: 'right',
        fontSize: 9,
        color: '#666666',
        margin: [0, 20, 44, 0]
      };
    },

    footer: function(currentPage, pageCount) {
      return {
        columns: [
          { text: `${options.preview ? 'Prévia em' : 'Emitido em'}: ${dataAtual}`, width: 120, alignment: 'left', fontSize: 9, color: '#52525b' },
          { text: options.emissao ? `${options.emissao.codigo} · R${options.emissao.revisao}` : options.preview ? 'Pré-visualização' : '', width: '*', alignment: 'center', fontSize: 8, color: '#52525b' },
          { text: `Página ${currentPage} de ${pageCount}`, width: 85, alignment: 'right', fontSize: 9, color: '#666666' }
        ],
        margin: [44, 18, 44, 0]
      };
    },

    content,

    styles: {
      header: {
        fontSize: 18,
        bold: true,
        color: '#047857' // emerald-700
      },
      sectionHeader: {
        fontSize: 12.5,
        bold: true,
        color: '#064e3b', // emerald-900
        margin: [0, 0, 0, 8]
      },
      label: {
        bold: true,
        fillColor: '#f4f4f5',
        color: '#3f3f46',
        fontSize: 10.5
      },
      value: {
        color: '#18181b'
      },
      paragraph: {
        fontSize: 11.5,
        lineHeight: 1.18,
        alignment: 'left'
      }
    }
  };

};

