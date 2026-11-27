import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { geoModalTransition } from '../utils/motion';
import { cn } from '../utils/cn';

const modalStack: HTMLElement[] = [];
let lockedRoot: { hidden: string | null; inert: boolean; overflow: string } | null = null;
function refreshModalStack() {
  modalStack.forEach((element, index) => {
    const covered = index !== modalStack.length - 1;
    element.toggleAttribute('inert', covered);
    if (covered) element.setAttribute('aria-hidden', 'true');
    else element.removeAttribute('aria-hidden');
  });
  const root = document.getElementById('root');
  if (modalStack.length) {
    if (!lockedRoot) lockedRoot = { hidden: root?.getAttribute('aria-hidden') ?? null, inert: root?.hasAttribute('inert') ?? false, overflow: document.body.style.overflow };
    root?.setAttribute('aria-hidden', 'true'); root?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
  } else if (lockedRoot) {
    root?.toggleAttribute('inert', lockedRoot.inert);
    if (lockedRoot.hidden === null) root?.removeAttribute('aria-hidden'); else root?.setAttribute('aria-hidden', lockedRoot.hidden);
    document.body.style.overflow = lockedRoot.overflow;
    lockedRoot = null;
  }
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string; // e.g. "max-w-md", "max-w-5xl"
  panelClassName?: string;
  contentScrollable?: boolean;
  initialFocusId?: string;
  initialFocusPreventScroll?: boolean;
  returnFocusSelector?: string;
  closeDisabled?: boolean;
  dialogRole?: 'dialog' | 'alertdialog';
  ariaDescribedBy?: string;
  density?: 'comfortable' | 'compact';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-md",
  panelClassName,
  contentScrollable = true,
  initialFocusId,
  initialFocusPreventScroll = false,
  returnFocusSelector,
  closeDisabled = false,
  dialogRole = 'dialog',
  ariaDescribedBy,
  density = 'comfortable'
}: ModalProps) {
  const titleId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const modalTransition = reduceMotion ? { duration: 0 } : geoModalTransition;

  // Only the top dialog owns keyboard interaction. Covered editors keep drafts.
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const dialog = modalRef.current;
      previousFocus.current = document.activeElement as HTMLElement;
      modalStack.push(dialog);
      refreshModalStack();

      // Set focus to the modal container or first input
      const focusTimer = window.setTimeout(() => {
        if (modalRef.current && modalStack.at(-1) === dialog) {
          if (modalRef.current.contains(document.activeElement)) return;
          const requestedFocus = initialFocusId
            ? modalRef.current.querySelector<HTMLElement>(`#${CSS.escape(initialFocusId)}`)
            : null;
          const focusable = modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
          );
          if (requestedFocus) {
            requestedFocus.focus({ preventScroll: initialFocusPreventScroll });
          } else if (focusable.length > 0) {
            (focusable[0] as HTMLElement).focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);

      return () => {
        window.clearTimeout(focusTimer);
        const index = modalStack.indexOf(dialog);
        if (index >= 0) modalStack.splice(index, 1);
        refreshModalStack();
        dialog.removeAttribute('inert'); dialog.removeAttribute('aria-hidden');
        const previousElement = previousFocus.current;
        const visible = (element: HTMLElement | null | undefined) => Boolean(element?.isConnected && element.getClientRects().length && !element.closest('[inert]'));
        const previousElementIsVisible = visible(previousElement);
        const visibleFallback = returnFocusSelector ? Array.from(document.querySelectorAll<HTMLElement>(returnFocusSelector)).find(visible) : undefined;
        (previousElementIsVisible ? previousElement : visibleFallback)?.focus();
      };
    }
  }, [initialFocusId, initialFocusPreventScroll, isOpen, returnFocusSelector]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalStack.at(-1) === modalRef.current && e.key === 'Escape' && !e.defaultPrevented && !closeDisabled) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDisabled, isOpen, onClose]);

  // Tab Focus Trap
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusable = modalRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    );
    if (focusable.length === 0) return;

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-3 sm:p-5 md:p-8">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
            onClick={closeDisabled ? undefined : onClose}
            className={`absolute inset-0 bg-zinc-950/60 backdrop-blur-sm dark:bg-black/80 ${closeDisabled ? 'cursor-wait' : ''}`}
          />

          {/* Modal Container */}
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            role={dialogRole}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={ariaDescribedBy}
            onKeyDown={handleKeyDown}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            transition={modalTransition}
            className={cn(
              'geo-surface-raised relative my-auto flex max-h-[88vh] max-h-[88dvh] min-w-0 w-full flex-col overflow-hidden',
              density === 'compact' ? 'rounded-xl p-4' : 'rounded-lg p-4 sm:p-6 md:p-8',
              maxWidth,
              panelClassName
            )}
          >
            {/* Header */}
            <div
              className={cn(
                'flex flex-shrink-0 items-center justify-between gap-3',
                density === 'compact' ? 'mb-3' : 'mb-5'
              )}
            >
              <h2
                id={titleId}
                className={cn(
                  'min-w-0 break-words font-bold tracking-tight text-zinc-950 dark:text-white',
                  density === 'compact' ? 'text-lg' : 'text-xl'
                )}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={closeDisabled}
                className="geo-focus-ring flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-[background-color,color,transform] duration-150 hover:bg-brand-surface-subtle hover:text-zinc-800 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-brand-surface-muted dark:hover:text-zinc-100"
                aria-label="Fechar modal"
              >
                <X aria-hidden="true" size={18} weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className={`min-h-0 min-w-0 flex-1 overflow-x-hidden overscroll-contain ${contentScrollable ? 'overflow-y-auto pr-1' : 'flex flex-col overflow-y-hidden'}`}>
              {children}
            </div>
            {footer ? (
              <div
                className={cn(
                  'min-w-0 flex-shrink-0 border-t border-zinc-200 [padding-bottom:max(0px,env(safe-area-inset-bottom))] dark:border-zinc-800',
                  density === 'compact' ? 'mt-3 pt-3' : 'mt-5 pt-4'
                )}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
