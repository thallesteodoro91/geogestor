-- Adicionar campos para template de orçamento na tabela dim_empresa
ALTER TABLE public.dim_empresa 
ADD COLUMN IF NOT EXISTS template_orcamento_url TEXT,
ADD COLUMN IF NOT EXISTS template_config JSONB DEFAULT '{
  "header": {"numero": {"x": 400, "y": 750, "size": 12}, "data": {"x": 400, "y": 730, "size": 10}},
  "cliente": {"nome": {"x": 80, "y": 650, "size": 11}, "contato": {"x": 80, "y": 630, "size": 9}},
  "tabela": {"inicio_x": 50, "inicio_y": 550, "altura_linha": 25, "colunas": {"descricao": 50, "qtd": 320, "valor_unit": 370, "desconto": 440, "total": 500}},
  "totais": {"x": 450, "subtotal_y": 300, "impostos_y": 280, "total_y": 260},
  "rodape": {"observacoes": {"x": 50, "y": 150, "size": 9}, "pagamento": {"x": 50, "y": 120, "size": 9}, "validade": {"x": 50, "y": 100, "size": 9}}
}'::jsonb;

-- Criar bucket para assets da empresa (templates, logos, etc)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empresa-assets',
  'empresa-assets',
  true,
  5242880, -- 5MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Public read access for empresa-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to empresa-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update empresa-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from empresa-assets" ON storage.objects;

-- Políticas RLS para o bucket empresa-assets
CREATE POLICY "Public read access for empresa-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'empresa-assets');

CREATE POLICY "Authenticated users can upload to empresa-assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'empresa-assets' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
);

CREATE POLICY "Authenticated users can update empresa-assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'empresa-assets'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
);

CREATE POLICY "Authenticated users can delete from empresa-assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'empresa-assets'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
);