import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: text('deleted_at'),
};

export const configuracoes = sqliteTable('configuracoes', {
  id: text('id').primaryKey(),
  empresaNome: text('empresa_nome').notNull(),
  empresaCnpj: text('empresa_cnpj'),
  dadosPasta: text('dados_pasta').notNull(),
  adminNome: text('admin_nome').notNull(),
  adminEmail: text('admin_email').notNull(),
  adminSenhaHash: text('admin_senha_hash').notNull(),
  setupConcluido: integer('setup_concluido', { mode: 'boolean' }).default(false).notNull(),
  googleClientId: text('google_client_id'),
  googleClientSecret: text('google_client_secret'),
  googleRefreshToken: text('google_refresh_token'),
  googleAccessToken: text('google_access_token'),
  googleSyncActive: integer('google_sync_active', { mode: 'boolean' }).default(false),
  ...timestamps
});

export const clientes = sqliteTable('clientes', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  tipoPessoa: text('tipo_pessoa'),
  documento: text('documento'), // CPF ou CNPJ
  email: text('email'),
  telefone: text('telefone'),
  endereco: text('endereco'),
  numero: text('numero'),
  semNumero: integer('sem_numero', { mode: 'boolean' }).default(false),
  complemento: text('complemento'),
  bairro: text('bairro'),
  municipio: text('municipio'),
  uf: text('uf'),
  cep: text('cep'),
  celular: text('celular'),
  celularWhatsapp: integer('celular_whatsapp', { mode: 'boolean' }).default(false),
  cpf: text('cpf'),
  rg: text('rg'),
  cnpj: text('cnpj'),
  documentoNormalizado: text('documento_normalizado'),
  inscricaoEstadual: text('inscricao_estadual'),
  origem: text('origem'),
  origemPrincipal: text('origem_principal'),
  origemDetalhe: text('origem_detalhe'),
  indicadoPor: text('indicado_por'),
  categoria: text('categoria'),
  perfis: text('perfis'),
  anotacoes: text('anotacoes'),
  situacao: text('situacao'),
  previsaoEntrega: text('previsao_entrega'),
  servicos: text('servicos'),
  ...timestamps
}, (table) => {
  return {
    nomeIdx: index('idx_clientes_nome').on(table.nome),
    docIdx: index('idx_clientes_documento').on(table.documento),
    normalizedDocIdx: index('idx_clientes_documento_normalizado')
      .on(table.documentoNormalizado)
      .where(sql`${table.deletedAt} IS NULL`),
    activeCreatedAtIdx: index('idx_clientes_active_created_at')
      .on(table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),
  };
});

export const projetos = sqliteTable('projetos', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id).notNull(),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  status: text('status').default('Em Andamento').notNull(),
  dataInicio: text('data_inicio'),
  dataEntrega: text('data_entrega'),
  areaHa: real('area_ha'),
  matricula: text('matricula'),
  car: text('car'),
  ccir: text('ccir'),
  itr: text('itr'),
  cidade: text('cidade'),
  municipio: text('municipio'),
  situacaoImovel: text('situacao_imovel'),
  tipo: text('tipo'),
  averbacao: text('averbacao'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  possuiMemorialDescritivo: text('possui_memorial_descritivo'),
  observacoes: text('observacoes'),
  propriedadeId: text('propriedade_id'), // Referência à nova tabela propriedades
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_projetos_cliente_id').on(table.clienteId),
    statusIdx: index('idx_projetos_status').on(table.status),
    reportsPeriodIdx: index('idx_reports_projetos_periodo')
      .on(table.dataInicio, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),
  };
});

