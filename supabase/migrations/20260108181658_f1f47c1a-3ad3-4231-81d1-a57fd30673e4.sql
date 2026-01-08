-- Remove o constraint antigo
ALTER TABLE fato_servico DROP CONSTRAINT IF EXISTS fato_servico_situacao_do_servico_check;

-- Adiciona novo constraint com todos os valores usados no sistema
ALTER TABLE fato_servico ADD CONSTRAINT fato_servico_situacao_do_servico_check 
CHECK (situacao_do_servico IS NULL OR situacao_do_servico = ANY (ARRAY[
  'Pendente'::text, 
  'Planejado'::text,
  'Em Andamento'::text, 
  'Em andamento'::text,
  'Em revisão'::text,
  'Concluído'::text, 
  'Cancelado'::text
]));