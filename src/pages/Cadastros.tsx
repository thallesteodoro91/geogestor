import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClienteDialog } from "@/components/cadastros/ClienteDialog";
import { EmpresaDialog } from "@/components/cadastros/EmpresaDialog";
import { PropriedadeDialog } from "@/components/cadastros/PropriedadeDialog";
import { TipoDespesaDialog } from "@/components/cadastros/TipoDespesaDialog";

export default function Cadastros() {
  const [searchTerm, setSearchTerm] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [clienteDialog, setClienteDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [empresaDialog, setEmpresaDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [propriedadeDialog, setPropriedadeDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [tipoDespesaDialog, setTipoDespesaDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  
  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; table?: string; id?: string }>({ open: false });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientesRes, empresasRes, propriedadesRes, tiposDespesaRes] = await Promise.all([
        supabase.from('dim_cliente').select('*').order('nome'),
        supabase.from('dim_empresa').select('*').order('nome'),
        supabase.from('dim_propriedade').select('*').order('nome_da_propriedade'),
        supabase.from('dim_tipodespesa').select('*').order('categoria'),
      ]);

      if (clientesRes.data) setClientes(clientesRes.data);
      if (empresasRes.data) setEmpresas(empresasRes.data);
      if (propriedadesRes.data) setPropriedades(propriedadesRes.data);
      if (tiposDespesaRes.data) setTiposDespesa(tiposDespesaRes.data);
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
        case 'empresa':
          ({ error } = await supabase
            .from('dim_empresa')
            .delete()
            .eq('id_empresa', deleteDialog.id));
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
        default:
          return;
      }
      
      if (error) throw error;
      
      toast.success("Registro excluído com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir registro");
    } finally {
      setDeleteDialog({ open: false });
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Base de Dados</h1>
          <p className="text-muted-foreground mt-2">Gerenciar clientes, empresas, propriedades e tipos de despesa</p>
        </div>

        <Tabs defaultValue="clientes" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="empresas">Empresas</TabsTrigger>
            <TabsTrigger value="propriedades">Propriedades</TabsTrigger>
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
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredClientes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhum cliente encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredClientes.map((cliente) => (
                          <TableRow key={cliente.id_cliente}>
                            <TableCell className="font-medium">{cliente.nome}</TableCell>
                            <TableCell>{cliente.cpf || cliente.cnpj || '-'}</TableCell>
                            <TableCell>{cliente.email || '-'}</TableCell>
                            <TableCell>{cliente.telefone || '-'}</TableCell>
                            <TableCell>{cliente.situacao || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
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

          {/* Empresas */}
          <TabsContent value="empresas" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Empresas</CardTitle>
                  <Button className="gap-2" onClick={() => setEmpresaDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Adicionar Empresa
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8">Carregando...</TableCell>
                        </TableRow>
                      ) : empresas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                            Nenhuma empresa encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        empresas.map((empresa) => (
                          <TableRow key={empresa.id_empresa}>
                            <TableCell className="font-medium">{empresa.nome}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setEmpresaDialog({ open: true, data: empresa })}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setDeleteDialog({ open: true, table: 'empresa', id: empresa.id_empresa })}
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Área (ha)</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell>
                        </TableRow>
                      ) : propriedades.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhuma propriedade encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        propriedades.map((prop) => (
                          <TableRow key={prop.id_propriedade}>
                            <TableCell className="font-medium">{prop.nome_da_propriedade}</TableCell>
                            <TableCell>{prop.area_ha || '-'}</TableCell>
                            <TableCell>{prop.cidade || '-'}</TableCell>
                            <TableCell>{prop.situacao || '-'}</TableCell>
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

          {/* Tipos de Despesa */}
          <TabsContent value="despesas" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Tipos de Despesa</CardTitle>
                  <Button className="gap-2" onClick={() => setTipoDespesaDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Adicionar Tipo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Subcategoria</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                        </TableRow>
                      ) : tiposDespesa.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhum tipo de despesa encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        tiposDespesa.map((tipo) => (
                          <TableRow key={tipo.id_tipodespesa}>
                            <TableCell className="font-medium">{tipo.categoria}</TableCell>
                            <TableCell>{tipo.subcategoria || '-'}</TableCell>
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
      
      <EmpresaDialog 
        open={empresaDialog.open} 
        onOpenChange={(open) => setEmpresaDialog({ open })}
        empresa={empresaDialog.data}
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

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
