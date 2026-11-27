import { useCallback, useEffect, useId, useState, type RefObject } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';

/** Opt-in protection for editors; read-only dialogs keep their existing behavior. */
export function useFormDraftGuard({ open, dirty, saving, lock, onDiscard }: {
  open: boolean; dirty: boolean; saving: boolean; lock: RefObject<boolean>; onDiscard: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const nativeId = useId();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => open && (dirty || saving || lock.current) &&
    `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}` !== `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`);
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => {
    if (!open || (!dirty && !saving && !lock.current)) return;
    event.preventDefault(); event.returnValue = '';
  }, [open, dirty, saving, lock]));
  useEffect(() => {
    window.electronAPI?.setLicenseDraftState?.(nativeId, { dirty: open && dirty, saving: open && saving });
    return () => window.electronAPI?.setLicenseDraftState?.(nativeId, { dirty: false, saving: false });
  }, [nativeId, open, dirty, saving]);
  useEffect(() => { if (!open && blocker.state === 'blocked') blocker.reset(); }, [open, blocker]);
  const cancelDiscard = () => { setConfirming(false); if (blocker.state === 'blocked') blocker.reset(); };
  const requestClose = () => {
    if (saving || lock.current) return;
    if (dirty) setConfirming(true); else onDiscard();
  };
  const confirmation = <ConfirmDialog isOpen={open && (confirming || blocker.state === 'blocked')}
    title="Descartar alterações não salvas?" description={saving ? 'Aguarde a conclusão do envio antes de sair.' : 'As informações preenchidas ainda não foram salvas. Você pode continuar editando ou descartar as alterações.'}
    cancelText="Continuar editando" confirmText="Descartar alterações" variant="warning" loading={saving}
    onClose={cancelDiscard} onConfirm={() => {
      if (saving || lock.current) return;
      setConfirming(false); onDiscard(); if (blocker.state === 'blocked') blocker.proceed();
    }} />;
  return { requestClose, confirmation };
}
