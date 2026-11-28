import { CaretDown } from '@phosphor-icons/react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PopoverSurface } from '../../components/Form';

export interface BudgetAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

// Keep the menu inside the dialog so its focus trap and inert stack apply.
export function BudgetMoreActions({ actions, disabled = false, label = 'Mais ações', ariaLabel = label }: { actions: BudgetAction[]; disabled?: boolean; label?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const attachRoot = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    setPortalContainer(node?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') || null);
  }, []);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);

  if (!actions.length) return null;
  return (
    <div ref={attachRoot} className="relative">
      <button ref={triggerRef} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(value => !value)} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
        }} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-xs disabled:opacity-60">
        {label}<CaretDown aria-hidden="true" size={16} />
      </button>
      <PopoverSurface ref={menuRef} open={open} anchorRef={triggerRef} portalContainer={portalContainer} id={id} role="menu" ariaLabel={ariaLabel} minWidth={240} maxWidth={256} className="overflow-y-auto p-1.5">
      <div onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); return; }
          if (event.key === 'Tab') { setOpen(false); triggerRef.current?.focus(); return; }
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') || []);
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : (index + 1) % items.length;
          items[next]?.focus();
        }}>
        {actions.map(action => <button key={action.label} type="button" role="menuitem" tabIndex={-1} disabled={action.disabled}
          onClick={() => { setOpen(false); triggerRef.current?.focus(); action.onClick(); }}
          className="geo-focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-text-primary hover:bg-brand-surface-subtle disabled:opacity-60">
          {action.icon}{action.label}
        </button>)}
      </div>
      </PopoverSurface>
    </div>
  );
}
