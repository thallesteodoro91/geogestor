import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { authSchema } from "@/lib/validations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";

interface LastUser {
  email: string;
  avatarUrl?: string;
}

const LAST_USER_KEY = "skygeo_last_user";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [lastUser, setLastUser] = useState<LastUser | null>(null);

  // Load last user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(LAST_USER_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LastUser;
        setLastUser(parsed);
        setEmail(parsed.email);
      } catch {
        localStorage.removeItem(LAST_USER_KEY);
      }
    }
  }, []);

  const clearLastUser = () => {
    localStorage.removeItem(LAST_USER_KEY);
    setLastUser(null);
    setEmail("");
  };

  const saveLastUser = async (userEmail: string, userId: string) => {
    // Fetch avatar from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    
    const userData: LastUser = {
      email: userEmail,
      avatarUrl: profile?.avatar_url || undefined,
    };
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(userData));
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handlePostLoginRedirect();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        handlePostLoginRedirect();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handlePostLoginRedirect = () => {
    // Check if there's a pending invite token
    const pendingToken = sessionStorage.getItem("pending_invite_token");
    if (pendingToken) {
      sessionStorage.removeItem("pending_invite_token");
      navigate(`/aceitar-convite?token=${pendingToken}`);
    } else {
      navigate("/");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ email, password });
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error(error.message);
        }
      } else {
        // Save last user info
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          saveLastUser(user.email || validatedData.email, user.id);
        }
        toast.success("Login realizado com sucesso!");
        handlePostLoginRedirect();
      }
    } catch (error: any) {
      if (error.errors) {
        error.errors.forEach((err: any) => toast.error(err.message));
      } else {
        toast.error("Erro ao fazer login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      setLoading(false);
      return;
    }

    try {
      const validatedData = authSchema.parse({ email, password });
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast.error("Este email já está cadastrado. Faça login.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Conta criada com sucesso! Você será redirecionado.");
      }
    } catch (error: any) {
      if (error.errors) {
        error.errors.forEach((err: any) => toast.error(err.message));
      } else {
        toast.error("Erro ao criar conta");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-heading">SkyGeo 360</CardTitle>
          <CardDescription>Plataforma de Gestão para Topografia</CardDescription>
          
          {lastUser && (
            <div className="flex items-center gap-3 pt-4 pb-2">
              <Avatar className="h-12 w-12">
                <AvatarImage src={lastUser.avatarUrl} alt={lastUser.email} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(lastUser.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
                <p className="text-sm font-medium truncate">{lastUser.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={clearLastUser}
                title="Usar outra conta"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" onValueChange={resetForm}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
