import { FormSelect } from '../../components/Form';
import { useMemo, useState } from 'react';
import {
  Calculator,
  Check,
  CheckCircle,
  ClockCounterClockwise,
  Info,
  ShieldCheck,
  Tree,
  Warning,
  WarningCircle
} from '@phosphor-icons/react';
import { Layout } from '../../components/Layout';
import { cn } from '../../utils/cn';

type ReservaLegalRegion = 'amazonia_floresta' | 'amazonia_cerrado' | 'amazonia_campos' | 'demais_regioes';

interface CalculadoraAmbientalProps {
  embedded?: boolean;
  showHeader?: boolean;
}

const hectareFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const regionOptions: Array<{ value: ReservaLegalRegion; label: string; percentage: number }> = [
  { value: 'demais_regioes', label: 'Demais regiões do Brasil', percentage: 20 },
  { value: 'amazonia_floresta', label: 'Amazônia Legal — área de floresta', percentage: 80 },
  { value: 'amazonia_cerrado', label: 'Amazônia Legal — área de cerrado', percentage: 35 },
  { value: 'amazonia_campos', label: 'Amazônia Legal — área de campos gerais', percentage: 20 }
];

const parseArea = (value: string) => value.trim() === '' ? null : Number(value);
const formatArea = (value: number) => `${hectareFormatter.format(value)} ha`;

