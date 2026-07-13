import { useState, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretDown, Check } from '@phosphor-icons/react';
import { cn } from '../utils/cn';
import { filterActiveControlClass, filterControlClass } from '../utils/filterStyles';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  id,
  ariaLabel,
  className,
  buttonClassName
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const isActiveValue = Boolean(value && !['Todos', 'Todas', 'ALL', 'all'].includes(value));
  const closeMenu = () => setIsOpen(false);

  return (
    <div className={cn('relative min-w-[150px]', className)} ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') closeMenu();
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-label={ariaLabel || placeholder}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-haspopup="listbox"
        className={cn(
          filterControlClass,
          isActiveValue && filterActiveControlClass,
          'flex w-full items-center justify-between gap-3 text-left',
          buttonClassName
        )}
      >
        <span className="min-w-0 truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <CaretDown
          weight="bold"
          aria-hidden="true"
          className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200 ease-out', isOpen && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={menuId}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="geo-surface-raised absolute z-50 mt-1.5 w-full min-w-[180px] overflow-hidden p-1.5 backdrop-blur-xl"
          >
            <div className="max-h-60 overflow-y-auto scrollbar-thin">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  onClick={() => {
                    onChange(option.value);
                    closeMenu();
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-[background-color,color] duration-200 ease-out ${
                    value === option.value
                      ? 'bg-brand-primary-50 text-brand-primary-700 dark:bg-brand-primary-400/15 dark:text-brand-primary-100'
                      : 'text-zinc-700 hover:bg-brand-surface-subtle hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-brand-surface-muted dark:hover:text-white'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" weight="bold" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
