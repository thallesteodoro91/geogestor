import { toast } from 'sonner';
import { DatePickerField, FormSelect } from './Form';
import { apiClient } from '../services/apiClient';
import { persistOperationalSetting } from '../services/operationalSettings';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { geoModalTransition, geoViewTransition } from '../utils/motion';
import { primarySubmitButtonClass } from '../utils/actionStyles';
import { cn } from '../utils/cn';
import { geoFieldClass } from '../utils/geoTheme';
import {
  X,
  Calendar,
  Plus,
  User,
  MapPin,
  Wrench,
  Hammer,
  FileText,
  Printer,
  Globe,
  Suitcase,
  CurrencyDollar,
  Phone,
  Envelope,
  Chat,
  Camera,
  Image as ImageIcon,
  Folder,
  House,
  Car,
  Truck,
  Tree,
  Mountains,
  Leaf,
  Check
} from '@phosphor-icons/react';

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

export function ModalAdicionarNota({ isOpen, onClose, clienteId, projetoId, onSuccess }: ModalAdicionarNotaProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [categorias, setCategorias] = useState<NotaCategoriaItem[]>(() => {
    const salvas = localStorage.getItem('geogestor_jornada_categorias');
    if (salvas) {
      try {
        return JSON.parse(salvas);
      } catch {
        return DEFAULT_CATEGORIAS;
      }
    }
    return DEFAULT_CATEGORIAS;
  });
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('Interno');

  // Painel de nova categoria
  const [showCatCreator, setShowCatCreator] = useState(false);
  const [newCatNome, setNewCatNome] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Folder');
  const [newCatCor, setNewCatCor] = useState('#8b5cf6');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setTitulo('');
        setDescricao('');
        setDataEvento(new Date().toISOString().split('T')[0]);
        setShowCatCreator(false);
      }, 0);
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'unset';
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  const handleSalvarCategoria = async () => {
    if (!newCatNome.trim()) return;
    const nova: NotaCategoriaItem = {
      id: `cat-${Date.now()}`,
      nome: newCatNome.trim(),
      icone: newCatIcon,
      cor: newCatCor
    };
    const listaAtualizada = [...categorias, nova];
    await persistOperationalSetting('geogestor_jornada_categorias', listaAtualizada);
    setCategorias(listaAtualizada);
    setCategoriaSelecionada(nova.nome);
    setNewCatNome('');
    setShowCatCreator(false);
  };

  const handleSubmeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error('Por favor, informe o título da nota.');
      return;
    }
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
      onSuccess?.();
      onClose();
    } catch {
      toast.error('Erro ao salvar nota na Jornada do Cliente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm animate-fade-in md:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={geoModalTransition}
        className="relative max-h-[96vh] w-full max-w-xl overflow-visible rounded-lg border border-zinc-700/80 bg-zinc-900/95 p-6 text-zinc-100 shadow-xl ring-1 ring-white/[0.03] motion-gpu md:p-8"
      >
        {/* Cabeçalho */}
        <div className="mb-5 flex items-center justify-between border-b border-zinc-700/80 pb-5">
          <h3 className="text-lg font-bold tracking-tight text-white">Adicionar Nota</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de nota"
            className="rounded-lg p-2 text-zinc-400 transition-[background-color,color,box-shadow] duration-150 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmeter} className="space-y-4">
          {/* Título * */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">Título *</label>
            <input
              id="nota-titulo"
              name="titulo"
              type="text"
              required
              autoComplete="off"
              aria-label="Titulo da nota"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Documentação recebida"
              className={cn(geoFieldClass, 'h-11 w-full px-4 text-sm font-medium')}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">Descrição</label>
            <textarea
              id="nota-descricao"
              name="descricao"
              rows={3}
              aria-label="Descricao da nota"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Detalhes adicionais..."
              className={cn(geoFieldClass, 'w-full resize-none p-4 text-sm font-medium')}
            />
          </div>

          {/* Data do Evento */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">Data do Evento</label>
            <div className="relative">
              <DatePickerField
                id="nota-data-evento"
                name="dataEvento"
                aria-label="Data do evento"
                value={dataEvento}
                onChange={e => setDataEvento(e.target.value)}
                className={cn(geoFieldClass, 'h-11 w-full px-4 pr-11 text-sm font-semibold')}
              />
              <Calendar className="absolute right-4 top-3 text-zinc-500 pointer-events-none" size={18} />
            </div>
          </div>

          {/* Categoria * */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">Categoria *</label>
            <div className="flex gap-2.5">
              <FormSelect
                id="nota-categoria"
                name="categoria"
                aria-label="Categoria da nota"
                value={categoriaSelecionada}
                onChange={e => setCategoriaSelecionada(e.target.value)}
                className={cn(geoFieldClass, 'h-11 flex-1 cursor-pointer px-4 text-sm font-semibold')}
              >
                {categorias.map(c => (
                  <option key={c.id} value={c.nome} className="bg-zinc-900 py-1 text-white">
                    {c.nome}
                  </option>
                ))}
              </FormSelect>
              <button
                type="button"
                onClick={() => { setShowCatCreator(!showCatCreator); setShowIconPicker(false); setShowColorPicker(false); }}
                aria-label="Criar nova categoria"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 ${
                  showCatCreator
                    ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
                    : 'border-zinc-700 bg-zinc-800/85 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white'
                }`}
                title="Criar nova categoria"
              >
                <Plus size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* Painel embutido para criar uma categoria sem sair do formulário. */}
          <AnimatePresence>
            {showCatCreator && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={geoViewTransition}
                className="mt-2 space-y-3 rounded-lg border border-zinc-700/80 bg-zinc-800/55 p-4 motion-gpu"
              >
                <input
                  id="nota-nova-categoria"
                  name="novaCategoria"
                  type="text"
                  autoComplete="off"
                  value={newCatNome}
                  onChange={e => setNewCatNome(e.target.value)}
                  placeholder="Nome da categoria"
                  aria-label="Nome da nova categoria"
                  className={cn(geoFieldClass, 'h-10 w-full px-3.5 text-xs')}
                />

                <div className="flex items-center gap-2 relative">
                  {/* Botão Seletor de Ícone */}
                  <button
                    type="button"
                    onClick={() => { setShowIconPicker(!showIconPicker); setShowColorPicker(false); }}
                    className="flex h-9 flex-1 items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/85 px-3 text-xs text-zinc-300 transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-zinc-600 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center text-indigo-300">
                        {ICON_MAP[newCatIcon] || <Folder />}
                      </span>
                      <span>Ícone</span>
                    </span>
                    <Plus size={12} className="text-zinc-500" />
                  </button>

                  {/* Botão Seletor de Cor */}
                  <button
                    type="button"
                    onClick={() => { setShowColorPicker(!showColorPicker); setShowIconPicker(false); }}
                    className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/85 px-3 text-xs text-zinc-300 transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-zinc-600 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white/10"
                      style={{ backgroundColor: newCatCor }}
                    />
                    <span>Cor</span>
                  </button>

                  {/* Botão Criar Categoria */}
                  <button
                    type="button"
                    onClick={handleSalvarCategoria}
                    className={cn(primarySubmitButtonClass, 'h-9 min-h-9 px-4 py-0 text-xs')}
                  >
                    Criar
                  </button>
                </div>

                {/* Popover Grade de Ícones */}
                {showIconPicker && (
                  <div className="mt-2 grid max-h-36 grid-cols-7 gap-1.5 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-2.5">
                    {Object.keys(ICON_MAP).map(iconName => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => { setNewCatIcon(iconName); setShowIconPicker(false); }}
                        aria-label={`Selecionar icone ${iconName}`}
                        className={`flex items-center justify-center rounded-lg p-2 transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 ${
                          newCatIcon === iconName
                            ? 'bg-indigo-600 text-white'
                            : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        {ICON_MAP[iconName]}
                      </button>
                    ))}
                  </div>
                )}

                {/* Popover Grade de Cores */}
                {showColorPicker && (
                  <div className="mt-2 grid grid-cols-4 gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => { setNewCatCor(c.hex); setShowColorPicker(false); }}
                        className="flex items-center gap-2 rounded-lg p-1.5 text-left transition-[background-color,box-shadow] duration-150 hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25"
                      >
                        <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                        <span className="text-xs text-zinc-300">{c.name}</span>
                        {newCatCor === c.hex && <Check size={12} className="ml-auto text-indigo-300" />}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botão Submit Principal no Rodapé */}
          <div className="pt-4 mt-2">
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className={cn(primarySubmitButtonClass, 'flex h-12 w-full items-center justify-center gap-2')}
            >
              {loading ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
