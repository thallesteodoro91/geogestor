import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { PageFilterBar } from '../../components/PageFilterBar';
import { PageHeader } from '../../components/PageHeader';
import { ArrowClockwise, Plus, Pencil, Trash, FileText } from '@phosphor-icons/react';
import { Modal } from '../../components/Modal';
import {
  headerPrimaryActionButtonClass,
  headerPrimaryActionIconClass,
  secondarySmallActionButtonClass,
} from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { MetricCard } from '../../components/MetricCard';
import { cn } from '../../utils/cn';
import { geoOrangeLabelClass, geoOrangeSurfaceClass, geoOrangeValueClass } from '../../utils/geoTheme';
import { apiClient } from '../../services/apiClient';

interface AuditLog {
  id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity: string;
  userId: string;
  oldData: string | null;
  newData: string | null;
  createdAt: string;
}

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');

  const fetchLogs = () => {
    Promise.resolve().then(() => {
      setLoading(true);
    });
    apiClient.get<AuditLog[]>('/api/audit-logs')
      .then(data => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching audit logs:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Plus className="w-3.5 h-3.5" /> Criação
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
            <Pencil className="w-3.5 h-3.5" /> Edição
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
            <Trash className="w-3.5 h-3.5" /> Exclusão
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-50 dark:bg-zinc-950 text-zinc-700 border border-zinc-100 dark:border-zinc-800">
            {action}
          </span>
        );
    }
  };

  const getEntityLabel = (entity: string) => {
    switch (entity) {
      case 'Cliente':
        return 'Cliente';
      case 'Projeto':
        return 'Projeto';
      case 'Orcamento':
        return 'Orçamento';
      case 'Despesa':
        return 'Despesa';
      default:
        return entity;
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    const matchesEntity = entityFilter === 'ALL' || log.entity === entityFilter;
    return matchesAction && matchesEntity;
  });

  // Calculate statistics
  const totalInsert = logs.filter(l => l.action === 'INSERT').length;
  const totalUpdate = logs.filter(l => l.action === 'UPDATE').length;
  const totalDelete = logs.filter(l => l.action === 'DELETE').length;
  const activeFilterCount = [actionFilter !== 'ALL', entityFilter !== 'ALL'].filter(Boolean).length;

  const renderDataDiff = (log: AuditLog) => {
    const oldObj = log.oldData ? (JSON.parse(log.oldData) as Record<string, unknown>) : null;
    const newObj = log.newData ? (JSON.parse(log.newData) as Record<string, unknown>) : null;

    // Helper to format values
    const formatVal = (val: unknown) => {
      if (val === null || val === undefined) return <span className="text-zinc-500 dark:text-zinc-400 italic">nulo</span>;
      if (typeof val === 'object') return JSON.stringify(val);
      if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
      return String(val);
    };

    if (log.action === 'INSERT' && newObj) {
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-zinc-950 dark:text-white uppercase tracking-wider mb-3">Dados Cadastrados</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2">
            {Object.entries(newObj).map(([key, val]) => (
              <div key={key} className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/50">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">{key}</span>
                <span className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{formatVal(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (log.action === 'DELETE' && oldObj) {
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-zinc-950 dark:text-white uppercase tracking-wider mb-3">Dados Excluídos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2">
            {Object.entries(oldObj).map(([key, val]) => (
              <div key={key} className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800/50">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">{key}</span>
                <span className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{formatVal(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (log.action === 'UPDATE') {
      const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
      const changedFields: { key: string; oldVal: unknown; newVal: unknown }[] = [];

      allKeys.forEach(key => {
        // Ignorar campos de timestamp internos de atualização se forem as únicas alterações
        if (key === 'updatedAt' || key === 'createdAt') return;

        const oldVal = oldObj ? oldObj[key] : undefined;
        const newVal = newObj ? newObj[key] : undefined;

        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changedFields.push({ key, oldVal, newVal });
        }
      });

      return (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-zinc-950 dark:text-white uppercase tracking-wider mb-3">Campos Alterados</h4>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
            {changedFields.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">Nenhum campo principal sofreu alterações (provavelmente apenas data de atualização).</p>
            ) : (
              changedFields.map(({ key, oldVal, newVal }) => (
                <div key={key} className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="md:w-1/3">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Atributo</span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{key}</span>
                  </div>
                  <div className="md:w-1/3 bg-rose-50/50 border border-rose-100/55 rounded-xl p-2.5">
                    <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block">Antes</span>
                    <span className="text-xs font-medium text-rose-700 break-all">{formatVal(oldVal)}</span>
                  </div>
                  <div className="md:w-1/3 bg-emerald-50/50 border border-emerald-100/55 rounded-xl p-2.5">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider block">Depois</span>
                    <span className="text-xs font-medium text-emerald-700 break-all">{formatVal(newVal)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Layout>
      <PageHeader
        eyebrow="Segurança & Conformidade"
        title="Auditoria de Logs"
        description="Histórico completo de alterações realizadas localmente no sistema."
        action={
          <button 
            type="button"
            onClick={fetchLogs}
            className={headerPrimaryActionButtonClass}
          >
            <span>Atualizar</span>
            <span className={headerPrimaryActionIconClass}>
              <ArrowClockwise weight="bold" className="w-4 h-4" />
            </span>
          </button>
        }
      />

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className={cn(geoOrangeSurfaceClass, 'rounded-[2rem] p-8 ring-1 ring-orange-300/15 shadow-sm')}>
          <span className={cn('block text-xs font-bold uppercase tracking-widest', geoOrangeLabelClass)}>Total de Logs</span>
          <span className={cn('mt-2 block text-4xl font-bold', geoOrangeValueClass)}>{logs.length}</span>
        </div>
        <MetricCard label="Criações (INSERT)" value={totalInsert} tone="positive" icon={<Plus className="h-5 w-5" />} />
        <MetricCard label="Edições (UPDATE)" value={totalUpdate} tone="topografia" delay={0.05} icon={<Pencil className="h-5 w-5" />} />
        <MetricCard label="Exclusões (DELETE)" value={totalDelete} tone="danger" delay={0.1} icon={<Trash className="h-5 w-5" />} />
      </div>

      {/* Main Filter & Feed Section */}
      <PageFilterBar
        filtersOpen={showFilters}
        onFiltersToggle={() => setShowFilters((current) => !current)}
        onClear={() => {
          setActionFilter('ALL');
          setEntityFilter('ALL');
        }}
        activeFilterCount={activeFilterCount}
        filterPanelId="audit-log-filter-panel"
        panelClassName="sm:grid-cols-2 lg:grid-cols-2"
      >
            <div>
              <label htmlFor="action-filter" className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Ação</label>
              <CustomSelect
                id="action-filter"
                value={actionFilter} 
                onChange={setActionFilter}
                placeholder="Todas as ações"
                ariaLabel="Filtrar por ação"
                options={[
                  { label: 'Todas as ações', value: 'ALL' },
                  { label: 'Criação (INSERT)', value: 'INSERT' },
                  { label: 'Edição (UPDATE)', value: 'UPDATE' },
                  { label: 'Exclusão (DELETE)', value: 'DELETE' }
                ]}
                buttonClassName="mt-1.5 h-10 min-h-10"
              />
            </div>

            <div>
              <label htmlFor="entity-filter" className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Entidade</label>
              <CustomSelect
                id="entity-filter"
                value={entityFilter} 
                onChange={setEntityFilter}
                placeholder="Todas as tabelas"
                ariaLabel="Filtrar por entidade"
                options={[
                  { label: 'Todas as tabelas', value: 'ALL' },
                  { label: 'Cliente', value: 'Cliente' },
                  { label: 'Projeto', value: 'Projeto' },
                  { label: 'Orçamento', value: 'Orcamento' },
                  { label: 'Despesa', value: 'Despesa' }
                ]}
                buttonClassName="mt-1.5 h-10 min-h-10"
              />
            </div>
      </PageFilterBar>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm mb-12">
        {loading ? (
          <div className="text-center py-20 text-zinc-500 dark:text-zinc-400 font-medium">Carregando logs de auditoria...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 dark:text-zinc-400 font-medium">Nenhum log encontrado para os filtros selecionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                  <th className="pb-4">Horário</th>
                  <th className="pb-4">Ação</th>
                  <th className="pb-4">Entidade</th>
                  <th className="pb-4">Autor</th>
                  <th className="pb-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 text-sm text-zinc-600">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50 dark:bg-zinc-900/50 transition-colors">
                    <td className="py-4 font-medium text-zinc-500 dark:text-zinc-400">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {getEntityLabel(log.entity)}
                    </td>
                    <td className="py-4 text-zinc-500 dark:text-zinc-400 font-medium">
                      {log.userId}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-all active:scale-[0.98]"
                      >
                        <FileText className="w-3.5 h-3.5" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Details */}
      <Modal
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="Detalhes do Log"
        maxWidth="max-w-3xl"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-zinc-500 dark:text-zinc-400 block">Entidade</span>
                <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  {getEntityLabel(selectedLog.entity)}
                </h4>
              </div>
              <div>
                {getActionBadge(selectedLog.action)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <div>
                <span className="block text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400">Identificador do Log</span>
                <span className="text-zinc-800 dark:text-zinc-200 break-all font-mono">{selectedLog.id}</span>
              </div>
              <div>
                <span className="block text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400">Data/Hora</span>
                <span className="text-zinc-800 dark:text-zinc-200">{new Date(selectedLog.createdAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div className="mt-4">
              {renderDataDiff(selectedLog)}
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800/85">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className={secondarySmallActionButtonClass}
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
