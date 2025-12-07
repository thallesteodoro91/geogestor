import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function AceitarConvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "auth-required">("loading");
  const [message, setMessage] = useState("");
  const [tenantName, setTenantName] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token de convite inválido ou não fornecido.");
      return;
    }

    checkAuthAndAccept();
  }, [token]);

  const checkAuthAndAccept = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setStatus("auth-required");
      setMessage("Faça login ou crie uma conta para aceitar o convite.");
      return;
    }

    acceptInvite();
  };

  const acceptInvite = async () => {
    setStatus("loading");

    try {
      const { data, error } = await supabase.functions.invoke("accept-invite", {
        body: { token },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStatus("success");
      setMessage(data?.message || "Convite aceito com sucesso!");
      setTenantName(data?.tenant_name || "");

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate("/");
      }, 2000);

    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "Erro ao aceitar convite.");
    }
  };

  const handleLogin = () => {
    // Store token in sessionStorage to retrieve after login
    if (token) {
      sessionStorage.setItem("pending_invite_token", token);
    }
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && (
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
            {status === "auth-required" && (
              <UserPlus className="h-12 w-12 text-primary" />
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Processando Convite..."}
            {status === "success" && "Bem-vindo!"}
            {status === "error" && "Erro no Convite"}
            {status === "auth-required" && "Aceitar Convite"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "auth-required" && (
            <div className="space-y-3">
              <Button onClick={handleLogin} className="w-full">
                Fazer Login
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Após fazer login, o convite será aceito automaticamente.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Você será redirecionado automaticamente...
              </p>
              <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                Ir para o Dashboard
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
                Ir para Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
