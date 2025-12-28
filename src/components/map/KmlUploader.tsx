import React, { useCallback, useState } from 'react';
import { Upload, FileUp, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { parseKmlKmz, ParsedGeometry } from '@/lib/kmlParser';
import { createGeometria } from '@/modules/crm/services/geometria.service';
import { Json } from '@/integrations/supabase/types';

interface KmlUploaderProps {
  propriedadeId: string;
  onSuccess: (geometry: ParsedGeometry) => void;
  onError?: (error: string) => void;
}

export function KmlUploader({ propriedadeId, onSuccess, onError }: KmlUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const processFile = useCallback(async (file: File) => {
    const validExtensions = ['.kml', '.kmz'];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(extension)) {
      const errorMsg = 'Formato inválido. Use arquivos .kml ou .kmz';
      toast.error(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setIsProcessing(true);
    setUploadStatus('idle');

    try {
      const geometry = await parseKmlKmz(file);
      
      // Salvar no banco de dados
      await createGeometria({
        id_propriedade: propriedadeId,
        geojson: geometry.geojson as unknown as Json,
        area_calculada_ha: geometry.areaHa,
        perimetro_m: geometry.perimetroM,
        centroide_lat: geometry.centroide.lat,
        centroide_lng: geometry.centroide.lng,
        glebas: geometry.glebas as unknown as Json,
        arquivo_original_nome: file.name
      });

      setUploadStatus('success');
      toast.success('Arquivo importado com sucesso!', {
        description: `${geometry.glebas.length} gleba(s) - ${geometry.areaHa.toLocaleString('pt-BR')} ha`
      });
      onSuccess(geometry);
    } catch (error: any) {
      setUploadStatus('error');
      const errorMsg = error.message || 'Erro ao processar arquivo';
      toast.error('Erro ao importar arquivo', { description: errorMsg });
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [propriedadeId, onSuccess, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center transition-all
        ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
        ${isProcessing ? 'pointer-events-none opacity-70' : ''}
      `}
    >
      <input
        type="file"
        accept=".kml,.kmz"
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />
      
      <div className="flex flex-col items-center gap-3">
        {isProcessing ? (
          <>
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm font-medium">Processando arquivo...</p>
          </>
        ) : uploadStatus === 'success' ? (
          <>
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-green-600">Arquivo importado!</p>
            <p className="text-xs text-muted-foreground">Clique ou arraste para substituir</p>
          </>
        ) : uploadStatus === 'error' ? (
          <>
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm font-medium text-destructive">Erro ao importar</p>
            <p className="text-xs text-muted-foreground">Clique ou arraste para tentar novamente</p>
          </>
        ) : (
          <>
            <div className="p-3 bg-primary/10 rounded-full">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Arraste um arquivo KML ou KMZ aqui</p>
              <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
