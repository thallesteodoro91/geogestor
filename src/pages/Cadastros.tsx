import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Eye, Users, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClientePropriedadeUnificadoDialog } from "@/components/cadastros/ClientePropriedadeUnificadoDialog";
import { ClienteDialog } from "@/components/cadastros/ClienteDialog";
import { PropriedadeDialog } from "@/components/cadastros/PropriedadeDialog";
import { TipoDespesaDialog } from "@/components/cadastros/TipoDespesaDialog";
import { TipoServicoDialog } from "@/components/cadastros/TipoServicoDialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Cadastros() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchServico, setSearchServico] = useState("");
  const [searchDespesa, setSearchDespesa] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<any[]>([]);
  const [tiposServico, setTiposServico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [clienteUnificadoDialog, setClienteUnificadoDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [clienteDialog, setClienteDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [propriedadeDialog, setPropriedadeDialog] = useState<{ open: boolean; data?: any; clienteId?: string }>({ open: false });
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

  // Filtro unificado para clientes e propriedades
  const filteredClientes = clientes.filter(c => 
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Propriedades por cliente
  const getPropriedadesByCliente = (clienteId: string) => {
    return propriedades.filter(p => p.id_cliente === clienteId);
  };

  // Propriedades sem cliente (órfãs)
  const propriedadesSemCliente = propriedades.filter(p => !p.id_cliente);

  const toggleClientExpanded = (clienteId: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clienteId)) {
        newSet.delete(clienteId);
      } else {
        newSet.add(clienteId);
      }
      return newSet;
    });
  };

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

        <Tabs defaultValue="clientes-propriedades" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clientes-propriedades" className="gap-2">
              <Users className="h-4 w-4" />
              Clientes e Propriedades
            </TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="despesas">Tipos de Despesa</TabsTrigger>
          </TabsList>

          {/* Clientes e Propriedades Unificado */}
          <TabsContent value="clientes-propriedades" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-primary" />
                    Clientes e Propriedades
                  </CardTitle>
                  <Button size="sm" className="gap-2" onClick={() => setClienteUnificadoDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Novo Cliente
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-9 h-9 text-sm"
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Propriedades</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredClientes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            Nenhum cliente encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredClientes.map((cliente) => {
                          const clientePropriedades = getPropriedadesByCliente(cliente.id_cliente);
                          const isExpanded = expandedClients.has(cliente.id_cliente);
                          
                          return (
                            <Collapsible key={cliente.id_cliente} asChild open={isExpanded}>
                              <>
                                <TableRow className="hover:bg-muted/50">
                                  <TableCell>
                                    {clientePropriedades.length > 0 && (
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => toggleClientExpanded(cliente.id_cliente)}
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </CollapsibleTrigger>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <button
                                      onClick={() => navigate(`/clientes/${cliente.id_cliente}`)}
                                      className="text-primary hover:underline font-medium flex items-center gap-2"
                                    >
                                      <Users className="h-4 w-4" />
                                      {cliente.nome}
                                    </button>
                                  </TableCell>
                                  <TableCell>{cliente.cpf || cliente.cnpj || '-'}</TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      {cliente.email && <div>{cliente.email}</div>}
                                      {cliente.telefone && <div className="text-muted-foreground">{cliente.telefone}</div>}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {clientePropriedades.length}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {cliente.situacao && (
                                      <Badge 
                                        variant={cliente.situacao === 'Ativo' ? 'default' : 'secondary'}
                                        className={cliente.situacao === 'Ativo' ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30' : ''}
                                      >
                                        {cliente.situacao}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-[150px] truncate" title={cliente.anotacoes || ''}>
                                    {cliente.anotacoes || '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
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
                                        onClick={() => setPropriedadeDialog({ open: true, clienteId: cliente.id_cliente })}
                                        title="Adicionar Propriedade"
                                      >
                                        <MapPin className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => setClienteUnificadoDialog({ open: true, data: cliente })}
                                        title="Editar Cliente"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => setDeleteDialog({ open: true, table: 'cliente', id: cliente.id_cliente })}
                                        title="Excluir Cliente"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                
                                {/* Propriedades do cliente (expandível) */}
                                <CollapsibleContent asChild>
                                  <>
                                    {clientePropriedades.map((prop) => (
                                      <TableRow key={prop.id_propriedade} className="bg-muted/30">
                                        <TableCell></TableCell>
                                        <TableCell className="pl-8">
                                          <div className="flex items-center gap-2 text-sm">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{prop.nome_da_propriedade}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {prop.area_ha ? `${prop.area_ha} ha` : '-'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {prop.cidade || prop.municipio || '-'}
                                        </TableCell>
                                        <TableCell></TableCell>
                                        <TableCell>
                                          {prop.situacao && (
                                            <Badge variant="outline" className="text-xs">
                                              {prop.situacao}
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="max-w-[150px] truncate text-sm" title={prop.observacoes || ''}>
                                          {prop.observacoes || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex justify-end gap-1">
                                            <Button 
                                              variant="ghost" 
                                              size="icon"
                                              className="h-8 w-8"
                                              onClick={() => setPropriedadeDialog({ open: true, data: prop })}
                                              title="Editar Propriedade"
                                            >
                                              <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button 
                                              variant="ghost" 
                                              size="icon"
                                              className="h-8 w-8"
                                              onClick={() => setDeleteDialog({ open: true, table: 'propriedade', id: prop.id_propriedade })}
                                              title="Excluir Propriedade"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </>
                                </CollapsibleContent>
                              </>
                            </Collapsible>
                          );
                        })
                      )}
                      
                      {/* Propriedades sem cliente */}
                      {propriedadesSemCliente.length > 0 && (
                        <>
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/50 py-2">
                              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Propriedades sem cliente vinculado ({propriedadesSemCliente.length})
                              </span>
                            </TableCell>
                          </TableRow>
                          {propriedadesSemCliente.map((prop) => (
                            <TableRow key={prop.id_propriedade} className="bg-muted/20">
                              <TableCell></TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{prop.nome_da_propriedade}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {prop.area_ha ? `${prop.area_ha} ha` : '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {prop.cidade || prop.municipio || '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Sem cliente
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {prop.situacao && (
                                  <Badge variant="outline" className="text-xs">
                                    {prop.situacao}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate text-sm" title={prop.observacoes || ''}>
                                {prop.observacoes || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setPropriedadeDialog({ open: true, data: prop })}
                                    title="Editar Propriedade"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setDeleteDialog({ open: true, table: 'propriedade', id: prop.id_propriedade })}
                                    title="Excluir Propriedade"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
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
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Tipos de Serviço</CardTitle>
                  <Button size="sm" className="gap-2" onClick={() => setTipoServicoDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-9 h-9 text-sm"
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
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Tipos de Despesa</CardTitle>
                  <Button size="sm" className="gap-2" onClick={() => setTipoDespesaDialog({ open: true })}>
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-9 h-9 text-sm"
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
      <ClientePropriedadeUnificadoDialog 
        open={clienteUnificadoDialog.open} 
        onOpenChange={(open) => setClienteUnificadoDialog({ open })}
        cliente={clienteUnificadoDialog.data}
        onSuccess={fetchData}
      />

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
        defaultClienteId={propriedadeDialog.clienteId}
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