export const orcamentos = sqliteTable('orcamentos', {
  id: text('id').primaryKey(),
  grupoId: text('grupo_id'),
  substituiOrcamentoId: text('substitui_orcamento_id'),
  versao: integer('versao').default(1).notNull(),
  clienteId: text('cliente_id').references(() => clientes.id).notNull(),
  projetoId: text('projeto_id').references(() => projetos.id),
  propriedadeId: text('propriedade_id'),
  valorTotal: integer('valor_total').notNull(), // stored in cents (centavos)
  status: text('status').default('rascunho').notNull(),
  descricao: text('descricao'),
  anotacoes: text('anotacoes'),
  observacoesCliente: text('observacoes_cliente'),
  termosCondicoes: text('termos_condicoes'),
  formaDePagamento: text('forma_de_pagamento'),
  desconto: integer('desconto'),
  codigoOrcamento: text('codigo_orcamento'),
  dataOrcamento: text('data_orcamento'),
  dataEmissao: text('data_emissao'),
  validadeAte: text('validade_ate'),
  dataCompetencia: text('data_competencia'),
  dataPagamento: text('data_pagamento'),
  responsavelTecnico: text('responsavel_tecnico'),
  origem: text('origem').default('manual'),
  servicoTipo: text('servico_tipo'),
  imovelTipo: text('imovel_tipo'),
  imovelNome: text('imovel_nome'),
  municipio: text('municipio'),
  uf: text('uf'),
  metodologia: text('metodologia'),
  entregaveis: text('entregaveis'),
  prazoExecucaoDias: integer('prazo_execucao_dias'),
  caracterizacaoJson: text('caracterizacao_json'),
  clienteSnapshotJson: text('cliente_snapshot_json'),
  imovelSnapshotJson: text('imovel_snapshot_json'),
  descontoGlobalTipo: text('desconto_global_tipo').default('fixo'),
  descontoGlobalValor: text('desconto_global_valor').default('0'),
  acrescimoGlobalTipo: text('acrescimo_global_tipo').default('fixo'),
  acrescimoGlobalValor: text('acrescimo_global_valor').default('0'),
  subtotalServicos: integer('subtotal_servicos').default(0),
  subtotalDespesas: integer('subtotal_despesas').default(0),
  subtotalTaxas: integer('subtotal_taxas').default(0),
  custoTotalEstimado: integer('custo_total_estimado').default(0),
  impostosPrevistos: integer('impostos_previstos').default(0),
  honorariosBrutos: integer('honorarios_brutos').default(0),
  honorariosLiquidos: integer('honorarios_liquidos').default(0),
  lucroEstimado: integer('lucro_estimado').default(0),
  margemPontosBase: integer('margem_pontos_base'),
  markupPontosBase: integer('markup_pontos_base'),
  valorReembolsavel: integer('valor_reembolsavel').default(0),
  valorNaoTributavel: integer('valor_nao_tributavel').default(0),
  emitidoEm: text('emitido_em'),
  enviadoEm: text('enviado_em'),
  visualizadoEm: text('visualizado_em'),
  aprovadoEm: text('aprovado_em'),
  aprovadoPor: text('aprovado_por'),
  rejeitadoEm: text('rejeitado_em'),
  canceladoEm: text('cancelado_em'),
  motivoStatus: text('motivo_status'),
  bloqueadoEm: text('bloqueado_em'),
  chaveIdempotenciaAprovacao: text('chave_idempotencia_aprovacao'),
  efeitosAprovacaoJson: text('efeitos_aprovacao_json'),
  possuiMarco: integer('possui_marco', { mode: 'boolean' }).default(false),
  marcoQtd: integer('marco_qtd'),
  marcoValor: integer('marco_valor'), // in cents
  possuiImposto: integer('possui_imposto', { mode: 'boolean' }).default(false),
  impostoPorcentagem: real('imposto_porcentagem'),
  impostoValor: integer('imposto_valor'),
  impostoRetido: integer('imposto_retido', { mode: 'boolean' }).default(false),
  centroCusto: text('centro_custo'),
  possuiArt: integer('possui_art', { mode: 'boolean' }).default(false),
  artValor: integer('art_valor'),
  ...timestamps
}, (table) => {
  return {
    grupoVersaoIdx: uniqueIndex('uq_orcamentos_grupo_versao').on(table.grupoId, table.versao),
    codigoVersaoIdx: index('idx_orcamentos_codigo_versao').on(table.codigoOrcamento, table.versao),
    clienteIdIdx: index('idx_orcamentos_cliente_id').on(table.clienteId),
    projetoIdIdx: index('idx_orcamentos_projeto_id').on(table.projetoId),
    statusIdx: index('idx_orcamentos_status').on(table.status),
    emissaoIdx: index('idx_orcamentos_emissao').on(table.dataEmissao),
    validadeIdx: index('idx_orcamentos_validade').on(table.validadeAte),
    reportsPeriodIdx: index('idx_reports_orcamentos_periodo')
      .on(table.dataCompetencia, table.dataEmissao, table.dataOrcamento, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),
    reportsPaymentIdx: index('idx_reports_orcamentos_pagamento')
      .on(table.dataPagamento)
      .where(sql`${table.deletedAt} IS NULL`),
    municipioIdx: index('idx_orcamentos_municipio').on(table.municipio),
    aprovacaoIdempotenteIdx: uniqueIndex('uq_orcamentos_aprovacao_idempotencia').on(table.chaveIdempotenciaAprovacao),
  };
});

export const orcamento_itens = sqliteTable('orcamento_itens', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id).notNull(),
  descricao: text('descricao').notNull(),
  quantidade: real('quantidade').notNull(),
  quantidadeDecimal: text('quantidade_decimal').default('1').notNull(),
  valorUnitario: integer('valor_unitario').notNull(),
  custoUnitario: integer('custo_unitario').default(0).notNull(),
  codigo: text('codigo'),
  grupo: text('grupo'),
  etapa: text('etapa'),
  categoria: text('categoria').default('Serviços'),
  unidade: text('unidade').default('serviço').notNull(),
  componenteFinanceiro: text('componente_financeiro').default('servico').notNull(),
  descontoTipo: text('desconto_tipo').default('fixo').notNull(),
  descontoValor: text('desconto_valor').default('0').notNull(),
  acrescimoTipo: text('acrescimo_tipo').default('fixo').notNull(),
  acrescimoValor: text('acrescimo_valor').default('0').notNull(),
  tributavel: integer('tributavel', { mode: 'boolean' }).default(true).notNull(),
  margemPontosBase: integer('margem_pontos_base'),
  observacoes: text('observacoes'),
  ordem: integer('ordem').default(0).notNull(),
  opcional: integer('opcional', { mode: 'boolean' }).default(false).notNull(),
  obrigatorio: integer('obrigatorio', { mode: 'boolean' }).default(true).notNull(),
  total: integer('total').notNull(),
  ...timestamps
}, (table) => {
  return {
    orcamentoIdIdx: index('idx_orcamento_itens_orcamento_id').on(table.orcamentoId),
  };
});

export const orcamento_despesas = sqliteTable('orcamento_despesas', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id).notNull(),
  descricao: text('descricao').notNull(),
  valor: integer('valor').notNull(),
  categoria: text('categoria').default('Outros custos').notNull(),
  classificacao: text('classificacao').default('custo_proprio').notNull(),
  tributavel: integer('tributavel', { mode: 'boolean' }).default(false).notNull(),
  observacoes: text('observacoes'),
  ordem: integer('ordem').default(0).notNull(),
  ...timestamps
}, (table) => {
  return {
    orcamentoIdIdx: index('idx_orcamento_despesas_orcamento_id').on(table.orcamentoId),
  };
});

