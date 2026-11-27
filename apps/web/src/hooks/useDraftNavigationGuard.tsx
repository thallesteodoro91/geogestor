import { useCallback, useEffect, useId } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';

/** Uses the existing desktop draft protocol; the native window owns close confirmation. */
export function useDraftNavigationGuard(dirty: boolean, saving: boolean) {
  const guardId = useId();
  useEffect(() => {
    window.electronAPI?.setLicenseDraftState?.(guardId, { dirty, saving });
    return () => window.electronAPI?.setLicenseDraftState?.(guardId, { dirty: false, saving: false });
  }, [dirty, saving, guardId]);
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => {
    if (!dirty && !saving) return;
    event.preventDefault(); event.returnValue = '';
  }, [dirty, saving]));
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || saving) && (
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search
  ));
  return <ConfirmDialog isOpen={blocker.state === 'blocked'}
    onClose={() => { if (blocker.state === 'blocked') blocker.reset(); }}
    onConfirm={() => { if (!saving && blocker.state === 'blocked') blocker.proceed(); }}
    variant="warning" title="Descartar alterações não salvas?"
    description="O rascunho desta demanda ainda não foi salvo. Continue editando para preservar o preenchimento ou descarte as alterações para sair."
    cancelText="Continuar editando" confirmText="Descartar e sair" loading={saving} loadingText="Aguarde o processamento…" />;
}
