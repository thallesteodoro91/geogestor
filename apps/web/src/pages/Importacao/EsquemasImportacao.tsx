import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCsv, Gear, ListDashes, MagnifyingGlass, Trash } from '@phosphor-icons/react';
import { Layout } from '../../components/Layout';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { persistOperationalSetting } from '../../services/operationalSettings';

interface ImportSchema {
  id: string;
  name: string;
  entity: string;
  mapping: Record<string, string>;
  date: string;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : dateFormatter.format(date);
};

export function EsquemasImportacao() {
  const [schemas, setSchemas] = useState<ImportSchema[]>(() => {
    return JSON.parse(localStorage.getItem('import_schemas') || '[]');
  });
  const [search, setSearch] = useState('');
  const [schemaToDelete, setSchemaToDelete] = useState<ImportSchema | null>(null);

  const filteredSchemas = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return schemas;

    return schemas.filter(schema =>
      schema.name.toLowerCase().includes(normalizedSearch) ||
      schema.entity.toLowerCase().includes(normalizedSearch)
    );
  }, [schemas, search]);

  const handleDelete = async () => {
    if (!schemaToDelete) return;

    const updated = schemas.filter(schema => schema.id !== schemaToDelete.id);
    await persistOperationalSetting('import_schemas', updated);
    setSchemas(updated);
    setSchemaToDelete(null);
  };

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <Gear weight="bold" size={14} aria-hidden="true" />
            Sistema
          </span>
          <h1 className="text-2xl font-bold leading-tight text-zinc-950 dark:text-white md:text-[28px]">
            Esquemas de importação
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Gerencie os modelos salvos automaticamente após cada importação.
          </p>
        </div>

        <Link
          to="/importacao"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500/45 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          <FileCsv weight="bold" size={16} aria-hidden="true" />
          Nova importação
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-950 dark:text-white">
            <Gear weight="duotone" size={22} aria-hidden="true" className="text-zinc-400" />
            Esquemas salvos
          </h2>
          <div className="relative">
            <label htmlFor="schema-search" className="sr-only">
              Buscar esquema
            </label>
            <MagnifyingGlass
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            />
            <input
              id="schema-search"
              name="busca-esquema"
              type="search"
              autoComplete="off"
              placeholder="Buscar esquema…"
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-zinc-50 pl-10 pr-3 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/35 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 sm:w-72"
            />
          </div>
        </div>

        {filteredSchemas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-14 text-center dark:border-zinc-700">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-50 text-zinc-400 dark:bg-zinc-950">
              <ListDashes weight="duotone" size={30} aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Nenhum esquema encontrado</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Faça uma importação para salvar um modelo de colunas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <tr>
                  <th scope="col" className="px-4 py-3">Nome do esquema</th>
                  <th scope="col" className="px-4 py-3">Entidade</th>
                  <th scope="col" className="px-4 py-3">Campos mapeados</th>
                  <th scope="col" className="px-4 py-3">Data</th>
                  <th scope="col" className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredSchemas.map(schema => (
                  <tr key={schema.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/70">
                    <td className="max-w-xs px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <span className="block truncate">{schema.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold uppercase text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {schema.entity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {Object.keys(schema.mapping).length} campos
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {formatDate(schema.date)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSchemaToDelete(schema)}
                        aria-label={`Excluir esquema ${schema.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500/35 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-red-900/70 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                      >
                        <Trash weight="bold" size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(schemaToDelete)}
        onClose={() => setSchemaToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir esquema"
        description={`O esquema "${schemaToDelete?.name ?? ''}" será removido dos modelos salvos. Você poderá gerar outro ao concluir uma nova importação.`}
        confirmText="Excluir esquema"
        cancelText="Cancelar"
        variant="danger"
      />
    </Layout>
  );
}