export const parcelas = sqliteTable('parcelas', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id).notNull(),
  valor: integer('valor').notNull(), // stored in cents (centavos)
  numero: integer('numero').default(1).notNull(),
  valorPago: integer('valor_pago').default(0).notNull(),
  tipoValor: text('tipo_valor').default('recebivel_previsto').notNull(),
  origemVersao: integer('origem_versao').default(1).notNull(),
  chaveOrigem: text('chave_origem'),
  categoriaFinanceira: text('categoria_financeira'),
  contaFinanceira: text('conta_financeira'),
  meioPagamento: text('meio_pagamento'),
  dataCompetencia: text('data_competencia'),
  dataVencimento: text('data_vencimento').notNull(),
  dataPagamento: text('data_pagamento'),
  statusPagamento: text('status_pagamento').default('Pendente').notNull(), // Pendente, Pago, Atrasado
  juros: integer('juros').default(0),
  multa: integer('multa').default(0),
  descontoAntecipacao: integer('desconto_antecipacao').default(0),
  impostoPrevisto: integer('imposto_previsto').default(0),
  canceladaEm: text('cancelada_em'),
  motivoCancelamento: text('motivo_cancelamento'),
  ...timestamps
}, (table) => {
  return {
    origemIdx: uniqueIndex('uq_parcelas_chave_origem').on(table.chaveOrigem),
    dataVencimentoIdx: index('idx_parcelas_data_vencimento').on(table.dataVencimento),
    reportsPeriodIdx: index('idx_reports_parcelas_periodo')
      .on(table.dataCompetencia, table.dataVencimento, table.dataPagamento, table.orcamentoId)
      .where(sql`${table.deletedAt} IS NULL AND ${table.canceladaEm} IS NULL`),
  };
});

export const perfisTributarios = sqliteTable('perfis_tributarios', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  ativo: integer('ativo', { mode: 'boolean' }).default(true).notNull(),
  ...timestamps
});

export const tributos = sqliteTable('tributos', {
  id: text('id').primaryKey(),
  perfilId: text('perfil_id').references(() => perfisTributarios.id, { onDelete: 'cascade' }).notNull(),
  nome: text('nome').notNull(),
  sigla: text('sigla').notNull(),
  aliquotaPontosBase: integer('aliquota_pontos_base').notNull(),
  baseCalculo: text('base_calculo').default('tributavel').notNull(),
  inclusoNoPreco: integer('incluso_no_preco', { mode: 'boolean' }).default(false).notNull(),
  cumulativo: integer('cumulativo', { mode: 'boolean' }).default(false).notNull(),
  ativo: integer('ativo', { mode: 'boolean' }).default(true).notNull(),
  categoriaFinanceira: text('categoria_financeira'),
  contaFinanceira: text('conta_financeira'),
  vigenciaInicio: text('vigencia_inicio'),
  vigenciaFim: text('vigencia_fim'),
  observacoes: text('observacoes'),
  ...timestamps
}, (table) => ({
  perfilIdx: index('idx_tributos_perfil').on(table.perfilId, table.ativo)
}));

export const orcamentoImpostos = sqliteTable('orcamento_impostos', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id, { onDelete: 'cascade' }).notNull(),
  tributoId: text('tributo_id').references(() => tributos.id),
  nome: text('nome').notNull(),
  sigla: text('sigla').notNull(),
  aliquotaPontosBase: integer('aliquota_pontos_base').notNull(),
  baseCalculo: text('base_calculo').default('tributavel').notNull(),
  inclusoNoPreco: integer('incluso_no_preco', { mode: 'boolean' }).default(false).notNull(),
  cumulativo: integer('cumulativo', { mode: 'boolean' }).default(false).notNull(),
  baseValor: integer('base_valor').default(0).notNull(),
  valorPrevisto: integer('valor_previsto').default(0).notNull(),
  ajusteManual: integer('ajuste_manual').default(0).notNull(),
  justificativaAjuste: text('justificativa_ajuste'),
  ordem: integer('ordem').default(0).notNull(),
  ...timestamps
}, (table) => ({
  orcamentoIdx: index('idx_orcamento_impostos_orcamento').on(table.orcamentoId)
}));

export const orcamentoCondicoesPagamento = sqliteTable('orcamento_condicoes_pagamento', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id, { onDelete: 'cascade' }).notNull(),
  tipo: text('tipo').default('parcelas').notNull(),
  descricao: text('descricao'),
  parcelasJson: text('parcelas_json').notNull(),
  meioPagamento: text('meio_pagamento'),
  contaFinanceira: text('conta_financeira'),
  jurosPontosBase: integer('juros_pontos_base').default(0).notNull(),
  multaPontosBase: integer('multa_pontos_base').default(0).notNull(),
  descontoAntecipacaoPontosBase: integer('desconto_antecipacao_pontos_base').default(0).notNull(),
  ...timestamps
}, (table) => ({
  orcamentoIdx: uniqueIndex('uq_orcamento_condicao_pagamento').on(table.orcamentoId)
}));

export const orcamentoStatusHistorico = sqliteTable('orcamento_status_historico', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id, { onDelete: 'cascade' }).notNull(),
  statusAnterior: text('status_anterior'),
  statusNovo: text('status_novo').notNull(),
  motivo: text('motivo'),
  usuarioId: text('usuario_id').default('admin').notNull(),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
  orcamentoIdx: index('idx_orcamento_status_historico').on(table.orcamentoId, table.createdAt)
}));

export const orcamentoVersoes = sqliteTable('orcamento_versoes', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id, { onDelete: 'cascade' }).notNull(),
  grupoId: text('grupo_id').notNull(),
  versao: integer('versao').notNull(),
  status: text('status').notNull(),
  valorTotal: integer('valor_total').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  motivo: text('motivo'),
  usuarioId: text('usuario_id').default('admin').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
  orcamentoIdx: index('idx_orcamento_versoes_orcamento').on(table.orcamentoId),
  grupoVersaoIdx: uniqueIndex('uq_orcamento_versoes_grupo_versao_status').on(table.grupoId, table.versao, table.status)
}));

export const orcamentoModelos = sqliteTable('orcamento_modelos', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  servicoTipo: text('servico_tipo'),
  descricao: text('descricao'),
  conteudoJson: text('conteudo_json').notNull(),
  ativo: integer('ativo', { mode: 'boolean' }).default(true).notNull(),
  ...timestamps
}, (table) => ({
  servicoIdx: index('idx_orcamento_modelos_servico').on(table.servicoTipo, table.ativo)
}));

