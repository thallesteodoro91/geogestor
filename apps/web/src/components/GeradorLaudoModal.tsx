import { toast } from 'sonner';
import { DatePickerField, FormSelect } from './Form';
import { useState } from 'react';
import { Modal } from './Modal';
import { FilePdf } from '@phosphor-icons/react';
import { gerarLaudoTecnico } from '../utils/laudoPdfGenerator';
import type { LaudoOptions } from '../utils/laudoPdfGenerator';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../utils/actionStyles';
import { geoFieldClass } from '../utils/geoTheme';
import { cn } from '../utils/cn';

interface GeradorLaudoModalProps {
  isOpen: boolean;
  onClose: () => void;
  projetoId: string;
  projetoNome: string;
}

const localToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const initialFormData = (projetoNome: string): Partial<LaudoOptions> => ({
  projetoNome,
  clienteNome: '',
  tipoLaudo: 'vistoria',
  dataVistoria: localToday(),
  tecnicoResponsavel: '',
  observacoes: '',
});

export function GeradorLaudoModal({ isOpen, onClose, projetoNome }: GeradorLaudoModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<Partial<LaudoOptions>>(() => initialFormData(projetoNome));

  const closeModal = () => {
    setFormData(initialFormData(projetoNome));
    onClose();
  };

  const handleChange = (field: keyof LaudoOptions, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.clienteNome?.trim() || !formData.tecnicoResponsavel?.trim()) {
      toast.error('Preencha os campos obrigatórios (Cliente e Técnico).');
      return;
    }

    if (isGenerating) return;
    setIsGenerating(true);
    try {
      await gerarLaudoTecnico({ ...formData, projetoNome } as LaudoOptions);
      toast.success('PDF gerado com sucesso.');
      closeModal();
    } catch {
      toast.error('Não foi possível gerar o PDF. Revise os dados e tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Gerar Laudo Técnico"
      initialFocusId="laudo-tipo"
      closeDisabled={isGenerating}
    >
      <div className="space-y-4 p-1">
        
        <div className="mb-4 text-sm text-zinc-500">
          Projeto: <strong className="text-zinc-700 dark:text-zinc-300">{projetoNome}</strong>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="laudo-tipo" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de Laudo
            </label>
            <FormSelect
              id="laudo-tipo"
              name="tipoLaudo"
              autoComplete="off"
              value={formData.tipoLaudo}
              onChange={(e) => handleChange('tipoLaudo', e.target.value)}
              className={cn(geoFieldClass, 'w-full px-3 py-2 text-sm')}
            >
              <option value="vistoria">Vistoria Técnica</option>
              <option value="fauna">Monitoramento de Fauna</option>
              <option value="flora">Inventário Florestal</option>
              <option value="outros">Laudo Ambiental Genérico</option>
            </FormSelect>
          </div>
          <div>
            <label htmlFor="laudo-data" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Data da Vistoria
            </label>
            <DatePickerField
              id="laudo-data"
              name="dataVistoria"
              autoComplete="off"
              required
              value={formData.dataVistoria}
              onChange={(e) => handleChange('dataVistoria', e.target.value)}
              className={cn(geoFieldClass, 'w-full px-3 py-2 text-sm')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="laudo-cliente" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              id="laudo-cliente"
              name="clienteNome"
              type="text"
              autoComplete="organization"
              required
              maxLength={200}
              placeholder="Nome do cliente/empresa"
              value={formData.clienteNome}
              onChange={(e) => handleChange('clienteNome', e.target.value)}
              className={cn(geoFieldClass, 'w-full px-3 py-2 text-sm')}
            />
          </div>
          <div>
            <label htmlFor="laudo-tecnico" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Técnico Responsável <span className="text-red-500">*</span>
            </label>
            <input
              id="laudo-tecnico"
              name="tecnicoResponsavel"
              type="text"
              autoComplete="name"
              required
              maxLength={200}
              value={formData.tecnicoResponsavel}
              onChange={(e) => handleChange('tecnicoResponsavel', e.target.value)}
              className={cn(geoFieldClass, 'w-full px-3 py-2 text-sm')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="laudo-observacoes" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Parecer Técnico / Observações
          </label>
          <textarea
            id="laudo-observacoes"
            name="observacoes"
            rows={5}
            maxLength={5000}
            placeholder="Descreva as constatações feitas em campo..."
            value={formData.observacoes}
            onChange={(e) => handleChange('observacoes', e.target.value)}
            className={cn(geoFieldClass, 'w-full resize-none px-3 py-2 text-sm')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={closeModal}
            disabled={isGenerating}
            className={secondarySmallActionButtonClass}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className={cn(primarySmallActionButtonClass, 'disabled:cursor-wait disabled:opacity-60')}
          >
            <FilePdf weight="bold" className="h-4 w-4" />
            {isGenerating ? 'Gerando PDF…' : 'Gerar PDF'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
