import { useState } from 'react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  UserPlus,
  MapPin,
  Wrench,
  Hammer,
  FileCheck,
  Building2,
  ScrollText,
  FileText,
  StickyNote,
  AlertTriangle,
  Trash2,
  Plus,
  Landmark,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useClienteEventos, useDeleteEvento } from '@/hooks/useClienteEventos';
import { ClienteEvento } from '@/modules/crm/services/cliente-eventos.service';
import { EditarEventoDialog } from './EditarEventoDialog';
import { getIconComponent } from '@/lib/iconMap';
import { toast } from 'sonner';

interface Servico {
  id_servico: string;
  nome_do_servico: string;
}

interface ClienteTimelineProps {
  clienteId: string;
  filtroCategoria?: string;
  filtroServico?: string;
  onAddEvento: () => void;
  servicos?: Servico[];
}

// Configuração de fallback por tipo
const tipoConfig: Record<string, { icon: React.ElementType; color: string }> = {
  cadastro: { icon: UserPlus, color: 'text-green-500 bg-green-500/10' },
  propriedade: { icon: MapPin, color: 'text-emerald-500 bg-emerald-500/10' },
  servico: { icon: Wrench, color: 'text-blue-500 bg-blue-500/10' },
  etapa: { icon: Hammer, color: 'text-purple-500 bg-purple-500/10' },
  documento: { icon: FileCheck, color: 'text-cyan-500 bg-cyan-500/10' },
  prefeitura: { icon: Building2, color: 'text-orange-500 bg-orange-500/10' },
  cartorio: { icon: ScrollText, color: 'text-indigo-500 bg-indigo-500/10' },
  incra: { icon: Landmark, color: 'text-amber-500 bg-amber-500/10' },
  orcamento: { icon: FileText, color: 'text-slate-500 bg-slate-500/10' },
  nota: { icon: StickyNote, color: 'text-yellow-500 bg-yellow-500/10' },
  alerta: { icon: AlertTriangle, color: 'text-red-500 bg-red-500/10' },
};

// Mapa de cores por nome de cor
const colorMap: Record<string, string> = {
  green: 'text-green-500 bg-green-500/10',
  emerald: 'text-emerald-500 bg-emerald-500/10',
  blue: 'text-blue-500 bg-blue-500/10',
  purple: 'text-purple-500 bg-purple-500/10',
  cyan: 'text-cyan-500 bg-cyan-500/10',
  orange: 'text-orange-500 bg-orange-500/10',
  indigo: 'text-indigo-500 bg-indigo-500/10',
  amber: 'text-amber-500 bg-amber-500/10',
  slate: 'text-slate-500 bg-slate-500/10',
  yellow: 'text-yellow-500 bg-yellow-500/10',
  red: 'text-red-500 bg-red-500/10',
  pink: 'text-pink-500 bg-pink-500/10',
  rose: 'text-rose-500 bg-rose-500/10',
  teal: 'text-teal-500 bg-teal-500/10',
};

function groupEventsByDate(eventos: ClienteEvento[]) {
  const groups: { label: string; eventos: ClienteEvento[] }[] = [];
  const groupMap = new Map<string, ClienteEvento[]>();

  eventos.forEach((evento) => {
    const date = new Date(evento.data_evento || evento.created_at);
    let label: string;

    if (isToday(date)) {
      label = 'Hoje';
    } else if (isYesterday(date)) {
      label = 'Ontem';
    } else if (isThisWeek(date)) {
      label = 'Esta Semana';
    } else if (isThisMonth(date)) {
      label = 'Este Mês';
    } else {
      label = format(date, 'MMMM yyyy', { locale: ptBR });
    }

    if (!groupMap.has(label)) {
      groupMap.set(label, []);
    }
    groupMap.get(label)!.push(evento);
  });

  groupMap.forEach((eventos, label) => {
    groups.push({ label, eventos });
  });

  return groups;
}

export function ClienteTimeline({
  clienteId,
  filtroCategoria,
  filtroServico,
  onAddEvento,
  servicos = [],
}: ClienteTimelineProps) {
  const { data: eventos, isLoading } = useClienteEventos(clienteId, {
    categoria: filtroCategoria,
    id_servico: filtroServico,
  });
  const deleteEvento = useDeleteEvento();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingEvento, setEditingEvento] = useState<ClienteEvento | null>(null);

  const handleDelete = async (eventoId: string) => {
    setDeletingId(eventoId);
    try {
      await deleteEvento.mutateAsync({ eventoId, clienteId });
      toast.success('Evento removido com sucesso');
    } catch (error) {
      toast.error('Erro ao remover evento');
    } finally {
      setDeletingId(null);
    }
  };

  // Função para obter ícone e cor do evento
  const getEventoStyle = (evento: ClienteEvento) => {
    // Prioridade 1: usar ícone/cor da categoria dinâmica
    if (evento.categoria_icone) {
      const Icon = getIconComponent(evento.categoria_icone);
      const color = evento.categoria_cor ? colorMap[evento.categoria_cor] || colorMap.blue : colorMap.blue;
      return { Icon, color };
    }
    
    // Prioridade 2: usar configuração do tipo
    const config = tipoConfig[evento.tipo] || tipoConfig.nota;
    return { Icon: config.icon, color: config.color };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const groups = groupEventsByDate(eventos || []);

  if (!eventos?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <StickyNote className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4 text-lg">Nenhum evento registrado ainda</p>
        <Button onClick={onAddEvento} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Adicionar nota
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Floating add button */}
      <Button
        onClick={onAddEvento}
        size="sm"
        className="absolute -top-2 right-0 z-10"
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar
      </Button>

      <div className="space-y-8 pt-10">
        {groups.map((group) => (
          <div key={group.label}>
            <h4 className="text-base font-semibold text-muted-foreground mb-4">
              {group.label}
            </h4>
            <div className="relative pl-10 border-l-2 border-border space-y-5">
              {group.eventos.map((evento) => {
                const { Icon, color } = getEventoStyle(evento);

                return (
                  <div
                    key={evento.id_evento}
                    className="relative group animate-in fade-in slide-in-from-left-2 duration-300"
                  >
                    {/* Timeline dot - MAIOR */}
                    <div
                      className={`absolute -left-[45px] w-10 h-10 rounded-full flex items-center justify-center ${color} shadow-sm`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Event content - MAIOR */}
                    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base">
                              {evento.titulo}
                            </span>
                            {evento.id_servico && (
                              <Badge variant="outline" className="text-xs">
                                Serviço
                              </Badge>
                            )}
                            {evento.manual && (
                              <Badge variant="secondary" className="text-xs">
                                Manual
                              </Badge>
                            )}
                          </div>
                          {evento.descricao && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                              {evento.descricao}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-3 font-medium">
                            {format(new Date(evento.data_evento || evento.created_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                        </div>

                        {/* Action buttons (only for manual events) */}
                        {evento.manual && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => setEditingEvento(evento)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                                  disabled={deletingId === evento.id_evento}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover evento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O evento será removido permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(evento.id_evento)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog de edição */}
      <EditarEventoDialog
        open={!!editingEvento}
        onOpenChange={(open) => !open && setEditingEvento(null)}
        evento={editingEvento}
        clienteId={clienteId}
        servicos={servicos}
      />
    </div>
  );
}
