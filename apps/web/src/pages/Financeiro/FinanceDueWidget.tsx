import { AuraAttentionWidget, AuraNumericValue } from '../../components/AuraWidget';
import { formatDateKey } from '../../utils/localDate';

export function FinanceDueWidget({ label, amount, date, title, actionLabel, onOpen }: {
  label: string;
  amount: number;
  date: string;
  title: string;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <AuraAttentionWidget
      className="finance-due-aura mb-4 w-full max-w-[260px]"
      label={label}
      context="Nesta página"
      value={<AuraNumericValue value={amount} currency />}
      detail={title}
      date={{ iso: date.slice(0, 10), label: formatDateKey(date) }}
      action={<button type="button" onClick={onOpen} className="geo-focus-ring aura-attention__overlay" aria-label={`${actionLabel}: ${title}`} />}
    />
  );
}
