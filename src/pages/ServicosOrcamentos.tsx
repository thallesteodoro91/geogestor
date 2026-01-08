import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText, Download, TrendingUp, DollarSign, Calculator, CalendarIcon, X, Info, Wand2 } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { Badge } from "@/components/ui/badge";
import { ServicoDialog } from "@/components/cadastros/ServicoDialog";
import { OrcamentoDialog } from "@/components/cadastros/OrcamentoDialog";
import { OrcamentoWizard } from "@/components/orcamento/OrcamentoWizard";
import { DespesasPendentes } from "@/components/despesas/DespesasPendentes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { generateOrcamentoPDF } from "@/lib/pdfTemplateGenerator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

  const { data: servicos = [], isLoading: loadingServicos, refetch: refetchServicos } = useQuery({
    queryKey: ['servicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_servico')
        .select(`
          *,
          dim_cliente(nome),
          dim_propriedade(nome_da_propriedade)
        `)
        .order('data_do_servico_inicio', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: orcamentos = [], isLoading: loadingOrcamentos, refetch: refetchOrcamentos } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      // Buscar orçamentos
      const { data: orcamentosData, error } = await supabase
        .from('fato_orcamento')
        .select(`
          *,
          dim_cliente(nome),
          dim_propriedade(nome_da_propriedade)
        `)
        .order('data_orcamento', { ascending: false });
      if (error) throw error;
      if (!orcamentosData?.length) return [];

      // Buscar TODOS os itens de uma vez (evita N+1)
      const orcamentoIds = orcamentosData.map(o => o.id_orcamento);
      const { data: allItens } = await supabase
        .from('fato_orcamento_itens')
        .select(`
          *,
          dim_tiposervico(nome)
        `)
        .in('id_orcamento', orcamentoIds);

      // Agrupar itens por orçamento
      const itensByOrcamento = (allItens || []).reduce((acc, item) => {
        const id = item.id_orcamento;
        if (!acc[id]) acc[id] = [];
        acc[id].push(item);
        return acc;
      }, {} as Record<string, typeof allItens>);

      // Combinar orçamentos com seus itens
      return orcamentosData.map(orc => ({
        ...orc,
        itens: itensByOrcamento[orc.id_orcamento] || []
      }));
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ['empresa-pdf'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_empresa')
        .select('template_orcamento_url, template_config')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleDeleteServico = async (id: string) => {
    setDeleteTarget({ id, type: 'servico' });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteOrcamento = async (id: string) => {
    setDeleteTarget({ id, type: 'orcamento' });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    const { id, type } = deleteTarget;
    
    if (type === 'servico') {
      const { error } = await supabase
        .from('fato_servico')
        .delete()
        .eq('id_servico', id);

      if (error) {
        toast.error('Erro ao excluir serviço');
      } else {
        toast.success('Serviço excluído com sucesso!');
        refetchServicos();
      }
    } else {
      const { error } = await supabase
        .from('fato_orcamento')
        .delete()
        .eq('id_orcamento', id);

      if (error) {
        toast.error('Erro ao excluir orçamento');
      } else {
        toast.success('Orçamento excluído com sucesso!');
        refetchOrcamentos();
      }
    }
    
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  const handleEditServico = (servico: any) => {
    setEditingServico(servico);
    setIsServicoDialogOpen(true);
  };

  const handleEditOrcamento = (orcamento: any) => {
    setEditingOrcamento(orcamento);
    setIsOrcamentoDialogOpen(true);
  };

  const handleNewServico = () => {
    setEditingServico(null);
    setIsServicoDialogOpen(true);
  };

  const handleNewOrcamento = () => {
    setEditingOrcamento(null);
    setIsOrcamentoDialogOpen(true);
  };

  const handleGeneratePDF = async (orcamento: any) => {
    setGeneratingPDF(orcamento.id_orcamento);

    try {
      const { data: clienteData } = await supabase
        .from('dim_cliente')
        .select('*')
        .eq('id_cliente', orcamento.id_cliente)
        .single();

      // Buscar itens do orçamento com nomes dos serviços
      const { data: itensData } = await supabase
        .from('fato_orcamento_itens')
        .select(`
          id_servico,
          quantidade,
          valor_unitario,
          desconto,
          dim_tiposervico(nome)
        `)
        .eq('id_orcamento', orcamento.id_orcamento);

      // Formatar itens com nome do serviço
      const itensFormatados = (itensData || []).map((item: any) => ({
        id_servico: item.id_servico,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        desconto: item.desconto,
        nome_servico: item.dim_tiposervico?.nome || 'Serviço'
      }));

      // Preparar dados do orçamento com itens
      const orcamentoComItens = {
        ...orcamento,
        itens: itensFormatados
      };

      await generateOrcamentoPDF(
        orcamentoComItens,
        clienteData,
        null, // servico não é mais necessário pois usamos itens
        empresa?.template_orcamento_url || null,
        empresa?.template_config as any
      );

      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPDF(null);
    }
  };

  const filteredServicos = servicos.filter(s => 
    s.nome_do_servico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.dim_cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtrar orçamentos por período
  const orcamentosFiltradosPorData = orcamentos.filter(o => {
    if (!dataInicio && !dataFim) return true;
    
    const dataOrcamento = new Date(o.data_orcamento);
    dataOrcamento.setHours(0, 0, 0, 0);
    
    if (dataInicio && dataFim) {
      const inicio = new Date(dataInicio);
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      return dataOrcamento >= inicio && dataOrcamento <= fim;
    }
    if (dataInicio) {
      const inicio = new Date(dataInicio);
      inicio.setHours(0, 0, 0, 0);
      return dataOrcamento >= inicio;
    }
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      return dataOrcamento <= fim;
    }
    return true;
  });

  const filteredOrcamentos = orcamentosFiltradosPorData.filter(o => 
    o.dim_cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.itens?.some((item: any) => item.dim_tiposervico?.nome?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination for orcamentos
  const pagination = usePagination(filteredOrcamentos, { initialPageSize: 10 });

  // Calcular KPIs usando orçamentos filtrados por período
  const filtroAtivo = dataInicio || dataFim;
  const orcamentosParaKPI = orcamentosFiltradosPorData;
  const totalServicos = servicos.length;
  const servicosConcluidos = servicos.filter(s => s.situacao_do_servico === 'Concluído').length;
  const receitaServicos = servicos.reduce((acc, s) => acc + (s.receita_servico || 0), 0);
  const totalOrcamentos = orcamentosParaKPI.length;
  const orcamentosAprovados = orcamentosParaKPI.filter(o => o.orcamento_convertido).length;
  const taxaConversao = totalOrcamentos > 0 ? (orcamentosAprovados / totalOrcamentos) * 100 : 0;
  const receitaOrcada = orcamentosParaKPI.reduce((acc, o) => acc + (o.receita_esperada || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-heading font-bold text-foreground">Orçamento</h1>
          <p className="text-base text-muted-foreground">Gestão de orçamentos e propostas comerciais</p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total de Orçamentos"
            value={totalOrcamentos.toString()}
            icon={FileText}
            subtitle={`${orcamentosAprovados} aprovados`}
            change={`${Math.round(taxaConversao)}%`}
            changeType="positive"
          />
          <KPICard
            title="Taxa de Conversão"
            value={`${Math.round(taxaConversao)}%`}
            icon={TrendingUp}
            subtitle="orçamentos convertidos"
            change="+8%"
            changeType="positive"
          />
          <KPICard
            title="Receita Orçada"
            value={`R$ ${receitaOrcada.toLocaleString('pt-BR')}`}
            icon={DollarSign}
            subtitle="pipeline total"
            change="+15%"
            changeType="positive"
          />
          <KPICard
            title="Ticket Médio"
            value={`R$ ${totalOrcamentos > 0 ? Math.round(receitaOrcada / totalOrcamentos).toLocaleString('pt-BR') : '0'}`}
            icon={Calculator}
            subtitle="valor médio por orçamento"
            change="+5%"
            changeType="positive"
          />
        </div>

        {/* Despesas Pendentes de Confirmação */}
        <DespesasPendentes />

        {/* Orçamentos */}
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <Input
                placeholder="Buscar orçamentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              
              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal gap-2 rounded-sm px-3",
                          !dataInicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="h-4 w-4 shrink-0" />
                        {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={setDataInicio}
                        className="pointer-events-auto"
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal gap-2 rounded-sm px-3",
                          !dataFim && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="h-4 w-4 shrink-0" />
                        {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFim}
                        onSelect={setDataFim}
                        className="pointer-events-auto"
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {filtroAtivo && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mt-5"
                    onClick={() => {
                      setDataInicio(undefined);
                      setDataFim(undefined);
                    }}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Limpar filtro
                  </Button>
                )}
              </div>
              
              <div className="flex gap-2 ml-auto">
                <Button onClick={() => setIsWizardOpen(true)} variant="default">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Novo Orçamento
                </Button>
                <Button onClick={handleNewOrcamento} variant="outline" size="icon" title="Modo avançado">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Disclaimer do filtro */}
            {filtroAtivo && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Os indicadores (KPIs) acima estão mostrando valores filtrados pelo período selecionado 
                  ({dataInicio ? format(dataInicio, "dd/MM/yyyy") : "início"} - {dataFim ? format(dataFim, "dd/MM/yyyy") : "atual"}).
                  Limpe o filtro para ver os valores totais.
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
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredOrcamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center">Nenhum orçamento encontrado</TableCell>
                    </TableRow>
                  ) : (
                    pagination.paginatedData.map((orcamento) => (
                      <TableRow key={orcamento.id_orcamento}>
                        <TableCell className="font-mono text-sm font-semibold text-primary">{orcamento.codigo_orcamento || '-'}</TableCell>
                        <TableCell className="font-medium">{orcamento.dim_cliente?.nome || '-'}</TableCell>
                        <TableCell>
                          {orcamento.itens?.length > 0 
                            ? orcamento.itens.map((item: any) => item.dim_tiposervico?.nome).filter(Boolean).join(', ') 
                            : '-'}
                        </TableCell>
                        <TableCell>{new Date(orcamento.data_orcamento).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>R$ {((orcamento.receita_esperada || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              orcamento.situacao_do_pagamento === "Pago" ? "bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,30%)]" :
                              orcamento.situacao_do_pagamento === "Cancelado" ? "bg-[hsl(0,100%,50%)] text-white hover:bg-[hsl(0,100%,45%)]" :
                              orcamento.situacao_do_pagamento === "Pendente" ? "bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)]" :
                              orcamento.situacao_do_pagamento === "Parcial" ? "bg-[hsl(217,91%,60%)] text-white hover:bg-[hsl(217,91%,55%)]" :
                              "bg-muted text-muted-foreground"
                            }
                          >
                            {orcamento.situacao_do_pagamento || 'Não definido'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              orcamento.forma_de_pagamento === "PIX" ? "bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)]" :
                              orcamento.forma_de_pagamento === "Dinheiro" ? "bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,30%)]" :
                              orcamento.forma_de_pagamento === "Cartão" ? "bg-[hsl(217,91%,60%)] text-white hover:bg-[hsl(217,91%,55%)]" :
                              orcamento.forma_de_pagamento === "Transferência" ? "bg-[hsl(280,70%,50%)] text-white hover:bg-[hsl(280,70%,45%)]" :
                              orcamento.forma_de_pagamento === "Boleto" ? "bg-[hsl(25,95%,53%)] text-white hover:bg-[hsl(25,95%,45%)]" :
                              "bg-muted text-muted-foreground"
                            }
                          >
                            {orcamento.forma_de_pagamento || 'Não definido'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={orcamento.orcamento_convertido ? 'default' : 'secondary'}>
                            {orcamento.orcamento_convertido ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleGeneratePDF(orcamento)}
                              disabled={generatingPDF === orcamento.id_orcamento}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditOrcamento(orcamento)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteOrcamento(orcamento.id_orcamento)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              <TablePagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                canGoNext={pagination.canGoNext}
                canGoPrevious={pagination.canGoPrevious}
                onPageChange={pagination.goToPage}
                onPageSizeChange={pagination.setPageSize}
                onFirstPage={pagination.goToFirstPage}
                onLastPage={pagination.goToLastPage}
                onNextPage={pagination.goToNextPage}
                onPreviousPage={pagination.goToPreviousPage}
              />
            </div>
        </div>

        {/* Dialogs */}
        <ServicoDialog
          open={isServicoDialogOpen}
          onOpenChange={setIsServicoDialogOpen}
          servico={editingServico}
          onSuccess={() => {
            refetchServicos();
            setIsServicoDialogOpen(false);
            setEditingServico(null);
          }}
        />

        <OrcamentoDialog
          open={isOrcamentoDialogOpen}
          onOpenChange={setIsOrcamentoDialogOpen}
          orcamento={editingOrcamento}
          onSuccess={() => {
            refetchOrcamentos();
            setIsOrcamentoDialogOpen(false);
            setEditingOrcamento(null);
          }}
        />

        <OrcamentoWizard
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          onSuccess={() => {
            refetchOrcamentos();
            setIsWizardOpen(false);
          }}
        />

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title={deleteTarget?.type === 'servico' ? 'Excluir serviço' : 'Excluir orçamento'}
          description={`Tem certeza que deseja excluir este ${deleteTarget?.type === 'servico' ? 'serviço' : 'orçamento'}? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onConfirm={confirmDelete}
        />
      </div>
    </AppLayout>
  );
}
