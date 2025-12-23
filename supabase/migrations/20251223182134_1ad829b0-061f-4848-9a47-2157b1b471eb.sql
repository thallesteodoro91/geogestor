-- Adicionar campos à tabela fato_servico
ALTER TABLE public.fato_servico 
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS id_orcamento UUID,
ADD COLUMN IF NOT EXISTS progresso INTEGER DEFAULT 0;

-- Criar tabela servico_tarefas
CREATE TABLE IF NOT EXISTS public.servico_tarefas (
  id_tarefa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_servico UUID NOT NULL REFERENCES public.fato_servico(id_servico) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  concluida BOOLEAN DEFAULT false,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tenant_id UUID
);

-- Criar tabela servico_eventos
CREATE TABLE IF NOT EXISTS public.servico_eventos (
  id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_servico UUID NOT NULL REFERENCES public.fato_servico(id_servico) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tenant_id UUID
);

-- Criar tabela servico_equipes
CREATE TABLE IF NOT EXISTS public.servico_equipes (
  id_designacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_servico UUID NOT NULL REFERENCES public.fato_servico(id_servico) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  funcao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tenant_id UUID
);

-- Criar tabela servico_anexos
CREATE TABLE IF NOT EXISTS public.servico_anexos (
  id_anexo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_servico UUID NOT NULL REFERENCES public.fato_servico(id_servico) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT,
  storage_path TEXT NOT NULL,
  tamanho_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tenant_id UUID
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.servico_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_anexos ENABLE ROW LEVEL SECURITY;

-- RLS Policies para servico_tarefas
CREATE POLICY "Users can read own tenant tasks" ON public.servico_tarefas
FOR SELECT USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can insert own tenant tasks" ON public.servico_tarefas
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can update own tenant tasks" ON public.servico_tarefas
FOR UPDATE USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can delete own tenant tasks" ON public.servico_tarefas
FOR DELETE USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

-- RLS Policies para servico_eventos
CREATE POLICY "Users can read own tenant events" ON public.servico_eventos
FOR SELECT USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can insert own tenant events" ON public.servico_eventos
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can delete own tenant events" ON public.servico_eventos
FOR DELETE USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

-- RLS Policies para servico_equipes
CREATE POLICY "Users can read own tenant teams" ON public.servico_equipes
FOR SELECT USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can insert own tenant teams" ON public.servico_equipes
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can update own tenant teams" ON public.servico_equipes
FOR UPDATE USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can delete own tenant teams" ON public.servico_equipes
FOR DELETE USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

-- RLS Policies para servico_anexos
CREATE POLICY "Users can read own tenant attachments" ON public.servico_anexos
FOR SELECT USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can insert own tenant attachments" ON public.servico_anexos
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Users can delete own tenant attachments" ON public.servico_anexos
FOR DELETE USING (
  tenant_id IS NOT NULL AND get_user_tenant_id(auth.uid()) IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Criar bucket para anexos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('servico-anexos', 'servico-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para o bucket
CREATE POLICY "Users can view own tenant attachments" ON storage.objects
FOR SELECT USING (
  bucket_id = 'servico-anexos' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can upload attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'servico-anexos' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete own attachments" ON storage.objects
FOR DELETE USING (
  bucket_id = 'servico-anexos' AND 
  auth.uid() IS NOT NULL
);

-- Trigger para atualizar updated_at em servico_tarefas
CREATE TRIGGER update_servico_tarefas_updated_at
BEFORE UPDATE ON public.servico_tarefas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();