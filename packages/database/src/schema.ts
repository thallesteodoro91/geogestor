import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
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
  documento: text('documento'), // CPF ou CNPJ
  email: text('email'),
  telefone: text('telefone'),
  endereco: text('endereco'),
  numero: text('numero'),
  bairro: text('bairro'),
  celular: text('celular'),
  cpf: text('cpf'),
  cnpj: text('cnpj'),
  origem: text('origem'),
  categoria: text('categoria'),
  anotacoes: text('anotacoes'),
  situacao: text('situacao'),
  previsaoEntrega: text('previsao_entrega'),
  servicos: text('servicos'),
  ...timestamps
}, (table) => {
  return {
    nomeIdx: index('idx_clientes_nome').on(table.nome),
    docIdx: index('idx_clientes_documento').on(table.documento),
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
  };
});

export const orcamentos = sqliteTable('orcamentos', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id).notNull(),
  projetoId: text('projeto_id').references(() => projetos.id),
  valorTotal: integer('valor_total').notNull(), // stored in cents (centavos)
  status: text('status').default('Em Análise').notNull(), // Em Análise, Aprovado, Rejeitado, Pago
  descricao: text('descricao'),
  anotacoes: text('anotacoes'),
  formaDePagamento: text('forma_de_pagamento'),
  desconto: integer('desconto'),
  codigoOrcamento: text('codigo_orcamento'),
  dataOrcamento: text('data_orcamento'),
  dataCompetencia: text('data_competencia'),
  dataPagamento: text('data_pagamento'),
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
    clienteIdIdx: index('idx_orcamentos_cliente_id').on(table.clienteId),
    projetoIdIdx: index('idx_orcamentos_projeto_id').on(table.projetoId),
    statusIdx: index('idx_orcamentos_status').on(table.status),
  };
});

export const orcamento_itens = sqliteTable('orcamento_itens', {
  id: text('id').primaryKey(),
  orcamentoId: text('orcamento_id').references(() => orcamentos.id).notNull(),
  descricao: text('descricao').notNull(),
  quantidade: real('quantidade').notNull(),
  valorUnitario: integer('valor_unitario').notNull(),
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
  dataVencimento: text('data_vencimento').notNull(),
  dataPagamento: text('data_pagamento'),
  statusPagamento: text('status_pagamento').default('Pendente').notNull(), // Pendente, Pago, Atrasado
  ...timestamps
}, (table) => {
  return {
    dataVencimentoIdx: index('idx_parcelas_data_vencimento').on(table.dataVencimento),
  };
});

export const despesas = sqliteTable('despesas', {
  id: text('id').primaryKey(),
  clienteId: text('cliente_id').references(() => clientes.id),
  projetoId: text('projeto_id').references(() => projetos.id), // Pode ser uma despesa solta ou ligada a projeto
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
  observacoes: text('observacoes'),
  status: text('status'),
  formaPagamento: text('forma_pagamento'),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_despesas_cliente_id').on(table.clienteId),
    projetoIdIdx: index('idx_despesas_projeto_id').on(table.projetoId),
    dataIdx: index('idx_despesas_data').on(table.data),
    statusIdx: index('idx_despesas_status').on(table.status),
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
  clienteId: text('cliente_id').references(() => clientes.id).notNull(),
  titulo: text('titulo').notNull(),
  valorEstimado: integer('valor_estimado'), // in cents
  estagio: text('estagio').default('Prospect').notNull(), // Prospect, Contato, Proposta, Ganho, Perdido
  ordem: integer('ordem').default(0).notNull(),
  ...timestamps
}, (table) => {
  return {
    clienteIdIdx: index('idx_oportunidades_cliente_id').on(table.clienteId),
    estagioIdx: index('idx_oportunidades_estagio').on(table.estagio),
  };
});

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

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(), // INSERT, UPDATE, DELETE
  entity: text('entity').notNull(), // Cliente, Projeto, Orcamento, Despesa, Tarefa, etc
  userId: text('user_id').default('admin').notNull(),
  oldData: text('old_data'), // JSON string
  newData: text('new_data'), // JSON string
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

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
  ...timestamps
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
  };
});

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
