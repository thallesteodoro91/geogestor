import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

type Status = "validating" | "ready" | "invalid" | "saving";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("validating");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let recoveryUid: string | null = null;

    const captureRecoveryUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      recoveryUid = user?.id ?? null;
      if (!cancelled) setRecoveryUserId(recoveryUid);
    };

    const processRecoveryLink = async () => {
      try {
        // Always clear any pre-existing session first so we don't reset the wrong user.
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});

        const url = new URL(window.location.href);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const search = url.searchParams;

        const errorDesc = hash.get("error_description") || search.get("error_description");
        if (errorDesc) {
          throw new Error(errorDesc);
        }

        // 1) PKCE flow: ?code=...
        const code = search.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState({}, document.title, "/reset-password");
          await captureRecoveryUser();
          if (!cancelled) setStatus("ready");
          return;
        }

        // 2) Classic OTP recovery: ?token_hash=...&type=recovery
        const tokenHash = search.get("token_hash") || hash.get("token_hash");
        const type = search.get("type") || hash.get("type");
        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          if (error) throw error;
          window.history.replaceState({}, document.title, "/reset-password");
          await captureRecoveryUser();
          if (!cancelled) setStatus("ready");
          return;
        }

        // 3) Legacy hash tokens: #access_token=...&type=recovery
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken && (type === "recovery" || hash.get("type") === "recovery")) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState({}, document.title, "/reset-password");
          await captureRecoveryUser();
          if (!cancelled) setStatus("ready");
          return;
        }

        // 4) If a recovery session was auto-created by detectSessionInUrl, accept it.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await captureRecoveryUser();
          if (!cancelled) setStatus("ready");
          return;
        }

        throw new Error("missing_token");
      } catch (err: any) {
        console.error("[ResetPassword] token error:", err);
        if (!cancelled) {
          setErrorMsg("Link expirado ou inválido. Solicite uma nova redefinição.");
          setStatus("invalid");
        }
      }
    };

    processRecoveryLink();

    // Guard: if any OTHER session (different user) gets injected mid-flow
    // — e.g. another tab logs in and syncs via localStorage — abort safely.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") return;
      // Only react once we have captured the recovery user
      if (!recoveryUid) return;
      const incomingUid = session?.user?.id ?? null;
      if (incomingUid && incomingUid !== recoveryUid) {
        console.warn("[ResetPassword] foreign session detected, aborting reset flow");
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setErrorMsg("Outra conta foi detectada durante a redefinição. Solicite um novo link e tente novamente em uma janela anônima.");
        setStatus("invalid");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setStatus("saving");
    try {
      // Re-verify the active session still belongs to the recovery user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || (recoveryUserId && user.id !== recoveryUserId)) {
        throw new Error("Sessão de recuperação perdida. Solicite um novo link.");
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut().catch(() => {});
      toast.success("Senha redefinida com sucesso. Faça login novamente.");
      navigate("/auth", { replace: true });
    } catch (err: any) {
      console.error("[ResetPassword] update error:", err);
      toast.error(err?.message || "Erro ao redefinir senha");
      setStatus("ready");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-heading">Redefinir senha</CardTitle>
          <CardDescription>Defina uma nova senha para acessar sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "validating" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Validando link…</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-foreground">{errorMsg}</p>
              </div>
              <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                Voltar ao login
              </Button>
            </div>
          )}

          {(status === "ready" || status === "saving") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={status === "saving"}>
                {status === "saving" ? "Salvando…" : "Redefinir senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