export const parametrosPrecificacao = sqliteTable('parametros_precificacao', {
  id: text('id').primaryKey(),
  chave: text('chave').notNull().unique(),
  nome: text('nome').notNull(),
  categoria: text('categoria').notNull(),
  unidade: text('unidade'),
  valorCentavos: integer('valor_centavos'),
  valorDecimal: text('valor_decimal'),
  ativo: integer('ativo', { mode: 'boolean' }).default(true).notNull(),
  observacoes: text('observacoes'),
  ...timestamps
});

export const orcamentoProjetos = sqliteTable('orcamento_projetos', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id, { onDelete: 'cascade' }).notNull(),
  projetoId: text('projeto_id').references(() => projetos.id).notNull(),
  tipoVinculo: text('tipo_vinculo').default('aprovacao').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
  orcamentoProjetoIdx: uniqueIndex('uq_orcamento_projeto').on(table.orcamentoId, table.projetoId)
}));

export const viagens = sqliteTable('viagens', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id),
  projetoId: text('projeto_id').references(() => projetos.id),
  finalidade: text('finalidade').notNull(),
  destino: text('destino').notNull(),
  dataInicio: text('data_inicio').notNull(),
  dataFim: text('data_fim'),
  responsavel: text('responsavel'),
  adiantamento: integer('adiantamento').default(0).notNull(),
  quilometragem: real('quilometragem').default(0).notNull(),
  valorReembolsavel: integer('valor_reembolsavel').default(0).notNull(),
  status: text('status').default('planejada').notNull(),
  observacoes: text('observacoes'),
  encerradaEm: text('encerrada_em'),
  ...timestamps
}, (table) => ({
  clienteIdIdx: index('idx_viagens_cliente_id').on(table.clienteId),
  projetoIdIdx: index('idx_viagens_projeto_id').on(table.projetoId),
  periodoIdx: index('idx_viagens_periodo').on(table.dataInicio, table.dataFim),
  statusIdx: index('idx_viagens_status').on(table.status)
}));

export const despesas = sqliteTable('despesas', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id),
  projetoId: text('projeto_id').references(() => projetos.id), // Pode ser uma despesa solta ou ligada a projeto
  viagemId: text('viagem_id').references(() => viagens.id),
  descricao: text('descricao').notNull(),
  fornecedor: text('fornecedor'),
  numeroDocumento: text('numero_documento'),
  valor: integer('valor').notNull(), // stored in cents
  data: text('data').notNull(),
  dataCompetencia: text('data_competencia'),
  dataPagamento: text('data_pagamento'),
  tipoCusto: text('tipo_custo'),
  centroCusto: text('centro_custo'),
  reembolsavel: integer('reembolsavel', { mode: 'boolean' }).default(false),
  comprovanteDocumentoId: text('comprovante_documento_id'),
  categoria: text('categoria').notNull(), // Combustível, Cartório, Alimentação, Equipamento
  categoriaCodigo: text('categoria_codigo').default('outros').notNull(),
  observacoes: text('observacoes'),
  status: text('status'),
  formaPagamento: text('forma_pagamento'),
  canceladaEm: text('cancelada_em'),
  motivoCancelamento: text('motivo_cancelamento'),
  estornadaEm: text('estornada_em'),
  motivoEstorno: text('motivo_estorno'),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_despesas_cliente_id').on(table.clienteId),
    projetoIdIdx: index('idx_despesas_projeto_id').on(table.projetoId),
    viagemIdIdx: index('idx_despesas_viagem_id').on(table.viagemId),
    dataIdx: index('idx_despesas_data').on(table.data),
    statusIdx: index('idx_despesas_status').on(table.status),
    reportsPeriodIdx: index('idx_reports_despesas_periodo')
      .on(table.dataPagamento, table.dataCompetencia, table.data)
      .where(sql`${table.deletedAt} IS NULL AND ${table.canceladaEm} IS NULL AND ${table.estornadaEm} IS NULL`),
  };
});

export const tarefas = sqliteTable('tarefas', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id),
  projetoId: text('projeto_id').references(() => projetos.id),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  status: text('status').default('A Fazer').notNull(), // A Fazer, Em Progresso, Concluído
  prioridade: text('prioridade').default('Média').notNull(), // Baixa, Média, Alta
  categoria: text('categoria').default('Interno'),
  contextoTipo: text('contexto_tipo').default('projeto'),
  dataLimite: text('data_limite'),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_tarefas_cliente_id').on(table.clienteId),
    projetoIdIdx: index('idx_tarefas_projeto_id').on(table.projetoId),
    statusIdx: index('idx_tarefas_status').on(table.status),
  };
});

export const compromissos = sqliteTable('compromissos', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  data: text('data').notNull(), // YYYY-MM-DD
  hora: text('hora'), // HH:mm
  tipo: text('tipo').default('Visita de Campo').notNull(), // Reunião, Visita de Campo, Outro
  clienteId: text('cliente_id').references(() => clientes.id),
  projetoId: text('projeto_id').references(() => projetos.id), // Opcional
  googleEventId: text('google_event_id'),
  ultimoSyncGoogle: text('ultimo_sync_google'),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_compromissos_cliente_id').on(table.clienteId),
    projetoIdIdx: index('idx_compromissos_projeto_id').on(table.projetoId),
    dataIdx: index('idx_compromissos_data').on(table.data),
  };
});

