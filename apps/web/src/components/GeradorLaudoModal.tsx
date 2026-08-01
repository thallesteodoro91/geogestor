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

export function GeradorLaudoModal({ isOpen, onClose, projetoNome }: GeradorLaudoModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<Partial<LaudoOptions>>({
    projetoNome: projetoNome,
    clienteNome: '',
    tipoLaudo: 'vistoria',
    dataVistoria: new Date().toISOString().split('T')[0],
    tecnicoResponsavel: 'Eng. Thalles',
    observacoes: '',
  });

  const handleChange = (field: keyof LaudoOptions, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.clienteNome || !formData.tecnicoResponsavel) {
      toast.error('Preencha os campos obrigatórios (Cliente e Técnico).');
      return;
    }

    if (isGenerating) return;
    setIsGenerating(true);
    try {
      await gerarLaudoTecnico(formData as LaudoOptions);
      onClose();
    } catch {
      toast.error('Não foi possível gerar o PDF. Revise os dados e tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gerar Laudo Técnico"
    >
      <div className="space-y-4 p-1">
        
        <div className="mb-4 text-sm text-zinc-500">
          Projeto: <strong className="text-zinc-700 dark:text-zinc-300">{projetoNome}</strong>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de Laudo
            </label>
            <FormSelect
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
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Data da Vistoria
            </label>
            <DatePickerField
              value={formData.dataVistoria}
              onChange={(e) => handleChange('dataVistoria', e.target.value)}
              className={cn(geoFieldClass, 'w-full px-3 py-2 text-sm')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Nome do cliente/empresa"
              value={formData.clienteNome}
              onChange={(e) => handleChange('clienteNome', e.target.value)}
              className={cn(geoFieldClass, 'w-full px-3 py-2 text-sm')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Técnico Responsável <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.tecnicoResponsavel}
              onChange={(e) => handleChange('tecnicoResponsavel', e.target.value)}
              className={cn(geoFieldClass, 'w-full px-3 py-2 text-sm')}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Parecer Técnico / Observações
          </label>
          <textarea
            rows={5}
            placeholder="Descreva as constatações feitas em campo..."
            value={formData.observacoes}
            onChange={(e) => handleChange('observacoes', e.target.value)}
            className={cn(geoFieldClass, 'w-full resize-none px-3 py-2 text-sm')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
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
