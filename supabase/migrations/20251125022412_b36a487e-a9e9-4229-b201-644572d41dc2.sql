-- Migration: Otimização de performance com índices
-- Adiciona índices em foreign keys e campos frequentemente filtrados

-- Índices para foreign keys (melhora JOINs)
CREATE INDEX IF NOT EXISTS idx_fato_servico_id_cliente ON fato_servico(id_cliente);
CREATE INDEX IF NOT EXISTS idx_fato_servico_id_empresa ON fato_servico(id_empresa);
CREATE INDEX IF NOT EXISTS idx_fato_servico_id_propriedade ON fato_servico(id_propriedade);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_id_cliente ON fato_orcamento(id_cliente);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_id_servico ON fato_orcamento(id_servico);
CREATE INDEX IF NOT EXISTS idx_fato_despesas_id_servico ON fato_despesas(id_servico);
CREATE INDEX IF NOT EXISTS idx_dim_propriedade_id_cliente ON dim_propriedade(id_cliente);

-- Índices para campos frequentemente filtrados
CREATE INDEX IF NOT EXISTS idx_fato_servico_situacao ON fato_servico(situacao_do_servico);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_convertido ON fato_orcamento(orcamento_convertido);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_data ON fato_orcamento(data_orcamento);
CREATE INDEX IF NOT EXISTS idx_fato_despesas_data ON fato_despesas(data_da_despesa);

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_fato_servico_cliente_situacao ON fato_servico(id_cliente, situacao_do_servico);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_cliente_convertido ON fato_orcamento(id_cliente, orcamento_convertido);