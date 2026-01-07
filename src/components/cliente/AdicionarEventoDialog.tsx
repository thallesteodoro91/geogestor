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
import { useRegistrarNota } from '@/hooks/useClienteEventos';
import { useCategoriaEventos, useCreateCategoria } from '@/hooks/useCategoriaEventos';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Servico {
  id_servico: string;
  nome_do_servico: string;
}

interface AdicionarEventoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

// Categorias padrão (fallback quando não há categorias no banco)
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

export function AdicionarEventoDialog({
  open,
  onOpenChange,
  clienteId,
  servicos = [],
}: AdicionarEventoDialogProps) {
  const registrarNota = useRegistrarNota();
  const { data: categoriasDinamicas } = useCategoriaEventos('evento');
  const createCategoria = useCreateCategoria();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [showNovaCategoriaInput, setShowNovaCategoriaInput] = useState(false);

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

  // Combine dynamic categories with default ones
  const categorias = categoriasDinamicas?.length
    ? categoriasDinamicas.map((c) => ({ value: c.nome, label: c.nome }))
    : categoriasPadrao;

  const handleAddCategoria = async () => {
    if (!novaCategoria.trim()) return;
    
    try {
      await createCategoria.mutateAsync({
        nome: novaCategoria.trim(),
        tipo: 'evento',
        cor: 'blue',
        icone: 'StickyNote',
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
      await registrarNota.mutateAsync({
        clienteId,
        titulo: data.titulo,
        descricao: data.descricao,
        servicoId: data.id_servico === '_none' ? undefined : data.id_servico || undefined,
        categoria: data.categoria,
        dataEvento: data.data_evento ? data.data_evento.toISOString() : undefined,
      });
      toast.success('Nota adicionada com sucesso!');
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao adicionar nota');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Nota</DialogTitle>
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
                    <Input placeholder="Ex: Documentação recebida" {...field} />
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
                    <Textarea
                      placeholder="Detalhes adicionais..."
                      rows={3}
                      {...field}
                    />
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
                            <span>Usar data atual</span>
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
                          <SelectValue placeholder="Selecione uma categoria" />
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
                    <div className="flex gap-2 mt-2">
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
