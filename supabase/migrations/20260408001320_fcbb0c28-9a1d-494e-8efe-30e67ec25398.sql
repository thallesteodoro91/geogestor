ALTER TABLE public.servico_tarefas
  ADD COLUMN prioridade text DEFAULT 'media',
  ADD COLUMN data_vencimento date,
  ADD COLUMN responsavel text,
  ADD COLUMN categoria text DEFAULT 'geral',
  ADD COLUMN observacoes text;