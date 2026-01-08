-- Atualiza o constraint para usar apenas valores padronizados
ALTER TABLE fato_servico DROP CONSTRAINT IF EXISTS fato_servico_situacao_do_servico_check;

ALTER TABLE fato_servico ADD CONSTRAINT fato_servico_situacao_do_servico_check 
CHECK (situacao_do_servico IS NULL OR situacao_do_servico = ANY (ARRAY[
  'Pendente'::text, 
  'Planejado'::text,
  'Em Andamento'::text,
  'Em Revisão'::text,
  'Concluído'::text, 
  'Cancelado'::text
]));