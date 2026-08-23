import { useEffect } from 'react';
import { ArrowLeft, Compass, MagnifyingGlass } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { APP_ROUTES } from '@geogestor/contracts';

export function NotFound() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Página não encontrada — GeoGestor';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <section className="mx-auto flex min-h-[65vh] max-w-3xl items-center px-2 py-10" aria-labelledby="not-found-title">
      <div className="geo-surface-raised w-full rounded-2xl p-6 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/30">
          <Compass size={30} aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">Erro 404</p>
        <h1 id="not-found-title" className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">
          Página não encontrada
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          O endereço informado não existe ou deixou de estar disponível. Use um dos caminhos abaixo para continuar.
        </p>

        <nav aria-label="Opções para continuar" className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            to={APP_ROUTES.dashboard.path}
            className="geo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,box-shadow] hover:bg-indigo-700"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Voltar à Visão Geral
          </Link>
          <Link
            to={APP_ROUTES.help.path}
            className="geo-button-secondary geo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-[background-color,border-color,color,box-shadow]"
          >
            <MagnifyingGlass size={18} aria-hidden="true" />
            Pesquisar na Ajuda
          </Link>
        </nav>

        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          <Link className="geo-focus-ring rounded-md font-semibold text-indigo-700 hover:underline dark:text-indigo-300" to={APP_ROUTES.clients.path}>Clientes</Link>
          <Link className="geo-focus-ring rounded-md font-semibold text-indigo-700 hover:underline dark:text-indigo-300" to={APP_ROUTES.projects.path}>Projetos</Link>
          <Link className="geo-focus-ring rounded-md font-semibold text-indigo-700 hover:underline dark:text-indigo-300" to={APP_ROUTES.finance.path}>Financeiro</Link>
        </div>
      </div>
    </section>
  );
}
