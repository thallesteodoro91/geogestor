import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, FileIcon, Download, Image, FileText, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  fetchAnexosByServico,
  uploadAnexo,
  deleteAnexo,
  getAnexoSignedUrl,
  formatFileSize,
  ServicoAnexo
} from '@/modules/operations/services/servico-anexos.service';
import { registrarAnexo } from '@/modules/operations/services/servico-eventos.service';

interface AnexosListProps {
  servicoId: string;
}

export function AnexosList({ servicoId }: AnexosListProps) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: anexos = [], isLoading } = useQuery({
    queryKey: ['servico-anexos', servicoId],
    queryFn: async () => {
      const { data, error } = await fetchAnexosByServico(servicoId);
      if (error) throw error;
      return data || [];
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { error } = await uploadAnexo(servicoId, file);
        if (error) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }
        await registrarAnexo(servicoId, file.name);
      }
      queryClient.invalidateQueries({ queryKey: ['servico-anexos', servicoId] });
      toast.success('Arquivo(s) enviado(s) com sucesso');
    } catch (error) {
      toast.error('Erro ao enviar arquivos');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (anexo: ServicoAnexo) => {
      const { error } = await deleteAnexo(anexo);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-anexos', servicoId] });
      toast.success('Arquivo removido');
    },
    onError: () => toast.error('Erro ao remover arquivo')
  });

  const handleDownload = async (anexo: ServicoAnexo) => {
    const url = await getAnexoSignedUrl(anexo.storage_path);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('Erro ao gerar link de download');
    }
  };

  const getFileIcon = (tipo: string | null) => {
    if (!tipo) return <File className="h-8 w-8" />;
    if (tipo.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
    if (tipo.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    return <FileIcon className="h-8 w-8 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {anexos.length} arquivo(s)
        </div>
        <div>
          <Input
            type="file"
            multiple
            className="hidden"
            id="file-upload"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <label htmlFor="file-upload">
            <Button asChild disabled={uploading}>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                {uploading ? 'Enviando...' : 'Upload'}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Carregando...</div>
      ) : anexos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          Nenhum arquivo anexado. Faça upload de documentos e imagens.
        </div>
      ) : (
        <div className="space-y-2">
          {anexos.map((anexo) => (
            <div
              key={anexo.id_anexo}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              {getFileIcon(anexo.tipo_arquivo)}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{anexo.nome_arquivo}</div>
                <div className="text-sm text-muted-foreground">
                  {formatFileSize(anexo.tamanho_bytes)}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDownload(anexo)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(anexo)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
