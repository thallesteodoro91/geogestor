import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => ReactNode;
  mobileLabel?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Nenhum registro encontrado',
}: ResponsiveTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (data.length === 0) {
    return (
      <div className="geo-surface py-12 text-center text-zinc-500 dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((item) => (
          <div 
            key={keyExtractor(item)} 
            className="geo-surface p-6"
          >
            <dl className="space-y-3">
              {columns.map((column) => (
                <div key={column.key} className="flex flex-col gap-1">
                  <dt className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {column.mobileLabel || column.label}
                  </dt>
                  <dd className="text-sm font-semibold text-zinc-900 dark:text-white leading-relaxed">
                    {column.render(item)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="geo-surface overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-brand-border bg-brand-surface-subtle/70 dark:bg-brand-surface-muted/45">
            {columns.map((column) => (
              <th 
                key={column.key} 
                className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border">
          {data.map((item) => (
            <tr 
              key={keyExtractor(item)} 
              className="transition-colors hover:bg-brand-surface-subtle/70 dark:hover:bg-brand-surface-muted/35"
            >
              {columns.map((column) => (
                <td 
                  key={column.key} 
                  className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-white"
                >
                  {column.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
