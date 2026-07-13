import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Plus, MagnifyingGlass, Funnel, Leaf, Scales, Certificate } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient';
import { Licenciamento } from '../Licenciamento/Licenciamento';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass } from '../../utils/actionStyles';

interface ProjetoAmbiental {
  id: string;
  nome: string;
  status?: string | null;
  descricao?: string | null;
  dataEntrega?: string | null;
}

export function ListagemAmbiental() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const activeTab = searchParams.get('tab') === 'licenciamento' ? 'licenciamento' : 'ambiental';

  const handleTabChange = (tab: 'ambiental' | 'licenciamento') => {
    setSearchParams({ tab });
  };

  const { data: projetos = [], isLoading } = useQuery<ProjetoAmbiental[]>({
    queryKey: ['projetos-ambiental'],
    queryFn: () => apiClient.get<ProjetoAmbiental[]>('/api/projetos').then(res =>
      // Filtrar apenas projetos que sejam do tipo "Ambiental" ou "Perícia"
      // Como não temos esse tipo exato no mock, vamos simular mostrando todos ou criar uma lógica para isso
      res
    ),
  });

  const filteredProjetos = projetos.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <Layout>
      {/* Tabs Navigation */}
      <div role="tablist" aria-label="Abas Ambientais" className="flex gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-4">
        <button 
          type="button"
          role="tab"
          aria-selected={activeTab === 'ambiental'}
          onClick={() => handleTabChange('ambiental')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'ambiental' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'}`}
        >
          <Leaf weight={activeTab === 'ambiental' ? 'fill' : 'regular'} className="w-3.5 h-3.5" /> Demandas Ambientais
        </button>
        <button 
          type="button"
          role="tab"
          aria-selected={activeTab === 'licenciamento'}
          onClick={() => handleTabChange('licenciamento')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'licenciamento' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'}`}
        >
          <Certificate weight={activeTab === 'licenciamento' ? 'fill' : 'regular'} className="w-3.5 h-3.5" /> Licenciamento
        </button>
      </div>

      {activeTab === 'ambiental' ? (
        <div className="animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
              <Leaf weight="duotone" className="w-5 h-5" />
            </div>
            Gestão Ambiental e Perícias
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Acompanhe processos ambientais, laudos e andamentos processuais
          </p>
        </div>

        <button
          onClick={() => navigate('/projetos', { state: { openCreateModal: true, contexto: 'ambiental' } })}
          className={cn(primaryActionButtonClass, 'gap-2 shrink-0 px-3.5 py-2 text-xs font-semibold')}
        >
          <Plus weight="bold" className="h-3.5 w-3.5" />
          Nova Demanda
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
        <div className="relative flex-1 w-full sm:max-w-md min-w-0">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 z-10" />
          <input
            type="text"
            placeholder="Buscar demandas, clientes ou processos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full relative z-0 pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
          />
        </div>
        <button className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
          <Funnel className="w-3.5 h-3.5" />
          Filtros
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <p className="col-span-full py-6 text-center text-xs text-zinc-500">Carregando demandas...</p>
        ) : filteredProjetos.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <Scales className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-0.5">Nenhuma demanda encontrada</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Comece cadastrando uma nova demanda ambiental ou perícia.</p>
          </div>
        ) : (
          filteredProjetos.map(projeto => (
            <div 
              key={projeto.id} 
              onClick={() => navigate(`/ambiental/${projeto.id}`)}
              className="group relative flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-lg">
                  <Scales weight="duotone" className="w-3.5 h-3.5" />
                </div>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {projeto.status || 'Em Andamento'}
                </span>
              </div>
              <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-white mb-0.5 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {projeto.nome}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2 line-clamp-2 leading-relaxed">
                {projeto.descricao || 'Sem descrição cadastrada'}
              </p>
              
              <div className="mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px]">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Prazo: {projeto.dataEntrega || 'Não definido'}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Detalhes &rarr;</span>
              </div>
            </div>
          ))
        )}
      </div>
        </div>
      ) : (
        <Licenciamento />
      )}
    </Layout>
  );
}
