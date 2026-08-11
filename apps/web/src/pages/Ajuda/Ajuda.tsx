import { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarBlank,
  ChartBar,
  CheckCircle,
  Coins,
  Database,
  FileText,
  FolderOpen,
  Gear,
  ListChecks,
  MagnifyingGlass,
  MapTrifold,
  Question,
  ShieldCheck,
  Sliders,
  UploadSimple,
  Users,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { PageFilterBar } from '../../components/PageFilterBar';
import { PageHeader } from '../../components/PageHeader';
import { APP_VERSION } from '../../version';
import { cn } from '../../utils/cn';
import { filterClearButtonClass, filterSearchInputClass } from '../../utils/filterStyles';
import {
  DEFAULT_RECOMMENDED_ARTICLE_IDS,
  HELP_ARTICLES,
  HELP_CATEGORIES,
  buildHelpArticleSearch,
  filterHelpArticles,
  getHelpArticle,
  isHelpCategory,
  type HelpArticle,
  type HelpCategoryFilter,
  type HelpIconKey,
} from './helpContent';

const iconByKey: Record<HelpIconKey, Icon> = {
  start: Sliders,
  users: Users,
  crm: ChartBar,
  projects: FolderOpen,
  finance: Coins,
  calendar: CalendarBlank,
  environment: MapTrifold,
  topography: MapTrifold,
  reports: FileText,
  planning: ListChecks,
  records: BookOpen,
  import: UploadSimple,
  quality: WarningCircle,
  audit: ShieldCheck,
  documents: FileText,
  backup: Database,
  alerts: Bell,
};

function formatReviewDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(year, month - 1, day));
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const term = query.trim();
  if (!term) return <>{text}</>;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return <>{parts.map((part, index) => part.toLocaleLowerCase('pt-BR') === term.toLocaleLowerCase('pt-BR')
    ? <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-0.5 text-inherit dark:bg-amber-400/25">{part}</mark>
    : part)}</>;
}

function ArticleIcon({ article, className }: { article: HelpArticle; className?: string }) {
  const Icon = iconByKey[article.icon];
  return <Icon aria-hidden="true" className={className} />;
}

