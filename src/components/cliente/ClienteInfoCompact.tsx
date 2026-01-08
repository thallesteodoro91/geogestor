import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, FileText, User, Building, StickyNote, LayoutDashboard, ChevronRight } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

interface ClienteInfoCompactProps {
  cliente: Tables<"dim_cliente">;
  onOpenCentralControle?: () => void;
}

export function ClienteInfoCompact({ cliente, onOpenCentralControle }: ClienteInfoCompactProps) {
  const getSituacaoBadgeClass = () => {
    switch(cliente.situacao) {
      case 'Ativo':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
      case 'Inativo':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardContent className="p-0 flex flex-col flex-1">
        {/* Header com nome e status - fundo com gradiente sutil */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-base">{cliente.nome}</span>
            </div>
            <Badge variant="outline" className={getSituacaoBadgeClass()}>
              {cliente.situacao || 'Não definido'}
            </Badge>
          </div>
        </div>

        {/* Conteúdo principal com grid compacto */}
        <div className="flex-1 p-3 space-y-3 overflow-auto">
          {/* Contato - linha única com ícones */}
          <div className="flex flex-wrap gap-3">
            {cliente.email && (
              <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2 py-1">
                <Mail className="h-3 w-3 text-blue-500" />
                <span className="truncate max-w-[140px]">{cliente.email}</span>
              </div>
            )}
            {cliente.telefone && (
              <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2 py-1">
                <Phone className="h-3 w-3 text-green-500" />
                <span>{cliente.telefone}</span>
              </div>
            )}
            {cliente.celular && (
              <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2 py-1">
                <Phone className="h-3 w-3 text-green-500" />
                <span>{cliente.celular}</span>
              </div>
            )}
          </div>

          {/* Info comercial e documentos em grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Categoria e Origem */}
            <div className="space-y-1.5">
              {cliente.categoria && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {cliente.categoria}
                </Badge>
              )}
              {cliente.origem && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building className="h-3 w-3 text-purple-500" />
                  <span>{cliente.origem}</span>
                </div>
              )}
            </div>

            {/* Documentos */}
            <div className="space-y-1">
              {cliente.cpf && (
                <div className="flex items-center gap-1.5 text-xs">
                  <FileText className="h-3 w-3 text-orange-500" />
                  <span className="text-muted-foreground">CPF:</span>
                  <span className="font-mono text-[10px]">{cliente.cpf}</span>
                </div>
              )}
              {cliente.cnpj && (
                <div className="flex items-center gap-1.5 text-xs">
                  <FileText className="h-3 w-3 text-orange-500" />
                  <span className="text-muted-foreground">CNPJ:</span>
                  <span className="font-mono text-[10px]">{cliente.cnpj}</span>
                </div>
              )}
            </div>
          </div>

          {/* Endereço */}
          {cliente.endereco && (
            <div className="flex items-start gap-1.5 text-xs bg-muted/30 rounded-md px-2 py-1.5">
              <MapPin className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2 text-muted-foreground">{cliente.endereco}</span>
            </div>
          )}

          {/* Observações */}
          {cliente.anotacoes && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md px-2 py-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <StickyNote className="h-3 w-3 text-yellow-600" />
                <span className="text-[10px] font-semibold text-yellow-700 uppercase">Observações</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{cliente.anotacoes}</p>
            </div>
          )}
        </div>

        {/* Botão Central de Controle - Destaque */}
        {onOpenCentralControle && (
          <div className="p-3 border-t bg-muted/30">
            <Button 
              onClick={onOpenCentralControle}
              className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
              size="default"
            >
              <LayoutDashboard className="h-4 w-4" />
              Central de Controle
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