export function CalculadoraAmbiental({ embedded = false, showHeader = true }: CalculadoraAmbientalProps) {
  const [region, setRegion] = useState<ReservaLegalRegion>('demais_regioes');
  const [totalArea, setTotalArea] = useState('');
  const [appArea, setAppArea] = useState('');
  const [nativeOutsideApp, setNativeOutsideApp] = useState('');
  const [fiscalModules, setFiscalModules] = useState('');
  const [nativeOn2008, setNativeOn2008] = useState('');
  const [propertyExistedOn2008, setPropertyExistedOn2008] = useState(false);
  const [carRequested, setCarRequested] = useState(false);
  const [appProtected, setAppProtected] = useState(false);
  const [noNewConversion, setNoNewConversion] = useState(false);
  const [historicalCompliance, setHistoricalCompliance] = useState(false);

  const analysis = useMemo(() => {
    const total = parseArea(totalArea);
    const app = parseArea(appArea) ?? 0;
    const nativeOutside = parseArea(nativeOutsideApp) ?? 0;
    const modules = parseArea(fiscalModules);
    const remnant2008 = parseArea(nativeOn2008);
    const errors: Record<string, string> = {};

    if (total === null) return { ready: false as const, errors };
    if (!Number.isFinite(total) || total <= 0) errors.totalArea = 'Informe uma área total maior que zero.';
    if (!Number.isFinite(app) || app < 0) errors.appArea = 'Informe uma área de APP válida.';
    if (!Number.isFinite(nativeOutside) || nativeOutside < 0) errors.nativeOutsideApp = 'Informe uma área de vegetação válida.';
    if (modules !== null && (!Number.isFinite(modules) || modules <= 0)) errors.fiscalModules = 'Informe uma quantidade de módulos fiscais maior que zero.';
    if (remnant2008 !== null && (!Number.isFinite(remnant2008) || remnant2008 < 0)) errors.nativeOn2008 = 'Informe uma área remanescente válida.';

    if (total !== null && total > 0) {
      if (app > total) errors.appArea = 'A APP não pode superar a área total do imóvel.';
      if (nativeOutside > total) errors.nativeOutsideApp = 'A vegetação fora de APP não pode superar a área total.';
      if (app + nativeOutside > total) errors.nativeOutsideApp = 'A soma da APP e da vegetação fora de APP supera a área total.';
      if (remnant2008 !== null && remnant2008 > total) errors.nativeOn2008 = 'O remanescente de 2008 não pode superar a área total.';
    }

    const article15Eligible = app > 0 && carRequested && appProtected && noNewConversion;
    const article67Candidate = modules !== null && modules <= 4 && propertyExistedOn2008;
    if (article67Candidate && (remnant2008 === null || remnant2008 <= 0)) {
      errors.nativeOn2008 = 'Informe o remanescente de vegetação nativa existente em 22/07/2008.';
    }

    if (Object.keys(errors).length > 0 || total === null) return { ready: true as const, valid: false as const, errors };

    const percentage = regionOptions.find((option) => option.value === region)?.percentage ?? 20;
    const generalRequirement = total * (percentage / 100);
    const article67Applied = article67Candidate && remnant2008 !== null && remnant2008 < generalRequirement;
    const requiredArea = article67Applied && remnant2008 !== null ? remnant2008 : generalRequirement;
    const eligibleAppArea = article15Eligible ? app : 0;
    const countableVegetation = nativeOutside + eligibleAppArea;
    const deficit = Math.max(0, requiredArea - countableVegetation);
    const potentialExcess = Math.max(0, countableVegetation - requiredArea);

    return {
      ready: true as const,
      valid: true as const,
      errors,
      percentage,
      requiredArea,
      generalRequirement,
      countableVegetation,
      eligibleAppArea,
      deficit,
      potentialExcess,
      article15Eligible,
      article67Candidate,
      article67Applied,
      historicalCompliance
    };
  }, [
    appArea,
    appProtected,
    carRequested,
    fiscalModules,
    historicalCompliance,
    nativeOn2008,
    nativeOutsideApp,
    noNewConversion,
    propertyExistedOn2008,
    region,
    totalArea
  ]);

  const fieldClass = 'geo-focus-ring min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';
  const errorClass = 'mt-1.5 text-xs font-medium text-red-700 dark:text-red-300';

  const content = (
    <div>
      {showHeader && (
        <header className="mb-6">
          <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            <span aria-hidden="true" className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Calculator weight="duotone" className="h-6 w-6" />
            </span>
            <span className="min-w-0 text-pretty">Análise preliminar de Reserva Legal</span>
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
            Faça uma triagem quantitativa com base nos arts. 12, 15, 67 e 68 da Lei nº 12.651/2012. O resultado não substitui a análise do CAR pelo órgão competente.
          </p>
        </header>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] 2xl:grid-cols-[minmax(36rem,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="car-parameters-title" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 id="car-parameters-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Dados declarados do imóvel</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">Separe a vegetação fora de APP para evitar dupla contagem.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="car-region" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Localização e formação vegetal</label>
              <FormSelect id="car-region" name="regiaoReservaLegal" autoComplete="off" value={region} onChange={(event) => setRegion(event.target.value as ReservaLegalRegion)} className={cn(fieldClass, 'geo-native-select')}>
                {regionOptions.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.percentage}%</option>)}
              </FormSelect>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="car-total-area" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Área total do imóvel (ha)</label>
                <input id="car-total-area" name="areaTotal" type="number" inputMode="decimal" min="0.01" step="0.01" autoComplete="off" value={totalArea} onChange={(event) => setTotalArea(event.target.value)} aria-invalid={Boolean(analysis.errors.totalArea)} aria-describedby={analysis.errors.totalArea ? 'car-total-area-error' : undefined} placeholder="Ex.: 100,50" className={fieldClass} />
                {analysis.errors.totalArea && <p id="car-total-area-error" className={errorClass}>{analysis.errors.totalArea}</p>}
              </div>
              <div>
                <label htmlFor="car-fiscal-modules" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Área em módulos fiscais</label>
                <input id="car-fiscal-modules" name="modulosFiscais" type="number" inputMode="decimal" min="0.01" step="0.01" autoComplete="off" value={fiscalModules} onChange={(event) => setFiscalModules(event.target.value)} aria-invalid={Boolean(analysis.errors.fiscalModules)} aria-describedby="car-fiscal-modules-help" placeholder="Opcional" className={fieldClass} />
                <p id="car-fiscal-modules-help" className="mt-1.5 text-xs text-zinc-500">Necessário para avaliar o possível enquadramento no art. 67.</p>
                {analysis.errors.fiscalModules && <p className={errorClass}>{analysis.errors.fiscalModules}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="car-app-area" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">APP conservada ou em recuperação (ha)</label>
                <input id="car-app-area" name="areaApp" type="number" inputMode="decimal" min="0" step="0.01" autoComplete="off" value={appArea} onChange={(event) => setAppArea(event.target.value)} aria-invalid={Boolean(analysis.errors.appArea)} placeholder="Ex.: 8,25" className={fieldClass} />
                {analysis.errors.appArea && <p className={errorClass}>{analysis.errors.appArea}</p>}
              </div>
              <div>
                <label htmlFor="car-native-outside-app" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Vegetação nativa fora de APP (ha)</label>
                <input id="car-native-outside-app" name="vegetacaoForaApp" type="number" inputMode="decimal" min="0" step="0.01" autoComplete="off" value={nativeOutsideApp} onChange={(event) => setNativeOutsideApp(event.target.value)} aria-invalid={Boolean(analysis.errors.nativeOutsideApp)} placeholder="Ex.: 18,00" className={fieldClass} />
                {analysis.errors.nativeOutsideApp && <p className={errorClass}>{analysis.errors.nativeOutsideApp}</p>}
              </div>
            </div>
          </div>

          <div className="mt-5 grid items-start gap-3 2xl:grid-cols-2">
          <fieldset className="rounded-2xl border border-emerald-200/80 bg-emerald-50/55 px-4 pb-2 dark:border-emerald-800/50 dark:bg-emerald-950/20">
            <legend className="max-w-full px-1">
              <span className="inline-flex max-w-full items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/20">
                  <ShieldCheck weight="duotone" className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">Condições para computar APP</span>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">Art. 15</span>
              </span>
            </legend>
            <div className="mt-2 divide-y divide-emerald-200/70 dark:divide-emerald-800/40">
              <CheckOption tone="success" checked={noNewConversion} onChange={setNoNewConversion} label="O benefício não implicará conversão de novas áreas." />
              <CheckOption tone="success" checked={appProtected} onChange={setAppProtected} label="A APP está conservada ou em processo de recuperação." />
              <CheckOption tone="success" checked={carRequested} onChange={setCarRequested} label="A inclusão do imóvel no CAR foi requerida." />
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-amber-200/90 bg-amber-50/60 px-4 pb-2 dark:border-amber-800/50 dark:bg-amber-950/20">
            <legend className="max-w-full px-1">
              <span className="inline-flex max-w-full items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/20">
                  <ClockCounterClockwise weight="duotone" className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">Situação histórica</span>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">Arts. 67–68</span>
              </span>
            </legend>
            <div className="mt-2 divide-y divide-amber-200/70 dark:divide-amber-800/40">
              <CheckOption tone="warning" checked={propertyExistedOn2008} onChange={setPropertyExistedOn2008} label="O imóvel já detinha essa extensão em 22/07/2008." />
              <CheckOption tone="warning" checked={historicalCompliance} onChange={setHistoricalCompliance} label="Há indícios de supressão regular conforme a legislação da época — art. 68." />
            </div>
            {parseArea(fiscalModules) !== null && Number(fiscalModules) <= 4 && propertyExistedOn2008 && (
              <div className="mt-2 border-t border-amber-200/70 py-4 dark:border-amber-800/40">
                <label htmlFor="car-native-2008" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Remanescente de vegetação nativa em 22/07/2008 (ha)</label>
                <input id="car-native-2008" name="remanescente2008" type="number" inputMode="decimal" min="0" step="0.01" autoComplete="off" value={nativeOn2008} onChange={(event) => setNativeOn2008(event.target.value)} aria-invalid={Boolean(analysis.errors.nativeOn2008)} className={fieldClass} />
                {analysis.errors.nativeOn2008 && <p className={errorClass}>{analysis.errors.nativeOn2008}</p>}
              </div>
            )}
          </fieldset>
          </div>
        </section>

        <section aria-labelledby="car-result-title" aria-live="polite" className="flex min-h-[22rem] flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:min-h-[32rem] sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 id="car-result-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Resultado da triagem</h2>

          {!analysis.ready ? (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <Tree aria-hidden="true" className="mb-4 h-16 w-16 text-zinc-200 dark:text-zinc-700" />
              <p className="font-medium text-zinc-600 dark:text-zinc-300">Informe a área total para iniciar a análise.</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">Os demais campos refinam o cenário e evitam conclusões incompatíveis com o histórico do imóvel.</p>
            </div>
          ) : !analysis.valid ? (
            <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <WarningCircle aria-hidden="true" className="h-7 w-7" />
              <h3 className="mt-3 font-semibold">Revise os dados informados</h3>
              <p className="mt-1 text-sm">Existem áreas incompatíveis ou informações obrigatórias para o cenário selecionado.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className={cn(
                'rounded-2xl border p-5',
                analysis.historicalCompliance
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : analysis.deficit > 0
                    ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
              )}>
                <div className="flex items-start gap-3">
                  {analysis.historicalCompliance ? <Warning aria-hidden="true" className="h-7 w-7 shrink-0 text-amber-700 dark:text-amber-300" /> : analysis.deficit > 0 ? <WarningCircle aria-hidden="true" className="h-7 w-7 shrink-0 text-red-700 dark:text-red-300" /> : <CheckCircle aria-hidden="true" weight="fill" className="h-7 w-7 shrink-0 text-emerald-700 dark:text-emerald-300" />}
                  <div>
                    <h3 className="font-bold text-zinc-950 dark:text-white">
                      {analysis.historicalCompliance ? 'Análise documental necessária' : analysis.deficit > 0 ? 'Déficit quantitativo preliminar' : 'Atendimento quantitativo preliminar'}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {analysis.historicalCompliance
                        ? 'O art. 68 pode alterar a obrigação de recomposição. Verifique documentos, percentuais e a legislação vigente na data da supressão antes de concluir o diagnóstico.'
                        : analysis.deficit > 0
                          ? `O cenário declarado indica déficit estimado de ${formatArea(analysis.deficit)} de Reserva Legal.`
                          : 'As áreas declaradas alcançam a referência quantitativa deste cenário, sujeita à validação espacial, documental e pelo órgão ambiental.'}
                    </p>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Referência aplicável" value={analysis.article67Applied ? 'Art. 67' : `${analysis.percentage}%`} />
                <Metric label="RL de referência" value={formatArea(analysis.requiredArea)} />
                <Metric label="Vegetação computada" value={formatArea(analysis.countableVegetation)} />
                <Metric label={analysis.deficit > 0 ? 'Déficit estimado' : 'Excedente potencial'} value={formatArea(analysis.deficit > 0 ? analysis.deficit : analysis.potentialExcess)} tone={analysis.deficit > 0 ? 'danger' : 'success'} />
              </dl>

              <div className="rounded-xl bg-blue-50 p-4 text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">
                <div className="flex items-start gap-3">
                  <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-semibold">Memória do cálculo</p>
                    <p className="mt-1">Vegetação fora de APP: {formatArea(parseArea(nativeOutsideApp) ?? 0)}. APP computada: {formatArea(analysis.eligibleAppArea)}.</p>
                    {parseArea(appArea) !== null && (parseArea(appArea) ?? 0) > 0 && !analysis.article15Eligible && <p className="mt-1 font-medium">A APP informada não foi computada porque as três condições declarativas do art. 15 não foram confirmadas.</p>}
                    {analysis.article67Applied && <p className="mt-1 font-medium">Foi utilizado o remanescente declarado de 22/07/2008 como referência do art. 67.</p>}
                    {analysis.article67Candidate && !analysis.article67Applied && <p className="mt-1 font-medium">O remanescente declarado de 2008 não é inferior ao percentual geral; por isso, o art. 67 não alterou a referência quantitativa.</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                Esta ferramenta não avalia geometria, sobreposições, áreas de uso restrito, passivos de APP, regularidade da supressão, ZEE, legislação estadual, PRA ou aprovação da localização da Reserva Legal.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );

  return embedded ? content : <Layout>{content}</Layout>;
}

function CheckOption({
  checked,
  onChange,
  label,
  tone = 'success',
  disabled = false
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  tone?: 'success' | 'warning';
  disabled?: boolean;
}) {
  return (
    <label className="group flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-1 py-3 text-sm text-zinc-700 transition-[background-color,color,transform] duration-150 hover:bg-white/65 active:scale-[0.995] has-[:focus-visible]:bg-white/80 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 dark:text-zinc-300 dark:hover:bg-white/5 dark:has-[:focus-visible]:bg-white/[0.07]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 inline-flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md border bg-white text-white shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-150 group-hover:scale-105 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-disabled:shadow-none dark:bg-zinc-900 dark:peer-focus-visible:ring-offset-zinc-950 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100',
          tone === 'success'
            ? 'border-emerald-300 peer-checked:border-emerald-700 peer-checked:bg-emerald-600 peer-focus-visible:ring-emerald-500 dark:border-emerald-700 dark:peer-checked:border-emerald-300 dark:peer-checked:bg-emerald-500'
            : 'border-amber-300 peer-checked:border-amber-700 peer-checked:bg-amber-600 peer-focus-visible:ring-amber-500 dark:border-amber-700 dark:peer-checked:border-amber-200 dark:peer-checked:bg-amber-500'
        )}
      >
        <Check weight="bold" className="h-3.5 w-3.5 transition-opacity duration-150" />
      </span>
      <span className="min-w-0 leading-5">{label}</span>
    </label>
  );
}

function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' | 'success' }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={cn('mt-1 text-lg font-bold tabular-nums text-zinc-950 dark:text-white', tone === 'danger' && 'text-red-700 dark:text-red-300', tone === 'success' && 'text-emerald-700 dark:text-emerald-300')}>{value}</dd>
    </div>
  );
}