export function Ajuda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategory = searchParams.get('categoria');
  const activeCategory: HelpCategoryFilter = isHelpCategory(requestedCategory) ? requestedCategory : 'all';
  const searchQuery = searchParams.get('q') ?? '';
  const selectedArticle = getHelpArticle(searchParams.get('artigo'));
  const articleTitleRef = useRef<HTMLHeadingElement | null>(null);
  const pendingArticleFocusRef = useRef<string | null>(null);
  const restoreArticleFocusRef = useRef<string | null>(null);

  const filteredArticles = useMemo(
    () => filterHelpArticles(HELP_ARTICLES, activeCategory, searchQuery),
    [activeCategory, searchQuery],
  );

  const recommendedArticles = useMemo(
    () => DEFAULT_RECOMMENDED_ARTICLE_IDS.map((id) => getHelpArticle(id)).filter((article): article is HelpArticle => Boolean(article)),
    [],
  );

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (requestedCategory && !isHelpCategory(requestedCategory)) {
      next.delete('categoria');
      changed = true;
    }
    const requestedArticle = searchParams.get('artigo');
    if (requestedArticle && !getHelpArticle(requestedArticle)) {
      next.delete('artigo');
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [requestedCategory, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedArticle || filteredArticles.some((article) => article.id === selectedArticle.id)) return;
    const next = new URLSearchParams(searchParams);
    next.delete('artigo');
    setSearchParams(next, { replace: true });
  }, [filteredArticles, searchParams, selectedArticle, setSearchParams]);

  useEffect(() => {
    if (!selectedArticle || pendingArticleFocusRef.current !== selectedArticle.id) return;
    pendingArticleFocusRef.current = null;
    window.requestAnimationFrame(() => articleTitleRef.current?.focus({ preventScroll: true }));
  }, [selectedArticle]);

  useEffect(() => {
    if (selectedArticle || !restoreArticleFocusRef.current) return;
    const articleId = restoreArticleFocusRef.current;
    restoreArticleFocusRef.current = null;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => document.getElementById(`help-card-${articleId}`)?.focus({ preventScroll: true }));
    });
  }, [selectedArticle]);

  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value); else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const selectCategory = (category: HelpCategoryFilter) => {
    const next = new URLSearchParams(searchParams);
    if (category === 'all') next.delete('categoria'); else next.set('categoria', category);
    next.delete('artigo');
    setSearchParams(next);
  };

  const openArticle = (article: HelpArticle, event?: ReactMouseEvent<HTMLButtonElement>) => {
    const shouldMoveFocus = event?.detail === 0 || window.matchMedia('(max-width: 1023px)').matches;
    pendingArticleFocusRef.current = shouldMoveFocus ? article.id : null;
    const next = buildHelpArticleSearch(article, searchQuery);
    setSearchParams(next);
  };

  const closeArticle = () => {
    if (selectedArticle) restoreArticleFocusRef.current = selectedArticle.id;
    const next = new URLSearchParams(searchParams);
    next.delete('artigo');
    setSearchParams(next);
  };

  const clearFilters = () => {
    restoreArticleFocusRef.current = null;
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const activeCategoryLabel = HELP_CATEGORIES.find((category) => category.id === activeCategory)?.label ?? 'Todos os guias';
  const resultMessage = `${filteredArticles.length} ${filteredArticles.length === 1 ? 'guia encontrado' : 'guias encontrados'} em ${activeCategoryLabel}`;

  return (
    <Layout>
      <PageHeader
        eyebrow="Documentação interna"
        title="Central de Ajuda"
        description="Guias operacionais revisados para usar o GeoGestor com segurança."
      />

      <PageFilterBar
        className="mb-5"
        search={
          <div className="relative min-w-0">
            <label htmlFor="help-search" className="sr-only">Pesquisar na Central de Ajuda</label>
            <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
            <input
              id="help-search"
              name="helpSearch"
              type="search"
              autoComplete="off"
              placeholder="Pesquisar procedimentos, telas ou recursos…"
              value={searchQuery}
              onChange={(event) => updateSearch(event.target.value)}
              className={`${filterSearchInputClass} pl-9`}
            />
          </div>
        }
        sorting={(searchQuery || activeCategory !== 'all') ? (
          <button
            type="button"
            onClick={clearFilters}
            className={`${filterClearButtonClass} inline-flex items-center justify-center px-4`}
          >
            Limpar filtros
          </button>
        ) : null}
      />

      <div className="relative mb-7 min-w-0 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <nav aria-label="Categorias da Central de Ajuda" className="flex min-w-0 gap-2 overflow-x-auto scroll-smooth pr-10 [scrollbar-width:thin]">
          {HELP_CATEGORIES.map((category) => {
            const Icon = iconByKey[category.icon];
            const isSelected = activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => selectCategory(category.id)}
                className={cn(
                  'geo-focus-ring inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-full px-4 text-xs font-bold transition-[background-color,color,box-shadow] motion-reduce:transition-none',
                  isSelected
                    ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-white',
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {category.label}
              </button>
            );
          })}
        </nav>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-3 right-0 top-0 w-12 bg-gradient-to-l from-white via-white/90 to-transparent dark:from-zinc-950 dark:via-zinc-950/90" />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="help-list-title" className="text-base font-semibold text-zinc-950 dark:text-white">Guias disponíveis</h2>
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
          {resultMessage}
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.7fr)]">
        <section aria-labelledby="help-list-title" className={cn('min-w-0 space-y-3', selectedArticle && 'hidden lg:block')}>
          {filteredArticles.map((article) => {
            const isSelected = selectedArticle?.id === article.id;
            const categoryLabel = HELP_CATEGORIES.find((category) => category.id === article.category)?.label;
            return (
              <button
                id={`help-card-${article.id}`}
                key={article.id}
                type="button"
                aria-label={`Abrir guia: ${article.title}`}
                aria-current={isSelected ? 'true' : undefined}
                onClick={(event) => openArticle(article, event)}
                className={cn(
                  'group w-full rounded-2xl border p-5 text-left shadow-sm transition-[background-color,border-color,color,box-shadow,transform] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-300/50 dark:focus-visible:ring-offset-zinc-950',
                  isSelected
                    ? 'border-zinc-950 bg-zinc-950 text-white shadow-md dark:border-indigo-300/50 dark:bg-indigo-400/15'
                    : 'border-zinc-200 bg-white text-zinc-900 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md motion-reduce:hover:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-400/35',
                )}
              >
                <div className="flex items-start gap-4">
                  <span aria-hidden="true" className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-[background-color,color] motion-reduce:transition-none',
                    isSelected ? 'bg-white/15 text-white dark:bg-indigo-300/15 dark:text-indigo-100' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200',
                  )}>
                    <ArticleIcon article={article} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[11px] font-bold uppercase tracking-wider', isSelected ? 'text-zinc-200 dark:text-indigo-100' : 'text-zinc-600 dark:text-zinc-300')}>
                      {categoryLabel}
                    </span>
                    <h3 className="mt-2 text-sm font-bold leading-snug">
                      <HighlightedText text={article.title} query={searchQuery} />
                    </h3>
                    <span className={cn('mt-2 block text-xs leading-5', isSelected ? 'text-zinc-200 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400')}>
                      <HighlightedText text={article.excerpt} query={searchQuery} />
                    </span>
                  </span>
                  <ArrowRight aria-hidden="true" className={cn('mt-3 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0', isSelected ? 'text-white' : 'text-zinc-500 dark:text-zinc-400')} />
                </div>
              </button>
            );
          })}

          {filteredArticles.length === 0 && (
            <div role="status" aria-live="polite" className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-7 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
              <Question aria-hidden="true" className="mx-auto h-9 w-9 text-zinc-500" />
              <h3 className="mt-3 font-semibold text-zinc-950 dark:text-white">Nenhum guia encontrado</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Tente outro termo ou remova a categoria selecionada.</p>
              <button type="button" onClick={clearFilters} className="geo-button-base geo-button-secondary geo-focus-ring mt-5 min-h-11 px-4">Limpar filtros</button>
            </div>
          )}
        </section>

        <div className="min-w-0 lg:sticky lg:top-6">
          {selectedArticle ? (
            <motion.article
              key={selectedArticle.id}
              aria-labelledby={`help-article-title-${selectedArticle.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="border-b border-zinc-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50/70 p-6 sm:p-8 dark:border-zinc-800 dark:from-indigo-500/10 dark:via-zinc-900 dark:to-cyan-500/5">
                <button
                  type="button"
                  onClick={closeArticle}
                  className="geo-focus-ring mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-zinc-700 hover:bg-white/80 hover:text-zinc-950 lg:hidden dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Voltar para a lista
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100">
                    {HELP_CATEGORIES.find((category) => category.id === selectedArticle.category)?.label}
                  </span>
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Revisado em {formatReviewDate(selectedArticle.updatedAt)}</span>
                </div>
                <h2
                  ref={articleTitleRef}
                  id={`help-article-title-${selectedArticle.id}`}
                  tabIndex={-1}
                  className="mt-5 max-w-3xl text-2xl font-bold tracking-tight text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 sm:text-3xl dark:text-white"
                >
                  {selectedArticle.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">{selectedArticle.excerpt}</p>
                <Link to={selectedArticle.route} className="geo-button-base geo-button-primary geo-focus-ring mt-6 inline-flex min-h-11 items-center gap-2 px-4 text-sm">
                  {selectedArticle.routeLabel}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>

              <div className="max-w-3xl space-y-8 p-6 sm:p-8">
                {selectedArticle.sections.map((section) => (
                  <section key={section.title} className="space-y-4">
                    <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">{section.title}</h3>
                    {section.paragraphs?.map((paragraph) => <p key={paragraph} className="text-sm leading-7 text-zinc-700 dark:text-zinc-300">{paragraph}</p>)}
                    {section.steps && (
                      <ol className="space-y-3">
                        {section.steps.map((step, index) => (
                          <li key={step} className="flex gap-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold tabular-nums text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-100">{index + 1}</span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {section.note && (
                      <aside className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-100">
                        <CheckCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                        <p><strong>Observação:</strong> {section.note}</p>
                      </aside>
                    )}
                    {section.warning && (
                      <aside className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
                        <WarningCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                        <p><strong>Atenção:</strong> {section.warning}</p>
                      </aside>
                    )}
                  </section>
                ))}

                {selectedArticle.relatedArticles?.length ? (
                  <section aria-labelledby="related-guides-title" className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
                    <h3 id="related-guides-title" className="text-base font-semibold text-zinc-950 dark:text-white">Guias relacionados</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedArticle.relatedArticles.map((id) => {
                        const related = getHelpArticle(id);
                        if (!related) return null;
                        return (
                          <Link
                            key={related.id}
                            to={{ pathname: '/ajuda', search: `?${buildHelpArticleSearch(related).toString()}` }}
                            onClick={() => { pendingArticleFocusRef.current = related.id; }}
                            className="geo-focus-ring inline-flex min-h-11 items-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-100"
                          >
                            {related.title}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-4 text-xs font-medium text-zinc-600 sm:px-8 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                <span>Conteúdo válido desde a versão {selectedArticle.minimumVersion}</span>
                <span>Versão instalada: GeoGestor v{APP_VERSION}</span>
              </footer>
            </motion.article>
          ) : (
            <section aria-labelledby="help-recommended-title" className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-indigo-50/80 via-white to-cyan-50/60 p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:from-indigo-500/10 dark:via-zinc-900 dark:to-cyan-500/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <Gear aria-hidden="true" className="h-6 w-6" />
              </div>
              <h2 id="help-recommended-title" className="mt-5 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Comece por aqui</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">Escolha um guia na lista ou use um dos atalhos recomendados para configurar a proteção e a organização dos seus dados.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {recommendedArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={(event) => openArticle(article, event)}
                    className="geo-focus-ring group min-h-32 rounded-2xl border border-white/90 bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-400/35"
                  >
                    <ArticleIcon article={article} className="h-5 w-5 text-indigo-700 dark:text-indigo-200" />
                    <span className="mt-4 block text-sm font-bold text-zinc-950 dark:text-white">{article.title}</span>
                    <span className="mt-2 block text-xs leading-5 text-zinc-600 dark:text-zinc-300">Abrir guia</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
