import { supabase } from "@/integrations/supabase/client";

// ========== DADOS ALEATÓRIOS ==========

const PRIMEIROS_NOMES = [
  "João", "Maria", "Pedro", "Ana", "Carlos", "Juliana", "Fernando", "Patrícia",
  "Ricardo", "Fernanda", "Marcelo", "Camila", "Rafael", "Amanda", "Lucas",
  "Larissa", "Gabriel", "Beatriz", "Thiago", "Letícia", "Bruno", "Carolina",
  "Diego", "Natália", "Eduardo", "Priscila", "Felipe", "Vanessa", "Gustavo",
  "Mariana", "André", "Isabela", "Rodrigo", "Gabriela", "Leonardo", "Renata",
  "Marcos", "Daniela", "Paulo", "Cristina", "Henrique", "Luciana", "Vinícius",
  "Tatiana", "Alexandre", "Sandra", "Matheus", "Adriana", "Fábio", "Simone"
];

const SOBRENOMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves",
  "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho",
  "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha",
  "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado",
  "Mendes", "Freitas", "Cardoso", "Ramos", "Gonçalves", "Santana", "Teixeira",
  "Araújo", "Correia", "Pinto", "Monteiro", "Campos", "Azevedo", "Batista"
];

const CIDADES_COORDENADAS = [
  { cidade: "Londrina", lat: -23.310453, lng: -51.169449 },
  { cidade: "Maringá", lat: -23.420503, lng: -51.933068 },
  { cidade: "Cascavel", lat: -24.957520, lng: -53.459268 },
  { cidade: "Curitiba", lat: -25.428954, lng: -49.271230 },
  { cidade: "Ponta Grossa", lat: -25.094773, lng: -50.162088 },
  { cidade: "Foz do Iguaçu", lat: -25.516228, lng: -54.588364 },
  { cidade: "Campo Mourão", lat: -24.046853, lng: -52.381882 },
  { cidade: "Umuarama", lat: -23.764553, lng: -53.314383 },
  { cidade: "Apucarana", lat: -23.550813, lng: -51.461097 },
  { cidade: "Toledo", lat: -24.713655, lng: -53.743082 },
  { cidade: "Guarapuava", lat: -25.390429, lng: -51.462376 },
  { cidade: "Paranavaí", lat: -23.073231, lng: -52.465379 },
  { cidade: "Pato Branco", lat: -26.228674, lng: -52.670599 },
  { cidade: "Francisco Beltrão", lat: -26.080753, lng: -53.055838 },
  { cidade: "Arapongas", lat: -23.416667, lng: -51.433333 },
];

const RUAS = [
  "Rua das Flores", "Avenida Brasil", "Rua São Paulo", "Rua Paraná",
  "Avenida JK", "Rua XV de Novembro", "Rua Marechal Deodoro", "Avenida Santos Dumont",
  "Rua Tiradentes", "Rua Sete de Setembro", "Avenida Rio Branco", "Rua Dom Pedro II",
  "Rua Benjamin Constant", "Avenida Getúlio Vargas", "Rua Castro Alves"
];

const ORIGENS = ["Indicação", "Site", "Evento", "Rede Social", "Visita", "Cold Call", "Parceria"];
const CATEGORIAS_CLIENTE = ["Produtor Rural", "Governo", "Empresa Privada", "Pessoa Física"];
const SITUACOES_CLIENTE = ["Ativo", "Inativo", "Pendente", "Prospecto"];

const NOMES_FAZENDA = [
  "Fazenda São José", "Sítio Boa Vista", "Fazenda Santa Maria", "Chácara Recanto",
  "Fazenda Primavera", "Sítio Esperança", "Fazenda Bela Vista", "Rancho Alegre",
  "Fazenda do Sol", "Sítio Verde Campo", "Fazenda Santa Clara", "Chácara Paraíso",
  "Fazenda Três Irmãos", "Sítio Água Limpa", "Fazenda Nova Era", "Rancho Feliz",
  "Fazenda Ouro Verde", "Sítio das Palmeiras", "Fazenda Santo Antônio", "Chácara do Vale"
];

const SITUACOES_ORCAMENTO = ["Em Análise", "Aprovado", "Recusado", "Em Negociação"];
const STATUS_PAGAMENTO = ["Pendente", "Pago", "Parcial"];
const STATUS_DESPESA = ["Pago", "Pendente"];

const DEMO_TAG = "[DEMO]";

// ========== FUNÇÕES GERADORAS ==========

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCPF(): string {
  const n = () => randomInt(0, 9);
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}

function generateCNPJ(): string {
  const n = () => randomInt(0, 9);
  return `${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}/0001-${n()}${n()}`;
}

function generatePhone(): string {
  const ddd = randomInt(11, 99);
  const p1 = randomInt(9000, 9999);
  const p2 = randomInt(1000, 9999);
  return `(${ddd}) ${p1}-${p2}`;
}

