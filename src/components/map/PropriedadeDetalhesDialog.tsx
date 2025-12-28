import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, Upload, Info, Trash2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { PropertyMap, PropertyMapSkeleton } from './PropertyMap';
import { PropertyInfoPanel } from './PropertyInfoPanel';
import { KmlUploader } from './KmlUploader';
import { useMapboxToken } from '@/hooks/useMapboxToken';
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

interface PropriedadeDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propriedade: Tables<'dim_propriedade'>;
}

export function PropriedadeDetalhesDialog({
  open,
  onOpenChange,
  propriedade
}: PropriedadeDetalhesDialogProps) {
  const { token: mapboxToken, loading: tokenLoading } = useMapboxToken();
  const [geometria, setGeometria] = useState<ParsedGeometry | null>(null);
  const [loadingGeometria, setLoadingGeometria] = useState(true);
  const [activeTab, setActiveTab] = useState('mapa');

  useEffect(() => {
    if (open && propriedade.id_propriedade) {
      loadGeometria();
    }
  }, [open, propriedade.id_propriedade]);

  const loadGeometria = async () => {
    setLoadingGeometria(true);
    try {
      const data = await fetchGeometriaByPropriedade(propriedade.id_propriedade);
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
    try {
      await deleteGeometria(propriedade.id_propriedade);
      setGeometria(null);
      toast.success('Geometria removida com sucesso');
    } catch (error) {
      toast.error('Erro ao remover geometria');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Map className="h-5 w-5" />
            {propriedade.nome_da_propriedade}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Painel Principal - Mapa */}
          <div className="flex-1 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-6 border-b">
                <TabsList className="h-10">
                  <TabsTrigger value="mapa" className="gap-2">
                    <Map className="h-4 w-4" />
                    Mapa
                  </TabsTrigger>
                  <TabsTrigger value="importar" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Importar KML
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="mapa" className="flex-1 m-0 p-4">
                {loadingGeometria || tokenLoading ? (
                  <PropertyMapSkeleton className="w-full h-full min-h-[400px]" />
                ) : geometria && mapboxToken ? (
                  <div className="relative h-full">
                    <PropertyMap
                      geojson={geometria.geojson}
                      centroide={geometria.centroide}
                      mapboxToken={mapboxToken}
                      className="w-full h-full min-h-[400px]"
                    />
                    
                    {/* Botão para remover geometria */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 left-2 z-10"
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
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/30 rounded-lg">
                    <Map className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum mapa disponível</h3>
                    <p className="text-muted-foreground mb-4 max-w-md">
                      Importe um arquivo KML ou KMZ para visualizar o polígono desta propriedade no mapa.
                    </p>
                    <Button onClick={() => setActiveTab('importar')}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Arquivo
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="importar" className="flex-1 m-0 p-4">
                <div className="max-w-lg mx-auto space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold mb-2">Importar Arquivo KML/KMZ</h3>
                    <p className="text-sm text-muted-foreground">
                      Arraste ou selecione um arquivo para importar o polígono da propriedade.
                      {geometria && ' O arquivo atual será substituído.'}
                    </p>
                  </div>
                  
                  <KmlUploader
                    propriedadeId={propriedade.id_propriedade}
                    onSuccess={handleUploadSuccess}
                  />

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Arquivos suportados: .kml e .kmz</p>
                    <p>• Apenas polígonos serão importados</p>
                    <p>• A área e perímetro serão calculados automaticamente</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Painel Lateral - Informações */}
          <div className="w-80 border-l bg-muted/20 overflow-y-auto p-4">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4" />
              <h3 className="font-semibold">Informações</h3>
            </div>
            
            {loadingGeometria ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <PropertyInfoPanel
                propriedade={propriedade}
                geometria={geometria}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
