import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClienteMapSectionProps {
  propriedades: Tables<'dim_propriedade'>[];
  isLoading?: boolean;
}

export function ClienteMapSection({ propriedades, isLoading }: ClienteMapSectionProps) {
  const [selectedPropriedade, setSelectedPropriedade] = useState<Tables<'dim_propriedade'> | null>(null);
  const [geometria, setGeometria] = useState<ParsedGeometry | null>(null);
  const [loadingGeometria, setLoadingGeometria] = useState(false);
  const [activeTab, setActiveTab] = useState('mapa');

  // Seleciona a primeira propriedade automaticamente
  useEffect(() => {
    if (propriedades.length > 0 && !selectedPropriedade) {
      setSelectedPropriedade(propriedades[0]);
    }
  }, [propriedades]);

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
            lng: data.centroide_lng || 0
          },
          glebas: (data.glebas as any[]) || []
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
    
    try {
      await deleteGeometria(selectedPropriedade.id_propriedade);
      setGeometria(null);
      toast.success('Geometria removida com sucesso');
    } catch (error) {
      toast.error('Erro ao remover geometria');
    }
  };

  const handlePropriedadeChange = (id: string) => {
    const prop = propriedades.find(p => p.id_propriedade === id);
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
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Mapa da Propriedade
          </CardTitle>
          
          {propriedades.length > 1 && (
            <Select
              value={selectedPropriedade?.id_propriedade}
              onValueChange={handlePropriedadeChange}
            >
              <SelectTrigger className="w-[250px]">
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

        {selectedPropriedade && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="font-medium text-foreground">{selectedPropriedade.nome_da_propriedade}</span>
            {selectedPropriedade.municipio && <span>• {selectedPropriedade.municipio}</span>}
            {geometria && <span>• {geometria.areaHa.toFixed(2)} ha</span>}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="h-9 w-fit">
            <TabsTrigger value="mapa" className="gap-2 text-xs">
              <Map className="h-3.5 w-3.5" />
              Visualizar
            </TabsTrigger>
            <TabsTrigger value="importar" className="gap-2 text-xs">
              <Upload className="h-3.5 w-3.5" />
              Importar KML
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mapa" className="flex-1 mt-3">
            {loadingGeometria ? (
              <PropertyMapSkeleton className="w-full h-full min-h-[400px] rounded-lg" />
            ) : geometria ? (
              <div className="relative h-full min-h-[400px]">
                <PropertyMap
                  geojson={geometria.geojson}
                  centroide={geometria.centroide}
                  className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
                />
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 left-2 z-[1000]"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover geometria?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá remover o polígono importado desta propriedade.
                        Você poderá importar um novo arquivo posteriormente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteGeometria}>
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-muted/30 rounded-lg">
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
          </TabsContent>

          <TabsContent value="importar" className="flex-1 mt-3">
            {selectedPropriedade && (
              <div className="max-w-lg mx-auto space-y-4 py-8">
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
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
