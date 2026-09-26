import { appLinks, type EnvironmentalDemandListItem } from '@geogestor/contracts';
import { ArrowRight, CalendarBlank, Scales } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import treesIllustration from '../../assets/magnific-icons/trees_5026999.png';
import { cn } from '../../utils/cn';
import { getWorkStatusPresentation } from '../../utils/workStatus';
import classes from './EnvironmentalDemandCard.module.css';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

function formatDate(date?: string | null) {
  return date ? dateFormatter.format(new Date(`${date.slice(0, 10)}T12:00:00Z`)) : 'Não definido';
}

function deadlineTone(date?: string | null) {
  if (!date) return 'text-zinc-500 dark:text-zinc-400';
  const days = Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'text-red-700 dark:text-red-300';
  if (days <= 7) return 'text-amber-700 dark:text-amber-300';
  return 'text-emerald-700 dark:text-emerald-300';
}

function DemandStatusRing({ status }: { status: string }) {
  const presentation = getWorkStatusPresentation(status);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className={cn('max-w-32 truncate rounded-full px-2.5 py-1 text-[10px] font-semibold', presentation.badgeClass)}>{presentation.label}</span>
      <svg
        role="img"
        aria-label={`Situação do trabalho: ${presentation.label}`}
        viewBox="0 0 28 28"
        className={cn('h-7 w-7 -rotate-90', presentation.ringClass)}
      >
        <circle cx="14" cy="14" r="10.5" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.18" />
        <circle
          cx="14"
          cy="14"
          r="10.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${presentation.progress} 100`}
        />
      </svg>
    </div>
  );
}

export function EnvironmentalDemandCard({ demand }: { demand: EnvironmentalDemandListItem }) {
  const isAssessment = demand.tipo === 'Perícia';
  const status = demand.status || 'Sem status';
  const demandType = demand.tipoDemanda || demand.tipo || 'Demanda ambiental';
  const supportingText = demand.proximaAcao
    ? `Próxima ação: ${demand.proximaAcao}${demand.proximaAcaoEm ? ` · ${formatDate(demand.proximaAcaoEm)}` : ''}`
    : demand.descricao || 'Nenhuma ação programada para esta demanda.';

  return (
    <Link
      to={appLinks.environmentalDemand(demand.id)}
      aria-label={`Abrir demanda ${demand.nome}`}
      className={cn(
        classes.card,
        'group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/90 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-zinc-800 dark:hover:border-emerald-500/50 dark:focus-visible:ring-offset-zinc-950'
      )}
    >
      <div className={cn(
        'relative h-28 overflow-hidden border-b',
        isAssessment
          ? 'border-sky-200/70 bg-gradient-to-br from-sky-100 via-cyan-50 to-indigo-100 dark:border-sky-900/50 dark:from-sky-950 dark:via-zinc-900 dark:to-indigo-950'
          : 'border-emerald-200/70 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:border-emerald-900/50 dark:from-emerald-950 dark:via-zinc-900 dark:to-teal-950'
      )}>
        <span aria-hidden="true" className="absolute -left-8 -top-12 h-36 w-36 rounded-full bg-white/35 blur-2xl dark:bg-white/5" />
        <span aria-hidden="true" className="absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-emerald-300/25 blur-2xl dark:bg-emerald-400/10" />
        {isAssessment ? (
          <Scales aria-hidden="true" weight="duotone" className="absolute -bottom-4 right-5 h-28 w-28 text-sky-500/35 transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105 dark:text-sky-300/20 motion-reduce:transition-none" />
        ) : (
          <img
            src={treesIllustration}
            alt=""
            width={512}
            height={512}
            loading="lazy"
            className="absolute -bottom-10 right-3 h-32 w-32 object-contain opacity-70 transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105 dark:opacity-45 motion-reduce:transition-none"
          />
        )}
        <span className={cn(
          'absolute bottom-3 left-3 max-w-[70%] truncate rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm',
          isAssessment
            ? 'border-sky-200/80 bg-white/75 text-sky-800 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-200'
            : 'border-emerald-200/80 bg-white/75 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200'
        )}>
          {demandType}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={cn(classes.title, 'line-clamp-2 text-zinc-950 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300')}>{demand.nome}</h2>
            <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{demand.orgaoAmbiental || demand.protocolo || 'Órgão ou processo não informado'}</p>
          </div>
          <DemandStatusRing status={status} />
        </div>

        <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{supportingText}</p>

        <dl className={cn(classes.footer, '-mx-4 -mb-4 mt-4 bg-zinc-50/70 dark:bg-zinc-950/35')}>
          <div className="min-w-0 flex-1 border-r border-zinc-100 pr-3 dark:border-zinc-800">
            <dt className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Cliente</dt>
            <dd className="mt-1 truncate text-[11px] font-semibold text-zinc-700 dark:text-zinc-200" title={demand.clienteNome}>{demand.clienteNome}</dd>
          </div>
          <div className="min-w-0 flex-1 border-r border-zinc-100 px-3 dark:border-zinc-800">
            <dt className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Fase</dt>
            <dd className="mt-1 truncate text-[11px] font-semibold text-zinc-700 dark:text-zinc-200" title={demand.statusFase || 'Inicial'}>{demand.statusFase || 'Inicial'}</dd>
          </div>
          <div className="min-w-0 flex-1 pl-3">
            <dt className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500"><CalendarBlank aria-hidden="true" className="h-3 w-3" />Prazo</dt>
            <dd className={cn('mt-1 truncate text-[11px] font-semibold tabular-nums', deadlineTone(demand.dataEntrega))}>{formatDate(demand.dataEntrega)}</dd>
          </div>
        </dl>
      </div>

      <span aria-hidden="true" className="absolute right-4 top-4 hidden items-center gap-1 rounded-full bg-zinc-950/70 px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 sm:flex motion-reduce:transition-none">
        Abrir <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