export const oportunidades = sqliteTable('oportunidades', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id),
  leadId: text('lead_id').references(() => contatos.id),
  titulo: text('titulo').notNull(),
  valorEstimado: integer('valor_estimado'), // in cents
  estagio: text('estagio').default('Prospectado').notNull(),
  ordem: integer('ordem').default(0).notNull(),
  responsavel: text('responsavel'),
  origem: text('origem'),
  servicoTipo: text('servico_tipo'),
  proximaAcao: text('proxima_acao'),
  proximaAcaoEm: text('proxima_acao_em'),
  previsaoFechamento: text('previsao_fechamento'),
  probabilidadePontosBase: integer('probabilidade_pontos_base').default(1000).notNull(),
  observacoes: text('observacoes'),
  motivoPerda: text('motivo_perda'),
  encerradoEm: text('encerrado_em'),
  ultimoContatoEm: text('ultimo_contato_em'),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id),
  projetoId: text('projeto_id').references(() => projetos.id),
  estagioAlteradoEm: text('estagio_alterado_em').default(sql`CURRENT_TIMESTAMP`).notNull(),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_oportunidades_cliente_id').on(table.clienteId),
    leadIdIdx: index('idx_oportunidades_lead_id').on(table.leadId),
    estagioIdx: index('idx_oportunidades_estagio').on(table.estagio),
    proximaAcaoIdx: index('idx_oportunidades_proxima_acao').on(table.proximaAcaoEm),
    previsaoFechamentoIdx: index('idx_oportunidades_previsao_fechamento').on(table.previsaoFechamento),
    orcamentoIdx: index('idx_oportunidades_orcamento_id').on(table.orcamentoId),
  };
});

export const oportunidadeEstagiosHistorico = sqliteTable('oportunidade_estagios_historico', {
  id: text('id').primaryKey(),
  oportunidadeId: text('oportunidade_id').references(() => oportunidades.id, { onDelete: 'cascade' }).notNull(),
  estagioAnterior: text('estagio_anterior'),
  estagioNovo: text('estagio_novo').notNull(),
  motivo: text('motivo'),
  usuarioId: text('usuario_id').default('admin').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
  oportunidadeIdx: index('idx_oportunidade_estagios_historico').on(table.oportunidadeId, table.createdAt)
}));

export const interacoes_cliente = sqliteTable('interacoes_cliente', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id).notNull(),
  projetoId: text('projeto_id').references(() => projetos.id),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id),
  titulo: text('titulo'),
  categoria: text('categoria'),
  manual: integer('manual', { mode: 'boolean' }).default(true),
  tipo: text('tipo').notNull(), // Whatsapp, Ligação, Reunião, Email, Observação
  data: text('data').notNull(),
  descricao: text('descricao').notNull(),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_interacoes_cliente_id').on(table.clienteId),
    projetoIdIdx: index('idx_interacoes_projeto_id').on(table.projetoId),
  };
});

export const documentoCategorias = sqliteTable('documento_categorias', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  pastaNome: text('pasta_nome').notNull(),
  icone: text('icone').default('FolderSimple').notNull(),
  cor: text('cor').default('zinc').notNull(),
  ordem: integer('ordem').default(0).notNull(),
  ativo: integer('ativo', { mode: 'boolean' }).default(true).notNull(),
  ...timestamps
});

export const documentos = sqliteTable('documentos', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id).notNull(),
  projetoId: text('projeto_id').references(() => projetos.id),
  categoriaId: text('categoria_id').references(() => documentoCategorias.id),
  categoria: text('categoria').default('Outros').notNull(),
  nome: text('nome').notNull(),
  nomeOriginal: text('nome_original'),
  extensao: text('extensao').notNull(),
  caminho: text('caminho').notNull(),
  caminhoRelativo: text('caminho_relativo'),
  tamanhoBytes: integer('tamanho_bytes').default(0).notNull(),
  mimeType: text('mime_type'),
  tags: text('tags'), // JSON string
  origem: text('origem').default('upload').notNull(),
  status: text('status').default('ativo').notNull(),
  criadoEmArquivo: text('criado_em_arquivo'),
  modificadoEmArquivo: text('modificado_em_arquivo'),
  ultimoSyncEm: text('ultimo_sync_em'),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_documentos_cliente_id').on(table.clienteId),
    projetoIdIdx: index('idx_documentos_projeto_id').on(table.projetoId),
  };
});

export const recebimentos = sqliteTable('recebimentos', {
  id: text('id').primaryKey(),
  parcelaId: text('parcela_id').references(() => parcelas.id).notNull(),
  valorPrincipal: integer('valor_principal').notNull(),
  juros: integer('juros').default(0).notNull(),
  multa: integer('multa').default(0).notNull(),
  desconto: integer('desconto').default(0).notNull(),
  taxas: integer('taxas').default(0).notNull(),
  valorRecebido: integer('valor_recebido').notNull(),
  dataRecebimento: text('data_recebimento').notNull(),
  meioPagamento: text('meio_pagamento'),
  observacoes: text('observacoes'),
  comprovanteDocumentoId: text('comprovante_documento_id').references(() => documentos.id),
  estornadoEm: text('estornado_em'),
  motivoEstorno: text('motivo_estorno'),
  usuarioId: text('usuario_id').default('admin').notNull(),
  ...timestamps
}, (table) => ({
  parcelaIdIdx: index('idx_recebimentos_parcela_id').on(table.parcelaId),
  dataIdx: index('idx_recebimentos_data').on(table.dataRecebimento),
  reportsPeriodIdx: index('idx_reports_recebimentos_periodo')
    .on(table.dataRecebimento, table.parcelaId)
    .where(sql`${table.deletedAt} IS NULL AND ${table.estornadoEm} IS NULL`)
}));

export const despesaDocumentos = sqliteTable('despesa_documentos', {
  id: text('id').primaryKey(),
  despesaId: text('despesa_id').references(() => despesas.id, { onDelete: 'cascade' }).notNull(),
  documentoId: text('documento_id').references(() => documentos.id).notNull(),
  tipo: text('tipo').default('comprovante').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
  vinculoIdx: uniqueIndex('uq_despesa_documento').on(table.despesaId, table.documentoId),
  documentoIdx: index('idx_despesa_documentos_documento').on(table.documentoId)
}));

