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
import { Plus, Trash2, Edit, Briefcase, CheckCircle2, Clock } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobalFilters, FilterState } from "@/components/filters/GlobalFilters";
import { servicoSchema } from "@/lib/validations";

export default function Servicos() {
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
    nome_do_servico: "",
    categoria: "",
    situacao_do_servico: "Em Andamento",
    data_do_servico_inicio: new Date().toISOString().split('T')[0],
    data_do_servico_fim: "",
    id_cliente: "",
    id_propriedade: "",
    receita_servico: "",
    custo_servico: "",
  });

  const { data: servicos = [], isLoading } = useQuery({
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

  const { data: propriedades = [] } = useQuery({
    queryKey: ['propriedades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_propriedade')
        .select('id_propriedade, nome_da_propriedade')
        .order('nome_da_propriedade');
      if (error) throw error;
      return data || [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData & { id_servico?: string }) => {
      if (data.id_servico) {
        const { error } = await supabase
          .from('fato_servico')
          .update({
            nome_do_servico: data.nome_do_servico,
            categoria: data.categoria,
            situacao_do_servico: data.situacao_do_servico,
            data_do_servico_inicio: data.data_do_servico_inicio,
            data_do_servico_fim: data.data_do_servico_fim || null,
            id_cliente: data.id_cliente || null,
            id_propriedade: data.id_propriedade || null,
            receita_servico: data.receita_servico ? parseFloat(data.receita_servico) : 0,
            custo_servico: data.custo_servico ? parseFloat(data.custo_servico) : 0,
          })
          .eq('id_servico', data.id_servico);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fato_servico').insert({
          nome_do_servico: data.nome_do_servico,
          categoria: data.categoria,
          situacao_do_servico: data.situacao_do_servico,
          data_do_servico_inicio: data.data_do_servico_inicio,
          data_do_servico_fim: data.data_do_servico_fim || null,
          id_cliente: data.id_cliente || null,
          id_propriedade: data.id_propriedade || null,
          receita_servico: data.receita_servico ? parseFloat(data.receita_servico) : 0,
          custo_servico: data.custo_servico ? parseFloat(data.custo_servico) : 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success(editingId ? "Serviço atualizado!" : "Serviço adicionado!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fato_servico').delete().eq('id_servico', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success("Serviço excluído!");
    },
  });

  const resetForm = () => {
    setFormData({
      nome_do_servico: "",
      categoria: "",
      situacao_do_servico: "Em Andamento",
      data_do_servico_inicio: new Date().toISOString().split('T')[0],
      data_do_servico_fim: "",
      id_cliente: "",
      id_propriedade: "",
      receita_servico: "",
      custo_servico: "",
    });
    setEditingId(null);
  };

  const handleEdit = (servico: any) => {
    setFormData({
      nome_do_servico: servico.nome_do_servico,
      categoria: servico.categoria || "",
      situacao_do_servico: servico.situacao_do_servico,
      data_do_servico_inicio: servico.data_do_servico_inicio,
      data_do_servico_fim: servico.data_do_servico_fim || "",
      id_cliente: servico.id_cliente || "",
      id_propriedade: servico.id_propriedade || "",
      receita_servico: servico.receita_servico?.toString() || "",
      custo_servico: servico.custo_servico?.toString() || "",
    });
    setEditingId(servico.id_servico);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = servicoSchema.parse({
        nome_do_servico: formData.nome_do_servico,
        id_cliente: formData.id_cliente || null,
        id_propriedade: formData.id_propriedade || null,
        categoria: formData.categoria || null,
        data_do_servico_inicio: formData.data_do_servico_inicio || null,
        data_do_servico_fim: formData.data_do_servico_fim || null,
        situacao_do_servico: formData.situacao_do_servico || null,
        receita_servico: formData.receita_servico ? parseFloat(formData.receita_servico) : null,
        custo_servico: formData.custo_servico ? parseFloat(formData.custo_servico) : null,
      });
      
      const dataToSubmit = {
        nome_do_servico: validatedData.nome_do_servico,
        categoria: validatedData.categoria || "",
        situacao_do_servico: validatedData.situacao_do_servico || "Em Andamento",
        data_do_servico_inicio: validatedData.data_do_servico_inicio || "",
        data_do_servico_fim: validatedData.data_do_servico_fim || "",
        id_cliente: validatedData.id_cliente || "",
        id_propriedade: validatedData.id_propriedade || "",
        receita_servico: validatedData.receita_servico?.toString() || "",
        custo_servico: validatedData.custo_servico?.toString() || "",
      };
      
      mutation.mutate(editingId ? { ...dataToSubmit, id_servico: editingId } : dataToSubmit);
    } catch (error: any) {
      if (error.errors) {
        error.errors.forEach((err: any) => toast.error(err.message));
      } else {
        toast.error("Erro na validação dos dados");
      }
    }
  };

  const servicosConcluidos = servicos.filter(s => s.situacao_do_servico === 'Concluído').length;
  const servicosEmAndamento = servicos.filter(s => s.situacao_do_servico === 'Em Andamento').length;

  const filteredServicos = servicos.filter(s => {
    const matchesSearch = 
      s.nome_do_servico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.dim_cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDataInicio = !filters.dataInicio || s.data_do_servico_inicio >= filters.dataInicio;
    const matchesDataFim = !filters.dataFim || (s.data_do_servico_fim && s.data_do_servico_fim <= filters.dataFim);
    const matchesCliente = !filters.clienteId || s.id_cliente === filters.clienteId;
    const matchesCategoria = !filters.categoria || s.categoria === filters.categoria;
    const matchesSituacao = !filters.situacao || s.situacao_do_servico === filters.situacao;

    return matchesSearch && matchesDataInicio && matchesDataFim && matchesCliente && matchesCategoria && matchesSituacao;
  });

  const { data: clientesFilter = [] } = useQuery({
    queryKey: ['clientes-filter'],
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
          <h1 className="text-3xl font-heading font-bold text-foreground">Serviços</h1>
          <p className="text-muted-foreground">Gerencie todos os serviços da empresa</p>
        </div>

        <GlobalFilters
          clientes={clientesFilter}
          onFilterChange={setFilters}
          showEmpresa={false}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <KPICard
            title="Total de Serviços"
            value={servicos.length.toString()}
            icon={Briefcase}
          />
          <KPICard
            title="Concluídos"
            value={servicosConcluidos.toString()}
            icon={CheckCircle2}
            change={`${((servicosConcluidos / servicos.length) * 100 || 0).toFixed(0)}%`}
            changeType="positive"
          />
          <KPICard
            title="Em Andamento"
            value={servicosEmAndamento.toString()}
            icon={Clock}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lista de Serviços</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar" : "Adicionar"} Serviço</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome do Serviço *</Label>
                      <Input
                        id="nome"
                        value={formData.nome_do_servico}
                        onChange={(e) => setFormData({ ...formData, nome_do_servico: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="categoria">Categoria *</Label>
                      <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Topografia">Topografia</SelectItem>
                          <SelectItem value="Ambiental">Ambiental</SelectItem>
                          <SelectItem value="Jurídico">Jurídico</SelectItem>
                          <SelectItem value="Especial">Especial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="situacao">Situação *</Label>
                      <Select value={formData.situacao_do_servico} onValueChange={(v) => setFormData({ ...formData, situacao_do_servico: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                          <SelectItem value="Concluído">Concluído</SelectItem>
                          <SelectItem value="Cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="cliente">Cliente</Label>
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
                      <Label htmlFor="propriedade">Propriedade</Label>
                      <Select value={formData.id_propriedade} onValueChange={(v) => setFormData({ ...formData, id_propriedade: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {propriedades.map((p) => (
                            <SelectItem key={p.id_propriedade} value={p.id_propriedade}>
                              {p.nome_da_propriedade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="inicio">Data Início *</Label>
                      <Input
                        id="inicio"
                        type="date"
                        value={formData.data_do_servico_inicio}
                        onChange={(e) => setFormData({ ...formData, data_do_servico_inicio: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="fim">Data Fim</Label>
                      <Input
                        id="fim"
                        type="date"
                        value={formData.data_do_servico_fim}
                        onChange={(e) => setFormData({ ...formData, data_do_servico_fim: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="receita">Receita</Label>
                      <Input
                        id="receita"
                        type="number"
                        step="0.01"
                        value={formData.receita_servico}
                        onChange={(e) => setFormData({ ...formData, receita_servico: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="custo">Custo</Label>
                      <Input
                        id="custo"
                        type="number"
                        step="0.01"
                        value={formData.custo_servico}
                        onChange={(e) => setFormData({ ...formData, custo_servico: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="todos" className="w-full">
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
                <TabsTrigger value="andamento">Em Andamento</TabsTrigger>
              </TabsList>
              <TabsContent value="todos" className="space-y-4">
                <Input
                  placeholder="Buscar serviços..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">Carregando...</TableCell>
                      </TableRow>
                    ) : filteredServicos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">Nenhum serviço encontrado</TableCell>
                      </TableRow>
                    ) : (
                      filteredServicos.map((servico) => (
                        <TableRow key={servico.id_servico}>
                          <TableCell className="font-medium">{servico.nome_do_servico}</TableCell>
                          <TableCell>{servico.categoria || '-'}</TableCell>
                          <TableCell>{servico.dim_cliente?.nome || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={
                              servico.situacao_do_servico === 'Concluído' ? 'default' :
                              servico.situacao_do_servico === 'Em Andamento' ? 'secondary' : 'destructive'
                            }>
                              {servico.situacao_do_servico}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(servico.data_do_servico_inicio).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(servico)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja excluir este serviço?')) {
                                  deleteMutation.mutate(servico.id_servico);
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
              </TabsContent>
              <TabsContent value="concluidos">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicos.filter(s => s.situacao_do_servico === 'Concluído').map((servico) => (
                      <TableRow key={servico.id_servico}>
                        <TableCell>{servico.nome_do_servico}</TableCell>
                        <TableCell>{servico.dim_cliente?.nome || '-'}</TableCell>
                        <TableCell>{servico.data_do_servico_fim ? new Date(servico.data_do_servico_fim).toLocaleDateString('pt-BR') : '-'}</TableCell>
                        <TableCell className="text-right">R$ {(servico.receita_servico || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="andamento">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Categoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicos.filter(s => s.situacao_do_servico === 'Em Andamento').map((servico) => (
                      <TableRow key={servico.id_servico}>
                        <TableCell>{servico.nome_do_servico}</TableCell>
                        <TableCell>{servico.dim_cliente?.nome || '-'}</TableCell>
                        <TableCell>{new Date(servico.data_do_servico_inicio).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{servico.categoria || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}