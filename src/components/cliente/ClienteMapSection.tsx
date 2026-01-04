import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, Upload, Trash2, Building2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { PropertyMap, PropertyMapSkeleton } from '@/components/map/PropertyMap';
import { KmlUploader } from '@/components/map/KmlUploader';
import { fetchGeometriaByPropriedade, deleteGeometria } from '@/modules/crm/services/geometria.service';
import { ParsedGeometry } from '@/lib/kmlParser';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ClienteMapSectionProps {
  propriedades: Tables<'dim_propriedade'>[];
  isLoading?: boolean;
}

export function ClienteMapSection({ propriedades, isLoading }: ClienteMapSectionProps) {
  const [selectedPropriedade, setSelectedPropriedade] = useState<Tables<'dim_propriedade'> | null>(null);
  const [geometria, setGeometria] = useState<ParsedGeometry | null>(null);
  const [loadingGeometria, setLoadingGeometria] = useState(false);
  const [activeTab, setActiveTab] = useState('mapa');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingGeometria, setDeletingGeometria] = useState(false);

  // Seleciona a primeira propriedade automaticamente
  useEffect(() => {
    if (propriedades.length > 0 && !selectedPropriedade) {
      setSelectedPropriedade(propriedades[0]);
    }
  }, [propriedades, selectedPropriedade]);

  // Carrega geometria quando uma propriedade é selecionada
  useEffect(() => {
    if (selectedPropriedade) {
      loadGeometria();
    }
  }, [selectedPropriedade?.id_propriedade]);

  const loadGeometria = async () => {
    if (!selectedPropriedade) return;

    setLoadingGeometria(true);
    try {
      const data = await fetchGeometriaByPropriedade(selectedPropriedade.id_propriedade);
      if (data) {
        setGeometria({
          geojson: data.geojson as unknown as GeoJSON.FeatureCollection,
          areaHa: data.area_calculada_ha || 0,
          perimetroM: data.perimetro_m || 0,
          centroide: {
            lat: data.centroide_lat || 0,
            lng: data.centroide_lng || 0,
          },
          glebas: (data.glebas as any[]) || [],
        });
      } else {
        setGeometria(null);
      }
    } catch (error) {
      console.error('Erro ao carregar geometria:', error);
      setGeometria(null);
    } finally {
      setLoadingGeometria(false);
    }
  };

  const handleUploadSuccess = (newGeometria: ParsedGeometry) => {
    setGeometria(newGeometria);
    setActiveTab('mapa');
  };

  const handleDeleteGeometria = async () => {
    if (!selectedPropriedade) return;

    setDeletingGeometria(true);
    try {
      await deleteGeometria(selectedPropriedade.id_propriedade);
      setGeometria(null);
      toast.success('Mapa removido com sucesso');
      setShowDeleteDialog(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao remover mapa';
      toast.error(message);
    } finally {
      setDeletingGeometria(false);
    }
  };

  const handlePropriedadeChange = (id: string) => {
    const prop = propriedades.find((p) => p.id_propriedade === id);
    if (prop) {
      setSelectedPropriedade(prop);
      setGeometria(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (propriedades.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center h-[500px] text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma propriedade cadastrada</h3>
          <p className="text-muted-foreground max-w-md">
            Cadastre uma propriedade para visualizar o mapa com o polígono da área.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Mapa da Propriedade
            </CardTitle>
            
            {geometria && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remover geometria importada</p>
                </TooltipContent>
              </Tooltip>
            )}

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deseja realmente remover o mapa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá remover o polígono importado desta propriedade.
                    Você poderá importar um novo arquivo posteriormente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteGeometria();
                    }}
                    disabled={deletingGeometria}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingGeometria ? 'Removendo...' : 'Remover'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex items-center gap-2">
            {/* Botões Visualizar e Importar KML */}
            <div className="flex gap-1 bg-muted/50 rounded-md p-1">
              <Button
                variant={activeTab === 'mapa' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 gap-2 text-xs"
                onClick={() => setActiveTab('mapa')}
              >
                <Map className="h-3.5 w-3.5" />
                Visualizar
              </Button>
              <Button
                variant={activeTab === 'importar' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 gap-2 text-xs"
                onClick={() => setActiveTab('importar')}
              >
                <Upload className="h-3.5 w-3.5" />
                Importar KML
              </Button>
            </div>
            
            {propriedades.length > 1 && (
              <Select
                value={selectedPropriedade?.id_propriedade}
                onValueChange={handlePropriedadeChange}
              >
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder="Selecione a propriedade" />
                </SelectTrigger>
                <SelectContent>
                  {propriedades.map((prop) => (
                    <SelectItem key={prop.id_propriedade} value={prop.id_propriedade}>
                      {prop.nome_da_propriedade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {selectedPropriedade && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="font-medium text-foreground">{selectedPropriedade.nome_da_propriedade}</span>
            {selectedPropriedade.municipio && <span>• {selectedPropriedade.municipio}</span>}
            {geometria && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold text-sm">
                <Map className="h-3.5 w-3.5" />
                {geometria.areaHa.toFixed(2)} ha
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
        {activeTab === 'mapa' && (
          <div className="flex-1 min-h-[450px]">
            {loadingGeometria ? (
              <PropertyMapSkeleton className="w-full h-full rounded-lg" />
            ) : geometria ? (
              <PropertyMap
                geojson={geometria.geojson}
                centroide={geometria.centroide}
                className="w-full h-full rounded-lg overflow-hidden"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/30 rounded-lg">
                <Map className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum mapa disponível</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Importe um arquivo KML ou KMZ para visualizar o polígono desta propriedade.
                </p>
                <Button onClick={() => setActiveTab('importar')}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Arquivo
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'importar' && selectedPropriedade && (
          <div className="flex-1 min-h-[450px] flex items-center justify-center">
            <div className="max-w-lg w-full space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Importar Arquivo KML/KMZ</h3>
                <p className="text-sm text-muted-foreground">
                  Arraste ou selecione um arquivo para importar o polígono da propriedade.
                  {geometria && ' O arquivo atual será substituído.'}
                </p>
              </div>
              
              <KmlUploader
                propriedadeId={selectedPropriedade.id_propriedade}
                onSuccess={handleUploadSuccess}
              />

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Arquivos suportados: .kml e .kmz</p>
                <p>• Apenas polígonos serão importados</p>
                <p>• A área e perímetro serão calculados automaticamente</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
