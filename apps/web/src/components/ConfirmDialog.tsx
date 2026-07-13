import React from 'react';
import { Modal } from './Modal';
import { WarningCircle, Info, Trash } from '@phosphor-icons/react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar exclusão',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false
}) => {
  const getIcon = () => {
    if (variant === 'danger') return <Trash aria-hidden="true" weight="duotone" className="w-6 h-6 text-brand-red-600 dark:text-brand-red-100" />;
    if (variant === 'warning') return <WarningCircle aria-hidden="true" weight="duotone" className="w-6 h-6 text-brand-rajah-800 dark:text-brand-rajah-100" />;
    return <Info aria-hidden="true" weight="duotone" className="w-6 h-6 text-brand-turquoise-700 dark:text-brand-turquoise-100" />;
  };

  const getBadgeBg = () => {
    if (variant === 'danger') return 'bg-brand-red-50 dark:bg-brand-red-500/12 border-brand-red-200 dark:border-brand-red-300/25';
    if (variant === 'warning') return 'bg-brand-rajah-50 dark:bg-brand-rajah-500/12 border-brand-rajah-300 dark:border-brand-rajah-300/25';
    return 'bg-brand-turquoise-50 dark:bg-brand-turquoise-500/12 border-brand-turquoise-200 dark:border-brand-turquoise-300/25';
  };

  const getButtonBg = () => {
    if (variant === 'danger') return 'bg-brand-red-600 hover:bg-brand-red-700 active:bg-brand-red-800 text-white shadow-brand-red-600/20';
    if (variant === 'warning') return 'bg-brand-rajah-700 hover:bg-brand-rajah-800 active:bg-brand-rajah-900 text-white shadow-brand-rajah-700/20';
    return 'bg-brand-turquoise-700 hover:bg-brand-turquoise-800 active:bg-brand-turquoise-900 text-white shadow-brand-turquoise-700/20';
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-6 pt-2">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center border shrink-0 ${getBadgeBg()}`}>
            {getIcon()}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 shrink-0 px-5 py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            className={`geo-button-base geo-focus-ring flex min-h-11 shrink-0 gap-2 px-5 py-2.5 text-xs shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${getButtonBg()}`}
          >
            {loading && (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"
              />
            )}
            {loading && <span className="sr-only">Processando confirmação…</span>}
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
