import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { forwardRef, useImperativeHandle, useRef, type ChangeEvent, type InputEvent, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  wrapperClassName?: string;
}

function readableName(input: HTMLInputElement | null) {
  return input?.getAttribute('aria-label') || input?.name || 'valor';
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
    onChange?.({ target: input, currentTarget: input } as ChangeEvent<HTMLInputElement>);
    onInput?.({ target: input, currentTarget: input } as unknown as InputEvent<HTMLInputElement>);
  };

  const current = Number(props.value);
  const min = props.min === undefined ? -Infinity : Number(props.min);
  const max = props.max === undefined ? Infinity : Number(props.max);
  const decrementDisabled = Boolean(disabled || (Number.isFinite(current) && current <= min));
  const incrementDisabled = Boolean(disabled || (Number.isFinite(current) && current >= max));

  return (
    <span className={cn('geo-numeric-input relative block min-w-0 w-full', wrapperClassName)}>
      <input
        {...props}
        ref={inputRef}
        type="number"
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={onChange}
        onInput={onInput}
        className={cn('geo-number-input appearance-none pr-9', className)}
      />
      <span className="absolute inset-y-[0.2rem] right-[0.2rem] flex w-[1.6rem] flex-col overflow-hidden rounded-md border border-zinc-200/80 bg-zinc-50/90 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-800/80">
        <button type="button" disabled={incrementDisabled} onClick={() => changeValue(1)} aria-label={`Aumentar ${ariaLabel || readableName(inputRef.current)}`} className="geo-focus-ring flex min-h-0 flex-1 items-center justify-center text-zinc-500 transition-[background-color,color] duration-150 hover:bg-white hover:text-brand-primary-600 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-brand-primary-300">
          <CaretUp aria-hidden="true" weight="bold" size={10} />
        </button>
        <span aria-hidden="true" className="h-px bg-zinc-200/80 dark:bg-zinc-700/80" />
        <button type="button" disabled={decrementDisabled} onClick={() => changeValue(-1)} aria-label={`Diminuir ${ariaLabel || readableName(inputRef.current)}`} className="geo-focus-ring flex min-h-0 flex-1 items-center justify-center text-zinc-500 transition-[background-color,color] duration-150 hover:bg-white hover:text-brand-primary-600 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-brand-primary-300">
          <CaretDown aria-hidden="true" weight="bold" size={10} />
        </button>
      </span>
    </span>
  );
});