export const notasFiscais = sqliteTable('notas_fiscais', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id).notNull(),
  projetoId: text('projeto_id').references(() => projetos.id),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id),
  documentoId: text('documento_id').references(() => documentos.id),
  numero: text('numero').notNull(),
  codigoVerificacao: text('codigo_verificacao'),
  dataEmissao: text('data_emissao').notNull(),
  valor: integer('valor').notNull(),
  status: text('status').default('emitida').notNull(),
  municipio: text('municipio'),
  link: text('link'),
  substituiNotaId: text('substitui_nota_id'),
  canceladaEm: text('cancelada_em'),
  motivoCancelamento: text('motivo_cancelamento'),
  ...timestamps
}, (table) => ({
  clienteIdx: index('idx_notas_fiscais_cliente').on(table.clienteId),
  orcamentoIdx: index('idx_notas_fiscais_orcamento').on(table.orcamentoId),
  emissaoIdx: index('idx_notas_fiscais_emissao').on(table.dataEmissao)
}));

export const financeiroEventos = sqliteTable('financeiro_eventos', {
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(),
  entidade: text('entidade').notNull(),
  entidadeId: text('entidade_id').notNull(),
  clienteId: text('cliente_id').references(() => clientes.id),
  projetoId: text('projeto_id').references(() => projetos.id),
  valor: integer('valor').default(0).notNull(),
  dataEvento: text('data_evento').notNull(),
  motivo: text('motivo'),
  metadataJson: text('metadata_json'),
  usuarioId: text('usuario_id').default('admin').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
  entidadeIdx: index('idx_financeiro_eventos_entidade').on(table.entidade, table.entidadeId),
  clienteIdx: index('idx_financeiro_eventos_cliente').on(table.clienteId, table.dataEvento)
}));

export const projetoFinanceiroDecisoes = sqliteTable('projeto_financeiro_decisoes', {
  id: text('id').primaryKey(),
  projetoId: text('projeto_id').references(() => projetos.id).notNull(),
  clienteId: text('cliente_id').references(() => clientes.id).notNull(),
  tipo: text('tipo').notNull(),
  percentualExecutado: real('percentual_executado'),
  valorExecutado: integer('valor_executado'),
  cancelarParcelasFuturas: integer('cancelar_parcelas_futuras', { mode: 'boolean' }).default(false).notNull(),
  motivo: text('motivo').notNull(),
  usuarioId: text('usuario_id').default('admin').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
  projetoIdx: index('idx_projeto_financeiro_decisoes_projeto').on(table.projetoId, table.createdAt)
}));

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(), // INSERT, UPDATE, DELETE
  entity: text('entity').notNull(), // Cliente, Projeto, Orcamento, Despesa, Tarefa, etc
  userId: text('user_id').default('admin').notNull(),
  oldData: text('old_data'), // JSON string
  newData: text('new_data'), // JSON string
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const filesystemOperations = sqliteTable('filesystem_operations', {
  id: text('id').primaryKey(),
  idempotencyKey: text('idempotency_key').notNull(),
  operationType: text('operation_type').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  payload: text('payload').notNull(),
  status: text('status').default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(8).notNull(),
  nextAttemptAt: text('next_attempt_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  lockedAt: text('locked_at'),
  lockOwner: text('lock_owner'),
  lastError: text('last_error'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
}, (table) => ({
  idempotencyKeyUnique: uniqueIndex('uq_filesystem_operations_idempotency_key').on(table.idempotencyKey),
  pendingIdx: index('idx_filesystem_operations_pending').on(table.status, table.nextAttemptAt),
  aggregateIdx: index('idx_filesystem_operations_aggregate').on(table.aggregateType, table.aggregateId)
}));

export const contatos = sqliteTable('contatos', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email'),
  telefone: text('telefone'),
  empresa: text('empresa'),
  cidade: text('cidade'),
  observacoes: text('observacoes'),
  origem: text('origem'),
  status: text('status').default('ativo').notNull(), // ativo ou convertido
  clienteConvertidoId: text('cliente_convertido_id').references(() => clientes.id),
  convertidoEm: text('convertido_em'),
  ...timestamps
}, (table) => {
  return {
    clienteConvertidoIdIdx: index('idx_contatos_cliente_convertido_id').on(table.clienteConvertidoId),
    statusIdx: index('idx_contatos_status').on(table.status),
  };
});

export const licencas = sqliteTable('licencas', {
  id: text('id').primaryKey(),
  projetoId: text('projeto_id').references(() => projetos.id, { onDelete: 'cascade' }).notNull(),
  clienteId: text('cliente_id').references(() => clientes.id),
  numero: text('numero').notNull(),
  protocolo: text('protocolo'),
  orgao: text('orgao').notNull(),
  tipoLicenca: text('tipo_licenca'),
  dataEmissao: text('data_emissao'),
  dataVencimento: text('data_vencimento').notNull(),
  status: text('status').default('Válida').notNull(), // Válida, Em Renovação, Vencida
  observacoes: text('observacoes'),
  ...timestamps
}, (table) => {
  return {
    projetoIdIdx: index('idx_licencas_projeto_id').on(table.projetoId),
    clienteIdIdx: index('idx_licencas_cliente_id').on(table.clienteId),
    statusIdx: index('idx_licencas_status').on(table.status),
    vencimentoIdx: index('idx_licencas_vencimento').on(table.dataVencimento),
  };
});

export const condicionantesAmbientais = sqliteTable('condicionantes_ambientais', {
  id: text('id').primaryKey(),
  licencaId: text('licenca_id').references(() => licencas.id, { onDelete: 'cascade' }).notNull(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  dataLimite: text('data_limite'),
  periodicidade: text('periodicidade'),
  responsavel: text('responsavel'),
  status: text('status').default('Pendente').notNull(),
  dataCumprimento: text('data_cumprimento'),
  observacoes: text('observacoes'),
  comprovante: text('comprovante'),
  ...timestamps
}, (table) => ({
  licencaIdIdx: index('idx_condicionantes_licenca_id').on(table.licencaId),
  statusIdx: index('idx_condicionantes_status').on(table.status),
  dataLimiteIdx: index('idx_condicionantes_data_limite').on(table.dataLimite),
}));

export const propriedades = sqliteTable('propriedades', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id, { onDelete: 'cascade' }).notNull(),
  nome: text('nome').notNull(),
  areaHa: real('area_ha'),
  matricula: text('matricula'),
  car: text('car'),
  ccir: text('ccir'),
  itr: text('itr'),
  cidade: text('cidade'),
  municipio: text('municipio'),
  situacaoImovel: text('situacao_imovel'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  observacoes: text('observacoes'),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_propriedades_cliente_id').on(table.clienteId),
  };
});

