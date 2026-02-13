/**
 * @fileoverview Módulos da aplicação GeoGestor
 * 
 * Arquitetura modular tenant-aware:
 * - CRM: Gestão de clientes e propriedades
 * - Finance: Gestão financeira (orçamentos, despesas, KPIs)
 * - Operations: Gestão operacional (serviços, empresas)
 */

export * as CRM from './crm';
export * as Finance from './finance';
export * as Operations from './operations';
