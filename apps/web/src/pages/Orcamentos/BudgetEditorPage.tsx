import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BUDGET_STATUS_LABELS } from '@geogestor/contracts';
import { ArrowLeft } from '@phosphor-icons/react';
import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { ModuleNavigation } from '../../components/ModuleNavigation';
import { PageHeader } from '../../components/PageHeader';
import { Skeleton } from '../../components/Skeleton';
import { apiClient } from '../../services/apiClient';
import { secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';
import { BudgetEditor } from './BudgetEditor';
import { getSafeBudgetReturnTo, isSafeEntityId, withBudgetHighlight } from './budgetNavigation';
import type { BudgetDetail, BudgetOptions } from './types';

const emptyOptions: BudgetOptions = {
  clients: [],
  projects: [],
  properties: [],
  taxProfiles: [],
  templates: [],
  pricingParameters: []
};

interface OpportunityContext {
  id: string;
  clienteId?: string | null;
}

export function BudgetEditorPage() {
  const { id: budgetId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = Boolean(budgetId);
  const safeBudgetId = isSafeEntityId(budgetId) ? budgetId : null;
  const clientIdParam = searchParams.get('clienteId');
  const opportunityIdParam = searchParams.get('oportunidadeId');
  const safeClientIdParam = isSafeEntityId(clientIdParam) ? clientIdParam : null;
  const safeOpportunityIdParam = isSafeEntityId(opportunityIdParam) ? opportunityIdParam : null;
  const returnTo = getSafeBudgetReturnTo(searchParams.get('retorno'));

  const optionsQuery = useQuery<BudgetOptions>({
    queryKey: ['budget-options'],
    queryFn: () => apiClient.get('/api/orcamentos/options')
  });
  const detailQuery = useQuery<BudgetDetail>({
    queryKey: ['budget-detail', safeBudgetId],
    queryFn: () => apiClient.get(`/api/orcamentos/${safeBudgetId}`),
    enabled: editing && Boolean(safeBudgetId)
  });
  const opportunityQuery = useQuery<OpportunityContext>({
    queryKey: ['opportunity-detail', safeOpportunityIdParam],
    queryFn: () => apiClient.get(`/api/oportunidades/${safeOpportunityIdParam}`),
    enabled: !editing && Boolean(safeOpportunityIdParam),
    retry: false
  });

  const options = optionsQuery.data || emptyOptions;
  const validClientId = safeClientIdParam && options.clients.some((client) => client.id === safeClientIdParam)
    ? safeClientIdParam
    : null;
  const opportunityClientId = opportunityQuery.data?.clienteId;
  const validOpportunityClientId = isSafeEntityId(opportunityClientId)
    && options.clients.some((client) => client.id === opportunityClientId)
    ? opportunityClientId
    : null;
  const initialClientId = validClientId || validOpportunityClientId || undefined;
  const validOpportunityId = isSafeEntityId(opportunityQuery.data?.id) ? opportunityQuery.data.id : null;

  const contextWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (clientIdParam && !safeClientIdParam) warnings.push('O identificador do cliente na URL é inválido. Selecione um cliente para continuar.');
    else if (safeClientIdParam && optionsQuery.isSuccess && !validClientId) warnings.push('O cliente informado não foi encontrado. Selecione outro cliente para continuar.');
    if (opportunityIdParam && !safeOpportunityIdParam) warnings.push('O identificador da oportunidade na URL é inválido. O orçamento será criado sem esse vínculo.');
    else if (safeOpportunityIdParam && opportunityQuery.isError) warnings.push('A oportunidade informada não foi encontrada ou não está acessível. O orçamento será criado sem esse vínculo.');
    if (validClientId && validOpportunityClientId && validClientId !== validOpportunityClientId) {
      warnings.push('O cliente informado difere do cliente da oportunidade. Confira o vínculo antes de salvar.');
    }
    return warnings;
  }, [clientIdParam, opportunityIdParam, opportunityQuery.isError, optionsQuery.isSuccess, safeClientIdParam, safeOpportunityIdParam, validClientId, validOpportunityClientId]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = editing ? 'Editar orçamento — GeoGestor' : 'Novo orçamento — GeoGestor';
    return () => { document.title = previousTitle; };
  }, [editing]);

  const returnToList = () => navigate(returnTo);

  const handleSaved = async (saved: BudgetDetail) => {
    queryClient.setQueryData(['budget-detail', saved.id], saved);

    if (!editing && validOpportunityId) {
      try {
        await apiClient.post(`/api/oportunidades/${validOpportunityId}/link-budget`, { orcamentoId: saved.id });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
          queryClient.invalidateQueries({ queryKey: ['opportunity-analytics'] })
        ]);
        toast.success('Orçamento vinculado à oportunidade e etapa atualizada para Proposta.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'O orçamento foi salvo, mas não foi possível vinculá-lo à oportunidade.');
      }
    }

    navigate(withBudgetHighlight(returnTo, saved.id), { replace: true });
  };

  const loading = optionsQuery.isLoading
    || (editing && Boolean(safeBudgetId) && detailQuery.isLoading)
    || (!editing && Boolean(safeOpportunityIdParam) && opportunityQuery.isLoading);
  const loadError = optionsQuery.isError || (editing && (!safeBudgetId || detailQuery.isError));
  const initialBudget = editing ? detailQuery.data : null;
  const readOnlyBudget = initialBudget && initialBudget.status !== 'rascunho';

  return (
    <Layout contentClassName="min-w-0 max-w-none">
      <PageHeader
        eyebrow="Propostas comerciais"
        title={editing ? 'Editar orçamento' : 'Novo orçamento'}
        description={editing
          ? 'Atualize o rascunho usando toda a área de trabalho. As alterações permanecem rastreáveis.'
          : 'Preencha a proposta usando toda a área de trabalho. O orçamento será salvo inicialmente como rascunho.'}
        action={(
          <Link
            to={returnTo}
            className={cn(secondarySmallActionButtonClass, 'min-h-11 w-full px-4 text-sm sm:w-auto')}
          >
            <ArrowLeft aria-hidden="true" size={17} weight="bold" />
            Voltar para orçamentos
          </Link>
        )}
        navigation={<ModuleNavigation module="commercial" className="mb-0" />}
        frameClassName="max-w-none"
      />

      {loading ? (
        <div aria-busy="true" aria-label="Carregando formulário do orçamento">
          <span className="sr-only" role="status" aria-live="polite">Carregando formulário do orçamento…</span>
          <Skeleton className="h-[36rem] w-full rounded-xl" />
        </div>
      ) : loadError ? (
        <div className="geo-card flex min-h-64 flex-col items-center justify-center px-6 text-center" role="alert">
          <h2 className="text-lg font-semibold text-text-primary">{editing ? 'Não foi possível abrir este orçamento' : 'Não foi possível preparar o novo orçamento'}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-text-secondary">Confira o endereço ou tente carregar novamente. Nenhuma informação foi alterada.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => { optionsQuery.refetch(); if (editing && safeBudgetId) detailQuery.refetch(); }} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5">Tentar novamente</button>
            <button type="button" onClick={returnToList} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-5">Voltar para orçamentos</button>
          </div>
        </div>
      ) : readOnlyBudget ? (
        <div className="geo-card flex min-h-64 flex-col items-center justify-center px-6 text-center" role="alert">
          <h2 className="text-lg font-semibold text-text-primary">Este orçamento não pode mais ser editado</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-text-secondary">Somente rascunhos podem ser alterados. O status atual é {initialBudget ? BUDGET_STATUS_LABELS[initialBudget.status] : 'indisponível'}.</p>
          <button type="button" onClick={returnToList} className="mt-5 geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-5">Voltar para orçamentos</button>
        </div>
      ) : (
        <>
          {contextWarnings.length > 0 && (
            <div className="mb-5 space-y-2" role="status" aria-live="polite">
              {contextWarnings.map((warning) => <p key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100">{warning}</p>)}
            </div>
          )}
          <BudgetEditor
            key={`budget-editor-page-${initialBudget?.id || initialClientId || 'empty'}`}
            presentation="page"
            options={options}
            initial={initialBudget}
            initialClientId={initialClientId}
            onClose={returnToList}
            onSaved={handleSaved}
          />
        </>
      )}
    </Layout>
  );
}
