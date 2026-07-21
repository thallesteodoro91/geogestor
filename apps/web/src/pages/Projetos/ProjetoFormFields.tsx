import type { Dispatch, SetStateAction } from 'react';
import { Compass, FileText, MapPin, Plus, PresentationChart, Scales } from '@phosphor-icons/react';
import { DatePickerField, FormField, FormSection, FormSelect } from '../../components/Form';
import { cn } from '../../utils/cn';
import { secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { geoFieldClass } from '../../utils/geoTheme';
import type { ProjectFormErrors, ProjectFormState, ProjectModalTab } from './projectForm';

interface ProjectClientOption {
  id: string;
  nome: string;
}

interface ProjetoFormFieldsProps {
  form: ProjectFormState;
  setForm: Dispatch<SetStateAction<ProjectFormState>>;
  errors: ProjectFormErrors;
  activeTab: ProjectModalTab;
  clientes: ProjectClientOption[];
  onClearErrors: (...fields: Array<keyof ProjectFormState>) => void;
  onCreateClient: () => void;
}

const fieldClass = cn(geoFieldClass, 'h-12 w-full px-4 font-medium');
const textareaClass = cn(geoFieldClass, 'min-h-[112px] w-full resize-y px-4 py-3 font-medium leading-relaxed');

const describedBy = (field: keyof ProjectFormState, errors: ProjectFormErrors, hintId?: string) => {
  const ids = [errors[field] ? `project-${field}-error` : '', hintId || ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
};

export function ProjetoFormFields({
  form,
  setForm,
  errors,
  activeTab,
  clientes,
  onClearErrors,
  onCreateClient
}: ProjetoFormFieldsProps) {
  const update = <K extends keyof ProjectFormState>(field: K, value: ProjectFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    onClearErrors(field);
  };

  if (activeTab === 'projeto') {
    const isEnvironmental = form.tipo === 'Ambiental' || form.tipo === 'Licenciamento';
    const isExpertAssessment = form.tipo === 'Perícia';
    return (
      <div className="space-y-4">
        <FormSection
          sectionId="project-section-essential"
          title="Identificação e planejamento"
          description="Defina o cliente, o escopo resumido e as datas principais do trabalho."
          icon={<PresentationChart className="h-5 w-5" weight="duotone" />}
          tone="indigo"
        >
          <FormField htmlFor="project-nome" label="Nome do projeto" required error={errors.nome} className="min-w-0">
            <input
              id="project-nome"
              name="nome"
              type="text"
              autoComplete="off"
              value={form.nome}
              onChange={(event) => update('nome', event.target.value)}
              placeholder="Ex.: Levantamento planialtimétrico — Lote 5"
              maxLength={160}
              aria-invalid={Boolean(errors.nome)}
              aria-describedby={describedBy('nome', errors)}
              className={fieldClass}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField htmlFor="project-clienteId" label="Cliente" required error={errors.clienteId}>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row md:col-span-1 md:flex-col xl:flex-row">
                <FormSelect
                  id="project-clienteId"
                  name="clienteId"
                  autoComplete="off"
                  value={form.clienteId}
                  onChange={(event) => update('clienteId', event.target.value)}
                  aria-invalid={Boolean(errors.clienteId)}
                  aria-describedby={describedBy('clienteId', errors)}
                  className={cn(fieldClass, 'min-w-0 flex-1 geo-native-select cursor-pointer')}
                >
                  <option value="">Selecione um cliente…</option>
                  {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                </FormSelect>
                <button
                  id="project-create-client"
                  type="button"
                  onClick={onCreateClient}
                  className={cn(secondarySmallActionButtonClass, 'h-12 shrink-0 gap-2 px-3')}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" weight="bold" />
                  Novo cliente
                </button>
              </div>
            </FormField>
            <FormField htmlFor="project-tipo" label="Tipo do projeto ou serviço" required error={errors.tipo}>
              <FormSelect
                id="project-tipo"
                name="tipo"
                autoComplete="off"
                value={form.tipo}
                onChange={(event) => update('tipo', event.target.value)}
                aria-invalid={Boolean(errors.tipo)}
                aria-describedby={describedBy('tipo', errors)}
                className={cn(fieldClass, 'geo-native-select cursor-pointer')}
              >
                <option value="">Selecione…</option>
                <option value="Rural">Rural</option>
                <option value="Urbano">Urbano</option>
                <option value="Comercial">Comercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Ambiental">Ambiental</option>
                <option value="Licenciamento">Licenciamento</option>
                <option value="Perícia">Perícia</option>
                <option value="Institucional">Institucional</option>
                <option value="Outro">Outro</option>
              </FormSelect>
            </FormField>
            <FormField htmlFor="project-status" label="Status inicial">
              <FormSelect id="project-status" name="status" autoComplete="off" value={form.status} onChange={(event) => update('status', event.target.value)} className={cn(fieldClass, 'geo-native-select cursor-pointer')}>
                <option value="Planejamento">Planejamento</option>
                <option value="Em Análise">Em análise</option>
                <option value="Em Andamento">Em andamento</option>
                <option value="Aguardando Cliente">Aguardando cliente</option>
                <option value="Aguardando Órgão">Aguardando órgão</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Cancelado">Cancelado</option>
              </FormSelect>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField htmlFor="project-dataInicio" label="Início previsto" error={errors.dataInicio}>
              <DatePickerField id="project-dataInicio" name="dataInicio" autoComplete="off" value={form.dataInicio} onChange={(event) => update('dataInicio', event.target.value)} aria-invalid={Boolean(errors.dataInicio)} aria-describedby={describedBy('dataInicio', errors)} className={fieldClass} />
            </FormField>
            <FormField htmlFor="project-dataEntrega" label="Previsão de entrega" error={errors.dataEntrega}>
              <DatePickerField id="project-dataEntrega" name="dataEntrega" autoComplete="off" min={form.dataInicio || undefined} value={form.dataEntrega} onChange={(event) => update('dataEntrega', event.target.value)} aria-invalid={Boolean(errors.dataEntrega)} aria-describedby={describedBy('dataEntrega', errors)} className={fieldClass} />
            </FormField>
          </div>

          <FormField htmlFor="project-descricao" label="Descrição curta" hint={`${form.descricao.length}/500 caracteres`}>
            <textarea id="project-descricao" name="descricao" value={form.descricao} onChange={(event) => update('descricao', event.target.value)} placeholder="Resuma a finalidade, o escopo e o principal produto a entregar." rows={4} maxLength={500} aria-describedby="project-descricao-hint" className={textareaClass} />
          </FormField>
        </FormSection>

        {isEnvironmental && (
          <FormSection
            sectionId="project-section-environmental"
            title={form.tipo === 'Licenciamento' ? 'Dados do licenciamento' : 'Dados da demanda ambiental'}
            description="Registre o órgão, o tipo de demanda e o número usado para acompanhamento."
            icon={<FileText className="h-5 w-5" weight="duotone" />}
            tone="emerald"
            optional
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {form.tipo === 'Licenciamento' ? (
                <FormField htmlFor="project-tipoLicenca" label="Tipo de licença">
                  <FormSelect id="project-tipoLicenca" name="tipoLicenca" autoComplete="off" value={form.tipoLicenca} onChange={(event) => update('tipoLicenca', event.target.value)} className={cn(fieldClass, 'geo-native-select cursor-pointer')}>
                    <option value="">Selecione…</option>
                    <option value="LP">Licença Prévia — LP</option>
                    <option value="LI">Licença de Instalação — LI</option>
                    <option value="LO">Licença de Operação — LO</option>
                    <option value="Renovação">Renovação</option>
                    <option value="Outros">Outros</option>
                  </FormSelect>
                </FormField>
              ) : (
                <FormField htmlFor="project-tipoDemanda" label="Tipo de demanda">
                  <FormSelect id="project-tipoDemanda" name="tipoDemanda" autoComplete="off" value={form.tipoDemanda} onChange={(event) => update('tipoDemanda', event.target.value)} className={cn(fieldClass, 'geo-native-select cursor-pointer')}>
                    <option value="">Selecione…</option>
                    <option value="Autorização ambiental">Autorização ambiental</option>
                    <option value="Estudo ambiental">Estudo ambiental</option>
                    <option value="Monitoramento ambiental">Monitoramento ambiental</option>
                    <option value="Regularização ambiental">Regularização ambiental</option>
                    <option value="Recuperação ambiental">Recuperação ambiental</option>
                    <option value="Laudo técnico">Laudo técnico</option>
                    <option value="Outros">Outros</option>
                  </FormSelect>
                </FormField>
              )}
              <FormField htmlFor="project-orgaoAmbiental" label="Órgão ambiental">
                <input id="project-orgaoAmbiental" name="orgaoAmbiental" type="text" autoComplete="organization" value={form.orgaoAmbiental} onChange={(event) => update('orgaoAmbiental', event.target.value)} placeholder="Ex.: IMA, IBAMA" className={fieldClass} />
              </FormField>
              <FormField htmlFor="project-protocolo" label="Processo ou protocolo">
                <input id="project-protocolo" name="protocolo" type="text" autoComplete="off" spellCheck={false} value={form.protocolo} onChange={(event) => update('protocolo', event.target.value)} placeholder="Ex.: 2026.000123" className={fieldClass} />
              </FormField>
            </div>
            {form.tipo === 'Licenciamento' && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField htmlFor="project-numeroLicenca" label="Número da licença" required error={errors.numeroLicenca}>
                    <input id="project-numeroLicenca" name="numeroLicenca" type="text" autoComplete="off" spellCheck={false} value={form.numeroLicenca} onChange={(event) => update('numeroLicenca', event.target.value)} placeholder="Ex.: LAO 1234/2026" aria-invalid={Boolean(errors.numeroLicenca)} aria-describedby={describedBy('numeroLicenca', errors)} className={fieldClass} />
                  </FormField>
                  <FormField htmlFor="project-dataEmissao" label="Data de emissão">
                    <DatePickerField id="project-dataEmissao" name="dataEmissao" autoComplete="off" value={form.dataEmissao} onChange={(event) => update('dataEmissao', event.target.value)} className={fieldClass} />
                  </FormField>
                  <FormField htmlFor="project-dataVencimentoLicenca" label="Data de vencimento" required error={errors.dataVencimentoLicenca}>
                    <DatePickerField id="project-dataVencimentoLicenca" name="dataVencimentoLicenca" autoComplete="off" min={form.dataEmissao || undefined} value={form.dataVencimentoLicenca} onChange={(event) => update('dataVencimentoLicenca', event.target.value)} aria-invalid={Boolean(errors.dataVencimentoLicenca)} aria-describedby={describedBy('dataVencimentoLicenca', errors)} className={fieldClass} />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField htmlFor="project-statusLicenca" label="Status inicial">
                    <FormSelect id="project-statusLicenca" name="statusLicenca" autoComplete="off" value={form.statusLicenca} onChange={(event) => update('statusLicenca', event.target.value)} className={cn(fieldClass, 'geo-native-select cursor-pointer')}>
                      <option value="Em análise">Em análise</option>
                      <option value="Válida">Válida</option>
                      <option value="Em renovação">Em renovação</option>
                      <option value="Suspensa">Suspensa</option>
                      <option value="Encerrada">Encerrada</option>
                    </FormSelect>
                  </FormField>
                  <FormField htmlFor="project-observacoesLicenca" label="Observações da licença" className="md:col-span-2">
                    <input id="project-observacoesLicenca" name="observacoesLicenca" type="text" autoComplete="off" value={form.observacoesLicenca} onChange={(event) => update('observacoesLicenca', event.target.value)} placeholder="Restrições, renovação ou referência documental" maxLength={2000} className={fieldClass} />
                  </FormField>
                </div>
              </>
            )}
          </FormSection>
        )}

        {isExpertAssessment && (
          <FormSection
            sectionId="project-section-expert-assessment"
            title="Dados da perícia"
            description="Registre a modalidade, o processo relacionado e a data prevista para a vistoria."
            icon={<Scales className="h-5 w-5" weight="duotone" />}
            tone="emerald"
            optional
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField htmlFor="project-tipoPericia" label="Tipo de perícia">
                <FormSelect id="project-tipoPericia" name="tipoPericia" autoComplete="off" value={form.tipoPericia} onChange={(event) => update('tipoPericia', event.target.value)} className={cn(fieldClass, 'geo-native-select cursor-pointer')}>
                  <option value="">Selecione…</option>
                  <option value="Judicial">Judicial</option>
                  <option value="Extrajudicial">Extrajudicial</option>
                  <option value="Assistência técnica">Assistência técnica</option>
                  <option value="Avaliação técnica">Avaliação técnica</option>
                  <option value="Outro">Outro</option>
                </FormSelect>
              </FormField>
              <FormField htmlFor="project-numeroProcesso" label="Número do processo">
                <input id="project-numeroProcesso" name="numeroProcesso" type="text" autoComplete="off" spellCheck={false} value={form.numeroProcesso} onChange={(event) => update('numeroProcesso', event.target.value)} placeholder="Ex.: 5001234-56.2026.8.24.0000" className={fieldClass} />
              </FormField>
              <FormField htmlFor="project-dataVistoria" label="Data da vistoria">
                <DatePickerField id="project-dataVistoria" name="dataVistoria" autoComplete="off" value={form.dataVistoria} onChange={(event) => update('dataVistoria', event.target.value)} className={fieldClass} />
              </FormField>
            </div>
          </FormSection>
        )}
      </div>
    );
  }

  if (activeTab === 'propriedade') {
    const isRural = form.tipo === 'Rural';
    return (
      <div className="space-y-4">
        <FormSection
          sectionId="project-section-property"
          title="Dados do imóvel"
          description="Informe a área e a situação documental do imóvel associado ao trabalho, quando aplicável."
          icon={<Compass className="h-5 w-5" weight="duotone" />}
          tone="amber"
          optional
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField htmlFor="project-area" label="Área estimada" error={errors.area} hint="O valor será armazenado em hectares.">
              <div className="flex min-w-0">
                <input id="project-area" name="area" type="text" inputMode="decimal" autoComplete="off" value={form.area} onChange={(event) => update('area', event.target.value)} placeholder={form.areaUnit === 'ha' ? 'Ex.: 120,4500' : 'Ex.: 1250,00'} aria-invalid={Boolean(errors.area)} aria-describedby={describedBy('area', errors, 'project-area-hint')} className={cn(fieldClass, 'min-w-0 rounded-r-none')} />
                <FormSelect aria-label="Unidade da área" name="areaUnit" value={form.areaUnit} onChange={(event) => update('areaUnit', event.target.value as ProjectFormState['areaUnit'])} className={cn(fieldClass, 'w-24 shrink-0 rounded-l-none border-l-0 px-3 text-sm')}>
                  <option value="ha">ha</option>
                  <option value="m2">m²</option>
                </FormSelect>
              </div>
            </FormField>
            <FormField htmlFor="project-situacaoImovel" label="Situação fundiária">
              <FormSelect id="project-situacaoImovel" name="situacaoImovel" autoComplete="off" value={form.situacaoImovel} onChange={(event) => update('situacaoImovel', event.target.value)} className={cn(fieldClass, 'geo-native-select cursor-pointer')}>
                <option value="">Não informado</option>
                <option value="Regularizado">Regularizado</option>
                <option value="Pendente">Pendente</option>
                <option value="Posse">Posse</option>
                <option value="Arrendado">Arrendado</option>
              </FormSelect>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField htmlFor="project-matricula" label="Número da matrícula">
              <input id="project-matricula" name="matricula" type="text" autoComplete="off" spellCheck={false} value={form.matricula} onChange={(event) => update('matricula', event.target.value)} placeholder="Ex.: Matrícula 12.345" className={fieldClass} />
            </FormField>
            <FormField htmlFor="project-averbacao" label="Averbação">
              <input id="project-averbacao" name="averbacao" type="text" autoComplete="off" spellCheck={false} value={form.averbacao} onChange={(event) => update('averbacao', event.target.value)} placeholder="Ex.: AV-3-12.345" className={fieldClass} />
            </FormField>
          </div>
        </FormSection>

        {isRural && (
          <FormSection
            sectionId="project-section-rural-documents"
            title="Documentação rural"
            description="Esses identificadores aparecem apenas para imóveis classificados como rurais."
            icon={<FileText className="h-5 w-5" weight="duotone" />}
            tone="emerald"
            optional
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField htmlFor="project-car" label="CAR">
                <input id="project-car" name="car" type="text" autoComplete="off" spellCheck={false} value={form.car} onChange={(event) => update('car', event.target.value)} placeholder="Código do CAR" className={fieldClass} />
              </FormField>
              <FormField htmlFor="project-ccir" label="CCIR">
                <input id="project-ccir" name="ccir" type="text" autoComplete="off" spellCheck={false} value={form.ccir} onChange={(event) => update('ccir', event.target.value)} placeholder="Código do CCIR" className={fieldClass} />
              </FormField>
              <FormField htmlFor="project-itr" label="ITR / Nirf">
                <input id="project-itr" name="itr" type="text" autoComplete="off" spellCheck={false} value={form.itr} onChange={(event) => update('itr', event.target.value)} placeholder="Código do ITR" className={fieldClass} />
              </FormField>
            </div>
          </FormSection>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormSection
        sectionId="project-section-location"
        title="Localização"
        description="Use município e UF como referência administrativa e coordenadas em graus decimais."
        icon={<MapPin className="h-5 w-5" weight="duotone" />}
        tone="cyan"
        optional
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_8rem]">
          <FormField htmlFor="project-municipio" label="Município">
            <input id="project-municipio" name="municipio" type="text" autoComplete="address-level2" value={form.municipio} onChange={(event) => update('municipio', event.target.value)} placeholder="Ex.: Florianópolis" className={fieldClass} />
          </FormField>
          <FormField htmlFor="project-uf" label="UF" error={errors.uf}>
            <input id="project-uf" name="uf" type="text" autoComplete="address-level1" spellCheck={false} value={form.uf} onChange={(event) => update('uf', event.target.value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase())} placeholder="SC" maxLength={2} aria-invalid={Boolean(errors.uf)} aria-describedby={describedBy('uf', errors)} className={fieldClass} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField htmlFor="project-latitude" label="Latitude" error={errors.latitude} hint="Graus decimais — SIRGAS 2000.">
            <input id="project-latitude" name="latitude" type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={form.latitude} onChange={(event) => update('latitude', event.target.value)} placeholder="Ex.: -27,594870" aria-invalid={Boolean(errors.latitude)} aria-describedby={describedBy('latitude', errors, 'project-latitude-hint')} className={fieldClass} />
          </FormField>
          <FormField htmlFor="project-longitude" label="Longitude" error={errors.longitude} hint="Informe latitude e longitude juntas.">
            <input id="project-longitude" name="longitude" type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={form.longitude} onChange={(event) => update('longitude', event.target.value)} placeholder="Ex.: -48,548220" aria-invalid={Boolean(errors.longitude)} aria-describedby={describedBy('longitude', errors, 'project-longitude-hint')} className={fieldClass} />
          </FormField>
          <FormField htmlFor="project-possuiMemorialDescritivo" label="Memorial descritivo">
            <FormSelect id="project-possuiMemorialDescritivo" name="possuiMemorialDescritivo" autoComplete="off" value={form.possuiMemorialDescritivo} onChange={(event) => update('possuiMemorialDescritivo', event.target.value)} className={cn(fieldClass, 'geo-native-select cursor-pointer')}>
              <option value="">Não informado</option>
              <option value="Não">Não</option>
              <option value="Em Confecção">Em confecção</option>
              <option value="Sim">Sim</option>
            </FormSelect>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        sectionId="project-section-notes"
        title="Notas técnicas"
        description="Registre limites, marcos, acessos, referências e trâmites relevantes para a equipe."
        icon={<FileText className="h-5 w-5" weight="duotone" />}
        tone="indigo"
        optional
      >
        <FormField htmlFor="project-observacoes" label="Observações" hint={`${form.observacoes.length}/1200 caracteres`}>
          <textarea id="project-observacoes" name="observacoes" value={form.observacoes} onChange={(event) => update('observacoes', event.target.value)} placeholder="Ex.: acesso pelo portão norte; marco M-03 não localizado em campo." rows={5} maxLength={1200} aria-describedby="project-observacoes-hint" className={textareaClass} />
        </FormField>
      </FormSection>
    </div>
  );
}
