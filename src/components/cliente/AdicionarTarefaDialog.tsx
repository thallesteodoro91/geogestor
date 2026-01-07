import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateTarefa } from '@/hooks/useClienteTarefas';
import { useCategoriaEventos, useCreateCategoria } from '@/hooks/useCategoriaEventos';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Servico {
  id_servico: string;
  nome_do_servico: string;
}

interface AdicionarTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  servicos?: Servico[];
}

const formSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  categoria: z.string().min(1, 'Categoria é obrigatória'),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']),
  data_vencimento: z.date().optional(),
  id_servico: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

// Categorias padrão (fallback quando não há categorias no banco)
const categoriasPadrao = [
  { value: 'documento_cliente', label: 'Documento do Cliente' },
  { value: 'prefeitura', label: 'Prefeitura' },
  { value: 'cartorio', label: 'Cartório' },
  { value: 'incra', label: 'INCRA' },
  { value: 'sigef', label: 'SIGEF' },
  { value: 'interno', label: 'Interno' },
  { value: 'trabalho', label: 'Trabalho/Campo' },
];

const prioridades = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export function AdicionarTarefaDialog({
  open,
  onOpenChange,
  clienteId,
  servicos = [],
}: AdicionarTarefaDialogProps) {
  const createTarefa = useCreateTarefa();
  const { data: categoriasDinamicas } = useCategoriaEventos('tarefa');
  const createCategoria = useCreateCategoria();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [showNovaCategoriaInput, setShowNovaCategoriaInput] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      categoria: 'documento_cliente',
      prioridade: 'media',
      observacoes: '',
      id_servico: '_none',
    },
  });

  // Combine dynamic categories with default ones
  const categorias = categoriasDinamicas?.length
    ? categoriasDinamicas.map((c) => ({ value: c.nome, label: c.nome }))
    : categoriasPadrao;

  const handleAddCategoria = async () => {
    if (!novaCategoria.trim()) return;
    
    try {
      await createCategoria.mutateAsync({
        nome: novaCategoria.trim(),
        tipo: 'tarefa',
        cor: 'blue',
        icone: 'ClipboardList',
        ativo: true,
      });
      form.setValue('categoria', novaCategoria.trim());
      setNovaCategoria('');
      setShowNovaCategoriaInput(false);
      toast.success('Categoria criada!');
    } catch (error) {
      toast.error('Erro ao criar categoria');
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await createTarefa.mutateAsync({
        id_cliente: clienteId,
        titulo: data.titulo,
        categoria: data.categoria,
        prioridade: data.prioridade,
        data_vencimento: data.data_vencimento
          ? format(data.data_vencimento, 'yyyy-MM-dd')
          : null,
        id_servico: data.id_servico === '_none' ? null : data.id_servico || null,
        observacoes: data.observacoes || null,
        concluida: false,
        ordem: 0,
      });
      toast.success('Tarefa adicionada com sucesso!');
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao adicionar tarefa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Coletar CPF do cliente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <div className="flex gap-1">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categorias.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowNovaCategoriaInput(!showNovaCategoriaInput)}
                        title="Adicionar categoria"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {prioridades.map((prio) => (
                          <SelectItem key={prio.value} value={prio.value}>
                            {prio.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showNovaCategoriaInput && (
              <div className="flex gap-2">
                <Input
                  placeholder="Nova categoria"
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCategoria}
                  disabled={createCategoria.isPending}
                >
                  {createCategoria.isPending ? 'Salvando...' : 'Criar'}
                </Button>
              </div>
            )}

            <FormField
              control={form.control}
              name="data_vencimento"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Vencimento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                          ) : (
                            <span>Selecione uma data (opcional)</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {servicos.length > 0 && (
              <FormField
                control={form.control}
                name="id_servico"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vincular a Serviço</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhum (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">Nenhum</SelectItem>
                        {servicos.map((servico) => (
                          <SelectItem key={servico.id_servico} value={servico.id_servico}>
                            {servico.nome_do_servico}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalhes adicionais..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
