import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, LogOut, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SubscriptionExpiredScreenProps {
  planName: string;
  expiredAt?: string | null;
}

export function SubscriptionExpiredScreen({ planName, expiredAt }: SubscriptionExpiredScreenProps) {
  const navigate = useNavigate();
  const formattedDate = expiredAt
    ? format(new Date(expiredAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Assinatura Expirada</CardTitle>
          <CardDescription className="text-base">
            Seu período de avaliação do plano <strong>{planName}</strong> expirou
            {formattedDate && <> em <strong>{formattedDate}</strong></>}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <p className="font-medium">Renove para continuar</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Escolha um plano e recupere o acesso completo ao GeoGestor.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 border-0"
              onClick={() => navigate("/assinatura")}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Renovar Assinatura
            </Button>
            <Button
              variant="outline"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}