import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { User, MapPin, Plus, Trash2, StickyNote } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/services/supabase.service";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { PlanLimitAlert } from "@/components/plan";

interface PropriedadeForm {
  nome_da_propriedade: string;
  area_ha?: number | string;
  cidade?: string;
  municipio?: string;
  tipo?: string;
  situacao?: string;
  matricula?: string;
  ccir?: string;
  car?: string;
  itr?: string;
  latitude?: number | string;
  longitude?: number | string;
  possui_memorial_descritivo?: string;
  observacoes?: string;
}

interface ClientePropriedadeUnificadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: any;
  onSuccess?: () => void;
}

const prospeccaoOpcoes = ["Indicação", "Redes Sociais", "Site", "Ligação", "WhatsApp", "Outro"];
const categoriaOpcoes = ["Produtor Rural", "Empresa", "Pessoa Física", "Governo", "ONG"];

export function ClientePropriedadeUnificadoDialog({
  open,
  onOpenChange,
  cliente,
  onSuccess
}: ClientePropriedadeUnificadoDialogProps) {
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const planLimits = usePlanLimits();
  const { clientsCount, propertiesCount, isLoading: countsLoading } = useResourceCounts();
  
  const [prospeccaoOptions, setProspeccaoOptions] = useState<string[]>([]);
  const [categoriaOptions, setCategoriaOptions] = useState<string[]>([]);
  const [propriedades, setPropriedades] = useState<PropriedadeForm[]>([]);
  const [activeTab, setActiveTab] = useState("cliente");
  const [saving, setSaving] = useState(false);

  const isEditing = !!cliente;
  const isAtClientLimit = !isEditing && !planLimits.isWithinLimit('clients', clientsCount);
  const isAtPropertyLimit = !planLimits.isWithinLimit('properties', propertiesCount);

  useEffect(() => {
    if (open) {
      if (cliente) {
        // Editing mode - populate client fields
        reset({
          nome: cliente.nome || "",
          email: cliente.email || "",
          telefone: cliente.telefone || "",
          celular: cliente.celular || "",
          cpf: cliente.cpf || "",
          cnpj: cliente.cnpj || "",
          endereco: cliente.endereco || "",
          situacao: cliente.situacao || "",
          anotacoes: cliente.anotacoes || "",
        });
        setProspeccaoOptions(cliente.origem?.split(", ").filter(Boolean) || []);
        setCategoriaOptions(cliente.categoria?.split(", ").filter(Boolean) || []);
        // Don't load properties in edit mode - use separate property dialog
        setPropriedades([]);
      } else {
        // New client mode
        reset({
          nome: "",
          email: "",
          telefone: "",
          celular: "",
          cpf: "",
          cnpj: "",
          endereco: "",
          situacao: "",
          anotacoes: "",
        });
        setProspeccaoOptions([]);
        setCategoriaOptions([]);
        setPropriedades([]);
      }
      setActiveTab("cliente");
    }
  }, [open, cliente, reset]);

  const handleProspeccaoToggle = (option: string) => {
    setProspeccaoOptions(prev =>
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    );
  };

  const handleCategoriaToggle = (option: string) => {
    setCategoriaOptions(prev =>
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    );
  };

  const addPropriedade = () => {
    setPropriedades(prev => [...prev, {
      nome_da_propriedade: "",
      area_ha: "",
      cidade: "",
      municipio: "",
      tipo: "",
      situacao: "",
      matricula: "",
      ccir: "",
      car: "",
      itr: "",
      latitude: "",
      longitude: "",
      possui_memorial_descritivo: "",
      observacoes: "",
    }]);
  };

  const removePropriedade = (index: number) => {
    setPropriedades(prev => prev.filter((_, i) => i !== index));
  };

  const updatePropriedade = (index: number, field: keyof PropriedadeForm, value: any) => {
    setPropriedades(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const onSubmit = async (data: any) => {
    if (isAtClientLimit) {
      toast.error("Limite de clientes atingido no seu plano");
      return;
    }

    if (!data.nome?.trim()) {
      toast.error("Nome do cliente é obrigatório");
      setActiveTab("cliente");
      return;
    }

    // Validate properties have names
    const invalidProps = propriedades.filter(p => !p.nome_da_propriedade?.trim());
    if (invalidProps.length > 0) {
      toast.error("Todas as propriedades devem ter um nome");
      setActiveTab("propriedades");
      return;
    }

    // Check property limit
    if (!isEditing && propriedades.length > 0 && isAtPropertyLimit) {
      const availableSlots = planLimits.maxProperties - propertiesCount;
      if (propriedades.length > availableSlots) {
        toast.error(`Você pode adicionar no máximo ${availableSlots} propriedade(s) com seu plano atual`);
        return;
      }
    }

    setSaving(true);

    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        toast.error("Erro: tenant não encontrado");
        return;
      }

      // Prepare client data
      const clienteData = {
        nome: data.nome.trim(),
        email: data.email?.trim() || null,
        telefone: data.telefone?.trim() || null,
        celular: data.celular?.trim() || null,
        cpf: data.cpf?.trim() || null,
        cnpj: data.cnpj?.trim() || null,
        endereco: data.endereco?.trim() || null,
        situacao: data.situacao || null,
        origem: prospeccaoOptions.length > 0 ? prospeccaoOptions.join(", ") : null,
        categoria: categoriaOptions.length > 0 ? categoriaOptions.join(", ") : null,
        anotacoes: data.anotacoes?.trim() || null,
        tenant_id: tenantId,
      };

      let clienteId: string;

      if (isEditing) {
        // Update existing client
        const { error } = await supabase
          .from("dim_cliente")
          .update(clienteData)
          .eq("id_cliente", cliente.id_cliente);

        if (error) throw error;
        clienteId = cliente.id_cliente;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        // Create new client
        const { data: newCliente, error } = await supabase
          .from("dim_cliente")
          .insert(clienteData)
          .select("id_cliente")
          .single();

        if (error) throw error;
        clienteId = newCliente.id_cliente;

        // Create properties if any
        if (propriedades.length > 0) {
          const propriedadesData = propriedades.map(p => ({
            nome_da_propriedade: p.nome_da_propriedade.trim(),
            area_ha: p.area_ha ? Number(p.area_ha) : null,
            cidade: p.cidade?.trim() || null,
            municipio: p.municipio?.trim() || null,
            tipo: p.tipo || null,
            situacao: p.situacao || null,
            matricula: p.matricula?.trim() || null,
            ccir: p.ccir?.trim() || null,
            car: p.car?.trim() || null,
            itr: p.itr?.trim() || null,
            latitude: p.latitude ? Number(p.latitude) : null,
            longitude: p.longitude ? Number(p.longitude) : null,
            possui_memorial_descritivo: p.possui_memorial_descritivo || null,
            observacoes: p.observacoes?.trim() || null,
            id_cliente: clienteId,
            tenant_id: tenantId,
          }));

          const { error: propError } = await supabase
            .from("dim_propriedade")
            .insert(propriedadesData);

          if (propError) throw propError;
        }

        const propCount = propriedades.length;
        toast.success(
          propCount > 0 
            ? `Cliente e ${propCount} propriedade(s) criados com sucesso!`
            : "Cliente criado com sucesso!"
        );
      }

      // Data saved successfully
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(error.message || "Erro ao salvar dados");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Cliente" : "Novo Cadastro"}
          </DialogTitle>
        </DialogHeader>

        {isAtClientLimit && (
          <PlanLimitAlert resource="clients" currentCount={clientsCount} />
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cliente" className="gap-2">
                <User className="h-4 w-4 text-blue-500" />
                Cliente
              </TabsTrigger>
              <TabsTrigger value="propriedades" className="gap-2" disabled={isEditing}>
                <MapPin className="h-4 w-4 text-green-500" />
                Propriedades
                {propriedades.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {propriedades.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 pr-4">
              {/* Tab Cliente */}
              <TabsContent value="cliente" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      {...register("nome")}
                      placeholder="Nome do cliente"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      {...register("telefone")}
                      placeholder="(00) 0000-0000"
                      onChange={(e) => setValue("telefone", formatPhoneNumber(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="celular">Celular</Label>
                    <Input
                      id="celular"
                      {...register("celular")}
                      placeholder="(00) 00000-0000"
                      onChange={(e) => setValue("celular", formatPhoneNumber(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="situacao">Situação</Label>
                    <Select onValueChange={(value) => setValue("situacao", value)} defaultValue={cliente?.situacao || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      {...register("cpf")}
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      {...register("cnpj")}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      {...register("endereco")}
                      placeholder="Endereço completo"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-3 block">Prospecção</Label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {prospeccaoOpcoes.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`prospeccao-${option}`}
                            checked={prospeccaoOptions.includes(option)}
                            onCheckedChange={() => handleProspeccaoToggle(option)}
                          />
                          <label htmlFor={`prospeccao-${option}`} className="text-sm cursor-pointer">
                            {option}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-3 block">Categoria do Cliente</Label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {categoriaOpcoes.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`categoria-${option}`}
                            checked={categoriaOptions.includes(option)}
                            onCheckedChange={() => handleCategoriaToggle(option)}
                          />
                          <label htmlFor={`categoria-${option}`} className="text-sm cursor-pointer">
                            {option}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="anotacoes" className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-yellow-500" />
                    Observações
                  </Label>
                  <Textarea
                    id="anotacoes"
                    {...register("anotacoes")}
                    placeholder="Anotações sobre o cliente..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              {/* Tab Propriedades */}
              <TabsContent value="propriedades" className="space-y-4 mt-4">
                {isEditing ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Para editar propriedades, use o botão de propriedade na lista de clientes.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Adicione propriedades vinculadas a este cliente (opcional)
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPropriedade}
                        disabled={isAtPropertyLimit}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar Propriedade
                      </Button>
                    </div>

                    {isAtPropertyLimit && (
                      <PlanLimitAlert resource="properties" currentCount={propertiesCount} />
                    )}

                    {propriedades.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <MapPin className="h-8 w-8 mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma propriedade adicionada</p>
                          <p className="text-xs">Clique em "Adicionar Propriedade" para começar</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {propriedades.map((prop, index) => (
                          <Card key={index}>
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-green-500" />
                                  <span className="font-medium text-sm">
                                    Propriedade {index + 1}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => removePropriedade(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                  <Label className="text-xs">Nome da Propriedade *</Label>
                                  <Input
                                    value={prop.nome_da_propriedade}
                                    onChange={(e) => updatePropriedade(index, "nome_da_propriedade", e.target.value)}
                                    placeholder="Ex: Fazenda São João"
                                    className="h-9"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Área (ha)</Label>
                                  <Input
                                    type="number"
                                    value={prop.area_ha}
                                    onChange={(e) => updatePropriedade(index, "area_ha", e.target.value)}
                                    placeholder="0.00"
                                    className="h-9"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Cidade</Label>
                                  <Input
                                    value={prop.cidade}
                                    onChange={(e) => updatePropriedade(index, "cidade", e.target.value)}
                                    placeholder="Cidade"
                                    className="h-9"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Município</Label>
                                  <Input
                                    value={prop.municipio}
                                    onChange={(e) => updatePropriedade(index, "municipio", e.target.value)}
                                    placeholder="Município"
                                    className="h-9"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Situação</Label>
                                  <Select
                                    value={prop.situacao || ""}
                                    onValueChange={(value) => updatePropriedade(index, "situacao", value)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Regular">Regular</SelectItem>
                                      <SelectItem value="Irregular">Irregular</SelectItem>
                                      <SelectItem value="Em Regularização">Em Regularização</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label className="text-xs">Matrícula</Label>
                                  <Input
                                    value={prop.matricula}
                                    onChange={(e) => updatePropriedade(index, "matricula", e.target.value)}
                                    placeholder="Nº da matrícula"
                                    className="h-9"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">CAR</Label>
                                  <Input
                                    value={prop.car}
                                    onChange={(e) => updatePropriedade(index, "car", e.target.value)}
                                    placeholder="Código CAR"
                                    className="h-9"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Latitude</Label>
                                  <Input
                                    type="number"
                                    step="any"
                                    value={prop.latitude}
                                    onChange={(e) => updatePropriedade(index, "latitude", e.target.value)}
                                    placeholder="-23.5505"
                                    className="h-9"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Longitude</Label>
                                  <Input
                                    type="number"
                                    step="any"
                                    value={prop.longitude}
                                    onChange={(e) => updatePropriedade(index, "longitude", e.target.value)}
                                    placeholder="-46.6333"
                                    className="h-9"
                                  />
                                </div>

                                <div className="col-span-2">
                                  <Label className="text-xs flex items-center gap-1">
                                    <StickyNote className="h-3 w-3 text-yellow-500" />
                                    Observações
                                  </Label>
                                  <Textarea
                                    value={prop.observacoes}
                                    onChange={(e) => updatePropriedade(index, "observacoes", e.target.value)}
                                    placeholder="Observações sobre a propriedade..."
                                    rows={2}
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || isAtClientLimit}>
              {saving ? "Salvando..." : isEditing ? "Salvar" : "Salvar Tudo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
