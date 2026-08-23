import { Minus, Plus } from '@phosphor-icons/react';
import { forwardRef, useImperativeHandle, useRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  wrapperClassName?: string;
  decrementLabel?: string;
  incrementLabel?: string;
}

function fallbackStep(input: HTMLInputElement, direction: 1 | -1) {
  const step = input.step && input.step !== 'any' ? Number(input.step) : 1;
  const current = Number(input.value || input.min || 0);
  const min = input.min === '' ? -Infinity : Number(input.min);
  const max = input.max === '' ? Infinity : Number(input.max);
  const next = Math.min(max, Math.max(min, current + (Number.isFinite(step) && step > 0 ? step : 1) * direction));
  input.value = String(next);
}

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput({
  className,
  wrapperClassName,
  decrementLabel = 'Diminuir valor',
  incrementLabel = 'Aumentar valor',
  disabled,
  onChange,
  onInput,
  'aria-label': ariaLabel,
  ...props
}, forwardedRef) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  const changeValue = (direction: 1 | -1) => {
    const input = inputRef.current;
    if (!input || disabled) return;
    try {
      if (input.step === 'any') fallbackStep(input, direction);
      else if (direction > 0) input.stepUp();
      else input.stepDown();
    } catch {
      fallbackStep(input, direction);
    }
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  };

  const current = Number(props.value);
  const min = props.min === undefined ? -Infinity : Number(props.min);
  const max = props.max === undefined ? Infinity : Number(props.max);
  const decrementDisabled = Boolean(disabled || (Number.isFinite(current) && current <= min));
  const incrementDisabled = Boolean(disabled || (Number.isFinite(current) && current >= max));

  return (
    <span className={cn('geo-numeric-input grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-stretch gap-2', wrapperClassName)}>
      <button
        type="button"
        disabled={decrementDisabled}
        onClick={() => changeValue(-1)}
        aria-label={decrementLabel}
        aria-controls={props.id}
        className="group geo-focus-ring flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl transition-[background-color,box-shadow,transform] duration-150 hover:bg-zinc-100/80 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 motion-reduce:transition-none"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 shadow-sm transition-[background-color,border-color,color] group-hover:border-zinc-400 group-hover:bg-zinc-50 group-hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:group-hover:border-zinc-600 dark:group-hover:bg-zinc-800 dark:group-hover:text-white">
          <Minus aria-hidden="true" weight="bold" size={16} />
        </span>
      </button>
      <input
        {...props}
        ref={inputRef}
        type="number"
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={onChange}
        onInput={onInput}
        className={cn('geo-number-input min-h-11 min-w-0 w-full appearance-none px-3 text-center tabular-nums', className)}
      />
      <button
        type="button"
        disabled={incrementDisabled}
        onClick={() => changeValue(1)}
        aria-label={incrementLabel}
        aria-controls={props.id}
        className="group geo-focus-ring flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl transition-[background-color,box-shadow,transform] duration-150 hover:bg-zinc-100/80 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 motion-reduce:transition-none"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 shadow-sm transition-[background-color,border-color,color] group-hover:border-zinc-400 group-hover:bg-zinc-50 group-hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:group-hover:border-zinc-600 dark:group-hover:bg-zinc-800 dark:group-hover:text-white">
          <Plus aria-hidden="true" weight="bold" size={16} />
        </span>
      </button>
    </span>
  );
});