function generateCelular(): string {
  const ddd = randomInt(41, 46); // DDDs do Paraná
  const p1 = randomInt(90000, 99999);
  const p2 = randomInt(1000, 9999);
  return `(${ddd}) ${p1}-${p2}`;
}

function generateEmail(nome: string, sobrenome: string): string {
  const domains = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "terra.com.br"];
  const normalized = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return `${normalized(nome)}.${normalized(sobrenome)}${randomInt(1, 99)}@${randomElement(domains)}`;
}

function generateRandomDate(startYear: number, endYear: number): string {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

// ========== GERADORES DE ENTIDADES ==========

interface DemoCliente {
  nome: string;
  email: string;
  telefone: string;
  celular: string;
  cpf: string | null;
  cnpj: string | null;
  endereco: string;
  categoria: string;
  situacao: string;
  origem: string;
  anotacoes: string;
  data_cadastro: string;
  idade: number;
  tenant_id: string;
}

function generateCliente(tenantId: string): DemoCliente {
  const primeiroNome = randomElement(PRIMEIROS_NOMES);
  const sobrenome1 = randomElement(SOBRENOMES);
  const sobrenome2 = randomElement(SOBRENOMES);
  const nome = `${primeiroNome} ${sobrenome1} ${sobrenome2}`;
  
  const isPJ = Math.random() > 0.7; // 30% são PJ
  const cidadeInfo = randomElement(CIDADES_COORDENADAS);
  
  return {
    nome,
    email: generateEmail(primeiroNome, sobrenome1),
    telefone: generatePhone(),
    celular: generateCelular(),
    cpf: isPJ ? null : generateCPF(),
    cnpj: isPJ ? generateCNPJ() : null,
    endereco: `${randomElement(RUAS)}, ${randomInt(1, 2000)} - ${cidadeInfo.cidade}`,
    categoria: randomElement(CATEGORIAS_CLIENTE),
    situacao: randomElement(SITUACOES_CLIENTE),
    origem: randomElement(ORIGENS),
    anotacoes: `${DEMO_TAG} Cliente de demonstração gerado automaticamente`,
    data_cadastro: generateRandomDate(2023, 2025),
    idade: randomInt(25, 70),
    tenant_id: tenantId,
  };
}

interface DemoPropriedade {
  nome_da_propriedade: string;
  area_ha: number;
  cidade: string;
  municipio: string;
  situacao: string;
  latitude: number;
  longitude: number;
  observacoes: string;
  id_cliente: string;
  tenant_id: string;
}

function generatePropriedade(clienteId: string, tenantId: string, index: number): DemoPropriedade {
  const cidadeInfo = randomElement(CIDADES_COORDENADAS);
  // Adicionar variação nas coordenadas para não empilhar no mesmo ponto
  const latOffset = randomFloat(-0.1, 0.1, 6);
  const lngOffset = randomFloat(-0.1, 0.1, 6);
  
  return {
    nome_da_propriedade: `${randomElement(NOMES_FAZENDA)} ${index > 0 ? index + 1 : ""}`.trim(),
    area_ha: randomFloat(10, 500, 2),
    cidade: cidadeInfo.cidade,
    municipio: cidadeInfo.cidade,
    situacao: "Ativo",
    latitude: cidadeInfo.lat + latOffset,
    longitude: cidadeInfo.lng + lngOffset,
    observacoes: `${DEMO_TAG} Propriedade de demonstração`,
    id_cliente: clienteId,
    tenant_id: tenantId,
  };
}

interface DemoOrcamento {
  data_orcamento: string;
  quantidade: number;
  valor_unitario: number;
  receita_esperada: number;
  lucro_esperado: number;
  margem_esperada: number;
  incluir_imposto: boolean;
  percentual_imposto: number;
  valor_imposto: number;
  situacao: string;
  situacao_do_pagamento: string;
  faturamento: boolean;
  data_do_faturamento: string | null;
  anotacoes: string;
  id_cliente: string;
  id_propriedade: string;
  tenant_id: string;
}

function generateOrcamento(
  clienteId: string, 
  propriedadeId: string, 
  tenantId: string
): DemoOrcamento {
  // Distribuir mais orçamentos em 2026 para testar o seletor de ano
  const year = Math.random() > 0.3 ? 2026 : 2025;
  const dataOrcamento = generateRandomDate(year, year);
  
  const quantidade = randomInt(10, 200);
  const valorUnitario = randomFloat(50, 300, 2);
  const receitaEsperada = parseFloat((quantidade * valorUnitario).toFixed(2));
  
  const incluirImposto = Math.random() > 0.3;
  const percentualImposto = incluirImposto ? randomFloat(8, 15, 2) : 0;
  const valorImposto = incluirImposto ? parseFloat((receitaEsperada * percentualImposto / 100).toFixed(2)) : 0;
  
  // Margem entre 20% e 50%
  const margemEsperada = randomFloat(20, 50, 2);
  const lucroEsperado = parseFloat(((receitaEsperada - valorImposto) * margemEsperada / 100).toFixed(2));
  
  const situacao = randomElement(SITUACOES_ORCAMENTO);
  const faturamento = situacao === "Aprovado" && Math.random() > 0.3;
  
  return {
    data_orcamento: dataOrcamento,
    quantidade,
    valor_unitario: valorUnitario,
    receita_esperada: receitaEsperada,
    lucro_esperado: lucroEsperado,
    margem_esperada: margemEsperada,
    incluir_imposto: incluirImposto,
    percentual_imposto: percentualImposto,
    valor_imposto: valorImposto,
    situacao,
    situacao_do_pagamento: faturamento ? randomElement(STATUS_PAGAMENTO) : "Pendente",
    faturamento,
    data_do_faturamento: faturamento ? addDays(dataOrcamento, randomInt(15, 60)) : null,
    anotacoes: `${DEMO_TAG} Orçamento de demonstração`,
    id_cliente: clienteId,
    id_propriedade: propriedadeId,
    tenant_id: tenantId,
  };
}

interface DemoDespesa {
  data_da_despesa: string;
  valor_da_despesa: number;
  status: string;
  observacoes: string;
  id_orcamento: string;
  tenant_id: string;
}

function generateDespesa(
  orcamentoId: string, 
  dataBase: string, 
  valorMaximo: number,
  tenantId: string
): DemoDespesa {
  return {
    data_da_despesa: addDays(dataBase, randomInt(0, 30)),
    valor_da_despesa: randomFloat(valorMaximo * 0.05, valorMaximo * 0.25, 2),
    status: randomElement(STATUS_DESPESA),
    observacoes: `${DEMO_TAG} Despesa de demonstração`,
    id_orcamento: orcamentoId,
    tenant_id: tenantId,
  };
}

// ========== FUNÇÃO PRINCIPAL ==========

export interface DemoDataResult {
  success: boolean;
  clientesInseridos: number;
  propriedadesInseridas: number;
  orcamentosInseridos: number;
  despesasInseridas: number;
  error?: string;
}

export async function generateAndInsertDemoData(
  tenantId: string, 
  quantidade: number = 50,
  onProgress?: (message: string) => void
): Promise<DemoDataResult> {
  const result: DemoDataResult = {
    success: false,
    clientesInseridos: 0,
    propriedadesInseridas: 0,
    orcamentosInseridos: 0,
    despesasInseridas: 0,
  };

  try {
    onProgress?.("Gerando clientes...");
    
    // 1. Gerar e inserir clientes
    const clientes: DemoCliente[] = [];
    for (let i = 0; i < quantidade; i++) {
      clientes.push(generateCliente(tenantId));
    }
    
    const { data: clientesInseridos, error: errorClientes } = await supabase
      .from("dim_cliente")
      .insert(clientes)
      .select("id_cliente");
    
    if (errorClientes) throw new Error(`Erro ao inserir clientes: ${errorClientes.message}`);
    result.clientesInseridos = clientesInseridos?.length || 0;
    
    onProgress?.(`${result.clientesInseridos} clientes criados. Gerando propriedades...`);
    
    // 2. Gerar e inserir propriedades (1-3 por cliente)
    const propriedades: DemoPropriedade[] = [];
    for (const cliente of clientesInseridos || []) {
      const numPropriedades = randomInt(1, 3);
      for (let i = 0; i < numPropriedades; i++) {
        propriedades.push(generatePropriedade(cliente.id_cliente, tenantId, i));
      }
    }
    
    const { data: propriedadesInseridas, error: errorPropriedades } = await supabase
      .from("dim_propriedade")
      .insert(propriedades)
      .select("id_propriedade, id_cliente");
    
    if (errorPropriedades) throw new Error(`Erro ao inserir propriedades: ${errorPropriedades.message}`);
    result.propriedadesInseridas = propriedadesInseridas?.length || 0;
    
    onProgress?.(`${result.propriedadesInseridas} propriedades criadas. Gerando orçamentos...`);
    
    // 3. Gerar e inserir orçamentos (1-5 por cliente)
    // Agrupar propriedades por cliente para facilitar
    const propsByCliente = new Map<string, string[]>();
    for (const prop of propriedadesInseridas || []) {
      if (!propsByCliente.has(prop.id_cliente)) {
        propsByCliente.set(prop.id_cliente, []);
      }
      propsByCliente.get(prop.id_cliente)!.push(prop.id_propriedade);
    }
    
    const orcamentos: DemoOrcamento[] = [];
    for (const cliente of clientesInseridos || []) {
      const propsDoCliente = propsByCliente.get(cliente.id_cliente) || [];
      if (propsDoCliente.length === 0) continue;
      
      const numOrcamentos = randomInt(1, 5);
      for (let i = 0; i < numOrcamentos; i++) {
        const propId = randomElement(propsDoCliente);
        orcamentos.push(generateOrcamento(cliente.id_cliente, propId, tenantId));
      }
    }
    
    const { data: orcamentosInseridos, error: errorOrcamentos } = await supabase
      .from("fato_orcamento")
      .insert(orcamentos)
      .select("id_orcamento, data_orcamento, receita_esperada");
    
    if (errorOrcamentos) throw new Error(`Erro ao inserir orçamentos: ${errorOrcamentos.message}`);
    result.orcamentosInseridos = orcamentosInseridos?.length || 0;
    
    onProgress?.(`${result.orcamentosInseridos} orçamentos criados. Gerando despesas...`);
    
    // 4. Gerar e inserir despesas (2-8 por orçamento)
    const despesas: DemoDespesa[] = [];
    for (const orcamento of orcamentosInseridos || []) {
      const numDespesas = randomInt(2, 8);
      for (let i = 0; i < numDespesas; i++) {
        despesas.push(generateDespesa(
          orcamento.id_orcamento,
          orcamento.data_orcamento,
          orcamento.receita_esperada,
          tenantId
        ));
      }
    }
    
    // Inserir despesas em lotes de 100 para evitar timeout
    const BATCH_SIZE = 100;
    for (let i = 0; i < despesas.length; i += BATCH_SIZE) {
      const batch = despesas.slice(i, i + BATCH_SIZE);
      const { error: errorDespesas } = await supabase
        .from("fato_despesas")
        .insert(batch);
      
      if (errorDespesas) throw new Error(`Erro ao inserir despesas: ${errorDespesas.message}`);
      result.despesasInseridas += batch.length;
    }
    
    onProgress?.(`${result.despesasInseridas} despesas criadas. Concluído!`);
    
    result.success = true;
    return result;
    
  } catch (error: any) {
    result.error = error.message;
    return result;
  }
}

// ========== REMOÇÃO DE DADOS DEMO ==========

export interface RemoveDemoResult {
  success: boolean;
  clientesRemovidos: number;
  error?: string;
}

export async function removeDemoData(tenantId: string): Promise<RemoveDemoResult> {
  try {
    // Buscar IDs dos clientes demo
    const { data: clientesDemo, error: errorBusca } = await supabase
      .from("dim_cliente")
      .select("id_cliente")
      .eq("tenant_id", tenantId)
      .like("anotacoes", `${DEMO_TAG}%`);
    
    if (errorBusca) throw new Error(`Erro ao buscar clientes demo: ${errorBusca.message}`);
    
    if (!clientesDemo || clientesDemo.length === 0) {
      return { success: true, clientesRemovidos: 0 };
    }
    
    const clienteIds = clientesDemo.map(c => c.id_cliente);
    
    // Buscar propriedades dos clientes demo
    const { data: propriedadesDemo } = await supabase
      .from("dim_propriedade")
      .select("id_propriedade")
      .in("id_cliente", clienteIds);
    
    const propriedadeIds = propriedadesDemo?.map(p => p.id_propriedade) || [];
    
    // Buscar orçamentos dos clientes demo
    const { data: orcamentosDemo } = await supabase
      .from("fato_orcamento")
      .select("id_orcamento")
      .in("id_cliente", clienteIds);
    
    const orcamentoIds = orcamentosDemo?.map(o => o.id_orcamento) || [];
    
    // Deletar na ordem correta (das dependências para as tabelas pai)
    
    // 1. Deletar despesas dos orçamentos
    if (orcamentoIds.length > 0) {
      await supabase
        .from("fato_despesas")
        .delete()
        .in("id_orcamento", orcamentoIds);
    }
    
    // 2. Deletar orçamentos
    if (orcamentoIds.length > 0) {
      await supabase
        .from("fato_orcamento")
        .delete()
        .in("id_orcamento", orcamentoIds);
    }
    
    // 3. Deletar propriedades
    if (propriedadeIds.length > 0) {
      await supabase
        .from("dim_propriedade")
        .delete()
        .in("id_propriedade", propriedadeIds);
    }
    
    // 4. Deletar clientes
    const { error: errorDelete } = await supabase
      .from("dim_cliente")
      .delete()
      .in("id_cliente", clienteIds);
    
    if (errorDelete) throw new Error(`Erro ao remover clientes: ${errorDelete.message}`);
    
    return {
      success: true,
      clientesRemovidos: clienteIds.length,
    };
    
  } catch (error: any) {
    return {
      success: false,
      clientesRemovidos: 0,
      error: error.message,
    };
  }
}
