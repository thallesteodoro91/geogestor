import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Mail, Phone, MapPin, FileText, User, Building, StickyNote, SlidersHorizontal, ChevronRight,
  UserCircle, Users, Briefcase, Tractor, Building2, Factory, Landmark, Heart,
  Globe, Share2, Megaphone, UserPlus, CalendarDays, MessageCircle, Search, Star
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

interface ClienteInfoCompactProps {
  cliente: Tables<"dim_cliente">;
  onOpenCentralControle?: () => void;
}

// Mapeamento de categorias com ícones e cores
const categoriaConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  'Pessoa Física': { icon: UserCircle, color: 'text-blue-600', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  'Pessoa Jurídica': { icon: Building2, color: 'text-violet-600', bg: 'bg-violet-500/15', border: 'border-violet-500/30' },
  'Produtor Rural': { icon: Tractor, color: 'text-green-600', bg: 'bg-green-500/15', border: 'border-green-500/30' },
  'Empresa': { icon: Factory, color: 'text-slate-600', bg: 'bg-slate-500/15', border: 'border-slate-500/30' },
  'Parceiro': { icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  'Governo': { icon: Landmark, color: 'text-amber-600', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  'ONG': { icon: Heart, color: 'text-pink-600', bg: 'bg-pink-500/15', border: 'border-pink-500/30' },
};

// Mapeamento de origens com ícones e cores
const origemConfig: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  'Indicação': { icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'Site': { icon: Globe, color: 'text-blue-600', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  'Redes Sociais': { icon: Share2, color: 'text-pink-600', bg: 'bg-pink-500/15', border: 'border-pink-500/30' },
  'Google': { icon: Search, color: 'text-amber-600', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  'Evento': { icon: CalendarDays, color: 'text-purple-600', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  'Marketing': { icon: Megaphone, color: 'text-orange-600', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  'WhatsApp': { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-500/15', border: 'border-green-500/30' },
  'Parceria': { icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30' },
  'Recorrente': { icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
};

const defaultConfig = { icon: User, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-muted' };

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

  const getCategoriaConfig = (categoria: string | null) => {
    if (!categoria) return defaultConfig;
    return categoriaConfig[categoria] || defaultConfig;
  };

  const getOrigemConfig = (origem: string | null) => {
    if (!origem) return defaultConfig;
    return origemConfig[origem] || defaultConfig;
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

        {/* Conteúdo principal organizado por seções */}
        <div className="flex-1 p-4 space-y-4 overflow-auto">
          
          {/* SEÇÃO: Contato */}
          {(cliente.email || cliente.telefone || cliente.celular) && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                Contato
              </h4>
              <div className="grid gap-1.5">
                {cliente.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                    <span className="truncate">{cliente.email}</span>
                  </div>
                )}
                {cliente.telefone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    <span>{cliente.telefone}</span>
                  </div>
                )}
                {cliente.celular && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    <span>{cliente.celular}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO: Perfil */}
          {(cliente.categoria || cliente.origem || cliente.cpf || cliente.cnpj) && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-purple-500" />
                Perfil
              </h4>
              <div className="flex flex-wrap gap-2">
                {cliente.categoria && cliente.categoria.split(', ').map((cat, index) => {
                  const config = getCategoriaConfig(cat.trim());
                  const IconComponent = config.icon;
                  return (
                    <Badge key={index} variant="outline" className={`text-xs font-medium gap-1.5 ${config.bg} ${config.color} ${config.border}`}>
                      <IconComponent className="h-3 w-3" />
                      {cat.trim()}
                    </Badge>
                  );
                })}
                {cliente.origem && (() => {
                  const config = getOrigemConfig(cliente.origem);
                  const IconComponent = config.icon;
                  return (
                    <Badge variant="outline" className={`text-xs font-medium gap-1.5 ${config.bg} ${config.color} ${config.border}`}>
                      <IconComponent className="h-3 w-3" />
                      {cliente.origem}
                    </Badge>
                  );
                })()}
              </div>
              {(cliente.cpf || cliente.cnpj) && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {cliente.cpf && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3 text-orange-500" />
                      <span>CPF:</span>
                      <span className="font-mono">{cliente.cpf}</span>
                    </div>
                  )}
                  {cliente.cnpj && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3 text-orange-500" />
                      <span>CNPJ:</span>
                      <span className="font-mono">{cliente.cnpj}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SEÇÃO: Localização */}
          {cliente.endereco && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-red-500" />
                Localização
              </h4>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{cliente.endereco}</span>
              </div>
            </div>
          )}

          {/* SEÇÃO: Observações */}
          {cliente.anotacoes && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-yellow-500" />
                Observações
              </h4>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2">
                <p className="text-xs text-muted-foreground line-clamp-3">{cliente.anotacoes}</p>
              </div>
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
              <SlidersHorizontal className="h-4 w-4" />
              Central de Controle
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
