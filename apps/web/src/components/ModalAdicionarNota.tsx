import { toast } from 'sonner';
import { DatePickerField, FormSelect } from './Form';
import { Modal } from './Modal';
import { apiClient } from '../services/apiClient';
import { persistOperationalSetting } from '../services/operationalSettings';
import React, { useState, useEffect, useRef, useId } from 'react';
import { primarySubmitButtonClass, secondaryActionButtonClass } from '../utils/actionStyles';
import { cn } from '../utils/cn';
import { geoFieldClass } from '../utils/geoTheme';
import { Calendar, Plus, User, MapPin, Wrench, Hammer, FileText, Printer, Globe, Suitcase,
  CurrencyDollar, Phone, Envelope, Chat, Camera, Image as ImageIcon, Folder, House, Car,
  Truck, Tree, Mountains, Leaf, Check } from '@phosphor-icons/react';
import './ModalAdicionarNota.css';

export interface NotaCategoriaItem {
  id: string;
  nome: string;
  icone: string;
  cor: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  User: <User />,
  MapPin: <MapPin />,
  Wrench: <Wrench />,
  Hammer: <Hammer />,
  FileText: <FileText />,
  Printer: <Printer />,
  Globe: <Globe />,
  Suitcase: <Suitcase />,
  CurrencyDollar: <CurrencyDollar />,
  Calendar: <Calendar />,
  Phone: <Phone />,
  Envelope: <Envelope />,
  Chat: <Chat />,
  Camera: <Camera />,
  Image: <ImageIcon />,
  Folder: <Folder />,
  House: <House />,
  Car: <Car />,
  Truck: <Truck />,
  Tree: <Tree />,
  Mountains: <Mountains />,
  Leaf: <Leaf />
};

const COLOR_PALETTE = [
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Roxo', hex: '#8b5cf6' },
  { name: 'Verde', hex: '#10b981' },
  { name: 'Laranja', hex: '#f59e0b' },
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Cinza', hex: '#71717a' }
];

const DEFAULT_CATEGORIAS: NotaCategoriaItem[] = [
  { id: 'cat-int', nome: 'Interno', icone: 'Folder', cor: '#3b82f6' },
  { id: 'cat-reuniao', nome: 'Reunião', icone: 'User', cor: '#8b5cf6' },
  { id: 'cat-ligacao', nome: 'Ligação', icone: 'Phone', cor: '#10b981' },
  { id: 'cat-whats', nome: 'WhatsApp', icone: 'Chat', cor: '#10b981' },
  { id: 'cat-email', nome: 'Email', icone: 'Envelope', cor: '#f59e0b' },
  { id: 'cat-prop', nome: 'Proposta', icone: 'FileText', cor: '#8b5cf6' },
  { id: 'cat-campo', nome: 'Visita de Campo', icone: 'MapPin', cor: '#ef4444' }
];

interface ModalAdicionarNotaProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  projetoId?: string | null;
  onSuccess?: () => void;
}

const fieldClass = cn(geoFieldClass, 'h-11 w-full px-3 text-sm font-medium');
const labelClass = 'mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200';
const iconLabels: Record<string, string> = {
  User: 'Pessoa', MapPin: 'Localização', Wrench: 'Ferramenta', Hammer: 'Martelo',
  FileText: 'Documento', Printer: 'Impressora', Globe: 'Globo', Suitcase: 'Maleta',
  CurrencyDollar: 'Financeiro', Calendar: 'Calendário', Phone: 'Telefone', Envelope: 'E-mail',
  Chat: 'Conversa', Camera: 'Câmera', Image: 'Imagem', Folder: 'Pasta', House: 'Casa',
  Car: 'Carro', Truck: 'Caminhão', Tree: 'Árvore', Mountains: 'Montanhas', Leaf: 'Folha'
};

