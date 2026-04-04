import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/layout/FilterBar";
import { ContextualKPIs } from "@/components/layout/ContextualKPIs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText, Download, TrendingUp, CalendarIcon, X, Wand2, Info, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ServicoDialog } from "@/components/cadastros/ServicoDialog";
import { OrcamentoDialog } from "@/components/cadastros/OrcamentoDialog";
import { OrcamentoWizard } from "@/components/orcamento/OrcamentoWizard";
import { SmartImporter } from "@/components/import/SmartImporter";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { generateOrcamentoPDF } from "@/lib/pdfTemplateGenerator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getPaymentStatusBadgeClass, getPaymentMethodBadgeClass } from "@/constants/budgetStatus";

export default function ServicosOrcamentos() {
  const [isServicoDialogOpen, setIsServicoDialogOpen] = useState(false);
  const [isOrcamentoDialogOpen, setIsOrcamentoDialogOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<any>(null);
  const [editingOrcamento, setEditingOrcamento] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'servico' | 'orcamento' } | null>(null);

  const { data: orcamentos = [], isLoading: loadingOrcamentos, refetch: refetchOrcamentos } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const { data: orcamentosData, error } = await supabase
        .from('fato_orcamento')
        .select(`*, dim_cliente:dim_cliente!fk_orcamento_cliente(nome), dim_propriedade:dim_propriedade!fk_orcamento_propriedade(nome_da_propriedade)`)
        .order('data_orcamento', { ascending: false });
      if (error) throw error;
      if (!orcamentosData?.length) return [];

      const orcamentoIds = orcamentosData.map(o => o.id_orcamento);
      const { data: allItens } = await supabase
        .from('fato_orcamento_itens')
        .select(`*, dim_tiposervico(nome)`)
        .in('id_orcamento', orcamentoIds);

      const itensByOrcamento = (allItens || []).reduce((acc, item) => {
        const id = item.id_orcamento;
        if (!acc[id]) acc[id] = [];
        acc[id].push(item);
        return acc;
      }, {} as Record<string, typeof allItens>);

      return orcamentosData.map(orc => ({ ...orc, itens: itensByOrcamento[orc.id_orcamento] || [] }));
    },
  });

  const { data: servicos = [], refetch: refetchServicos } = useQuery({
    queryKey: ['servicos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fato_servico').select(`*, dim_cliente:dim_cliente!fk_servico_cliente(nome)`).order('data_do_servico_inicio', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ['empresa-pdf'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dim_empresa').select('template_orcamento_url, template_config').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;
    if (type === 'servico') {
      const { error } = await supabase.from('fato_servico').delete().eq('id_servico', id);
      if (error) toast.error('Erro ao excluir serviço');
      else { toast.success('Serviço excluído!'); refetchServicos(); }
    } else {
      const { error } = await supabase.from('fato_orcamento').delete().eq('id_orcamento', id);
      if (error) toast.error('Erro ao excluir orçamento');
      else { toast.success('Orçamento excluído!'); refetchOrcamentos(); }
    }
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  const handleGeneratePDF = async (orcamento: any) => {
    setGeneratingPDF(orcamento.id_orcamento);
    try {
      const { data: clienteData } = await supabase.from('dim_cliente').select('*').eq('id_cliente', orcamento.id_cliente).single();
      const { data: itensData } = await supabase.from('fato_orcamento_itens').select(`id_servico, quantidade, valor_unitario, desconto, dim_tiposervico(nome)`).eq('id_orcamento', orcamento.id_orcamento);
      const itensFormatados = (itensData || []).map((item: any) => ({ id_servico: item.id_servico, quantidade: item.quantidade, valor_unitario: item.valor_unitario, desconto: item.desconto, nome_servico: item.dim_tiposervico?.nome || 'Serviço' }));
      await generateOrcamentoPDF({ ...orcamento, itens: itensFormatados }, clienteData, null, empresa?.template_orcamento_url || null, empresa?.template_config as any);
      toast.success('PDF gerado com sucesso!');
    } catch { toast.error('Erro ao gerar PDF'); }
    finally { setGeneratingPDF(null); }
  };

  // Filters
  const filtroAtivo = dataInicio || dataFim;
  const orcamentosFiltradosPorData = orcamentos.filter(o => {
    if (!dataInicio && !dataFim) return true;
    const d = new Date(o.data_orcamento); d.setHours(0, 0, 0, 0);
    if (dataInicio && dataFim) { const i = new Date(dataInicio); i.setHours(0,0,0,0); const f = new Date(dataFim); f.setHours(23,59,59,999); return d >= i && d <= f; }
    if (dataInicio) { const i = new Date(dataInicio); i.setHours(0,0,0,0); return d >= i; }
    if (dataFim) { const f = new Date(dataFim); f.setHours(23,59,59,999); return d <= f; }
    return true;
  });

  const filteredOrcamentos = orcamentosFiltradosPorData.filter(o =>
    o.dim_cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.itens?.some((item: any) => item.dim_tiposervico?.nome?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const pagination = usePagination(filteredOrcamentos, { initialPageSize: 10 });

  const totalOrcamentos = orcamentosFiltradosPorData.length;
  const orcamentosAprovados = orcamentosFiltradosPorData.filter(o => o.orcamento_convertido).length;
  const taxaConversao = totalOrcamentos > 0 ? (orcamentosAprovados / totalOrcamentos) * 100 : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Orçamentos" subtitle="Gestão de orçamentos e propostas comerciais">
          <Button onClick={() => setIsWizardOpen(true)}>
            <Wand2 className="mr-2 h-4 w-4" />
            Novo Orçamento
          </Button>
          <Button onClick={() => { setEditingOrcamento(null); setIsOrcamentoDialogOpen(true); }} variant="outline" size="icon" title="Modo avançado">
            <Plus className="h-4 w-4" />
          </Button>
        </PageHeader>

        <ContextualKPIs
          columns={2}
          items={[
            { label: "Total de Orçamentos", value: totalOrcamentos, icon: FileText },
            { label: "Taxa de Conversão", value: `${Math.round(taxaConversao)}%`, icon: TrendingUp, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
          ]}
        />

        <FilterBar searchValue={searchTerm} onSearchChange={setSearchTerm} searchPlaceholder="Buscar orçamentos...">
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-[140px] justify-start text-left font-normal gap-2", !dataInicio && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} className="pointer-events-auto" initialFocus />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 w-[140px] justify-start text-left font-normal gap-2", !dataFim && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={setDataFim} className="pointer-events-auto" initialFocus />
              </PopoverContent>
            </Popover>
            {filtroAtivo && (
              <Button variant="ghost" size="sm" onClick={() => { setDataInicio(undefined); setDataFim(undefined); }}>
                <X className="mr-1 h-4 w-4" />Limpar
              </Button>
            )}
          </div>
        </FilterBar>

        {filtroAtivo && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              KPIs filtrados pelo período ({dataInicio ? format(dataInicio, "dd/MM/yyyy") : "início"} - {dataFim ? format(dataFim, "dd/MM/yyyy") : "atual"}).
            </p>
          </div>
        )}

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Situação Pagamento</TableHead>
                <TableHead>Forma Pagamento</TableHead>
                <TableHead>Convertido</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingOrcamentos ? (
                <TableRow><TableCell colSpan={9} className="text-center">Carregando...</TableCell></TableRow>
              ) : filteredOrcamentos.length === 0 && !searchTerm ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-10 w-10 text-muted-foreground/50" />
                      <p className="font-medium text-foreground">Nenhum orçamento cadastrado</p>
                      <p className="text-sm text-muted-foreground">Crie orçamentos profissionais e acompanhe aprovações</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredOrcamentos.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center">Nenhum orçamento encontrado</TableCell></TableRow>
              ) : (
                pagination.paginatedData.map((orcamento) => (
                  <TableRow key={orcamento.id_orcamento}>
                    <TableCell className="font-mono text-sm font-semibold text-primary">{orcamento.codigo_orcamento || '-'}</TableCell>
                    <TableCell className="font-medium">{orcamento.dim_cliente?.nome || '-'}</TableCell>
                    <TableCell>{orcamento.itens?.length > 0 ? orcamento.itens.map((item: any) => item.dim_tiposervico?.nome).filter(Boolean).join(', ') : '-'}</TableCell>
                    <TableCell>{new Date(orcamento.data_orcamento).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>R$ {(orcamento.receita_esperada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Badge className={getPaymentStatusBadgeClass(orcamento.situacao_do_pagamento)}>{orcamento.situacao_do_pagamento || 'Não definido'}</Badge></TableCell>
                    <TableCell><Badge className={getPaymentMethodBadgeClass(orcamento.forma_de_pagamento)}>{orcamento.forma_de_pagamento || 'Não definido'}</Badge></TableCell>
                    <TableCell><Badge variant={orcamento.orcamento_convertido ? 'default' : 'secondary'}>{orcamento.orcamento_convertido ? 'Sim' : 'Não'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleGeneratePDF(orcamento)} disabled={generatingPDF === orcamento.id_orcamento}><Download className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingOrcamento(orcamento); setIsOrcamentoDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget({ id: orcamento.id_orcamento, type: 'orcamento' }); setDeleteConfirmOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="p-2">
            <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} pageSize={pagination.pageSize} startIndex={pagination.startIndex} endIndex={pagination.endIndex} canGoNext={pagination.canGoNext} canGoPrevious={pagination.canGoPrevious} onPageChange={pagination.goToPage} onPageSizeChange={pagination.setPageSize} onFirstPage={pagination.goToFirstPage} onLastPage={pagination.goToLastPage} onNextPage={pagination.goToNextPage} onPreviousPage={pagination.goToPreviousPage} />
          </div>
        </div>

        <ServicoDialog open={isServicoDialogOpen} onOpenChange={setIsServicoDialogOpen} servico={editingServico} onSuccess={() => { refetchServicos(); setIsServicoDialogOpen(false); setEditingServico(null); }} />
        <OrcamentoDialog open={isOrcamentoDialogOpen} onOpenChange={setIsOrcamentoDialogOpen} orcamento={editingOrcamento} onSuccess={() => { refetchOrcamentos(); setIsOrcamentoDialogOpen(false); setEditingOrcamento(null); }} />
        <OrcamentoWizard open={isWizardOpen} onOpenChange={setIsWizardOpen} onSuccess={() => { refetchOrcamentos(); setIsWizardOpen(false); }} />
        <ConfirmDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} title={deleteTarget?.type === 'servico' ? 'Excluir serviço' : 'Excluir orçamento'} description={`Tem certeza que deseja excluir este ${deleteTarget?.type === 'servico' ? 'serviço' : 'orçamento'}?`} confirmLabel="Excluir" onConfirm={confirmDelete} />
      </div>
    </AppLayout>
  );
}
