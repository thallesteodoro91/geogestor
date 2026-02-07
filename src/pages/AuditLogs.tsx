import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePagination } from '@/hooks/usePagination';
import { Shield, ChevronDown, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  INSERT: { label: 'Criação', variant: 'default' },
  UPDATE: { label: 'Edição', variant: 'secondary' },
  DELETE: { label: 'Exclusão', variant: 'destructive' },
};

const ENTITY_OPTIONS = ['Orçamento', 'Despesa', 'Serviço', 'Cliente'];

export default function AuditLogs() {
  const { user } = useAuth();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Check admin role
  const { data: isAdmin, isLoading: isLoadingRole } = useQuery({
    queryKey: ['user-is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  // Fetch audit logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', filterAction, filterEntity, filterDateStart, filterDateEnd],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filterAction) query = query.eq('action', filterAction);
      if (filterEntity) query = query.eq('entity', filterEntity);
      if (filterDateStart) query = query.gte('created_at', filterDateStart);
      if (filterDateEnd) query = query.lte('created_at', filterDateEnd + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin === true,
  });

  // Fetch user profiles for display names
  const userIds = [...new Set(logs.map((l: any) => l.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['audit-profiles', userIds.join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      return data || [];
    },
    enabled: userIds.length > 0 && isAdmin === true,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

  const pagination = usePagination(logs, { initialPageSize: 20 });

  if (isLoadingRole) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-heading font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Somente administradores podem acessar os logs de auditoria.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Logs de Auditoria
          </h1>
          <p className="text-muted-foreground">Rastreabilidade de ações críticas do sistema</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Ação</Label>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="INSERT">Criação</SelectItem>
                    <SelectItem value="UPDATE">Edição</SelectItem>
                    <SelectItem value="DELETE">Exclusão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entidade</Label>
                <Select value={filterEntity} onValueChange={setFilterEntity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {ENTITY_OPTIONS.map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} />
              </div>
            </div>
            {(filterAction || filterEntity || filterDateStart || filterDateEnd) && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setFilterAction('');
                  setFilterEntity('');
                  setFilterDateStart('');
                  setFilterDateEnd('');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Registros ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagination.paginatedData.map((log: any) => {
                        const profile = profileMap.get(log.user_id);
                        const badge = ACTION_BADGES[log.action] || { label: log.action, variant: 'secondary' as const };
                        const isExpanded = expandedRow === log.id;

                        return (
                          <Collapsible key={log.id} open={isExpanded} onOpenChange={() => setExpandedRow(isExpanded ? null : log.id)} asChild>
                            <>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell className="whitespace-nowrap">
                                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell>{profile?.full_name || profile?.email || log.user_id.slice(0, 8)}</TableCell>
                                <TableCell>
                                  <Badge variant={badge.variant}>{badge.label}</Badge>
                                </TableCell>
                                <TableCell>{log.entity}</TableCell>
                                <TableCell>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-1">
                                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      Ver
                                    </Button>
                                  </CollapsibleTrigger>
                                </TableCell>
                              </TableRow>
                              <CollapsibleContent asChild>
                                <TableRow>
                                  <TableCell colSpan={5} className="bg-muted/30 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                      {log.old_data && (
                                        <div>
                                          <p className="font-medium text-destructive mb-1">Dados Anteriores</p>
                                          <pre className="bg-background rounded p-3 overflow-auto max-h-48 text-xs">
                                            {JSON.stringify(log.old_data, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                      {log.new_data && (
                                        <div>
                                          <p className="font-medium text-primary mb-1">Dados Novos</p>
                                          <pre className="bg-background rounded p-3 overflow-auto max-h-48 text-xs">
                                            {JSON.stringify(log.new_data, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                      {!log.old_data && !log.new_data && (
                                        <p className="text-muted-foreground">Sem detalhes registrados</p>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <TablePagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  startIndex={pagination.startIndex}
                  endIndex={pagination.endIndex}
                  canGoNext={pagination.canGoNext}
                  canGoPrevious={pagination.canGoPrevious}
                  onPageChange={pagination.goToPage}
                  onPageSizeChange={pagination.setPageSize}
                  onFirstPage={pagination.goToFirstPage}
                  onLastPage={pagination.goToLastPage}
                  onNextPage={pagination.goToNextPage}
                  onPreviousPage={pagination.goToPreviousPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
