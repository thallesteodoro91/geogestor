import { useRef, type KeyboardEvent } from 'react';
import executiveReportIcon from '../../assets/magnific-icons/line-bars_2698159.png';
import financialReportIcon from '../../assets/magnific-icons/money-management_9509946.png';
import projectsReportIcon from '../../assets/magnific-icons/tool_9030221.png';
import { cn } from '../../utils/cn';
import {
  localNavigationButtonClass,
  localNavigationIconClass,
  localNavigationItemsClass
} from '../../utils/localNavigationStyles';
import { REPORT_TYPES, type ReportType } from './reportPresentation';

const TABS = [
  { type: 'financeiro' as const, label: 'Financeiro', icon: financialReportIcon, tone: 'finance' as const },
  { type: 'projetos' as const, label: 'Projetos', icon: projectsReportIcon, tone: 'system' as const },
  { type: 'executivo' as const, label: 'Executivo', icon: executiveReportIcon, tone: 'field' as const }
];

export function ReportTabs({
  value,
  onChange
}: {
  value: ReportType;
  onChange: (type: ReportType) => void;
}) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, type: ReportType) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = REPORT_TYPES.indexOf(type);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? REPORT_TYPES.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + REPORT_TYPES.length) % REPORT_TYPES.length;
    const next = REPORT_TYPES[nextIndex];
    onChange(next);
    tabListRef.current?.querySelector<HTMLButtonElement>(`[data-report-tab="${next}"]`)?.focus();
  };

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Tipo de relatório"
      className={cn(
        localNavigationItemsClass,
        'w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      )}
    >
      {TABS.map(({ type, label, icon, tone }) => {
        const selected = value === type;
        return (
          <button
            key={type}
            id={`report-tab-${type}`}
            data-report-tab={type}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="report-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(type)}
            onKeyDown={(event) => handleKeyDown(event, type)}
            className={localNavigationButtonClass(selected, tone)}
          >
            <span
              aria-hidden="true"
              className={localNavigationIconClass(
                selected,
                tone,
                'overflow-hidden bg-transparent p-0 dark:bg-transparent'
              )}
            >
              <img src={icon} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
