import { useState } from 'react';
import { Layout } from '../../components/Layout';
import { Calculator, Tree, Warning, CheckCircle, Info } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';

type Bioma = 'amazonia_floresta' | 'amazonia_cerrado' | 'amazonia_campos' | 'outros';

export function CalculadoraAmbiental() {
  const [areaTotal, setAreaTotal] = useState<number | ''>('');
  const [areaApp, setAreaApp] = useState<number | ''>('');
  const [areaVegetacaoNativa, setAreaVegetacaoNativa] = useState<number | ''>('');
  const [bioma, setBioma] = useState<Bioma>('outros');

  // Cálculo da % de Reserva Legal exigida
  const getPercentualExigido = (b: Bioma) => {
    switch (b) {
      case 'amazonia_floresta': return 80;
      case 'amazonia_cerrado': return 35;
      case 'amazonia_campos': return 20;
      case 'outros': return 20;
      default: return 20;
    }
  };

  const calcular = () => {
    if (areaTotal === '' || areaTotal <= 0) return null;

    const valTotal = Number(areaTotal);
    const valNat = Number(areaVegetacaoNativa || 0);
    const percentualExigido = getPercentualExigido(bioma);
    
    const reservaLegalExigida = valTotal * (percentualExigido / 100);
    
    // O código florestal permite computar APP na RL sob certas condições, 
    // mas para simplificar a calculadora inicial, vamos somar o que ele tem de vegetação
    // assumindo que a vegetação nativa informada seja o total preservado.
    const vegetacaoExistente = valNat; 
    
    const deficit = Math.max(0, reservaLegalExigida - vegetacaoExistente);
    const superavit = Math.max(0, vegetacaoExistente - reservaLegalExigida);
    const regular = vegetacaoExistente >= reservaLegalExigida;

    return {
      percentualExigido,
      reservaLegalExigida,
      vegetacaoExistente,
      deficit,
      superavit,
      regular
    };
  };

  const resultado = calcular();

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
            <Calculator weight="duotone" className="w-6 h-6" />
          </div>
          Calculadora de Requisitos Legais (CAR)
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Simule o passivo ou ativo ambiental da propriedade com base no Código Florestal (Lei nº 12.651/12).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário */}
        <div className="lg:col-span-1 space-y-6">
          <section className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-5 text-lg font-semibold text-zinc-950 dark:text-white">
              Parâmetros da Propriedade
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Bioma / Localização
                </label>
                <select 
                  value={bioma}
                  onChange={(e) => setBioma(e.target.value as Bioma)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="outros">Demais Regiões (Mata Atlântica, Pampas, etc) - 20%</option>
                  <option value="amazonia_floresta">Amazônia Legal (Área de Floresta) - 80%</option>
                  <option value="amazonia_cerrado">Amazônia Legal (Área de Cerrado) - 35%</option>
                  <option value="amazonia_campos">Amazônia Legal (Campos Gerais) - 20%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Área Total (ha)
                </label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={areaTotal}
                  onChange={(e) => setAreaTotal(Number(e.target.value) || '')}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder="Ex: 100.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Área de APP Existente (ha)
                </label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={areaApp}
                  onChange={(e) => setAreaApp(Number(e.target.value) || '')}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Vegetação Nativa Total Preservada (ha)
                </label>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={areaVegetacaoNativa}
                  onChange={(e) => setAreaVegetacaoNativa(Number(e.target.value) || '')}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  placeholder="Incluindo Reserva e APP preservada"
                />
              </div>
            </div>
            
            <div className="mt-6 rounded-xl bg-blue-50 p-4 dark:bg-blue-500/10">
              <div className="flex gap-3">
                <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Esta é uma calculadora simplificada. O cálculo oficial do CAR pode variar de acordo com o ano de desmatamento, existência de rios e peculiaridades estaduais.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 h-full flex flex-col">
            <h3 className="mb-5 text-lg font-semibold text-zinc-950 dark:text-white">
              Diagnóstico do Imóvel
            </h3>

            {!resultado ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <Tree className="w-16 h-16 text-zinc-200 dark:text-zinc-700 mb-4" />
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">Informe a Área Total para ver o diagnóstico</p>
              </div>
            ) : (
              <div className="space-y-6 flex-1">
                {/* Status Geral */}
                <div className={cn(
                  "p-5 rounded-2xl border flex items-start gap-4",
                  resultado.regular 
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-500/5" 
                    : "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-500/5"
                )}>
                  {resultado.regular ? (
                    <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" weight="fill" />
                  ) : (
                    <Warning className="w-8 h-8 text-red-600 dark:text-red-400 shrink-0" weight="fill" />
                  )}
                  <div>
                    <h4 className={cn(
                      "text-lg font-bold mb-1",
                      resultado.regular ? "text-emerald-900 dark:text-emerald-300" : "text-red-900 dark:text-red-300"
                    )}>
                      {resultado.regular ? 'Propriedade Regular (Reserva Legal)' : 'Passivo Ambiental Detectado'}
                    </h4>
                    <p className={cn(
                      "text-sm leading-relaxed",
                      resultado.regular ? "text-emerald-800 dark:text-emerald-400/80" : "text-red-800 dark:text-red-400/80"
                    )}>
                      {resultado.regular 
                        ? 'A propriedade possui vegetação nativa suficiente para cobrir os requisitos de Reserva Legal exigidos por lei para a região.'
                        : 'A propriedade apresenta um déficit de Reserva Legal e pode necessitar de um PRAD (Plano de Recuperação de Área Degradada) ou compensação ambiental.'}
                    </p>
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Exigência Legal</p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-white">{resultado.percentualExigido}%</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Reserva Necessária</p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-white">{resultado.reservaLegalExigida.toFixed(2)} ha</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Déficit (Passivo)</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">{resultado.deficit.toFixed(2)} ha</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">Superávit (Ativo)</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{resultado.superavit.toFixed(2)} ha</p>
                  </div>
                </div>

              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
