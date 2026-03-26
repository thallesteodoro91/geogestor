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
import { toast } from "sonner";
import { Calendar, Loader2, FileText, Briefcase } from "lucide-react";
import { SERVICE_STATUS, CALENDAR_STATUS_OPTIONS } from "@/constants/serviceStatus";
import { cn } from "@/lib/utils";
import { BUDGET_SITUATION_OPTIONS } from "@/constants/budgetStatus";
import { useTenant } from "@/contexts/TenantContext";

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
  const { tenant } = useTenant();
  const [tipo, setTipo] = useState<"orcamento" | "servico">(tipoInicial);
  const [formData, setFormData] = useState({
    id_cliente: "",
    id_servico: "",
    id_propriedade: "",
    nome_do_servico: "",
    data_inicio: new Date().toISOString().split("T")[0],
    data_termino: "",
    valor_unitario: "",
    situacao: SERVICE_STATUS.PENDENTE as string,
    situacao_servico: SERVICE_STATUS.PLANEJADO as string,
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
          id_servico: data.id_servico || null,
          id_propriedade: data.id_propriedade || null,
          data_orcamento: data.data_inicio,
          data_inicio: data.data_inicio,
          data_termino: data.data_termino || null,
          valor_unitario: parseFloat(data.valor_unitario) || 0,
          situacao: data.situacao,
          tenant_id: tenant?.id,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendario-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-semanal"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-diario"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-tabela"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-kpis"] });
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
          nome_do_servico: data.nome_do_servico || "Novo Serviço",
          id_cliente: data.id_cliente,
          id_propriedade: data.id_propriedade || null,
          data_do_servico_inicio: data.data_inicio,
          data_do_servico_fim: data.data_termino || null,
          situacao_do_servico: data.situacao_servico,
          receita_servico: parseFloat(data.valor_unitario || "0"),
          tenant_id: tenant?.id,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendario-eventos"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-semanal"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-diario"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-tabela"] });
      queryClient.invalidateQueries({ queryKey: ["calendario-kpis"] });
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
      nome_do_servico: "",
      data_inicio: new Date().toISOString().split("T")[0],
      data_termino: "",
      valor_unitario: "",
      situacao: SERVICE_STATUS.PENDENTE,
      situacao_servico: SERVICE_STATUS.PLANEJADO,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id_cliente || !formData.data_inicio) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (tipo === "servico" && !formData.nome_do_servico.trim()) {
      toast.error("Informe o nome do serviço");
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

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tipo === "orcamento" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTipo("orcamento")}
          >
            <FileText className="h-4 w-4" />
            Orçamento
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tipo === "servico" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTipo("servico")}
          >
            <Briefcase className="h-4 w-4" />
            Serviço
          </button>
        </div>

           <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {tipo === "orcamento" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.id_cliente}
                    onChange={(e) => setFormData({ ...formData, id_cliente: e.target.value, id_propriedade: "" })}
                  >
                    <option value="">Selecione...</option>
                    {clientes.map((c) => (
                      <option key={c.id_cliente} value={c.id_cliente}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.id_servico}
                    onChange={(e) => setFormData({ ...formData, id_servico: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {servicos.map((s) => (
                      <option key={s.id_servico} value={s.id_servico}>{s.nome_do_servico}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Propriedade</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    value={formData.id_propriedade}
                    onChange={(e) => setFormData({ ...formData, id_propriedade: e.target.value })}
                    disabled={!formData.id_cliente}
                  >
                    <option value="">Selecione...</option>
                    {propriedades.map((p) => (
                      <option key={p.id_propriedade} value={p.id_propriedade}>{p.nome_da_propriedade}</option>
                    ))}
                  </select>
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
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.situacao}
                    onChange={(e) => setFormData({ ...formData, situacao: e.target.value })}
                  >
                    {BUDGET_SITUATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {tipo === "servico" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nome do Serviço *</Label>
                  <Input
                    value={formData.nome_do_servico}
                    onChange={(e) => setFormData({ ...formData, nome_do_servico: e.target.value })}
                    placeholder="Ex: Levantamento topográfico"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.id_cliente}
                    onChange={(e) => setFormData({ ...formData, id_cliente: e.target.value, id_propriedade: "" })}
                  >
                    <option value="">Selecione...</option>
                    {clientes.map((c) => (
                      <option key={c.id_cliente} value={c.id_cliente}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Propriedade</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    value={formData.id_propriedade}
                    onChange={(e) => setFormData({ ...formData, id_propriedade: e.target.value })}
                    disabled={!formData.id_cliente}
                  >
                    <option value="">Selecione...</option>
                    {propriedades.map((p) => (
                      <option key={p.id_propriedade} value={p.id_propriedade}>{p.nome_da_propriedade}</option>
                    ))}
                  </select>
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
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.situacao_servico}
                    onChange={(e) => setFormData({ ...formData, situacao_servico: e.target.value })}
                  >
                    {CALENDAR_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
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
            )}

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
      </DialogContent>
    </Dialog>
  );
};
