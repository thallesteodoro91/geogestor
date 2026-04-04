import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";
import { FilterBar } from "@/components/layout/FilterBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TipoDespesaDialog } from "@/components/cadastros/TipoDespesaDialog";
import { TipoServicoDialog } from "@/components/cadastros/TipoServicoDialog";

export default function Cadastros() {
  const [searchServico, setSearchServico] = useState("");
  const [searchDespesa, setSearchDespesa] = useState("");
  const [tiposDespesa, setTiposDespesa] = useState<any[]>([]);
  const [tiposServico, setTiposServico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [tipoDespesaDialog, setTipoDespesaDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [tipoServicoDialog, setTipoServicoDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; table?: string; id?: string }>({ open: false });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tiposDespesaRes, tiposServicoRes] = await Promise.all([
        supabase.from('dim_tipodespesa').select('*').order('categoria'),
        supabase.from('dim_tiposervico').select('*').order('nome'),
      ]);
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
        <PageHeader title="Cadastros" subtitle="Configure tipos de serviço e categorias de despesa do sistema" />

        <Tabs defaultValue="servicos" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="servicos">Tipos de Serviço</TabsTrigger>
            <TabsTrigger value="despesas">Tipos de Despesa</TabsTrigger>
          </TabsList>

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
