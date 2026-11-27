import { Copy } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { LicenseCondition } from '@geogestor/contracts';
import { formatLicenseDate } from './licensePresentation';
import { secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';

export function ConditionReadDetails({ condition }: { condition: LicenseCondition }) {
  const copyReference = async () => {
    if (!condition.comprovante) return;
    try { await navigator.clipboard.writeText(condition.comprovante); toast.success('Referência do comprovante copiada.'); }
    catch { toast.error('Não foi possível copiar. Selecione a referência abaixo e copie manualmente.'); }
  };
  return (
    <details className="mt-4 border-t border-brand-border pt-3">
      <summary className="geo-focus-ring min-h-11 cursor-pointer rounded-lg py-3 text-sm font-semibold text-brand-primary-700 dark:text-brand-primary-100">Ver detalhes da condicionante</summary>
      <div className="mt-2 space-y-4 text-sm">
        <div><h4 className="font-semibold">Descrição completa</h4><p className="license-secondary mt-1 whitespace-pre-wrap break-words leading-relaxed">{condition.descricao || 'Não informada.'}</p></div>
        <div><h4 className="font-semibold">Observações</h4><p className="license-secondary mt-1 whitespace-pre-wrap break-words leading-relaxed">{condition.observacoes || 'Não informadas.'}</p></div>
        <dl><dt>Data de cumprimento</dt><dd className="mt-1 font-semibold tabular-nums">{formatLicenseDate(condition.dataCumprimento)}</dd></dl>
        {condition.comprovante && <div><h4 className="font-semibold">Comprovante ou referência documental</h4><p className="license-secondary mt-1 break-all">{condition.comprovante}</p><button type="button" onClick={copyReference} className={cn(secondarySmallActionButtonClass, 'mt-3 min-h-11')}><Copy aria-hidden="true" className="h-4 w-4" />Copiar referência</button></div>}
      </div>
    </details>
  );
}