export const ambiental = sqliteTable('ambiental', {
  id: text('id').primaryKey(),
  projetoId: text('projeto_id').references(() => projetos.id, { onDelete: 'cascade' }).notNull(),
  clienteId: text('cliente_id').references(() => clientes.id),
  propriedadeId: text('propriedade_id').references(() => propriedades.id),
  orgaoAmbiental: text('orgao_ambiental'),
  tipoDemanda: text('tipo_demanda'),
  protocolo: text('protocolo'),
  statusFase: text('status_fase'),
  ...timestamps
}, (table) => {
  return {
    projetoIdIdx: index('idx_ambiental_projeto_id').on(table.projetoId),
  };
});

export const pericias = sqliteTable('pericias', {
  id: text('id').primaryKey(),
  projetoId: text('projeto_id').references(() => projetos.id, { onDelete: 'cascade' }).notNull(),
  clienteId: text('cliente_id').references(() => clientes.id),
  propriedadeId: text('propriedade_id').references(() => propriedades.id),
  tipoPericia: text('tipo_pericia'),
  numeroProcesso: text('numero_processo'),
  dataVistoria: text('data_vistoria'),
  laudoEntregue: integer('laudo_entregue', { mode: 'boolean' }).default(false),
  status: text('status'),
  ...timestamps
}, (table) => {
  return {
    projetoIdIdx: index('idx_pericias_projeto_id').on(table.projetoId),
  };
});

export const configuracoesOperacionais = sqliteTable('configuracoes_operacionais', {
  id: text('id').primaryKey(),
  chave: text('chave').notNull().unique(),
  valorJson: text('valor_json').notNull(),
  origem: text('origem').default('aplicacao').notNull(),
  migradoEm: text('migrado_em'),
  ...timestamps
}, (table) => ({
  chaveIdx: uniqueIndex('uq_configuracoes_operacionais_chave').on(table.chave)
}));

export const calculosSalvos = sqliteTable('calculos_salvos', {
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(),
  nome: text('nome').notNull(),
  clienteId: text('cliente_id').references(() => clientes.id),
  projetoId: text('projeto_id').references(() => projetos.id),
  dataCalculo: text('data_calculo').notNull(),
  entradasJson: text('entradas_json').notNull(),
  resultadoJson: text('resultado_json').notNull(),
  unidade: text('unidade'),
  metodo: text('metodo'),
  observacoes: text('observacoes'),
  ...timestamps
}, (table) => ({
  tipoDataIdx: index('idx_calculos_salvos_tipo_data').on(table.tipo, table.dataCalculo),
  clienteIdx: index('idx_calculos_salvos_cliente').on(table.clienteId),
  projetoIdx: index('idx_calculos_salvos_projeto').on(table.projetoId)
}));

export const ciclosEstrategicos = sqliteTable('ciclos_estrategicos', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  dataInicio: text('data_inicio').notNull(),
  dataFim: text('data_fim').notNull(),
  visao: text('visao').notNull(),
  status: text('status').default('rascunho').notNull(),
  proximaRevisao: text('proxima_revisao'),
  ...timestamps
}, (table) => ({
  statusPeriodoIdx: index('idx_ciclos_estrategicos_status_periodo').on(table.status, table.dataInicio, table.dataFim),
}));

