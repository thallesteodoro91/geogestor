-- Inserir categorias padrão para todos os tenants existentes
INSERT INTO dim_categoria_evento (nome, icone, cor, tipo, ativo, tenant_id)
SELECT 
  cat.nome, 
  cat.icone, 
  cat.cor, 
  'evento'::text, 
  true, 
  t.id
FROM tenants t
CROSS JOIN (
  VALUES 
    ('cliente', 'UserPlus', 'green'),
    ('documento_cliente', 'FileCheck', 'cyan'),
    ('prefeitura', 'Building2', 'orange'),
    ('cartorio', 'ScrollText', 'indigo'),
    ('incra', 'Landmark', 'amber'),
    ('trabalho', 'Wrench', 'blue'),
    ('interno', 'StickyNote', 'yellow'),
    ('financeiro', 'DollarSign', 'emerald')
) AS cat(nome, icone, cor)
ON CONFLICT DO NOTHING;