import { z } from 'zod';

export const StatusProjetoSchema = z.enum([
  'Em Andamento',
  'Aguardando Documentação',
  'Em Análise no Órgão',
  'Concluído',
  'Cancelado'
]);
export type StatusProjeto = z.infer<typeof StatusProjetoSchema>;

export const StatusOrcamentoSchema = z.enum([
  'Pendente',
  'Aprovado',
  'Rejeitado',
  'Expirado'
]);
export type StatusOrcamento = z.infer<typeof StatusOrcamentoSchema>;

export const ProjetoPayloadSchema = z.object({
  nome: z.string().min(1, 'Nome do projeto é obrigatório'),
  clienteId: z.string().min(1, 'Selecione um cliente'),
  descricao: z.string().nullable().optional(),
  status: z.string().optional(),
  dataInicio: z.string().nullable().optional(),
  dataEntrega: z.string().nullable().optional(),
  areaHa: z.number().nullable().optional(),
  matricula: z.string().nullable().optional(),
  car: z.string().nullable().optional(),
  ccir: z.string().nullable().optional(),
  itr: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  municipio: z.string().nullable().optional(),
  situacaoImovel: z.string().nullable().optional(),
  tipo: z.string().nullable().optional(),
  averbacao: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  possuiMemorialDescritivo: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional()
});
export type ProjetoPayload = z.infer<typeof ProjetoPayloadSchema>;

export const ClientePayloadSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  documento: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  celular: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  origem: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  anotacoes: z.string().nullable().optional(),
  situacao: z.string().nullable().optional(),
  previsaoEntrega: z.string().nullable().optional(),
  servicos: z.string().nullable().optional()
});
export type ClientePayload = z.infer<typeof ClientePayloadSchema>;

export interface OrcamentoItem {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number; // Em reais ou centavos dependendo do contexto da interface
  total: number;
}

export interface Cliente {
  id: string;
  nome: string;
  tipo?: string | null;
  cpfCnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  observacoes?: string | null;
  servicos?: string | null;
}

export interface Projeto {
  id: string;
  nome: string;
  clienteId?: string | null;
  descricao?: string | null;
  status?: string;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  areaHa?: number | null;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  situacaoImovel?: string | null;
  tipo?: string | null;
  averbacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  possuiMemorialDescritivo?: string | null;
  observacoes?: string | null;
}

export interface Tarefa {
  id: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string;
  titulo: string;
  descricao?: string;
  status: string;
  prioridade: string;
  dataLimite?: string;
}

export interface Oportunidade {
  id: string;
  estagio: string;
  valorEstimado: number | null;
  nome?: string;
  clienteId?: string | null;
}

export interface DRE {
  mes: string;
  receitas: number;
  despesas: number;
  lucro: number;
}
