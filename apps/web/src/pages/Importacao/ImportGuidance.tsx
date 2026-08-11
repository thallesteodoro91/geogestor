import { Info, WarningCircle } from '@phosphor-icons/react';

export function ImportGuidance() {
  return (
    <section aria-labelledby="spreadsheet-guidance-title" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
      <div className="flex items-start gap-3">
        <Info size={22} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-sky-700 dark:text-sky-300" />
        <div className="min-w-0">
          <h2 id="spreadsheet-guidance-title" className="font-bold">Antes de importar sua planilha</h2>
          <p className="mt-1 text-sm leading-6">
            O GeoGestor tenta reconhecer o cabeçalho e o significado das colunas, mas a identificação automática não é 100% garantida. A conferência do mapeamento, das pendências e dos totais é obrigatória antes da gravação.
          </p>
          <ul className="mt-3 grid gap-1.5 text-sm leading-5 md:grid-cols-2">
            <li>• Use títulos únicos e descritivos na primeira linha da tabela.</li>
            <li>• Evite títulos, observações, linhas vazias e células mescladas acima ou dentro da tabela.</li>
            <li>• Mantenha Cliente, CPF, CNPJ, Telefone, Projeto, Valor e Data em colunas próprias.</li>
            <li>• Use CPF/CNPJ corretos e nunca associe o mesmo documento a pessoas diferentes.</li>
            <li>• Use datas e valores em formatos reconhecíveis pelo Excel.</li>
            <li>• Revise também os cadastros que ficarem marcados para conferência posterior.</li>
          </ul>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
            <WarningCircle size={18} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>Nenhum processo automatizado substitui a conferência humana. Colunas podem ser interpretadas incorretamente, ignoradas ou exigir associação manual.</p>
          </div>
          <details className="mt-3 rounded-lg border border-sky-200 bg-white/70 px-3 py-2 dark:border-sky-900/70 dark:bg-zinc-950/30">
            <summary className="cursor-pointer text-sm font-bold focus-visible:ring-2 focus-visible:ring-sky-500/40">Ver exemplo de planilha bem estruturada</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead><tr className="border-b border-sky-200 dark:border-sky-900"><th className="px-2 py-2">Cliente</th><th className="px-2 py-2">CPF</th><th className="px-2 py-2">CNPJ</th><th className="px-2 py-2">Telefone</th><th className="px-2 py-2">Projeto</th><th className="px-2 py-2">Valor</th><th className="px-2 py-2">Data</th></tr></thead>
                <tbody className="divide-y divide-sky-100 dark:divide-sky-900/60">
                  <tr><td className="px-2 py-2">Cliente Exemplo A</td><td className="px-2 py-2">CPF fictício válido</td><td className="px-2 py-2">—</td><td className="px-2 py-2">(48) 99999-0001</td><td className="px-2 py-2">Levantamento RTK</td><td className="px-2 py-2">4.500,00</td><td className="px-2 py-2">10/08/2026</td></tr>
                  <tr><td className="px-2 py-2">Empresa Exemplo B</td><td className="px-2 py-2">—</td><td className="px-2 py-2">CNPJ fictício válido</td><td className="px-2 py-2">(48) 3333-0002</td><td className="px-2 py-2">Georreferenciamento</td><td className="px-2 py-2">12.000,00</td><td className="px-2 py-2">11/08/2026</td></tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
