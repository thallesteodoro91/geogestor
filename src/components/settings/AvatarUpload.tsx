import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  userName?: string;
  userEmail?: string;
}

export function AvatarUpload({ userId, currentAvatarUrl, userName, userEmail }: AvatarUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const getInitials = () => {
    if (userName) return userName.charAt(0).toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return "U";
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Por favor, selecione uma imagem');
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('A imagem deve ter no máximo 2MB');
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Avatar atualizado com sucesso!');
      setPreviewUrl(null);
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar avatar: ${error.message}`);
      setPreviewUrl(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // List files in user's folder
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (files && files.length > 0) {
        const filePaths = files.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('avatars').remove(filePaths);
      }

      // Update profile to remove avatar URL
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Avatar removido');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover avatar: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadMutation.mutate(file);
  };

  const displayUrl = previewUrl || currentAvatarUrl;
  const isLoading = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <Avatar className="h-20 w-20">
          <AvatarImage src={displayUrl || undefined} alt="Avatar" />
          <AvatarFallback className="bg-primary/10 text-primary text-2xl">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : getInitials()}
          </AvatarFallback>
        </Avatar>
        {isLoading && displayUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Foto de Perfil</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Camera className="h-4 w-4 mr-2" />
            {currentAvatarUrl ? 'Alterar' : 'Adicionar'}
          </Button>
          {currentAvatarUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG ou GIF. Máximo 2MB.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}