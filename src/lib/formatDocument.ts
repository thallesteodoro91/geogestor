/**
 * Formata CPF no padrão 000.000.000-00
 */
export function formatCPF(value: string): string {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  
  // Aplica a máscara
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Formata CNPJ no padrão 00.000.000/0000-00
 */
export function formatCNPJ(value: string): string {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  
  // Aplica a máscara
  return numbers
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/**
 * Valida se CPF tem formato válido (apenas formato, não dígito verificador)
 */
export function isValidCPFFormat(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '');
  return numbers.length === 11;
}

/**
 * Valida se CNPJ tem formato válido (apenas formato, não dígito verificador)
 */
export function isValidCNPJFormat(cnpj: string): boolean {
  const numbers = cnpj.replace(/\D/g, '');
  return numbers.length === 14;
}

/**
 * Remove formatação de CPF ou CNPJ
 */
export function cleanDocument(value: string): string {
  return value.replace(/\D/g, '');
}
