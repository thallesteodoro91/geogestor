import { z } from "zod";

// Auth validations
export const authSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email deve ter no máximo 255 caracteres" }),
  password: z
    .string()
    .min(8, { message: "Senha deve ter no mínimo 8 caracteres" })
    .max(100, { message: "Senha deve ter no máximo 100 caracteres" }),
});

// Despesas validations
export const despesaSchema = z.object({
  valor_da_despesa: z
    .number({
      required_error: "Valor é obrigatório",
      invalid_type_error: "Valor deve ser um número",
    })
    .positive({ message: "Valor deve ser positivo" })
    .max(999999999, { message: "Valor muito alto" })
    .finite({ message: "Valor inválido" }),
  data_da_despesa: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida" }),
  id_tipodespesa: z
    .string()
    .uuid({ message: "Tipo de despesa inválido" })
    .optional()
    .nullable(),
  id_servico: z
    .string()
    .uuid({ message: "Serviço inválido" })
    .optional()
    .nullable(),
  observacoes: z
    .string()
    .max(1000, { message: "Observações devem ter no máximo 1000 caracteres" })
    .optional(),
});

// Servicos validations
export const servicoSchema = z.object({
  nome_do_servico: z
    .string()
    .trim()
    .min(1, { message: "Nome é obrigatório" })
    .max(200, { message: "Nome deve ter no máximo 200 caracteres" }),
  id_cliente: z
    .string()
    .uuid({ message: "Cliente inválido" })
    .optional()
    .nullable(),
  id_propriedade: z
    .string()
    .uuid({ message: "Propriedade inválida" })
    .optional()
    .nullable(),
  categoria: z
    .string()
    .max(100, { message: "Categoria deve ter no máximo 100 caracteres" })
    .optional()
    .nullable(),
  data_do_servico_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inicial inválida" })
    .optional()
    .nullable(),
  data_do_servico_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data final inválida" })
    .optional()
    .nullable(),
  situacao_do_servico: z
    .string()
    .max(50, { message: "Situação deve ter no máximo 50 caracteres" })
    .optional()
    .nullable(),
  receita_servico: z
    .number({
      invalid_type_error: "Receita deve ser um número",
    })
    .min(0, { message: "Receita não pode ser negativa" })
    .max(999999999, { message: "Receita muito alta" })
    .finite({ message: "Receita inválida" })
    .optional()
    .nullable(),
  custo_servico: z
    .number({
      invalid_type_error: "Custo deve ser um número",
    })
    .min(0, { message: "Custo não pode ser negativo" })
    .max(999999999, { message: "Custo muito alto" })
    .finite({ message: "Custo inválido" })
    .optional()
    .nullable(),
});

// Orcamentos validations
export const orcamentoSchema = z.object({
  id_cliente: z
    .string()
    .uuid({ message: "Cliente inválido" })
    .optional()
    .nullable(),
  id_servico: z
    .string()
    .uuid({ message: "Serviço inválido" })
    .optional()
    .nullable(),
  data_orcamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data do orçamento inválida" }),
  valor_unitario: z
    .number({
      required_error: "Valor unitário é obrigatório",
      invalid_type_error: "Valor unitário deve ser um número",
    })
    .positive({ message: "Valor unitário deve ser positivo" })
    .max(999999999, { message: "Valor unitário muito alto" })
    .finite({ message: "Valor unitário inválido" }),
  quantidade: z
    .number({
      required_error: "Quantidade é obrigatória",
      invalid_type_error: "Quantidade deve ser um número",
    })
    .int({ message: "Quantidade deve ser um número inteiro" })
    .positive({ message: "Quantidade deve ser positiva" })
    .max(1000000, { message: "Quantidade muito alta" }),
  situacao_do_pagamento: z
    .string()
    .max(50, { message: "Situação deve ter no máximo 50 caracteres" })
    .optional()
    .nullable(),
  forma_de_pagamento: z
    .string()
    .max(50, { message: "Forma de pagamento deve ter no máximo 50 caracteres" })
    .optional()
    .nullable(),
});

// Cliente validations
export const clienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, { message: "Nome é obrigatório" })
    .max(200, { message: "Nome deve ter no máximo 200 caracteres" }),
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email deve ter no máximo 255 caracteres" })
    .optional()
    .nullable()
    .or(z.literal("")),
  telefone: z
    .string()
    .max(20, { message: "Telefone deve ter no máximo 20 caracteres" })
    .optional()
    .nullable(),
  cpf: z
    .string()
    .max(14, { message: "CPF deve ter no máximo 14 caracteres" })
    .optional()
    .nullable(),
  cnpj: z
    .string()
    .max(18, { message: "CNPJ deve ter no máximo 18 caracteres" })
    .optional()
    .nullable(),
  endereco: z
    .string()
    .max(500, { message: "Endereço deve ter no máximo 500 caracteres" })
    .optional()
    .nullable(),
});
