-- Add data_evento column for custom event dates
ALTER TABLE cliente_eventos 
ADD COLUMN data_evento TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Comment explaining the column purpose
COMMENT ON COLUMN cliente_eventos.data_evento IS 'Custom date for the event. If NULL, created_at should be used for display.';

-- Create table for dynamic event/task categories
CREATE TABLE dim_categoria_evento (
  id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT 'blue',
  icone TEXT DEFAULT 'StickyNote',
  tipo TEXT NOT NULL CHECK (tipo IN ('evento', 'tarefa', 'ambos')),
  ativo BOOLEAN DEFAULT TRUE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(nome, tenant_id)
);

-- Enable RLS on dim_categoria_evento
ALTER TABLE dim_categoria_evento ENABLE ROW LEVEL SECURITY;

-- RLS policies for dim_categoria_evento
CREATE POLICY "Users can view categories from their tenant"
ON dim_categoria_evento
FOR SELECT
USING (tenant_id = (SELECT get_user_tenant_id(auth.uid())));

CREATE POLICY "Users can create categories in their tenant"
ON dim_categoria_evento
FOR INSERT
WITH CHECK (tenant_id = (SELECT get_user_tenant_id(auth.uid())));

CREATE POLICY "Users can update categories in their tenant"
ON dim_categoria_evento
FOR UPDATE
USING (tenant_id = (SELECT get_user_tenant_id(auth.uid())));

CREATE POLICY "Users can delete categories in their tenant"
ON dim_categoria_evento
FOR DELETE
USING (tenant_id = (SELECT get_user_tenant_id(auth.uid())));