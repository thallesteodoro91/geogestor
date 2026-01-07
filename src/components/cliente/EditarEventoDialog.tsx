import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus } from 'lucide-react';
import { IconPicker } from '@/components/ui/icon-picker';
import { ColorPicker } from '@/components/ui/color-picker';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useUpdateEvento } from '@/hooks/useClienteEventos';
import { useCategoriaEventos, useCreateCategoria } from '@/hooks/useCategoriaEventos';
import { ClienteEvento } from '@/modules/crm/services/cliente-eventos.service';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Servico {
  id_servico: string;
  nome_do_servico: string;
}

interface EditarEventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento: ClienteEvento | null;
  clienteId: string;
  servicos?: Servico[];
}

const formSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().optional(),
  categoria: z.string().min(1, 'Categoria é obrigatória'),
  id_servico: z.string().optional(),
  data_evento: z.date().optional(),
});

type FormData = z.infer<typeof formSchema>;

const categoriasPadrao = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'documento_cliente', label: 'Documento' },
  { value: 'prefeitura', label: 'Prefeitura' },
  { value: 'cartorio', label: 'Cartório' },
  { value: 'incra', label: 'INCRA' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'interno', label: 'Interno' },
  { value: 'financeiro', label: 'Financeiro' },
];

export function EditarEventoDialog({
  open,
  onOpenChange,
  evento,
  clienteId,
  servicos = [],
}: EditarEventoDialogProps) {
  const updateEvento = useUpdateEvento();
  const { data: categoriasDinamicas } = useCategoriaEventos('evento');
  const createCategoria = useCreateCategoria();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novoIcone, setNovoIcone] = useState('StickyNote');
  const [novaCor, setNovaCor] = useState('blue');
  const [showNovaCategoriaInput, setShowNovaCategoriaInput] = useState(false);

  const handleAddCategoria = async () => {
    if (!novaCategoria.trim()) return;
    
    try {
      await createCategoria.mutateAsync({
        nome: novaCategoria.trim(),
        tipo: 'evento',
        cor: novaCor,
        icone: novoIcone,
        ativo: true,
      });
      form.setValue('categoria', novaCategoria.trim());
      setNovaCategoria('');
      setNovoIcone('StickyNote');
      setNovaCor('blue');
      setShowNovaCategoriaInput(false);
      toast.success('Categoria criada!');
    } catch (error) {
      toast.error('Erro ao criar categoria');
    }
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      categoria: 'interno',
      id_servico: '_none',
      data_evento: undefined,
    },
  });

  // Reset form when evento changes
  useEffect(() => {
    if (evento) {
      form.reset({
        titulo: evento.titulo,
        descricao: evento.descricao || '',
        categoria: evento.categoria,
        id_servico: evento.id_servico || '_none',
        data_evento: evento.data_evento ? new Date(evento.data_evento) : undefined,
      });
    }
  }, [evento, form]);

  const categorias = categoriasDinamicas?.length
    ? categoriasDinamicas.map((c) => ({ value: c.nome, label: c.nome }))
    : categoriasPadrao;

  const onSubmit = async (data: FormData) => {
    if (!evento) return;
    
    setIsSubmitting(true);
    try {
      await updateEvento.mutateAsync({
        eventoId: evento.id_evento,
        clienteId,
        data: {
          titulo: data.titulo,
          descricao: data.descricao || null,
          categoria: data.categoria,
          id_servico: data.id_servico === '_none' ? null : data.id_servico || null,
          data_evento: data.data_evento ? data.data_evento.toISOString() : null,
        },
      });
      toast.success('Nota atualizada!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao atualizar nota');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Nota</DialogTitle>
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data_evento"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data do Evento</FormLabel>
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
                            format(field.value, 'PPP', { locale: ptBR })
                          ) : (
                            <span>Selecionar data</span>
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
                        disabled={(date) => date > new Date()}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria *</FormLabel>
                  <div className="flex gap-2">
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
                  {showNovaCategoriaInput && (
                    <div className="space-y-2 mt-2 p-3 border rounded-lg bg-muted/30">
                      <Input
                        placeholder="Nome da categoria"
                        value={novaCategoria}
                        onChange={(e) => setNovaCategoria(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <IconPicker value={novoIcone} onChange={setNovoIcone} />
                        <ColorPicker value={novaCor} onChange={setNovaCor} />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddCategoria}
                          disabled={createCategoria.isPending || !novaCategoria.trim()}
                          className="ml-auto"
                        >
                          {createCategoria.isPending ? 'Salvando...' : 'Criar'}
                        </Button>
                      </div>
                    </div>
                  )}
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
                          <SelectValue placeholder="Nenhum" />
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
