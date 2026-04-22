import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Wrench } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SERVICE_STATUS, getServiceStatusBadgeClasses } from "@/constants/serviceStatus";

interface ClienteServicosProps {
  servicos: any[];
}

export function ClienteServicos({ servicos }: ClienteServicosProps) {
  if (servicos.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="Este cliente ainda não tem serviços"
        description="Crie um serviço vinculado para acompanhar a execução dos projetos deste cliente."
        actionLabel="+ Criar Serviço"
        onAction={() => {}}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Serviço</TableHead>
          <TableHead>Propriedade</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Data Início</TableHead>
          <TableHead>Data Fim</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Receita</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {servicos.map((servico) => (
          <TableRow key={servico.id_servico}>
            <TableCell className="font-medium">{servico.nome_do_servico}</TableCell>
            <TableCell>{servico.dim_propriedade?.nome_da_propriedade || '-'}</TableCell>
            <TableCell>
              {servico.categoria && <Badge variant="outline">{servico.categoria}</Badge>}
            </TableCell>
            <TableCell>
              {servico.data_do_servico_inicio
                ? format(new Date(servico.data_do_servico_inicio), 'dd/MM/yyyy', { locale: ptBR })
                : '-'}
            </TableCell>
            <TableCell>
              {servico.data_do_servico_fim
                ? format(new Date(servico.data_do_servico_fim), 'dd/MM/yyyy', { locale: ptBR })
                : '-'}
            </TableCell>
            <TableCell>
              <Badge className={getServiceStatusBadgeClasses(servico.situacao_do_servico)}>
                {servico.situacao_do_servico || SERVICE_STATUS.PENDENTE}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-medium">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(Number(servico.receita_servico) || 0)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
