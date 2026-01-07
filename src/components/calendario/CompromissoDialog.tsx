import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Calendar, Loader2, FileText, Briefcase } from "lucide-react";

interface CompromissoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo?: "orcamento" | "servico";
  eventoId?: string;
}

export const CompromissoDialog = ({
  open,
  onOpenChange,
  tipo: tipoInicial = "orcamento",
  eventoId,
}: CompromissoDialogProps) => {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<"orcamento" | "servico">(tipoInicial);
  const [formData, setFormData] = useState({
    id_cliente: "",
    id_servico: "",
    id_propriedade: "",
    data_inicio: new Date().toISOString().split("T")[0],
    data_termino: "",
    valor_unitario: "",
    situacao: "Pendente",
    situacao_servico: "Planejado",
  });

  // Buscar clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dim_cliente")
        .select("id_cliente, nome")
        .order("nome");
      return data || [];
    },
  });

  // Buscar serviços
  const { data: servicos = [] } = useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fato_servico")
        .select("id_servico, nome_do_servico, categoria")
        .order("nome_do_servico");
      return data || [];
    },
  });

  // Buscar propriedades do cliente selecionado
  const { data: propriedades = [] } = useQuery({
    queryKey: ["propriedades", formData.id_cliente],
    queryFn: async () => {
      if (!formData.id_cliente) return [];
      const { data } = await supabase
        .from("dim_propriedade")
        .select("id_propriedade, nome_da_propriedade")
        .eq("id_cliente", formData.id_cliente)
        .order("nome_da_propriedade");
      return data || [];
    },
    enabled: !!formData.id_cliente,
  });

  // Mutation para criar orçamento
  const createOrcamento = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("fato_orcamento").insert([
        {
          id_cliente: data.id_cliente,
          id_servico: data.id_servico,
          id_propriedade: data.id_propriedade,
          data_orcamento: data.data_inicio,
          data_inicio: data.data_inicio,
          data_termino: data.data_termino || null,
          valor_unitario: parseFloat(data.valor_unitario),
          situacao: data.situacao,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendario-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-semanal"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-diario"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-tabela"] });
      toast.success("Orçamento criado com sucesso!");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar orçamento");
      console.error(error);
    },
  });

  // Mutation para criar serviço
  const createServico = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("fato_servico").insert([
        {
          nome_do_servico: "Novo Serviço",
          id_cliente: data.id_cliente,
          id_propriedade: data.id_propriedade,
          data_do_servico_inicio: data.data_inicio,
          data_do_servico_fim: data.data_termino || null,
          situacao_do_servico: data.situacao_servico,
          receita_servico: parseFloat(data.valor_unitario || 0),
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendario-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-semanal"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-diario"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-tabela"] });
      toast.success("Serviço criado com sucesso!");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar serviço");
      console.error(error);
    },
  });

  const resetForm = () => {
    setFormData({
      id_cliente: "",
      id_servico: "",
      id_propriedade: "",
      data_inicio: new Date().toISOString().split("T")[0],
      data_termino: "",
      valor_unitario: "",
      situacao: "Pendente",
      situacao_servico: "Planejado",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id_cliente || !formData.data_inicio) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (tipo === "orcamento") {
      createOrcamento.mutate(formData);
    } else {
      createServico.mutate(formData);
    }
  };

  const isLoading = createOrcamento.isPending || createServico.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {eventoId ? "Editar Compromisso" : "Novo Compromisso"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo compromisso no calendário
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orcamento" className="gap-2">
              <FileText className="h-4 w-4" />
              Orçamento
            </TabsTrigger>
            <TabsTrigger value="servico" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Serviço
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <TabsContent value="orcamento" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select
                    value={formData.id_cliente}
                    onValueChange={(v) => setFormData({ ...formData, id_cliente: v, id_propriedade: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
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

                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Select
                    value={formData.id_servico}
                    onValueChange={(v) => setFormData({ ...formData, id_servico: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
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

                <div className="space-y-2">
                  <Label>Propriedade</Label>
                  <Select
                    value={formData.id_propriedade}
                    onValueChange={(v) => setFormData({ ...formData, id_propriedade: v })}
                    disabled={!formData.id_cliente}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
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

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_unitario}
                    onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Término</Label>
                  <Input
                    type="date"
                    value={formData.data_termino}
                    onChange={(e) => setFormData({ ...formData, data_termino: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.situacao}
                    onValueChange={(v) => setFormData({ ...formData, situacao: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Aprovado">Aprovado</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="servico" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select
                    value={formData.id_cliente}
                    onValueChange={(v) => setFormData({ ...formData, id_cliente: v, id_propriedade: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
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

                <div className="space-y-2">
                  <Label>Propriedade</Label>
                  <Select
                    value={formData.id_propriedade}
                    onValueChange={(v) => setFormData({ ...formData, id_propriedade: v })}
                    disabled={!formData.id_cliente}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
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

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_unitario}
                    onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.situacao_servico}
                    onValueChange={(v) => setFormData({ ...formData, situacao_servico: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planejado">Planejado</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Término</Label>
                  <Input
                    type="date"
                    value={formData.data_termino}
                    onChange={(e) => setFormData({ ...formData, data_termino: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
