import { useState } from 'react';
import { ClipboardList, Clock, Wrench, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClienteTimeline } from './ClienteTimeline';
import { ClienteTarefas } from './ClienteTarefas';
import { AdicionarEventoDialog } from './AdicionarEventoDialog';
import { AdicionarTarefaDialog } from './AdicionarTarefaDialog';
import { useTarefasPendentes } from '@/hooks/useClienteTarefas';

interface Servico {
  id_servico: string;
  nome_do_servico: string;
  situacao_do_servico?: string | null;
}

interface Propriedade {
  id_propriedade: string;
  nome_da_propriedade: string;
}

interface ClienteCentralControleProps {
  clienteId: string;
  servicos?: Servico[];
  propriedades?: Propriedade[];
}

const categorias = [
  { value: '_all', label: 'Todas' },
  { value: 'documento_cliente', label: 'Documentos' },
  { value: 'prefeitura', label: 'Prefeitura' },
  { value: 'cartorio', label: 'Cartório' },
  { value: 'incra', label: 'INCRA' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'interno', label: 'Interno' },
];

export function ClienteCentralControle({
  clienteId,
  servicos = [],
  propriedades = [],
}: ClienteCentralControleProps) {
  const [filtroCategoria, setFiltroCategoria] = useState('_all');
  const [filtroServico, setFiltroServico] = useState('_all');
  const [eventoDialogOpen, setEventoDialogOpen] = useState(false);
  const [tarefaDialogOpen, setTarefaDialogOpen] = useState(false);

  const { data: tarefasPendentes } = useTarefasPendentes(clienteId);

  const servicosAtivos = servicos.filter(
    (s) => s.situacao_do_servico && s.situacao_do_servico !== 'Concluído'
  ).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <ListTodo className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tarefasPendentes || 0}</p>
                <p className="text-xs text-muted-foreground">Pendências</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Wrench className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{servicosAtivos}</p>
                <p className="text-xs text-muted-foreground">Serviços Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <ClipboardList className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{propriedades.length}</p>
                <p className="text-xs text-muted-foreground">Propriedades</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{servicos.length}</p>
                <p className="text-xs text-muted-foreground">Total Serviços</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {servicos.length > 0 && (
          <Select value={filtroServico} onValueChange={setFiltroServico}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os serviços</SelectItem>
              {servicos.map((servico) => (
                <SelectItem key={servico.id_servico} value={servico.id_servico}>
                  {servico.nome_do_servico}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Main content */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Checklist de Pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClienteTarefas
              clienteId={clienteId}
              filtroCategoria={filtroCategoria || undefined}
              filtroServico={filtroServico || undefined}
              onAddTarefa={() => setTarefaDialogOpen(true)}
            />
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Linha do Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClienteTimeline
              clienteId={clienteId}
              filtroCategoria={filtroCategoria === '_all' ? undefined : filtroCategoria}
              filtroServico={filtroServico === '_all' ? undefined : filtroServico}
              onAddEvento={() => setEventoDialogOpen(true)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <AdicionarEventoDialog
        open={eventoDialogOpen}
        onOpenChange={setEventoDialogOpen}
        clienteId={clienteId}
        servicos={servicos}
      />

      <AdicionarTarefaDialog
        open={tarefaDialogOpen}
        onOpenChange={setTarefaDialogOpen}
        clienteId={clienteId}
        servicos={servicos}
      />
    </div>
  );
}
