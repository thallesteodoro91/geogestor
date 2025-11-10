import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, FileText, User, Building } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

interface ClienteInfoCardProps {
  cliente: Tables<"dim_cliente">;
}

export function ClienteInfoCard({ cliente }: ClienteInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {cliente.nome}
          </CardTitle>
          <Badge variant={cliente.situacao === 'Ativo' ? 'default' : 'secondary'}>
            {cliente.situacao || 'Não definido'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Informações de Contato */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">Contato</h4>
            {cliente.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{cliente.email}</span>
              </div>
            )}
            {cliente.telefone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{cliente.telefone}</span>
              </div>
            )}
            {cliente.celular && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{cliente.celular}</span>
              </div>
            )}
          </div>

          {/* Informações Comerciais */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">Informações Comerciais</h4>
            {cliente.categoria && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{cliente.categoria}</Badge>
              </div>
            )}
            {cliente.origem && (
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>Origem: {cliente.origem}</span>
              </div>
            )}
          </div>
        </div>

        {/* Documentos */}
        {(cliente.cpf || cliente.cnpj) && (
          <div className="space-y-2 pt-3 border-t">
            <h4 className="font-semibold text-sm text-muted-foreground">Documentos</h4>
            <div className="flex gap-4 text-sm">
              {cliente.cpf && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>CPF: {cliente.cpf}</span>
                </div>
              )}
              {cliente.cnpj && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>CNPJ: {cliente.cnpj}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Endereço */}
        {cliente.endereco && (
          <div className="space-y-2 pt-3 border-t">
            <h4 className="font-semibold text-sm text-muted-foreground">Endereço</h4>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{cliente.endereco}</span>
            </div>
          </div>
        )}

        {/* Anotações */}
        {cliente.anotacoes && (
          <div className="space-y-2 pt-3 border-t">
            <h4 className="font-semibold text-sm text-muted-foreground">Anotações</h4>
            <p className="text-sm text-muted-foreground">{cliente.anotacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
