import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarIcon, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { updateServico } from "@/modules/operations";
import { SERVICE_STATUS, SERVICE_STATUS_COLORS } from "@/constants/serviceStatus";

interface KanbanBoardProps {
  servicos: any[];
}

const KANBAN_COLUMNS = [
  { id: SERVICE_STATUS.PENDENTE, label: "Pendente", colorKey: "PENDENTE" as const },
  { id: SERVICE_STATUS.EM_ANDAMENTO, label: "Em Andamento", colorKey: "EM_ANDAMENTO" as const },
  { id: SERVICE_STATUS.EM_REVISAO, label: "Em Revisão", colorKey: "EM_REVISAO" as const },
  { id: SERVICE_STATUS.CONCLUIDO, label: "Concluído", colorKey: "CONCLUIDO" as const },
];

export function KanbanBoard({ servicos }: KanbanBoardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await updateServico(id, { situacao_do_servico: status });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      toast.success("Status atualizado!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    const servicoId = result.draggableId;
    const servico = servicos.find((s: any) => s.id_servico === servicoId);
    if (servico?.situacao_do_servico === newStatus) return;
    updateMutation.mutate({ id: servicoId, status: newStatus });
  };

  const getColumnServicos = (status: string) =>
    servicos.filter((s: any) => (s.situacao_do_servico || SERVICE_STATUS.PENDENTE) === status);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((col) => {
          const items = getColumnServicos(col.id);
          const colors = SERVICE_STATUS_COLORS[col.colorKey];
          return (
            <div key={col.id} className="flex flex-col min-h-[400px]">
              {/* Column Header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                <span className="font-semibold text-sm">{col.label}</span>
                <Badge
                  variant="secondary"
                  className="bg-white/20 text-inherit hover:bg-white/30 text-xs"
                >
                  {items.length}
                </Badge>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-2 rounded-b-lg border border-t-0 transition-colors ${
                      snapshot.isDraggingOver
                        ? "bg-accent/50 border-primary/30"
                        : "bg-muted/30 border-border"
                    }`}
                  >
                    {items.map((servico: any, index: number) => (
                      <Draggable
                        key={servico.id_servico}
                        draggableId={servico.id_servico}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-3 cursor-grab active:cursor-grabbing transition-shadow ${
                              snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : "shadow-sm"
                            }`}
                            onClick={() => navigate(`/servicos/${servico.id_servico}`)}
                          >
                            <p className="font-medium text-sm text-foreground line-clamp-2 mb-2">
                              {servico.nome_do_servico}
                            </p>

                            {servico.dim_cliente?.nome && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                                <User className="h-3 w-3" />
                                <span className="truncate">{servico.dim_cliente.nome}</span>
                              </div>
                            )}

                            {servico.data_do_servico_inicio && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                <CalendarIcon className="h-3 w-3" />
                                <span>
                                  {format(new Date(servico.data_do_servico_inicio), "dd/MM/yy", {
                                    locale: ptBR,
                                  })}
                                  {servico.data_do_servico_fim &&
                                    ` → ${format(new Date(servico.data_do_servico_fim), "dd/MM/yy", {
                                      locale: ptBR,
                                    })}`}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <Progress value={servico.progresso || 0} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {servico.progresso || 0}%
                              </span>
                            </div>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {items.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground italic">
                        Arraste serviços aqui
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
