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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit, DollarSign, TrendingDown } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { GlobalFilters, FilterState } from "@/components/filters/GlobalFilters";

export default function Despesas() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    dataInicio: "",
    dataFim: "",
    clienteId: "",
    empresaId: "",
    categoria: "",
    situacao: "",
  });
  const [formData, setFormData] = useState({
    valor_da_despesa: "",
    data_da_despesa: new Date().toISOString().split('T')[0],
    id_tipodespesa: "",
    id_servico: "",
    observacoes: "",
  });

  // Buscar despesas
  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ['despesas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_despesas')
        .select(`
          *,
          dim_tipodespesa(categoria, subcategoria, descricao),
          fato_servico(nome_do_servico)
        `)
        .order('data_da_despesa', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar tipos de despesa
  const { data: tiposDespesa = [] } = useQuery({
    queryKey: ['tipos-despesa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_tipodespesa')
        .select('*')
        .order('categoria');
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar serviços
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

  // Criar/Atualizar despesa
  const mutation = useMutation({
    mutationFn: async (data: typeof formData & { id_despesas?: string }) => {
      if (data.id_despesas) {
        const { error } = await supabase
          .from('fato_despesas')
          .update({
            valor_da_despesa: parseFloat(data.valor_da_despesa),
            data_da_despesa: data.data_da_despesa,
            id_tipodespesa: data.id_tipodespesa || null,
            id_servico: data.id_servico || null,
            observacoes: data.observacoes,
          })
          .eq('id_despesas', data.id_despesas);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fato_despesas').insert({
          valor_da_despesa: parseFloat(data.valor_da_despesa),
          data_da_despesa: data.data_da_despesa,
          id_tipodespesa: data.id_tipodespesa || null,
          id_servico: data.id_servico || null,
          observacoes: data.observacoes,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      toast.success(editingId ? "Despesa atualizada!" : "Despesa adicionada!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Deletar despesa
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fato_despesas').delete().eq('id_despesas', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      toast.success("Despesa excluída!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      valor_da_despesa: "",
      data_da_despesa: new Date().toISOString().split('T')[0],
      id_tipodespesa: "",
      id_servico: "",
      observacoes: "",
    });
    setEditingId(null);
  };

  const handleEdit = (despesa: any) => {
    setFormData({
      valor_da_despesa: despesa.valor_da_despesa.toString(),
      data_da_despesa: despesa.data_da_despesa,
      id_tipodespesa: despesa.id_tipodespesa || "",
      id_servico: despesa.id_servico || "",
      observacoes: despesa.observacoes || "",
    });
    setEditingId(despesa.id_despesas);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(editingId ? { ...formData, id_despesas: editingId } : formData);
  };

  // Calcular KPIs
  const totalDespesas = despesas.reduce((sum, d) => sum + parseFloat(String(d.valor_da_despesa || 0)), 0);
  const despesasPorCategoria = despesas.reduce((acc: any, d) => {
    const cat = d.dim_tipodespesa?.categoria || 'Sem categoria';
    acc[cat] = (acc[cat] || 0) + parseFloat(String(d.valor_da_despesa || 0));
    return acc;
  }, {});

  const chartData = Object.entries(despesasPorCategoria).map(([categoria, valor]) => ({
    categoria,
    valor,
  }));

  const filteredDespesas = despesas.filter(d => {
    const matchesSearch = 
      d.dim_tipodespesa?.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.dim_tipodespesa?.subcategoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.observacoes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDataInicio = !filters.dataInicio || d.data_da_despesa >= filters.dataInicio;
    const matchesDataFim = !filters.dataFim || d.data_da_despesa <= filters.dataFim;
    const matchesCategoria = !filters.categoria || d.dim_tipodespesa?.categoria === filters.categoria;

    return matchesSearch && matchesDataInicio && matchesDataFim && matchesCategoria;
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_cliente')
        .select('id_cliente, nome')
        .order('nome');
      if (error) throw error;
      return data.map(c => ({ id: c.id_cliente, nome: c.nome }));
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Despesas</h1>
          <p className="text-muted-foreground">Gerencie todas as despesas da empresa</p>
        </div>

        <GlobalFilters
          clientes={clientes}
          onFilterChange={setFilters}
          showEmpresa={false}
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <KPICard
            title="Total de Despesas"
            value={`R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            subtitle={`${despesas.length} lançamentos`}
          />
          <KPICard
            title="Despesas do Mês"
            value={`R$ ${despesas
              .filter(d => new Date(d.data_da_despesa).getMonth() === new Date().getMonth())
              .reduce((sum, d) => sum + parseFloat(String(d.valor_da_despesa)), 0)
              .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={TrendingDown}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoria" />
                <YAxis />
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="valor" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lista de Despesas</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Despesa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar" : "Adicionar"} Despesa</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="valor">Valor *</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      value={formData.valor_da_despesa}
                      onChange={(e) => setFormData({ ...formData, valor_da_despesa: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="data">Data *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={formData.data_da_despesa}
                      onChange={(e) => setFormData({ ...formData, data_da_despesa: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="tipo">Tipo de Despesa</Label>
                    <Select value={formData.id_tipodespesa} onValueChange={(v) => setFormData({ ...formData, id_tipodespesa: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposDespesa.map((t) => (
                          <SelectItem key={t.id_tipodespesa} value={t.id_tipodespesa}>
                            {t.categoria} - {t.subcategoria}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="servico">Serviço Vinculado</Label>
                    <Select value={formData.id_servico} onValueChange={(v) => setFormData({ ...formData, id_servico: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
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
                    <Label htmlFor="obs">Observações</Label>
                    <Textarea
                      id="obs"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Buscar despesas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Subcategoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Carregando...</TableCell>
                  </TableRow>
                ) : filteredDespesas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Nenhuma despesa encontrada</TableCell>
                  </TableRow>
                ) : (
                  filteredDespesas.map((despesa) => (
                    <TableRow key={despesa.id_despesas}>
                      <TableCell>{new Date(despesa.data_da_despesa).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{despesa.dim_tipodespesa?.categoria || '-'}</TableCell>
                      <TableCell>{despesa.dim_tipodespesa?.subcategoria || '-'}</TableCell>
                      <TableCell>R$ {parseFloat(String(despesa.valor_da_despesa)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{despesa.fato_servico?.nome_do_servico || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(despesa)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja excluir esta despesa?')) {
                              deleteMutation.mutate(despesa.id_despesas);
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