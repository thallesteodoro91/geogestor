import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Ruler, Square, Layers } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { ParsedGeometry } from '@/lib/kmlParser';

interface PropertyInfoPanelProps {
  propriedade: Tables<'dim_propriedade'>;
  geometria?: ParsedGeometry | null;
}

export function PropertyInfoPanel({ propriedade, geometria }: PropertyInfoPanelProps) {
  return (
    <div className="space-y-4">
      {/* Informações Básicas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Localização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Município:</span>
            <span className="font-medium">{propriedade.municipio || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cidade:</span>
            <span className="font-medium">{propriedade.cidade || '-'}</span>
          </div>
          {propriedade.latitude && propriedade.longitude && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coordenadas:</span>
              <span className="font-medium text-xs">
                {Number(propriedade.latitude).toFixed(6)}, {Number(propriedade.longitude).toFixed(6)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Métricas da Geometria */}
      {geometria && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Square className="h-4 w-4" />
              Métricas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Área Total:</span>
              <Badge variant="secondary" className="font-mono">
                {geometria.areaHa.toLocaleString('pt-BR')} ha
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Perímetro:</span>
              <Badge variant="outline" className="font-mono">
                {(geometria.perimetroM / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Glebas */}
      {geometria && geometria.glebas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Glebas ({geometria.glebas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {geometria.glebas.map((gleba, index) => (
              <div key={index} className="flex justify-between items-center text-sm py-1">
                <span className="truncate max-w-[120px]" title={gleba.nome}>
                  {gleba.nome}
                </span>
                <span className="font-mono text-muted-foreground">
                  {gleba.areaHa.toLocaleString('pt-BR')} ha
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Documentação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Documentação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {propriedade.matricula && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Matrícula:</span>
              <span className="font-medium">{propriedade.matricula}</span>
            </div>
          )}
          {propriedade.car && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">CAR:</span>
              <span className="font-medium text-xs truncate max-w-[150px]" title={propriedade.car}>
                {propriedade.car}
              </span>
            </div>
          )}
          {propriedade.ccir && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">CCIR:</span>
              <span className="font-medium">{propriedade.ccir}</span>
            </div>
          )}
          {propriedade.itr && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">ITR:</span>
              <span className="font-medium">{propriedade.itr}</span>
            </div>
          )}
          {propriedade.situacao && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Situação:</span>
              <Badge variant={propriedade.situacao === 'Ativo' ? 'default' : 'secondary'}>
                {propriedade.situacao}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
