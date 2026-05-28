import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RotateCcw, Wand2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  CONSISTENCY_RULES,
  getRuleConfig,
  setRuleConfig,
  resetRuleConfig,
  type RuleConfig,
} from "@/lib/etl/consistencyRulesConfig";

export function ImportRulesTab() {
  const [config, setConfig] = useState<RuleConfig>(() => getRuleConfig());

  useEffect(() => {
    setConfig(getRuleConfig());
  }, []);

  const updateRule = (code: string, patch: Partial<{ enabled: boolean; autoFix: boolean }>) => {
    const next: RuleConfig = {
      ...config,
      [code]: { ...config[code], ...patch },
    };
    setConfig(next);
    setRuleConfig(next);
  };

  const handleReset = () => {
    resetRuleConfig();
    setConfig(getRuleConfig());
    toast.success("Regras restauradas para o padrão");
  };

  const enabledCount = Object.values(config).filter((c) => c.enabled).length;
  const autoFixCount = Object.values(config).filter((c) => c.enabled && c.autoFix).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Regras de consistência da importação
            </CardTitle>
            <CardDescription>
              Ative ou desative cada regra de validação cruzada entre Forma de Pagamento,
              Situação do Pagamento e Status do Orçamento. Para regras com auto-fix, você
              pode escolher se a correção é aplicada automaticamente.
            </CardDescription>
            <div className="flex gap-2 pt-1">
              <Badge variant="secondary">{enabledCount} de {CONSISTENCY_RULES.length} ativas</Badge>
              <Badge variant="outline" className="gap-1">
                <Wand2 className="h-3 w-3" />
                {autoFixCount} com auto-fix
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {CONSISTENCY_RULES.map((rule, idx) => {
          const cfg = config[rule.code] ?? { enabled: true, autoFix: false };
          return (
            <div key={rule.code}>
              {idx > 0 && <Separator className="mb-4" />}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <Label htmlFor={`rule-${rule.code}`} className="text-sm font-medium cursor-pointer">
                    {rule.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                  {rule.supportsAutoFix && cfg.enabled && (
                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        id={`autofix-${rule.code}`}
                        checked={cfg.autoFix}
                        onCheckedChange={(v) => updateRule(rule.code, { autoFix: !!v })}
                      />
                      <Label
                        htmlFor={`autofix-${rule.code}`}
                        className="text-xs cursor-pointer flex items-center gap-1"
                      >
                        <Wand2 className="h-3 w-3" />
                        Aplicar correção automática
                      </Label>
                    </div>
                  )}
                </div>
                <Switch
                  id={`rule-${rule.code}`}
                  checked={cfg.enabled}
                  onCheckedChange={(v) => updateRule(rule.code, { enabled: !!v })}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