export function ModalAdicionarNota({ isOpen, onClose, clienteId, projetoId, onSuccess }: ModalAdicionarNotaProps) {
  const formId = useId();
  const hintId = useId();
  const titleErrorId = useId();
  const categoryErrorId = useId();
  const creatorId = useId();
  const tooltipId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const newCategoryRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const creatingCategoryRef = useRef(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [categorias, setCategorias] = useState<NotaCategoriaItem[]>(() => {
    try {
      const salvas = localStorage.getItem('geogestor_jornada_categorias');
      return salvas ? JSON.parse(salvas) : DEFAULT_CATEGORIAS;
    } catch { return DEFAULT_CATEGORIAS; }
  });
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Interno');
  const [showCatCreator, setShowCatCreator] = useState(false);
  const [newCatNome, setNewCatNome] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Folder');
  const [newCatCor, setNewCatCor] = useState('#8b5cf6');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const busy = loading || creatingCategory;

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      setTitulo('');
      setDescricao('');
      // Preserve the existing UTC date initialization and empty-date fallback.
      setDataEvento(new Date().toISOString().split('T')[0]);
      setShowCatCreator(false);
      setTitleError('');
      setCategoryError('');
      setSubmitError('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleClose = () => {
    if (!submittingRef.current && !creatingCategoryRef.current) onClose();
  };

  const handleSalvarCategoria = async () => {
    if (creatingCategoryRef.current || submittingRef.current) return;
    if (!newCatNome.trim()) {
      setCategoryError('Informe o nome da nova categoria.');
      newCategoryRef.current?.focus();
      return;
    }
    creatingCategoryRef.current = true;
    setCreatingCategory(true);
    setCategoryError('');
    const nova: NotaCategoriaItem = {
      id: `cat-${Date.now()}`, nome: newCatNome.trim(), icone: newCatIcon, cor: newCatCor
    };
    const listaAtualizada = [...categorias, nova];
    try {
      await persistOperationalSetting('geogestor_jornada_categorias', listaAtualizada);
      setCategorias(listaAtualizada);
      setCategoriaSelecionada(nova.nome);
      setNewCatNome('');
      setShowCatCreator(false);
      window.requestAnimationFrame(() => document.getElementById('nota-categoria')?.focus());
    } catch {
      setCategoryError('Não foi possível criar a categoria. Tente novamente.');
    } finally {
      creatingCategoryRef.current = false;
      setCreatingCategory(false);
    }
  };

  const handleSubmeter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || creatingCategoryRef.current) return;
    setSubmitError('');
    if (!titulo.trim()) {
      setTitleError('Informe um título para a nota.');
      titleRef.current?.focus();
      return;
    }
    if (!categoriaSelecionada.trim()) {
      setCategoryError('Selecione uma categoria para a nota.');
      document.getElementById('nota-categoria')?.focus();
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      await apiClient.post(`/api/clientes/${clienteId}/historico`, {
        tipo: categoriaSelecionada,
        titulo: titulo.trim(),
        categoria: categoriaSelecionada,
        projetoId: projetoId || null,
        data: dataEvento || new Date().toISOString().split('T')[0],
        descricao: descricao.trim() || titulo.trim()
      });
      toast.success('Nota adicionada à Jornada do Cliente.');
      onSuccess?.();
      onClose();
    } catch {
      setSubmitError('Não foi possível adicionar a nota. Tente novamente.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return <Modal
    isOpen={isOpen}
    onClose={handleClose}
    title="Adicionar nota"
    maxWidth="max-w-xl"
    panelClassName="geo-note-dialog"
    initialFocusId="nota-titulo"
    closeDisabled={busy}
    ariaDescribedBy={hintId}
    footer={<div className="space-y-3">
      {submitError && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{submitError}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 sm:gap-3">
        <button type="button" onClick={handleClose} disabled={busy} className={cn(secondaryActionButtonClass, 'h-12 min-w-0 justify-center px-3 py-0')}>Cancelar</button>
        <button type="submit" form={formId} disabled={busy} aria-busy={loading} className={cn(primarySubmitButtonClass, 'h-12 min-w-0 w-full px-3 py-0')}>
          <span aria-live="polite">{loading ? 'Adicionando…' : 'Adicionar nota'}</span>
        </button>
      </div>
    </div>}
  >
    <form id={formId} onSubmit={handleSubmeter} noValidate>
      <p id={hintId} className="mb-4 text-xs text-zinc-600 dark:text-zinc-300">Campos com * são obrigatórios.</p>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div>
          <label htmlFor="nota-titulo" className={labelClass}>Título <span aria-hidden="true">*</span></label>
          <input ref={titleRef} id="nota-titulo" name="titulo" type="text" required autoComplete="off" value={titulo}
            aria-invalid={Boolean(titleError)} aria-describedby={titleError ? titleErrorId : undefined}
            onChange={event => { setTitulo(event.target.value); setTitleError(''); }}
            placeholder="Ex.: Documentação recebida" className={fieldClass} />
          {titleError && <p id={titleErrorId} role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-300">{titleError}</p>}
        </div>
        <div>
          <label htmlFor="nota-descricao" className={labelClass}>Descrição <span className="font-normal text-zinc-600 dark:text-zinc-300">— opcional</span></label>
          <textarea id="nota-descricao" name="descricao" rows={4} value={descricao} onChange={event => setDescricao(event.target.value)}
            placeholder="Acrescente os detalhes da nota…" className={cn(geoFieldClass, 'min-h-28 w-full resize-none px-3 py-2.5 text-sm leading-relaxed')} />
        </div>
        <div>
          <label htmlFor="nota-data-evento" className={labelClass}>Data do evento</label>
          <DatePickerField id="nota-data-evento" name="dataEvento" aria-label="Data do evento" value={dataEvento}
            onChange={event => setDataEvento(event.target.value)} className={fieldClass} popoverClassName="geo-note-calendar" />
        </div>
        <div>
          <label htmlFor="nota-categoria" className={labelClass}>Categoria <span aria-hidden="true">*</span></label>
          <div className="flex min-w-0 items-start gap-2.5">
            <FormSelect id="nota-categoria" name="categoria" aria-label="Categoria da nota" required density="form" value={categoriaSelecionada}
              aria-invalid={Boolean(categoryError && !showCatCreator)} aria-describedby={categoryError ? categoryErrorId : undefined}
              onChange={event => { setCategoriaSelecionada(event.target.value); setCategoryError(''); }}
              wrapperClassName="min-w-0 flex-1" className={fieldClass} popoverMaxWidth={560} matchTriggerWidth popoverClassName="geo-note-options">
              {categorias.map(category => <option key={category.id} value={category.nome}>{category.nome}</option>)}
            </FormSelect>
            <button type="button" aria-label="Criar categoria" aria-describedby={tooltipId} aria-expanded={showCatCreator} aria-controls={creatorId}
              onClick={() => { setShowCatCreator(!showCatCreator); setShowIconPicker(false); setShowColorPicker(false); setCategoryError(''); }}
              className={cn(secondaryActionButtonClass, 'geo-note-category-action relative h-11 w-11 min-w-11 justify-center p-0')}>
              <Plus aria-hidden="true" size={18} weight="bold" />
              <span id={tooltipId} role="tooltip" className="geo-note-tooltip">Criar categoria</span>
            </button>
          </div>
          {categoryError && <p id={categoryErrorId} role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-300">{categoryError}</p>}
        </div>
        {showCatCreator && <section id={creatorId} aria-label="Nova categoria" className="space-y-3 rounded-lg border border-brand-border bg-brand-surface-subtle p-3">
          <label htmlFor="nota-nova-categoria" className={labelClass}>Nome da nova categoria</label>
          <input ref={newCategoryRef} id="nota-nova-categoria" name="novaCategoria" type="text" autoComplete="off" value={newCatNome}
            onChange={event => { setNewCatNome(event.target.value); setCategoryError(''); }}
            aria-invalid={Boolean(categoryError && !newCatNome.trim())} aria-describedby={categoryError ? categoryErrorId : undefined}
            placeholder="Ex.: Conferência documental" className={fieldClass} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-expanded={showIconPicker} onClick={() => { setShowIconPicker(!showIconPicker); setShowColorPicker(false); }}
              className={cn(secondaryActionButtonClass, 'min-w-0 flex-1 justify-center gap-2 px-3 py-2 text-sm')}>
              <span aria-hidden="true" className="flex h-4 w-4 shrink-0">{ICON_MAP[newCatIcon] || <Folder />}</span>Ícone
            </button>
            <button type="button" aria-expanded={showColorPicker} onClick={() => { setShowColorPicker(!showColorPicker); setShowIconPicker(false); }}
              className={cn(secondaryActionButtonClass, 'min-w-0 flex-1 justify-center gap-2 px-3 py-2 text-sm')}>
              <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: newCatCor }} />Cor
            </button>
            <button type="button" onClick={() => void handleSalvarCategoria()} aria-busy={creatingCategory}
              className={cn(primarySubmitButtonClass, 'min-w-24 px-3 text-sm')}>{creatingCategory ? 'Criando…' : 'Criar'}</button>
          </div>
          {showIconPicker && <div aria-label="Ícones da categoria" className="grid max-h-44 grid-cols-4 gap-1 overflow-y-auto sm:grid-cols-7">
            {Object.keys(ICON_MAP).map(iconName => <button key={iconName} type="button" aria-label={`Selecionar ícone ${iconLabels[iconName]}`} aria-pressed={newCatIcon === iconName}
              onClick={() => { setNewCatIcon(iconName); setShowIconPicker(false); }}
              className={cn('geo-focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-transparent p-2 hover:bg-brand-surface-muted', newCatIcon === iconName && 'border-indigo-500 bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-100')}>
              <span aria-hidden="true" className="flex h-5 w-5">{ICON_MAP[iconName]}</span>
            </button>)}
          </div>}
          {showColorPicker && <div aria-label="Cores da categoria" className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {COLOR_PALETTE.map(color => <button key={color.hex} type="button" aria-label={`Selecionar cor ${color.name}`} aria-pressed={newCatCor === color.hex}
              onClick={() => { setNewCatCor(color.hex); setShowColorPicker(false); }}
              className="geo-focus-ring flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-sm text-zinc-800 hover:bg-brand-surface-muted dark:text-zinc-200">
              <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color.hex }} />
              {color.name}{newCatCor === color.hex && <Check aria-hidden="true" size={14} className="ml-auto shrink-0" />}
            </button>)}
          </div>}
        </section>}
      </fieldset>
    </form>
  </Modal>;
}
