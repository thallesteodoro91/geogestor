import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  CheckCircle, 
  PlusCircle, 
  UserPlus, 
  FileUp,
  RefreshCw
} from 'lucide-react';
import { fetchEventosByServico } from '@/modules/operations/services/servico-eventos.service';

interface EventosTimelineProps {
  servicoId: string;
}

export function EventosTimeline({ servicoId }: EventosTimelineProps) {
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['servico-eventos', servicoId],
    queryFn: async () => {
      const { data, error } = await fetchEventosByServico(servicoId);
      if (error) throw error;
      return data || [];
    }
  });

  const getEventoIcon = (tipo: string) => {
    switch (tipo) {
      case 'criacao':
        return <PlusCircle className="h-4 w-4 text-green-500" />;
      case 'status':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'tarefa_adicionada':
        return <PlusCircle className="h-4 w-4 text-amber-500" />;
      case 'tarefa_concluida':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'equipe':
        return <UserPlus className="h-4 w-4 text-purple-500" />;
      case 'anexo':
        return <FileUp className="h-4 w-4 text-cyan-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatData = (data: string) => {
    return format(new Date(data), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
  };

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Carregando...</div>;
  }

  if (eventos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        Nenhum evento registrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {eventos.map((evento, index) => (
        <div key={evento.id_evento} className="flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              {getEventoIcon(evento.tipo)}
            </div>
            {index < eventos.length - 1 && (
              <div className="w-px flex-1 bg-border mt-2" />
            )}
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm">{evento.descricao}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {evento.created_at && formatData(evento.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
