import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText, Download, TrendingUp, DollarSign, Calculator } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServicoDialog } from "@/components/cadastros/ServicoDialog";
import { OrcamentoDialog } from "@/components/cadastros/OrcamentoDialog";
import { generateOrcamentoPDF } from "@/lib/pdfTemplateGenerator";

export default function ServicosOrcamentos() {
  const [isServicoDialogOpen, setIsServicoDialogOpen] = useState(false);
  const [isOrcamentoDialogOpen, setIsOrcamentoDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<any>(null);
  const [editingOrcamento, setEditingOrcamento] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);

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
      const { data, error } = await supabase
        .from('fato_orcamento')
        .select(`
          *,
          dim_cliente(nome),
          fato_servico(nome_do_servico)
        `)
        .order('data_orcamento', { ascending: false });
      if (error) throw error;
      return data || [];
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
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    
    const { error } = await supabase
      .from('fato_servico')
      .delete()
      .eq('id_servico', id);

    if (error) {
      toast.error('Erro ao excluir serviço');
      return;
    }

    toast.success('Serviço excluído com sucesso!');
    refetchServicos();
  };

  const handleDeleteOrcamento = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;
    
    const { error } = await supabase
      .from('fato_orcamento')
      .delete()
      .eq('id_orcamento', id);

    if (error) {
      toast.error('Erro ao excluir orçamento');
      return;
    }

    toast.success('Orçamento excluído com sucesso!');
    refetchOrcamentos();
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
    if (!empresa?.template_orcamento_url) {
      toast.error('Template de orçamento não configurado');
      return;
    }

    setGeneratingPDF(orcamento.id_orcamento);

    try {
      const { data: clienteData } = await supabase
        .from('dim_cliente')
        .select('*')
        .eq('id_cliente', orcamento.id_cliente)
        .single();

      const { data: servicoData } = await supabase
        .from('fato_servico')
        .select('*')
        .eq('id_servico', orcamento.id_servico)
        .single();

      await generateOrcamentoPDF(
        orcamento,
        clienteData,
        servicoData,
        empresa.template_orcamento_url,
        empresa.template_config as any
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

  const filteredOrcamentos = orcamentos.filter(o => 
    o.dim_cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.fato_servico?.nome_do_servico?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular KPIs
  const totalServicos = servicos.length;
  const servicosConcluidos = servicos.filter(s => s.situacao_do_servico === 'Concluído').length;
  const receitaServicos = servicos.reduce((acc, s) => acc + (s.receita_servico || 0), 0);
  const totalOrcamentos = orcamentos.length;
  const orcamentosAprovados = orcamentos.filter(o => o.orcamento_convertido).length;
  const taxaConversao = totalOrcamentos > 0 ? (orcamentosAprovados / totalOrcamentos) * 100 : 0;
  const receitaOrcada = orcamentos.reduce((acc, o) => acc + (o.receita_esperada || 0), 0);

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

        {/* Orçamentos */}
        <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Buscar orçamentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={handleNewOrcamento}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Orçamento
              </Button>
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Situação Pagamento</TableHead>
                    <TableHead>Convertido</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingOrcamentos ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredOrcamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">Nenhum orçamento encontrado</TableCell>
                    </TableRow>
                  ) : (
                    filteredOrcamentos.map((orcamento) => (
                      <TableRow key={orcamento.id_orcamento}>
                        <TableCell className="font-medium">{orcamento.dim_cliente?.nome || '-'}</TableCell>
                        <TableCell>{orcamento.fato_servico?.nome_do_servico || '-'}</TableCell>
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
      </div>
    </AppLayout>
  );
}