export const pilaresEstrategicos = sqliteTable('pilares_estrategicos', {
  id: text('id').primaryKey(),
  cicloId: text('ciclo_id').references(() => ciclosEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  ordem: integer('ordem').default(0).notNull(),
  ...timestamps
}, (table) => ({
  cicloOrdemIdx: index('idx_pilares_estrategicos_ciclo_ordem').on(table.cicloId, table.ordem),
}));

export const objetivosEstrategicos = sqliteTable('objetivos_estrategicos', {
  id: text('id').primaryKey(),
  cicloId: text('ciclo_id').references(() => ciclosEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  pilarId: text('pilar_id').references(() => pilaresEstrategicos.id, { onDelete: 'restrict' }).notNull(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  responsavel: text('responsavel').notNull(),
  dataLimite: text('data_limite').notNull(),
  status: text('status').default('nao_iniciado').notNull(),
  prioridade: text('prioridade').default('media').notNull(),
  ordem: integer('ordem').default(0).notNull(),
  ...timestamps
}, (table) => ({
  cicloStatusIdx: index('idx_objetivos_estrategicos_ciclo_status').on(table.cicloId, table.status, table.dataLimite),
  pilarIdx: index('idx_objetivos_estrategicos_pilar').on(table.pilarId),
  pilarOrdemIdx: index('idx_objetivos_estrategicos_pilar_ordem').on(table.pilarId, table.ordem),
}));

export const resultadosChave = sqliteTable('resultados_chave', {
  id: text('id').primaryKey(),
  objetivoId: text('objetivo_id').references(() => objetivosEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  linhaBase: real('linha_base').notNull(),
  meta: real('meta').notNull(),
  valorAtual: real('valor_atual'),
  unidade: text('unidade').notNull(),
  direcao: text('direcao').default('aumentar').notNull(),
  fonteTipo: text('fonte_tipo').default('manual').notNull(),
  fonteCodigo: text('fonte_codigo'),
  fonteRegra: text('fonte_regra'),
  fontePeriodo: text('fonte_periodo'),
  fonteRota: text('fonte_rota'),
  frequencia: text('frequencia').default('mensal').notNull(),
  ultimaAtualizacao: text('ultima_atualizacao'),
  confianca: text('confianca').default('media').notNull(),
  ...timestamps
}, (table) => ({
  objetivoIdx: index('idx_resultados_chave_objetivo').on(table.objetivoId),
  fonteIdx: index('idx_resultados_chave_fonte').on(table.fonteTipo, table.fonteCodigo),
}));

export const iniciativasEstrategicas = sqliteTable('iniciativas_estrategicas', {
  id: text('id').primaryKey(),
  objetivoId: text('objetivo_id').references(() => objetivosEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  responsavel: text('responsavel').notNull(),
  dataLimite: text('data_limite').notNull(),
  progresso: real('progresso').default(0).notNull(),
  status: text('status').default('planejada').notNull(),
  orcamentoCentavos: integer('orcamento_centavos'),
  dependencias: text('dependencias'),
  proximoMarco: text('proximo_marco'),
  projetoId: text('projeto_id').references(() => projetos.id, { onDelete: 'set null' }),
  tarefaId: text('tarefa_id').references(() => tarefas.id, { onDelete: 'set null' }),
  ...timestamps
}, (table) => ({
  objetivoStatusIdx: index('idx_iniciativas_estrategicas_objetivo_status').on(table.objetivoId, table.status, table.dataLimite),
  projetoIdx: index('idx_iniciativas_estrategicas_projeto').on(table.projetoId),
  tarefaIdx: index('idx_iniciativas_estrategicas_tarefa').on(table.tarefaId),
}));

export const checkinsEstrategicos = sqliteTable('checkins_estrategicos', {
  id: text('id').primaryKey(),
  cicloId: text('ciclo_id').references(() => ciclosEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  objetivoId: text('objetivo_id').references(() => objetivosEstrategicos.id, { onDelete: 'set null' }),
  data: text('data').notNull(),
  status: text('status').notNull(),
  narrativa: text('narrativa').notNull(),
  confianca: text('confianca').notNull(),
  bloqueios: text('bloqueios'),
  decisoes: text('decisoes'),
  decisoesPendentes: text('decisoes_pendentes'),
  proximosPassos: text('proximos_passos'),
  proximaRevisao: text('proxima_revisao'),
  ...timestamps
}, (table) => ({
  cicloDataIdx: index('idx_checkins_estrategicos_ciclo_data').on(table.cicloId, table.data),
  objetivoIdx: index('idx_checkins_estrategicos_objetivo').on(table.objetivoId),
}));

export const riscosEstrategicos = sqliteTable('riscos_estrategicos', {
  id: text('id').primaryKey(),
  cicloId: text('ciclo_id').references(() => ciclosEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  objetivoId: text('objetivo_id').references(() => objetivosEstrategicos.id, { onDelete: 'set null' }),
  iniciativaId: text('iniciativa_id').references(() => iniciativasEstrategicas.id, { onDelete: 'set null' }),
  descricao: text('descricao').notNull(),
  impacto: text('impacto').notNull(),
  probabilidade: text('probabilidade').notNull(),
  mitigacao: text('mitigacao'),
  responsavel: text('responsavel').notNull(),
  status: text('status').default('aberto').notNull(),
  ...timestamps
}, (table) => ({
  cicloStatusIdx: index('idx_riscos_estrategicos_ciclo_status').on(table.cicloId, table.status),
  objetivoIdx: index('idx_riscos_estrategicos_objetivo').on(table.objetivoId),
  iniciativaIdx: index('idx_riscos_estrategicos_iniciativa').on(table.iniciativaId),
}));

export const decisoesEstrategicas = sqliteTable('decisoes_estrategicas', {
  id: text('id').primaryKey(),
  cicloId: text('ciclo_id').references(() => ciclosEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  checkinId: text('checkin_id').references(() => checkinsEstrategicos.id, { onDelete: 'set null' }),
  objetivoId: text('objetivo_id').references(() => objetivosEstrategicos.id, { onDelete: 'set null' }),
  descricao: text('descricao').notNull(),
  responsavel: text('responsavel').notNull(),
  prazo: text('prazo').notNull(),
  status: text('status').default('pendente').notNull(),
  concluidaEm: text('concluida_em'),
  observacaoEncerramento: text('observacao_encerramento'),
  ...timestamps
}, (table) => ({
  cicloStatusPrazoIdx: index('idx_decisoes_estrategicas_ciclo_status_prazo').on(table.cicloId, table.status, table.prazo),
  checkinIdx: index('idx_decisoes_estrategicas_checkin').on(table.checkinId),
  objetivoIdx: index('idx_decisoes_estrategicas_objetivo').on(table.objetivoId),
}));

export const snapshotsEstrategicos = sqliteTable('snapshots_estrategicos', {
  id: text('id').primaryKey(),
  cicloId: text('ciclo_id').references(() => ciclosEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  checkinId: text('checkin_id').references(() => checkinsEstrategicos.id, { onDelete: 'cascade' }).notNull(),
  capturadoEm: text('capturado_em').notNull(),
  progressoGeral: real('progresso_geral'),
  objetivosJson: text('objetivos_json').notNull(),
  riscosJson: text('riscos_json').notNull(),
  iniciativasJson: text('iniciativas_json').notNull(),
  decisoesJson: text('decisoes_json').notNull(),
  dadosDesatualizados: integer('dados_desatualizados').default(0).notNull(),
  ...timestamps
}, (table) => ({
  cicloCapturaIdx: index('idx_snapshots_estrategicos_ciclo_captura').on(table.cicloId, table.capturadoEm),
  checkinUniqueIdx: uniqueIndex('idx_snapshots_estrategicos_checkin_unique').on(table.checkinId),
}));
