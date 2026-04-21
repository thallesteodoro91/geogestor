import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, FileText, User, StickyNote, SlidersHorizontal, UserCircle, Users, Briefcase, Tractor, Building2, Factory, Landmark, Heart, Globe, Share2, Megaphone, UserPlus, CalendarDays, MessageCircle, Search, Star, Target, UserCog, PhoneCall, HelpCircle, RefreshCw } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { getStatusClasses } from "@/lib/statusColors";
import { cn } from "@/lib/utils";

interface ClienteInfoCompactProps {
  cliente: Tables<"dim_cliente">;
  onOpenCentralControle?: () => void;
}

/**
 * Tom semântico para chips de categoria/origem.
 * Todas as classes têm variantes de dark mode garantidas via design tokens.
 */
type ChipTone =
  | "primary" | "info" | "success" | "warning" | "danger" | "accent" | "neutral";

const CHIP_CLASSES: Record<ChipTone, string> = {
  primary: "bg-primary/15 text-primary border-primary/30",
  info:    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger:  "bg-destructive/15 text-destructive border-destructive/30",
  accent:  "bg-accent/15 text-accent border-accent/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

const categoriaConfig: Record<string, { icon: React.ElementType; tone: ChipTone }> = {
  'Pessoa Física':   { icon: UserCircle, tone: "info" },
  'Pessoa Jurídica': { icon: Building2,  tone: "primary" },
  'Produtor Rural':  { icon: Tractor,    tone: "success" },
  'Empresa':         { icon: Factory,    tone: "neutral" },
  'Parceiro':        { icon: Users,      tone: "accent" },
  'Governo':         { icon: Landmark,   tone: "warning" },
  'ONG':             { icon: Heart,      tone: "danger" },
};

const origemConfig: Record<string, { icon: React.ElementType; tone: ChipTone }> = {
  'Indicação':     { icon: UserPlus,      tone: "success" },
  'Site':          { icon: Globe,         tone: "info" },
  'Redes Sociais': { icon: Share2,        tone: "danger" },
  'Google':        { icon: Search,        tone: "warning" },
  'Evento':        { icon: CalendarDays,  tone: "primary" },
  'Marketing':     { icon: Megaphone,     tone: "warning" },
  'WhatsApp':      { icon: MessageCircle, tone: "success" },
  'Parceria':      { icon: Briefcase,     tone: "primary" },
  'Recorrente':    { icon: RefreshCw,     tone: "accent" },
  'Cliente antigo':{ icon: Star,          tone: "warning" },
  'Ligação':       { icon: PhoneCall,     tone: "warning" },
  'Outro':         { icon: HelpCircle,    tone: "neutral" },
};

const defaultConfig: { icon: React.ElementType; tone: ChipTone } = {
  icon: User,
  tone: "neutral",
};

export function ClienteInfoCompact({
  cliente,
  onOpenCentralControle,
}: ClienteInfoCompactProps) {
  const situacaoClasses = getStatusClasses(cliente.situacao);
  const getCategoriaConfig = (categoria: string | null) => categoria ? (categoriaConfig[categoria] ?? defaultConfig) : defaultConfig;
  const getOrigemConfig = (origem: string | null) => origem ? (origemConfig[origem] ?? defaultConfig) : defaultConfig;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardContent className="p-0 flex flex-col flex-1">
        {/* Header com nome e status */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-base">{cliente.nome}</span>
            </div>
            <Badge variant="outline" className={situacaoClasses}>
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
                <Phone className="h-3 w-3 text-primary" />
                Contato
              </h4>
              <div className="grid gap-1.5">
                {cliente.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span className="truncate">{cliente.email}</span>
                  </div>
                )}
                {cliente.telefone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-success flex-shrink-0" />
                    <span>{cliente.telefone}</span>
                  </div>
                )}
                {cliente.celular && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-success flex-shrink-0" />
                    <span>{cliente.celular}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO: Endereço */}
          {cliente.endereco && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-destructive" />
                Endereço
              </h4>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="line-clamp-2">{cliente.endereco}</span>
              </div>
            </div>
          )}

          {/* SEÇÃO: Prospecção */}
          {cliente.origem && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Target className="h-3 w-3 text-primary" />
                Prospecção
              </h4>
              <div className="flex flex-wrap gap-2">
                {cliente.origem.split(', ').map((origem, index) => {
                  const config = getOrigemConfig(origem.trim());
                  const IconComponent = config.icon;
                  return (
                    <Badge key={index} variant="outline" className={cn("text-xs font-medium gap-1.5", CHIP_CLASSES[config.tone])}>
                      <IconComponent className="h-3 w-3" />
                      {origem.trim()}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEÇÃO: Categoria do Cliente */}
          {cliente.categoria && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserCog className="h-3 w-3 text-primary" />
                Categoria do Cliente
              </h4>
              <div className="flex flex-wrap gap-2">
                {cliente.categoria.split(', ').map((cat, index) => {
                  const config = getCategoriaConfig(cat.trim());
                  const IconComponent = config.icon;
                  return (
                    <Badge key={index} variant="outline" className={cn("text-xs font-medium gap-1.5", CHIP_CLASSES[config.tone])}>
                      <IconComponent className="h-3 w-3" />
                      {cat.trim()}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEÇÃO: Documentos */}
          {(cliente.cpf || cliente.cnpj) && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-warning" />
                Documentos
              </h4>
              <div className="flex flex-wrap gap-3">
                {cliente.cpf && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium">CPF:</span>
                    <span className="font-mono">{cliente.cpf}</span>
                  </div>
                )}
                {cliente.cnpj && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium">CNPJ:</span>
                    <span className="font-mono">{cliente.cnpj}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO: Observações */}
          {cliente.anotacoes && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <StickyNote className="h-3 w-3 text-warning" />
                Observações
              </h4>
              <div className="bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
                <p className="text-xs text-muted-foreground line-clamp-3">{cliente.anotacoes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Botão Central de Controle */}
        {onOpenCentralControle && (
          <div className="p-2 border-t bg-muted/30 flex justify-center">
            <Button
              onClick={onOpenCentralControle}
              size="sm"
              className="w-1/2 gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm text-xs h-10 justify-center mx-[10px] text-center py-[20px] px-[25px]"
            >
              <SlidersHorizontal className="h-3 w-3" />
              Central de Controle
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
