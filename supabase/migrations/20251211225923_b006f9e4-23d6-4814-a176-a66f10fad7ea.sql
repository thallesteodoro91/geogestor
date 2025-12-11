-- Add id_orcamento column to fato_despesas to link expenses to budgets
ALTER TABLE fato_despesas ADD COLUMN id_orcamento uuid REFERENCES fato_orcamento(id_orcamento) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX idx_fato_despesas_orcamento ON fato_despesas(id_orcamento);