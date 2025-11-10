import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Plus } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

interface ClientePropriedadesProps {
  propriedades: Tables<"dim_propriedade">[];
  onNovaPropriedade?: () => void;
}

export function ClientePropriedades({ propriedades, onNovaPropriedade }: ClientePropriedadesProps) {
  if (propriedades.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma propriedade cadastrada</h3>
        <p className="text-muted-foreground mb-4">Este cliente ainda não possui propriedades vinculadas.</p>
        {onNovaPropriedade && (
          <Button onClick={onNovaPropriedade}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Propriedade
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onNovaPropriedade && (
        <div className="flex justify-end">
          <Button onClick={onNovaPropriedade}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Propriedade
          </Button>
        </div>
      )}
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Município</TableHead>
            <TableHead>Área (ha)</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Coordenadas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {propriedades.map((prop) => (
            <TableRow key={prop.id_propriedade}>
              <TableCell className="font-medium">{prop.nome_da_propriedade}</TableCell>
              <TableCell>{prop.municipio || '-'}</TableCell>
              <TableCell>{prop.area_ha ? Number(prop.area_ha).toFixed(2) : '-'}</TableCell>
              <TableCell>
                {prop.tipo && <Badge variant="outline">{prop.tipo}</Badge>}
              </TableCell>
              <TableCell>
                {prop.situacao && (
                  <Badge variant={prop.situacao === 'Ativo' ? 'default' : 'secondary'}>
                    {prop.situacao}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {prop.latitude && prop.longitude ? (
                  <a
                    href={`https://www.google.com/maps?q=${prop.latitude},${prop.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <MapPin className="h-3 w-3" />
                    Ver no mapa
                  </a>
                ) : (
                  '-'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import { Building2 } from "lucide-react";
