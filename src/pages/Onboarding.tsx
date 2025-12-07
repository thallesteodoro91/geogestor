import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { createTenant } from "@/services/tenant.service";
import { Building2, ArrowRight, CheckCircle } from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant, refetchTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [step, setStep] = useState(1);

  // Redireciona para dashboard se já tem tenant
  useEffect(() => {
    if (tenant) {
      navigate("/", { replace: true });
    }
  }, [tenant, navigate]);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyName.trim()) return;

    setLoading(true);
    try {
      await createTenant(user.id, companyName.trim());
      await refetchTenant();
      setStep(2);
      toast.success("Empresa criada com sucesso!");
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      toast.error(error.message || "Erro ao criar empresa");
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-heading">Tudo Pronto!</CardTitle>
            <CardDescription>
              Sua empresa <strong>{companyName}</strong> foi criada com sucesso.
              <br />
              Você está no período de trial de 14 dias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Redirecionando para o dashboard...
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Ir para o Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-heading text-center">
            Configure sua Empresa
          </CardTitle>
          <CardDescription className="text-center">
            Informe o nome da sua empresa para começar a usar o SkyGeo 360.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da Empresa</Label>
              <Input
                id="company-name"
                type="text"
                placeholder="Ex: TopGeo Topografia"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !companyName.trim()}>
              {loading ? (
                "Criando..."
              ) : (
                <>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Você terá 14 dias de trial gratuito para explorar todas as funcionalidades.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
