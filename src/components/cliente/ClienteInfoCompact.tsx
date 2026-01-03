import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, FileText, User, Building, StickyNote } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

interface ClienteInfoCompactProps {
  cliente: Tables<"dim_cliente">;
}

export function ClienteInfoCompact({ cliente }: ClienteInfoCompactProps) {
  const getSituacaoBadgeClass = () => {
    switch(cliente.situacao) {
      case 'Ativo':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'Inativo':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{cliente.nome}</span>
          </div>
          <Badge className={getSituacaoBadgeClass()}>
            {cliente.situacao || 'Não definido'}
          </Badge>
        </div>

        {/* Contato */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</h4>
          <div className="space-y-1.5">
            {cliente.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{cliente.email}</span>
              </div>
            )}
            {cliente.telefone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span>{cliente.telefone}</span>
              </div>
            )}
            {cliente.celular && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span>{cliente.celular}</span>
              </div>
            )}
          </div>
        </div>

        {/* Informações Comerciais */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comercial</h4>
          <div className="flex flex-wrap gap-2">
            {cliente.categoria && <Badge variant="outline" className="text-xs">{cliente.categoria}</Badge>}
            {cliente.origem && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building className="h-3 w-3" />
                <span>{cliente.origem}</span>
              </div>
            )}
          </div>
        </div>

        {/* Documentos */}
        {(cliente.cpf || cliente.cnpj) && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documentos</h4>
            <div className="space-y-1">
              {cliente.cpf && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>CPF: {cliente.cpf}</span>
                </div>
              )}
              {cliente.cnpj && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>CNPJ: {cliente.cnpj}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Endereço */}
        {cliente.endereco && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endereço</h4>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span>{cliente.endereco}</span>
            </div>
          </div>
        )}

        {/* Observações */}
        {cliente.anotacoes && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <StickyNote className="h-3 w-3 text-yellow-500" />
              Observações
            </h4>
            <p className="text-sm text-muted-foreground line-clamp-3">{cliente.anotacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
