import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, FileText, User, Building, StickyNote, LayoutDashboard } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

interface ClienteInfoCompactProps {
  cliente: Tables<"dim_cliente">;
  onOpenCentralControle?: () => void;
}

export function ClienteInfoCompact({ cliente, onOpenCentralControle }: ClienteInfoCompactProps) {
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
    <Card className="h-full flex flex-col">
      <CardContent className="p-4 flex flex-col flex-1">
        {/* Header com nome e status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{cliente.nome}</span>
          </div>
          <Badge className={getSituacaoBadgeClass()}>
            {cliente.situacao || 'Não definido'}
          </Badge>
        </div>

        {/* Grid de informações reorganizado */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {/* Coluna Esquerda - Contato */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</h4>
            {cliente.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate text-xs">{cliente.email}</span>
              </div>
            )}
            {cliente.telefone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs">{cliente.telefone}</span>
              </div>
            )}
            {cliente.celular && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs">{cliente.celular}</span>
              </div>
            )}
          </div>

          {/* Coluna Direita - Comercial */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comercial</h4>
            {cliente.categoria && (
              <Badge variant="outline" className="text-xs">{cliente.categoria}</Badge>
            )}
            {cliente.origem && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building className="h-3 w-3" />
                <span>{cliente.origem}</span>
              </div>
            )}
          </div>

          {/* Documentos */}
          {(cliente.cpf || cliente.cnpj) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documentos</h4>
              {cliente.cpf && (
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>CPF: {cliente.cpf}</span>
                </div>
              )}
              {cliente.cnpj && (
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>CNPJ: {cliente.cnpj}</span>
                </div>
              )}
            </div>
          )}

          {/* Endereço */}
          {cliente.endereco && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endereço</h4>
              <div className="flex items-start gap-2 text-xs">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{cliente.endereco}</span>
              </div>
            </div>
          )}
        </div>

        {/* Observações */}
        {cliente.anotacoes && (
          <div className="mt-3 pt-3 border-t">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1">
              <StickyNote className="h-3 w-3 text-yellow-500" />
              Observações
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2">{cliente.anotacoes}</p>
          </div>
        )}

        {/* Botão Central de Controle - Destaque */}
        {onOpenCentralControle && (
          <div className="mt-auto pt-4">
            <Button 
              onClick={onOpenCentralControle}
              className="w-full gap-2"
              size="lg"
            >
              <LayoutDashboard className="h-5 w-5" />
              Central de Controle
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
