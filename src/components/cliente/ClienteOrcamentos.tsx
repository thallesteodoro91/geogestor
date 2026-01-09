import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getPaymentStatusBadgeClass, getPaymentMethodBadgeClass } from "@/constants/budgetStatus";

interface ClienteOrcamentosProps {
  orcamentos: any[];
}

export function ClienteOrcamentos({ orcamentos }: ClienteOrcamentosProps) {

  if (orcamentos.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum orçamento emitido</h3>
        <p className="text-muted-foreground">Este cliente ainda não possui orçamentos cadastrados.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Serviço</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Convertido</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Forma Pagamento</TableHead>
          <TableHead className="text-right">Receita Esperada</TableHead>
          <TableHead className="text-right">Receita Realizada</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orcamentos.map((orc) => (
          <TableRow key={orc.id_orcamento}>
            <TableCell>
              {format(new Date(orc.data_orcamento), 'dd/MM/yyyy', { locale: ptBR })}
            </TableCell>
            <TableCell className="font-medium">
              {orc.fato_servico?.nome_do_servico || '-'}
            </TableCell>
            <TableCell>{orc.quantidade}</TableCell>
            <TableCell>
              <Badge variant={orc.orcamento_convertido ? 'default' : 'secondary'}>
                {orc.orcamento_convertido ? 'Sim' : 'Não'}
              </Badge>
            </TableCell>
            <TableCell>
              {orc.situacao_do_pagamento && (
                <Badge className={getPaymentStatusBadgeClass(orc.situacao_do_pagamento)}>
                  {orc.situacao_do_pagamento}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              {orc.forma_de_pagamento && (
                <Badge className={getPaymentMethodBadgeClass(orc.forma_de_pagamento)}>
                  {orc.forma_de_pagamento}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(Number(orc.receita_esperada) || 0)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {orc.receita_realizada
                ? new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(Number(orc.receita_realizada))
                : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
