-- Inserir categoria "servicos" para eventos de conversão de orçamento
INSERT INTO dim_categoria_evento (nome, icone, cor, tipo, ativo)
SELECT 'servicos', 'Briefcase', 'blue', 'evento', true
WHERE NOT EXISTS (
  SELECT 1 FROM dim_categoria_evento WHERE nome = 'servicos' AND tenant_id IS NULL
);

-- Inserir para cada tenant existente
INSERT INTO dim_categoria_evento (nome, icone, cor, tipo, ativo, tenant_id)
SELECT 'servicos', 'Briefcase', 'blue', 'evento', true, t.id
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM dim_categoria_evento WHERE nome = 'servicos' AND tenant_id = t.id
);