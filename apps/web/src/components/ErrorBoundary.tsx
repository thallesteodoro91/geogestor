import React, { type ReactNode, type ErrorInfo } from 'react';
import { WarningCircle, ArrowCounterClockwise, House } from '@phosphor-icons/react';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../utils/actionStyles';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorStack: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorStack: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorStack: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
    this.setState({ errorStack: errorInfo.componentStack || null });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorStack: null });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="geo-empty-state my-4 flex min-h-[400px] w-full items-center justify-center p-6 text-zinc-900 dark:text-zinc-100">
          <div className="geo-surface-raised w-full max-w-lg space-y-5 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-brand-red-50 text-brand-red-600 ring-8 ring-brand-red-500/5 dark:bg-brand-red-500/12 dark:text-brand-red-100">
              <WarningCircle aria-hidden="true" weight="duotone" className="w-9 h-9" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold tracking-tight">
                {this.props.fallbackTitle || 'Ops! Ocorreu um erro ao exibir esta tela'}
              </h3>
              <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Um erro inesperado aconteceu durante a renderização. Os dados foram preservados com segurança.
              </p>
              {this.state.error && (
                <div className="mt-3 max-h-40 space-y-2 overflow-x-auto rounded-lg border border-brand-border bg-brand-surface-subtle p-3 text-left dark:bg-brand-surface-muted/55">
                  <p className="font-mono text-xs text-brand-red-600 dark:text-brand-red-100 break-all font-bold">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorStack && (
                    <pre className="border-t border-brand-border pt-1 font-mono text-[9px] text-zinc-500 whitespace-pre-wrap dark:text-zinc-400">
                      {this.state.errorStack}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className={primarySmallActionButtonClass}
              >
                <ArrowCounterClockwise aria-hidden="true" weight="bold" className="w-4 h-4" />
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className={secondarySmallActionButtonClass}
              >
                <House aria-hidden="true" weight="bold" className="w-4 h-4" />
                Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
