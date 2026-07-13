import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Certificate, Plus, MagnifyingGlass, Clock, CheckCircle, Warning, FileText } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { MetricCard } from '../../components/MetricCard';
import { filterBarClass, filterSearchInputClass } from '../../utils/filterStyles';

type StatusLicenca = 'ativa' | 'vencida' | 'em_analise';

interface Licenca {
  id: string;
  numero: string;
  tipo: string;
  empreendimento: string;
  dataEmissao: string;
  dataVencimento: string;
  status: StatusLicenca;
  orgao: string;
  condicionantesPendentes: number;
}

const mockLicencas: Licenca[] = [
  {
    id: '1',
    numero: 'LI-2023/045',
    tipo: 'Licença de Instalação (LI)',
    empreendimento: 'Fazenda Boa Esperança - Lote 4',
    dataEmissao: '2023-05-10',
    dataVencimento: '2025-05-10',
    status: 'ativa',
    orgao: 'SEMA',
    condicionantesPendentes: 2
  },
  {
    id: '2',
    numero: 'LO-2021/112',
    tipo: 'Licença de Operação (LO)',
    empreendimento: 'Agroindústria São João',
    dataEmissao: '2021-08-15',
    dataVencimento: '2024-08-15',
    status: 'vencida',
    orgao: 'IBAMA',
    condicionantesPendentes: 0
  },
  {
    id: '3',
    numero: 'LP-2024/002',
    tipo: 'Licença Prévia (LP)',
    empreendimento: 'Expansão Área de Plantio Leste',
    dataEmissao: '-',
    dataVencimento: '-',
    status: 'em_analise',
    orgao: 'SEMA',
    condicionantesPendentes: 0
  }
];

export function Licenciamento() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [vencimentoFilter, setVencimentoFilter] = useState('');
  const [licencas] = useState<Licenca[]>(mockLicencas);
  const navigate = useNavigate();

  const filtered = licencas.filter(l => {
    const matchSearch = l.empreendimento.toLowerCase().includes(searchTerm.toLowerCase()) || l.numero.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === '' || l.status === statusFilter;
    const matchTipo = tipoFilter === '' || l.tipo.includes(tipoFilter);
    
    let matchVencimento = true;
    if (vencimentoFilter === 'vencido') {
      matchVencimento = l.status === 'vencida' || (l.dataVencimento !== '-' && new Date(l.dataVencimento) < new Date());
    } else if (vencimentoFilter === '30d') {
      if (l.dataVencimento !== '-') {
        const diffDays = (new Date(l.dataVencimento).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
        matchVencimento = diffDays >= 0 && diffDays <= 30;
      } else { matchVencimento = false; }
    }

    return matchSearch && matchStatus && matchTipo && matchVencimento;
  });

  const getStatusConfig = (status: StatusLicenca) => {
    switch (status) {
      case 'ativa':
        return { color: 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20', icon: CheckCircle, text: 'Ativa' };
      case 'vencida':
        return { color: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/20', icon: Warning, text: 'Vencida' };
      case 'em_analise':
        return { color: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20', icon: Clock, text: 'Em Análise' };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 rounded-xl">
              <Certificate weight="duotone" className="w-6 h-6" />
            </div>
            Licenciamento Ambiental
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Controle de Licenças (LP, LI, LO), condicionantes e vencimentos
          </p>
        </div>

        <button
          onClick={() => navigate('/projetos', { state: { openCreateModal: true, contexto: 'licenciamento' } })}
          className={cn(primaryActionButtonClass, 'gap-2 shrink-0 px-4 py-2.5 text-sm font-semibold')}
        >
          <Plus weight="bold" className="h-4 w-4" />
          Nova Licença
        </button>
      </div>

      {/* Dashboard Resumo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Licenças Ativas" value={licencas.filter(l => l.status === 'ativa').length} tone="ambiental" icon={<CheckCircle weight="fill" className="h-5 w-5" />} />
        <MetricCard label="Licenças Vencidas" value={licencas.filter(l => l.status === 'vencida').length} tone="danger" delay={0.05} icon={<Warning weight="fill" className="h-5 w-5" />} />
        <MetricCard label="Condicionantes Pendentes" value={licencas.reduce((acc, l) => acc + l.condicionantesPendentes, 0)} tone="danger" delay={0.1} icon={<FileText weight="fill" className="h-5 w-5" />} />
      </div>

      {/* Filters */}
      <div className={cn(filterBarClass, 'flex flex-col items-stretch gap-2 xl:flex-row xl:items-center')}>
        <div className="relative flex-1 w-full xl:max-w-md min-w-0">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 z-10" />
          <input
            type="text"
            placeholder="Buscar por empreendimento ou número da licença..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={filterSearchInputClass}
          />
        </div>
        <div className="flex flex-1 flex-col sm:flex-row gap-2 min-w-0">
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Status: Todos"
            className="min-w-0 flex-1"
            options={[
              { label: 'Status: Todos', value: '' },
              { label: 'Ativa', value: 'ativa' },
              { label: 'Vencida', value: 'vencida' },
              { label: 'Em Análise', value: 'em_analise' }
            ]}
          />
          <CustomSelect
            value={tipoFilter}
            onChange={setTipoFilter}
            placeholder="Tipo: Todos"
            className="min-w-0 flex-1"
            options={[
              { label: 'Tipo: Todos', value: '' },
              { label: 'Licença Prévia (LP)', value: 'LP' },
              { label: 'Licença de Instalação (LI)', value: 'LI' },
              { label: 'Licença de Operação (LO)', value: 'LO' }
            ]}
          />
          <CustomSelect
            value={vencimentoFilter}
            onChange={setVencimentoFilter}
            placeholder="Vencimento: Todos"
            className="min-w-0 flex-1"
            options={[
              { label: 'Vencimento: Todos', value: '' },
              { label: 'Próximos 30 dias', value: '30d' },
              { label: 'Vencido', value: 'vencido' }
            ]}
          />
        </div>
      </div>

      {/* Tabela de Licenças */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="px-4 py-2.5">Número / Órgão</th>
                <th className="px-4 py-2.5">Empreendimento</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Vencimento</th>
                <th className="px-4 py-2.5">Condicionantes</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filtered.map(licenca => {
                const statusConf = getStatusConfig(licenca.status);
                const Icon = statusConf.icon;
                
                return (
                  <tr key={licenca.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer text-xs">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-zinc-900 dark:text-white">{licenca.numero}</div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{licenca.orgao}</div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                      {licenca.empreendimento}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                      {licenca.tipo}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                      {licenca.dataVencimento}
                    </td>
                    <td className="px-4 py-2.5">
                      {licenca.condicionantesPendentes > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400">
                          {licenca.condicionantesPendentes} pendentes
                        </span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", statusConf.color)}>
                        <Icon className="w-3 h-3" />
                        {statusConf.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-zinc-500">
                    Nenhuma licença encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
