import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { geoModalTransition } from '../utils/motion';
import { cn } from '../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  maxWidth?: string; // e.g. "max-w-md", "max-w-5xl"
  panelClassName?: string;
  contentScrollable?: boolean;
  initialFocusId?: string;
  closeDisabled?: boolean;
  dialogRole?: 'dialog' | 'alertdialog';
  ariaDescribedBy?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
  panelClassName,
  contentScrollable = true,
  initialFocusId,
  closeDisabled = false,
  dialogRole = 'dialog',
  ariaDescribedBy
}: ModalProps) {
  const titleId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousRootAriaHidden = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();
  const modalTransition = reduceMotion ? { duration: 0 } : geoModalTransition;

  // Store previously focused element and handle Escape key + scroll lock
  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      const appRoot = document.getElementById('root');
      if (appRoot) {
        previousRootAriaHidden.current = appRoot.getAttribute('aria-hidden');
        appRoot.setAttribute('aria-hidden', 'true');
        appRoot.setAttribute('inert', '');
      }

      // Set focus to the modal container or first input
      setTimeout(() => {
        if (modalRef.current) {
          const requestedFocus = initialFocusId
            ? modalRef.current.querySelector<HTMLElement>(`#${CSS.escape(initialFocusId)}`)
            : null;
          const focusable = modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
          );
          if (requestedFocus) {
            requestedFocus.focus();
          } else if (focusable.length > 0) {
            (focusable[0] as HTMLElement).focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);
    } else {
      document.body.style.overflow = 'unset';
      const appRoot = document.getElementById('root');
      if (appRoot) {
        appRoot.removeAttribute('inert');
        if (previousRootAriaHidden.current === null) appRoot.removeAttribute('aria-hidden');
        else appRoot.setAttribute('aria-hidden', previousRootAriaHidden.current);
      }
      if (previousFocus.current) {
        previousFocus.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = 'unset';
      const appRoot = document.getElementById('root');
      if (appRoot) {
        appRoot.removeAttribute('inert');
        if (previousRootAriaHidden.current === null) appRoot.removeAttribute('aria-hidden');
        else appRoot.setAttribute('aria-hidden', previousRootAriaHidden.current);
      }
    };
  }, [initialFocusId, isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !closeDisabled) {
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
              'geo-surface-raised relative my-auto flex max-h-[88vh] max-h-[88dvh] min-w-0 w-full flex-col overflow-hidden rounded-lg p-4 sm:p-6 md:p-8',
              maxWidth,
              panelClassName
            )}
          >
            {/* Header */}
            <div className="mb-5 flex flex-shrink-0 items-center justify-between gap-3">
              <h3 id={titleId} className="min-w-0 break-words text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
                {title}
              </h3>
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
            <div className={`min-h-0 min-w-0 flex-1 overflow-x-hidden ${contentScrollable ? 'overflow-y-auto pr-1' : 'flex flex-col overflow-y-hidden'}`}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
