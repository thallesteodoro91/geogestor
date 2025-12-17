-- Add status column to fato_despesas for expense lifecycle management
ALTER TABLE fato_despesas 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmada';

COMMENT ON COLUMN fato_despesas.status IS 'Status da despesa: pendente (vinda de orçamento), confirmada, cancelada';

-- Mark existing expenses linked to budgets as pending for review
UPDATE fato_despesas 
SET status = 'pendente' 
WHERE id_orcamento IS NOT NULL AND status IS NULL;