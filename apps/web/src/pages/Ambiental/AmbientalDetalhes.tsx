import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { ArrowLeft, Scales, CalendarBlank, CheckCircle, Leaf } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { ClienteCentralControle } from '../Clientes/ClienteCentralControle';
import { GeradorLaudoModal } from '../../components/GeradorLaudoModal';

interface ProjetoAmbiental {
  id: string;
  clienteId: string;
  nome: string;
  descricao?: string | null;
  status?: string | null;
  dataEntrega?: string | null;
}

export function AmbientalDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLaudoModalOpen, setIsLaudoModalOpen] = useState(false);

  const { data: projeto, isLoading } = useQuery<ProjetoAmbiental>({
    queryKey: ['projeto', id],
    queryFn: () => apiClient.get<ProjetoAmbiental>(`/api/projetos/${id}`),
    enabled: !!id
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-zinc-500">Carregando detalhes da demanda...</p>
        </div>
      </Layout>
    );
  }

  if (!projeto) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <p className="text-zinc-500 mb-4">Demanda ambiental não encontrada.</p>
          <button 
            onClick={() => navigate('/ambiental')}
            className="text-emerald-600 hover:underline"
          >
            Voltar para listagem
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout contentClassName="max-w-none">
      {/* Top Bar with back button */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ambiental')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/50 text-zinc-500 shadow-sm transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800/80 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                <Leaf className="h-3 w-3" />
                Módulo Ambiental
              </span>
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                {projeto.status || 'Em andamento'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {projeto.nome}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsLaudoModalOpen(true)}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-all"
          >
            Gerar Laudo PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info lateral */}
        <div className="lg:col-span-1 space-y-6">
          <section className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 text-base font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
              <Scales className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Detalhes do Processo
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Descrição</p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-white">{projeto.descricao || 'Sem descrição'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <CalendarBlank className="w-3.5 h-3.5" />
                    Prazo
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">{projeto.dataEntrega || 'Não definido'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Criado em
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">Hoje</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Timeline Jornada da Perícia */}
        <div className="lg:col-span-2">
          {/* Reaproveitamos o componente ClienteCentralControle mas passamos forceTimelineOnly 
              Isso fará com que exiba apenas a linha do tempo esticada */}
          <ClienteCentralControle 
            clienteId={projeto.clienteId || 'mock'} 
            projetos={[]}
            orcamentos={[]}
            historico={[]}
            onlyTimeline={true} 
          />
        </div>
      </div>

      <GeradorLaudoModal
        isOpen={isLaudoModalOpen}
        onClose={() => setIsLaudoModalOpen(false)}
        projetoId={projeto.id}
        projetoNome={projeto.nome}
      />
    </Layout>
  );
}
