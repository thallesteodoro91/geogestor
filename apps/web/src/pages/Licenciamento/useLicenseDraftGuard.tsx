import { useCallback, useEffect, useId, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';

/** Shared by the two license editors; never alters the global modal behavior. */
export function useLicenseDraftGuard(form: object, loading: boolean, onClose: () => void) {
  const [initial] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== initial;
  const [confirmClose, setConfirmClose] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const continueId = useId();
  const descriptionId = useId();
  const nativeGuardId = useId();
  useEffect(() => {
    window.electronAPI?.setLicenseDraftState?.(nativeGuardId, { dirty, saving: loading });
    return () => window.electronAPI?.setLicenseDraftState?.(nativeGuardId, { dirty: false, saving: false });
  }, [dirty, loading, nativeGuardId]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || loading) && (
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search || currentLocation.hash !== nextLocation.hash
  ));
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => {
    if (!dirty && !loading) return;
    event.preventDefault();
    event.returnValue = '';
  }, [dirty, loading]));

  const requestClose = () => {
    if (loading) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  };
  const confirmation = (
    <Modal
      isOpen={!discarding && (confirmClose || blocker.state === 'blocked')}
      onClose={() => { setConfirmClose(false); if (blocker.state === 'blocked') blocker.reset(); }}
      title="Descartar alterações não salvas?"
      panelClassName="licensing-dialog"
      dialogRole="alertdialog"
      ariaDescribedBy={descriptionId}
      initialFocusId={continueId}
      closeDisabled={loading}
    >
      <p id={descriptionId} className="license-secondary text-sm leading-relaxed">{loading ? 'Aguarde o salvamento antes de sair.' : 'As informações preenchidas ainda não foram salvas. Você pode continuar editando ou descartar as alterações.'}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button id={continueId} type="button" disabled={loading} onClick={() => { setConfirmClose(false); if (blocker.state === 'blocked') blocker.reset(); }} className={cn(secondarySmallActionButtonClass, 'min-h-11')}>Continuar editando</button>
        <button type="button" disabled={loading} onClick={() => {
          if (loading) return;
          setDiscarding(true); setConfirmClose(false);
          // Close the top dialog first so the editor can restore its own focus.
          window.requestAnimationFrame(() => { onClose(); if (blocker.state === 'blocked') blocker.proceed(); });
        }} className={primarySubmitButtonClass}>{loading ? 'Salvando…' : 'Descartar alterações'}</button>
      </div>
    </Modal>
  );
  return { requestClose, confirmation };
}
