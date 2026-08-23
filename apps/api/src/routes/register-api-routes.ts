import type { FastifyInstance } from 'fastify';
import { alertasRoutes } from './alertas.routes';
import { ambientalRoutes } from './ambiental.routes';
import { arquivosRoutes } from './arquivos.routes';
import { auditRoutes } from './audit.routes';
import { clientesRoutes } from './clientes.routes';
import { compromissosRoutes } from './compromissos.routes';
import { contatosRoutes } from './contatos.routes';
import { dashboardRoutes } from './dashboard.routes';
import { financeiroRoutes } from './financeiro.routes';
import { importacoesRoutes } from './importacoes.routes';
import { licencasRoutes } from './licencas.routes';
import { operationalDataRoutes } from './operational-data.routes';
import { oportunidadesRoutes } from './oportunidades.routes';
import { orcamentosRoutes } from './orcamentos.routes';
import { projetosRoutes } from './projetos.routes';
import { relatoriosRoutes } from './relatorios.routes';
import { searchRoutes } from './search.routes';
import { strategicPlanningRoutes } from './strategic-planning.routes';
import { tarefasRoutes } from './tarefas.routes';

const API_ROUTE_MODULES = [
  ['/api/clientes', clientesRoutes],
  ['/api/dashboard', dashboardRoutes],
  ['/api/projetos', projetosRoutes],
  ['/api/financeiro', financeiroRoutes],
  ['/api/arquivos', arquivosRoutes],
  ['/api/tarefas', tarefasRoutes],
  ['/api/relatorios', relatoriosRoutes],
  ['/api/compromissos', compromissosRoutes],
  ['/api/oportunidades', oportunidadesRoutes],
  ['/api/audit-logs', auditRoutes],
  ['/api/search', searchRoutes],
  ['/api/contatos', contatosRoutes],
  ['/api/licencas', licencasRoutes],
  ['/api/ambiental', ambientalRoutes],
  ['/api/orcamentos', orcamentosRoutes],
  ['/api/planejamento', strategicPlanningRoutes],
  ['/api/dados-operacionais', operationalDataRoutes],
  ['/api/alertas', alertasRoutes],
  ['/api/importacoes', importacoesRoutes]
] as const;

export function registerApiRoutes(server: FastifyInstance) {
  for (const [prefix, routes] of API_ROUTE_MODULES) {
    server.register(routes, { prefix });
  }
}
