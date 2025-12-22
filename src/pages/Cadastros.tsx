import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClienteDialog } from "@/components/cadastros/ClienteDialog";
import { PropriedadeDialog } from "@/components/cadastros/PropriedadeDialog";
import { TipoDespesaDialog } from "@/components/cadastros/TipoDespesaDialog";
import { TipoServicoDialog } from "@/components/cadastros/TipoServicoDialog";

export default function Cadastros() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchPropriedade, setSearchPropriedade] = useState("");
  const [searchServico, setSearchServico] = useState("");
  const [searchDespesa, setSearchDespesa] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<any[]>([]);
  const [tiposServico, setTiposServico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [clienteDialog, setClienteDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [propriedadeDialog, setPropriedadeDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [tipoDespesaDialog, setTipoDespesaDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [tipoServicoDialog, setTipoServicoDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  
  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; table?: string; id?: string }>({ open: false });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientesRes, propriedadesRes, tiposDespesaRes, tiposServicoRes] = await Promise.all([
        supabase.from('dim_cliente').select('*').order('nome'),
        supabase.from('dim_propriedade').select('*, dim_cliente(nome)').order('nome_da_propriedade'),
        supabase.from('dim_tipodespesa').select('*').order('categoria'),
        supabase.from('dim_tiposervico').select('*').order('nome'),
      ]);

      if (clientesRes.data) setClientes(clientesRes.data);
      if (propriedadesRes.data) setPropriedades(propriedadesRes.data);
      if (tiposDespesaRes.data) setTiposDespesa(tiposDespesaRes.data);
      if (tiposServicoRes.data) setTiposServico(tiposServicoRes.data);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.table || !deleteDialog.id) return;
    
    try {
      let error;
      
      switch (deleteDialog.table) {
        case 'cliente':
          ({ error } = await supabase
            .from('dim_cliente')
            .delete()
            .eq('id_cliente', deleteDialog.id));
          break;
        case 'propriedade':
          ({ error } = await supabase
            .from('dim_propriedade')
            .delete()
            .eq('id_propriedade', deleteDialog.id));
          break;
        case 'tipodespesa':
          ({ error } = await supabase
            .from('dim_tipodespesa')
            .delete()
            .eq('id_tipodespesa', deleteDialog.id));
          break;
        case 'tiposervico':
          ({ error } = await supabase
            .from('dim_tiposervico')
            .delete()
            .eq('id_tiposervico', deleteDialog.id));
          break;
        default:
          return;
      }
      
      if (error) {
        console.error('Erro ao deletar:', error);
        throw error;
      }
      
      toast.success("Registro excluído com sucesso!");
      setDeleteDialog({ open: false });
      await fetchData();
    } catch (error: any) {
      console.error('Erro completo:', error);
      toast.error(error.message || "Erro ao excluir registro. Verifique as permissões.");
      setDeleteDialog({ open: false });
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPropriedades = propriedades.filter(p => 
    p.nome_da_propriedade?.toLowerCase().includes(searchPropriedade.toLowerCase()) ||
    p.dim_cliente?.nome?.toLowerCase().includes(searchPropriedade.toLowerCase()) ||
    p.cidade?.toLowerCase().includes(searchPropriedade.toLowerCase()) ||
    p.municipio?.toLowerCase().includes(searchPropriedade.toLowerCase())
  );

  const filteredTiposServico = tiposServico.filter(s =>
    s.nome?.toLowerCase().includes(searchServico.toLowerCase()) ||
    s.categoria?.toLowerCase().includes(searchServico.toLowerCase())
  );

  const filteredTiposDespesa = tiposDespesa.filter(t =>
    t.categoria?.toLowerCase().includes(searchDespesa.toLowerCase()) ||
    t.descricao?.toLowerCase().includes(searchDespesa.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Base de Dados</h1>
          <p className="text-muted-foreground mt-2">Gerenciar clientes, propriedades, serviços e tipos de despesa</p>
        </div>

        <Tabs defaultValue="clientes" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="propriedades">Propriedades</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="despesas">Tipos de Despesa</TabsTrigger>
          </TabsList>

          {/* Clientes */}
          <TabsContent value="clientes" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Clientes</CardTitle>
                  <Button className="gap-2" onClick={() => setClienteDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Adicionar Cliente
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CPF ou email..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredClientes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhum cliente encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredClientes.map((cliente) => (
                          <TableRow key={cliente.id_cliente}>
                            <TableCell className="font-medium">
                              <button
                                onClick={() => navigate(`/clientes/${cliente.id_cliente}`)}
                                className="text-primary hover:underline font-medium"
                              >
                                {cliente.nome}
                              </button>
                            </TableCell>
                            <TableCell>{cliente.cpf || cliente.cnpj || '-'}</TableCell>
                            <TableCell>{cliente.email || '-'}</TableCell>
                            <TableCell>{cliente.telefone || '-'}</TableCell>
                            <TableCell>{cliente.situacao || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={cliente.anotacoes || ''}>{cliente.anotacoes || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => navigate(`/clientes/${cliente.id_cliente}`)}
                                  title="Ver Detalhes"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setClienteDialog({ open: true, data: cliente })}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setDeleteDialog({ open: true, table: 'cliente', id: cliente.id_cliente })}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Propriedades */}
          <TabsContent value="propriedades" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Propriedades</CardTitle>
                  <Button className="gap-2" onClick={() => setPropriedadeDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Adicionar Propriedade
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, cliente ou cidade..."
                    className="pl-9"
                    value={searchPropriedade}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchPropriedade(e.target.value)}
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Área (ha)</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell>
                        </TableRow>
                      ) : filteredPropriedades.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhuma propriedade encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPropriedades.map((prop) => (
                          <TableRow key={prop.id_propriedade}>
                            <TableCell className="font-medium">{prop.nome_da_propriedade}</TableCell>
                            <TableCell>
                              {prop.dim_cliente?.nome ? (
                                <button
                                  onClick={() => navigate(`/clientes/${prop.id_cliente}`)}
                                  className="text-primary hover:underline"
                                >
                                  {prop.dim_cliente.nome}
                                </button>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>{prop.area_ha || '-'}</TableCell>
                            <TableCell>{prop.cidade || '-'}</TableCell>
                            <TableCell>{prop.situacao || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={prop.observacoes || ''}>{prop.observacoes || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setPropriedadeDialog({ open: true, data: prop })}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setDeleteDialog({ open: true, table: 'propriedade', id: prop.id_propriedade })}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Serviços */}
          <TabsContent value="servicos" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Serviços</CardTitle>
                  <Button className="gap-2" onClick={() => setTipoServicoDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Adicionar Serviço
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou categoria..."
                    className="pl-9"
                    value={searchServico}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchServico(e.target.value)}
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">Carregando...</TableCell>
                        </TableRow>
                      ) : filteredTiposServico.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            Nenhum serviço encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTiposServico.map((servico) => (
                          <TableRow key={servico.id_tiposervico}>
                            <TableCell className="font-medium">{servico.nome}</TableCell>
                            <TableCell>{servico.categoria || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setTipoServicoDialog({ open: true, data: servico })}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setDeleteDialog({ open: true, table: 'tiposervico', id: servico.id_tiposervico })}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tipos de Despesa */}
          <TabsContent value="despesas" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tipos de Despesa</CardTitle>
                  <Button className="gap-2" onClick={() => setTipoDespesaDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Adicionar Tipo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por categoria ou descrição..."
                    className="pl-9"
                    value={searchDespesa}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchDespesa(e.target.value)}
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">Carregando...</TableCell>
                        </TableRow>
                      ) : filteredTiposDespesa.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            Nenhum tipo de despesa encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTiposDespesa.map((tipo) => (
                          <TableRow key={tipo.id_tipodespesa}>
                            <TableCell className="font-medium">{tipo.categoria || '-'}</TableCell>
                            <TableCell>{tipo.descricao || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setTipoDespesaDialog({ open: true, data: tipo })}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setDeleteDialog({ open: true, table: 'tipodespesa', id: tipo.id_tipodespesa })}
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ClienteDialog 
        open={clienteDialog.open} 
        onOpenChange={(open) => setClienteDialog({ open })}
        cliente={clienteDialog.data}
        onSuccess={fetchData}
      />

      <PropriedadeDialog 
        open={propriedadeDialog.open} 
        onOpenChange={(open) => setPropriedadeDialog({ open })}
        propriedade={propriedadeDialog.data}
        onSuccess={fetchData}
      />

      <TipoDespesaDialog 
        open={tipoDespesaDialog.open} 
        onOpenChange={(open) => setTipoDespesaDialog({ open })}
        tipoDespesa={tipoDespesaDialog.data}
        onSuccess={fetchData}
      />

      <TipoServicoDialog 
        open={tipoServicoDialog.open} 
        onOpenChange={(open) => setTipoServicoDialog({ open })}
        tipoServico={tipoServicoDialog.data}
        onSuccess={fetchData}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Tem certeza que deseja excluir este registro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}