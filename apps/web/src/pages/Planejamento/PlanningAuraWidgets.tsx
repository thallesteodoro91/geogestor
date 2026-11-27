import { useId } from 'react';
import { ArrowUpRight, Clock, CurrencyCircleDollar, PencilSimple, Percent, Target } from '@phosphor-icons/react';
import type { StrategicKeyResult } from '@geogestor/contracts';
import { Link } from 'react-router-dom';
import { AuraProgress, AuraProgressWidget, AuraWidget } from '../../components/AuraWidget';
import { formatDateKey } from '../../utils/localDate';
import { formatPlanningMeasure } from './planningMetadata';
import './planning-aura.css';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const cyclePreviewSize = 3;
const measureIcons = new Map([['dias', Clock], ['BRL', CurrencyCircleDollar], ['%', Percent]]);

export function PlanningCycleGoalsWidget({ results, progress, goalsHref, getGoalHref }: {
  results: StrategicKeyResult[];
  progress: number | null;
  goalsHref: string;
  getGoalHref: (id: string) => string;
}) {
  const headingId = useId();
  const measured = results.filter(result => result.progresso !== null).length;
  const shown = results.slice(0, cyclePreviewSize);

  return (
    <AuraWidget as="article" tone="teal" className="planning-cycle-goals" aria-labelledby={headingId}>
      <header className="planning-cycle-goals__heading">
        <h3 id={headingId}>Metas do ciclo</h3>
        <Link to={goalsHref} className="geo-focus-ring planning-cycle-goals__link" aria-label="Ver todos os objetivos e metas">
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </header>
      <div className="planning-cycle-goals__total">
        <p>Progresso geral</p>
        <div className="planning-cycle-goals__reading">
          <p className="aura-widget__value" data-unmeasured={progress === null}>
            {progress === null ? 'Sem medição' : `${number.format(progress)}%`}
          </p>
          {results.length > 0 && (
            <p className="planning-cycle-goals__coverage">
              {number.format(measured)} de {number.format(results.length)} {results.length === 1 ? 'medida' : 'medidas'}
            </p>
          )}
        </div>
        {progress !== null && <p className="sr-only">Média dos resultados-chave do ciclo com dados válidos.</p>}
      </div>
      {shown.length > 0 ? (
        <ul className="planning-cycle-goals__list">
          {shown.map(result => {
            const Icon = measureIcons.get(result.unidade) ?? Target;
            const current = result.valorAtual === null ? null : formatPlanningMeasure(result.valorAtual, result.unidade);
            const target = formatPlanningMeasure(result.meta, result.unidade);
            return (
              <li key={result.id}>
                <span className="planning-cycle-goals__icon"><Icon size={17} aria-hidden="true" /></span>
                <div className="planning-cycle-goals__result">
                  <div className="planning-cycle-goals__result-head">
                    <Link to={getGoalHref(result.id)} className="geo-focus-ring">{result.titulo}</Link>
                    <p>Meta <strong>{target}</strong></p>
                  </div>
                  {result.progresso !== null && <AuraProgress fraction={result.progresso / 100} />}
                  <p className="planning-cycle-goals__caption">
                    {current !== null && <span>Atual {current}</span>}
                    <span>{result.progresso === null ? 'Sem medição' : `${number.format(result.progresso)}% de progresso`}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="planning-cycle-goals__empty">Nenhuma meta cadastrada neste ciclo.</p>}
      {results.length > shown.length && (
        <p className="planning-cycle-goals__caption planning-cycle-goals__more">Exibindo {shown.length} de {number.format(results.length)} metas.</p>
      )}
    </AuraWidget>
  );
}

export function PlanningObjectiveWidget({ progress, measured, total }: {
  progress: number | null | undefined;
  measured: number;
  total: number;
}) {
  return (
    <AuraProgressWidget
      className="planning-aura--objective"
      headingAs="h5"
      label="Progresso do objetivo"
      context={`${number.format(total)} ${total === 1 ? 'indicador' : 'indicadores'}`}
      value={progress == null ? 'Sem medição' : `${number.format(progress)}%`}
      badge={progress == null ? undefined : `${number.format(measured)} ${measured === 1 ? 'medido' : 'medidos'}`}
      fraction={progress == null ? undefined : progress / 100}
    />
  );
}

export function PlanningGoalWidget({ title, target, current, progress, deadline, onEdit }: {
  title: string;
  target: string;
  current: string | null;
  progress: number | null;
  deadline: string;
  onEdit: () => void;
}) {
  const headingId = useId();
  return (
    <AuraWidget size="medium" tone="blue" className="planning-aura--goal" aria-labelledby={headingId}>
      <header className="planning-aura__goal-header">
        <p>Meta</p>
        {progress != null && <p className="planning-aura__goal-progress">{number.format(progress)}% de progresso</p>}
        <button type="button" className="geo-focus-ring planning-aura__edit" aria-label={`Editar resultado-chave ${title}`} onClick={onEdit}>
          <span className="planning-aura__edit-icon" aria-hidden="true"><PencilSimple size={15} /></span>
        </button>
      </header>
      <div className="planning-aura__goal-summary">
        <h5 id={headingId} className="planning-aura__goal-name">{title}</h5>
        <p className="planning-aura__goal-deadline">Prazo <span className="sr-only">do objetivo </span><time dateTime={deadline}>{formatDateKey(deadline)}</time></p>
      </div>
      <div className="planning-aura__goal-reading">
        {progress != null && <AuraProgress fraction={progress / 100} />}
        <dl className="planning-aura__goal-values">
          <div><dt>Atual</dt><dd>{current ?? 'Sem medição'}</dd></div>
          <div><dt>Meta</dt><dd>{target}</dd></div>
        </dl>
      </div>
    </AuraWidget>
  );
}
