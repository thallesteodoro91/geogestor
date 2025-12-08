import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText, TrendingUp, Target, Download } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { orcamentoSchema } from "@/lib/validations";
import { generateOrcamentoPDF } from "@/lib/pdfTemplateGenerator";

export default function Orcamentos() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id_cliente: "",
    id_servico: "",
    data_orcamento: new Date().toISOString().split('T')[0],
    valor_unitario: "",
    quantidade: "1",
    desconto: "0",
    situacao_do_pagamento: "Pendente",
    forma_de_pagamento: "",
  });

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_orcamento')
        .select(`
          *,
          dim_cliente(nome, email, telefone),
          fato_servico(nome_do_servico)
        `)
        .order('data_orcamento', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_cliente')
        .select('id_cliente, nome')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_servico')
        .select('id_servico, nome_do_servico')
        .order('nome_do_servico');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ['empresa-pdf'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_empresa')
        .select('nome, template_orcamento_url, template_config')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData & { id_orcamento?: string }) => {
      const valorTotal = parseFloat(data.valor_unitario) * parseInt(data.quantidade) - parseFloat(data.desconto);
      const valorImposto = valorTotal * 0.12;
      const receitaEsperada = valorTotal - valorImposto;

      const payload = {
        id_cliente: data.id_cliente || null,
        id_servico: data.id_servico || null,
        data_orcamento: data.data_orcamento,
        valor_unitario: parseFloat(data.valor_unitario),
        quantidade: parseInt(data.quantidade),
        desconto: parseFloat(data.desconto),
        valor_imposto: valorImposto,
        receita_esperada: receitaEsperada,
        receita_esperada_imposto: receitaEsperada,
        situacao_do_pagamento: data.situacao_do_pagamento,
        forma_de_pagamento: data.forma_de_pagamento || null,
      };

      if (data.id_orcamento) {
        const { error } = await supabase
          .from('fato_orcamento')
          .update(payload)
          .eq('id_orcamento', data.id_orcamento);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fato_orcamento').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success(editingId ? "Orçamento atualizado!" : "Orçamento criado!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fato_orcamento').delete().eq('id_orcamento', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success("Orçamento excluído!");
    },
  });

  const resetForm = () => {
    setFormData({
      id_cliente: "",
      id_servico: "",
      data_orcamento: new Date().toISOString().split('T')[0],
      valor_unitario: "",
      quantidade: "1",
      desconto: "0",
      situacao_do_pagamento: "Pendente",
      forma_de_pagamento: "",
    });
    setEditingId(null);
  };

  const handleEdit = (orc: any) => {
    setFormData({
      id_cliente: orc.id_cliente || "",
      id_servico: orc.id_servico || "",
      data_orcamento: orc.data_orcamento,
      valor_unitario: orc.valor_unitario.toString(),
      quantidade: orc.quantidade.toString(),
      desconto: orc.desconto?.toString() || "0",
      situacao_do_pagamento: orc.situacao_do_pagamento || "Pendente",
      forma_de_pagamento: orc.forma_de_pagamento || "",
    });
    setEditingId(orc.id_orcamento);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = orcamentoSchema.parse({
        id_cliente: formData.id_cliente || null,
        id_servico: formData.id_servico || null,
        data_orcamento: formData.data_orcamento,
        valor_unitario: parseFloat(formData.valor_unitario),
        quantidade: parseInt(formData.quantidade),
        situacao_do_pagamento: formData.situacao_do_pagamento || null,
        forma_de_pagamento: formData.forma_de_pagamento || null,
      });
      
      const dataToSubmit = {
        id_cliente: validatedData.id_cliente || "",
        id_servico: validatedData.id_servico || "",
        data_orcamento: validatedData.data_orcamento,
        valor_unitario: validatedData.valor_unitario.toString(),
        quantidade: validatedData.quantidade.toString(),
        desconto: formData.desconto || "0",
        situacao_do_pagamento: validatedData.situacao_do_pagamento || "Pendente",
        forma_de_pagamento: validatedData.forma_de_pagamento || "",
      };
      
      mutation.mutate(editingId ? { ...dataToSubmit, id_orcamento: editingId } : dataToSubmit);
    } catch (error: any) {
      if (error.errors) {
        error.errors.forEach((err: any) => toast.error(err.message));
      } else {
        toast.error("Erro na validação dos dados");
      }
    }
  };

  const handleExportPDF = async (orcamento: any) => {
    setGeneratingPDF(orcamento.id_orcamento);

    try {
      const cliente = orcamento.dim_cliente || null;
      const servico = orcamento.fato_servico || null;
      const templateUrl = empresa?.template_orcamento_url || null;
      const config = (empresa?.template_config || null) as any;
      const empresaData = empresa ? { nome: empresa.nome } : null;

      await generateOrcamentoPDF(
        orcamento,
        cliente,
        servico,
        templateUrl,
        config,
        empresaData
      );

      toast.success('PDF gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGeneratingPDF(null);
    }
  };

  const receitaEsperadaTotal = orcamentos.reduce((sum, o) => sum + (parseFloat(String(o.receita_esperada || 0))), 0);
  const orcamentosConvertidos = orcamentos.filter(o => o.orcamento_convertido).length;
  const taxaConversao = orcamentos.length > 0 ? (orcamentosConvertidos / orcamentos.length * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground">Gerencie todos os orçamentos e propostas</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <KPICard
            title="Total de Orçamentos"
            value={orcamentos.length.toString()}
            icon={FileText}
          />
          <KPICard
            title="Receita Esperada"
            value={`R$ ${receitaEsperadaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={TrendingUp}
          />
          <KPICard
            title="Taxa de Conversão"
            value={`${taxaConversao.toFixed(1)}%`}
            icon={Target}
            change={`${orcamentosConvertidos} convertidos`}
            changeType="positive"
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lista de Orçamentos</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Orçamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar" : "Novo"} Orçamento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cliente">Cliente *</Label>
                      <Select value={formData.id_cliente} onValueChange={(v) => setFormData({ ...formData, id_cliente: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map((c) => (
                            <SelectItem key={c.id_cliente} value={c.id_cliente}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="servico">Serviço</Label>
                      <Select value={formData.id_servico} onValueChange={(v) => setFormData({ ...formData, id_servico: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {servicos.map((s) => (
                            <SelectItem key={s.id_servico} value={s.id_servico}>
                              {s.nome_do_servico}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="data">Data *</Label>
                      <Input
                        id="data"
                        type="date"
                        value={formData.data_orcamento}
                        onChange={(e) => setFormData({ ...formData, data_orcamento: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="valor">Valor Unitário *</Label>
                      <Input
                        id="valor"
                        type="number"
                        step="0.01"
                        value={formData.valor_unitario}
                        onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="qtd">Quantidade *</Label>
                      <Input
                        id="qtd"
                        type="number"
                        value={formData.quantidade}
                        onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="desconto">Desconto</Label>
                      <Input
                        id="desconto"
                        type="number"
                        step="0.01"
                        value={formData.desconto}
                        onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="situacao">Situação</Label>
                      <Select value={formData.situacao_do_pagamento} onValueChange={(v) => setFormData({ ...formData, situacao_do_pagamento: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="Pago">Pago</SelectItem>
                          <SelectItem value="Atrasado">Atrasado</SelectItem>
                          <SelectItem value="Cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="forma">Forma de Pagamento</Label>
                      <Input
                        id="forma"
                        value={formData.forma_de_pagamento}
                        onChange={(e) => setFormData({ ...formData, forma_de_pagamento: e.target.value })}
                        placeholder="Ex: PIX, Boleto, Cartão"
                      />
                    </div>
                  </div>
                  <div className="bg-muted/20 p-4 rounded-lg space-y-2">
                    <p className="text-sm"><strong>Valor Total:</strong> R$ {((parseFloat(formData.valor_unitario) || 0) * (parseInt(formData.quantidade) || 1) - (parseFloat(formData.desconto) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-sm"><strong>Imposto (12%):</strong> R$ {(((parseFloat(formData.valor_unitario) || 0) * (parseInt(formData.quantidade) || 1) - (parseFloat(formData.desconto) || 0)) * 0.12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-sm font-semibold"><strong>Receita Esperada:</strong> R$ {(((parseFloat(formData.valor_unitario) || 0) * (parseInt(formData.quantidade) || 1) - (parseFloat(formData.desconto) || 0)) * 0.88).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Receita Esperada</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Carregando...</TableCell>
                  </TableRow>
                ) : orcamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Nenhum orçamento encontrado</TableCell>
                  </TableRow>
                ) : (
                  orcamentos.map((orc) => (
                    <TableRow key={orc.id_orcamento}>
                      <TableCell>{new Date(orc.data_orcamento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{orc.dim_cliente?.nome || '-'}</TableCell>
                      <TableCell>{orc.fato_servico?.nome_do_servico || '-'}</TableCell>
                      <TableCell>R$ {(parseFloat(String(orc.receita_esperada)) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge variant={
                          orc.situacao_do_pagamento === 'Pago' ? 'default' :
                          orc.situacao_do_pagamento === 'Pendente' ? 'secondary' : 'destructive'
                        }>
                          {orc.situacao_do_pagamento}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleExportPDF(orc)}
                          disabled={generatingPDF === orc.id_orcamento}
                          title="Exportar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(orc)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir este orçamento?')) {
                              deleteMutation.mutate(orc.id_orcamento);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}