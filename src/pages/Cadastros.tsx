import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";
import { FilterBar } from "@/components/layout/FilterBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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

  const [clienteUnificadoDialog, setClienteUnificadoDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [clienteDialog, setClienteDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [propriedadeDialog, setPropriedadeDialog] = useState<{ open: boolean; data?: any; clienteId?: string }>({ open: false });
  const [tipoDespesaDialog, setTipoDespesaDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [tipoServicoDialog, setTipoServicoDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; table?: string; id?: string }>({ open: false });

  useEffect(() => { fetchData(); }, []);

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
    } catch {
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
        case 'cliente': ({ error } = await supabase.from('dim_cliente').delete().eq('id_cliente', deleteDialog.id)); break;
        case 'propriedade': ({ error } = await supabase.from('dim_propriedade').delete().eq('id_propriedade', deleteDialog.id)); break;
        case 'tipodespesa': ({ error } = await supabase.from('dim_tipodespesa').delete().eq('id_tipodespesa', deleteDialog.id)); break;
        case 'tiposervico': ({ error } = await supabase.from('dim_tiposervico').delete().eq('id_tiposervico', deleteDialog.id)); break;
        default: return;
      }
      if (error) {
        if (error.code === '23503' || error.message?.includes('foreign key') || error.message?.includes('violates')) {
          throw new Error('Este registro possui dependências. Remova as dependências antes de excluir.');
        }
        throw error;
      }
      toast.success("Registro excluído com sucesso!");
      setDeleteDialog({ open: false });
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir registro.");
      setDeleteDialog({ open: false });
    }
  };

  const filteredClientes = clientes.filter(c =>
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPropriedadesByCliente = (clienteId: string) => propriedades.filter(p => p.id_cliente === clienteId);
  const propriedadesSemCliente = propriedades.filter(p => !p.id_cliente);

  const toggleClientExpanded = (clienteId: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clienteId)) newSet.delete(clienteId); else newSet.add(clienteId);
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
        <PageHeader title="Cadastros" subtitle="Configure os dados base do sistema: clientes, tipos de serviço e categorias de despesa" />

        <Tabs defaultValue="clientes-propriedades" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clientes-propriedades" className="gap-2"><Users className="h-4 w-4" />Clientes e Propriedades</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="despesas">Tipos de Despesa</TabsTrigger>
          </TabsList>

          {/* Clientes e Propriedades */}
          <TabsContent value="clientes-propriedades" className="space-y-6">
            <PageContent>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Clientes e Propriedades</h3>
                <Button size="sm" className="gap-2" onClick={() => setClienteUnificadoDialog({ open: true })}><Plus className="h-4 w-4" />Novo Cliente</Button>
              </div>
              <FilterBar searchValue={searchTerm} onSearchChange={setSearchTerm} searchPlaceholder="Buscar..." />
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
                      <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
                    ) : filteredClientes.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
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
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleClientExpanded(cliente.id_cliente)}>
                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      </Button>
                                    </CollapsibleTrigger>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">
                                  <button onClick={() => navigate(`/clientes/${cliente.id_cliente}`)} className="text-primary hover:underline font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />{cliente.nome}
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
                                  {clientePropriedades.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                      {clientePropriedades.slice(0, 2).map((prop: any) => (
                                        <Badge key={prop.id_propriedade} variant="secondary" className="gap-1 text-xs"><MapPin className="h-3 w-3" />{prop.nome_da_propriedade}</Badge>
                                      ))}
                                      {clientePropriedades.length > 2 && <span className="text-xs text-muted-foreground">+{clientePropriedades.length - 2} mais</span>}
                                    </div>
                                  ) : <span className="text-muted-foreground text-sm">-</span>}
                                </TableCell>
                                <TableCell>
                                  {cliente.situacao && (
                                    <Badge variant={cliente.situacao === 'Ativo' ? 'default' : 'secondary'} className={cliente.situacao === 'Ativo' ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30' : cliente.situacao === 'Inativo' ? 'bg-red-500/20 text-red-700 hover:bg-red-500/30' : ''}>
                                      {cliente.situacao}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate" title={cliente.anotacoes || ''}>{cliente.anotacoes || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => navigate(`/clientes/${cliente.id_cliente}`)} title="Ver Detalhes"><Eye className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setPropriedadeDialog({ open: true, clienteId: cliente.id_cliente })} title="Adicionar Propriedade"><MapPin className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setClienteUnificadoDialog({ open: true, data: cliente })} title="Editar Cliente"><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, table: 'cliente', id: cliente.id_cliente })} title="Excluir Cliente"><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <CollapsibleContent asChild>
                                <>
                                  {clientePropriedades.map((prop) => (
                                    <TableRow key={prop.id_propriedade} className="bg-muted/30">
                                      <TableCell></TableCell>
                                      <TableCell className="pl-8">
                                        <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{prop.nome_da_propriedade}</div>
                                      </TableCell>
                                      <TableCell className="text-sm">{prop.municipio || '-'}</TableCell>
                                      <TableCell className="text-sm">{prop.area_ha ? `${prop.area_ha} ha` : '-'}</TableCell>
                                      <TableCell colSpan={2}></TableCell>
                                      <TableCell></TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button variant="ghost" size="icon" onClick={() => setPropriedadeDialog({ open: true, data: prop })} title="Editar Propriedade"><Edit className="h-4 w-4" /></Button>
                                          <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, table: 'propriedade', id: prop.id_propriedade })} title="Excluir Propriedade"><Trash2 className="h-4 w-4" /></Button>
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
                    {propriedadesSemCliente.length > 0 && (
                      <>
                        <TableRow><TableCell colSpan={8} className="bg-muted/50 text-sm font-medium py-2 pl-4">Propriedades sem cliente vinculado</TableCell></TableRow>
                        {propriedadesSemCliente.map((prop) => (
                          <TableRow key={prop.id_propriedade} className="bg-amber-50/50 dark:bg-amber-950/20">
                            <TableCell></TableCell>
                            <TableCell><div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-amber-500" />{prop.nome_da_propriedade}</div></TableCell>
                            <TableCell className="text-sm">{prop.municipio || '-'}</TableCell>
                            <TableCell className="text-sm">{prop.area_ha ? `${prop.area_ha} ha` : '-'}</TableCell>
                            <TableCell colSpan={2}><Badge variant="outline" className="text-amber-600 border-amber-300">Sem cliente</Badge></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setPropriedadeDialog({ open: true, data: prop })} title="Editar"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, table: 'propriedade', id: prop.id_propriedade })} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </PageContent>
          </TabsContent>

          {/* Serviços */}
          <TabsContent value="servicos" className="space-y-6">
            <PageContent>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Tipos de Serviço</h3>
                <Button size="sm" className="gap-2" onClick={() => setTipoServicoDialog({ open: true })}><Plus className="h-4 w-4" />Novo Tipo</Button>
              </div>
              <FilterBar searchValue={searchServico} onSearchChange={setSearchServico} searchPlaceholder="Buscar tipo de serviço..." />
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor Sugerido</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
                    ) : filteredTiposServico.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum tipo de serviço encontrado</TableCell></TableRow>
                    ) : (
                      filteredTiposServico.map((tipo) => (
                        <TableRow key={tipo.id_tiposervico}>
                          <TableCell className="font-medium">{tipo.nome}</TableCell>
                          <TableCell>{tipo.categoria || '-'}</TableCell>
                          <TableCell>{tipo.valor_sugerido ? `R$ ${tipo.valor_sugerido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setTipoServicoDialog({ open: true, data: tipo })}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, table: 'tiposervico', id: tipo.id_tiposervico })}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </PageContent>
          </TabsContent>

          {/* Despesas */}
          <TabsContent value="despesas" className="space-y-6">
            <PageContent>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Tipos de Despesa</h3>
                <Button size="sm" className="gap-2" onClick={() => setTipoDespesaDialog({ open: true })}><Plus className="h-4 w-4" />Novo Tipo</Button>
              </div>
              <FilterBar searchValue={searchDespesa} onSearchChange={setSearchDespesa} searchPlaceholder="Buscar tipo de despesa..." />
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
                      <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
                    ) : filteredTiposDespesa.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum tipo de despesa encontrado</TableCell></TableRow>
                    ) : (
                      filteredTiposDespesa.map((tipo) => (
                        <TableRow key={tipo.id_tipodespesa}>
                          <TableCell className="font-medium">{tipo.categoria}</TableCell>
                          <TableCell>{tipo.subcategoria || '-'}</TableCell>
                          <TableCell>{tipo.descricao || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setTipoDespesaDialog({ open: true, data: tipo })}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, table: 'tipodespesa', id: tipo.id_tipodespesa })}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </PageContent>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <ClientePropriedadeUnificadoDialog
          open={clienteUnificadoDialog.open}
          onOpenChange={(open) => setClienteUnificadoDialog({ open })}
          cliente={clienteUnificadoDialog.data}
          onSuccess={() => { fetchData(); setClienteUnificadoDialog({ open: false }); }}
        />
        <ClienteDialog open={clienteDialog.open} onOpenChange={(open) => setClienteDialog({ open })} cliente={clienteDialog.data} onSuccess={() => { fetchData(); setClienteDialog({ open: false }); }} />
        <PropriedadeDialog open={propriedadeDialog.open} onOpenChange={(open) => setPropriedadeDialog({ open })} propriedade={propriedadeDialog.data} defaultClienteId={propriedadeDialog.clienteId} onSuccess={() => { fetchData(); setPropriedadeDialog({ open: false }); }} />
        <TipoDespesaDialog open={tipoDespesaDialog.open} onOpenChange={(open) => setTipoDespesaDialog({ open })} tipoDespesa={tipoDespesaDialog.data} onSuccess={() => { fetchData(); setTipoDespesaDialog({ open: false }); }} />
        <TipoServicoDialog open={tipoServicoDialog.open} onOpenChange={(open) => setTipoServicoDialog({ open })} tipoServico={tipoServicoDialog.data} onSuccess={() => { fetchData(); setTipoServicoDialog({ open: false }); }} />

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
