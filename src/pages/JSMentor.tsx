import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileCode, CheckCircle2, AlertCircle, BookOpen, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AnalysisResult {
  issues: Array<{
    line: number;
    severity: "error" | "warning" | "info";
    message: string;
    explanation: string;
    suggestion: string;
    reference?: string;
  }>;
  refactoredCode?: string;
  summary: string;
  bestPractices: string[];
}

export default function JSMentor() {
  const [code, setCode] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [explainLikeImFive, setExplainLikeImFive] = useState(false);
  const { toast } = useToast();

  const analyzeCode = async () => {
    if (!code.trim()) {
      toast({
        title: "Código vazio",
        description: "Por favor, cole algum código JavaScript para análise.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-js-code", {
        body: { code, simplifyExplanations: explainLikeImFive },
      });

      if (error) throw error;

      setAnalysis(data as AnalysisResult);
      toast({
        title: "✨ Análise concluída!",
        description: "Vamos revisar seu código juntos.",
      });
    } catch (error) {
      console.error("Error analyzing code:", error);
      toast({
        title: "Erro na análise",
        description: "Não foi possível analisar o código. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error":
        return "text-red-500 bg-red-50 dark:bg-red-950/20";
      case "warning":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20";
      case "info":
        return "text-blue-500 bg-blue-50 dark:bg-blue-950/20";
      default:
        return "";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-5 w-5" />;
      case "warning":
        return <AlertCircle className="h-5 w-5" />;
      case "info":
        return <Lightbulb className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">JS Mentor</h1>
            <p className="text-muted-foreground">
              Seu mentor de JavaScript: calmo, confiável e sempre presente para ajudar
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Input */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-primary" />
                  <CardTitle>Cole seu código</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="explain-mode"
                    checked={explainLikeImFive}
                    onCheckedChange={setExplainLikeImFive}
                  />
                  <Label htmlFor="explain-mode" className="text-sm cursor-pointer">
                    Explicar de forma simples
                  </Label>
                </div>
              </div>
              <CardDescription>
                Cole qualquer código JavaScript, TypeScript ou React para análise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="// Cole seu código aqui...
function example() {
  var x = 10;
  if (x = 5) {
    console.log('Hello');
  }
}"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
              />
              <Button
                onClick={analyzeCode}
                disabled={isAnalyzing}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Analisando seu código...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analisar Código
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Analysis Results */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Análise e Sugestões
              </CardTitle>
              <CardDescription>
                Vamos revisar juntos e aprender com cada detalhe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!analysis ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Sparkles className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">
                      Pronto para começar?
                    </h3>
                    <p className="text-muted-foreground max-w-sm">
                      Cole seu código JavaScript e vou ajudá-lo a identificar problemas,
                      aprender boas práticas e escrever código mais limpo.
                    </p>
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="issues" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="issues">Problemas</TabsTrigger>
                    <TabsTrigger value="refactored">Refatorado</TabsTrigger>
                    <TabsTrigger value="practices">Boas Práticas</TabsTrigger>
                  </TabsList>

                  <TabsContent value="issues" className="space-y-4">
                    <ScrollArea className="h-[450px] pr-4">
                      {analysis.summary && (
                        <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm text-foreground">{analysis.summary}</p>
                        </div>
                      )}

                      {analysis.issues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3">
                          <CheckCircle2 className="h-16 w-16 text-green-500" />
                          <h3 className="font-semibold text-lg">Excelente trabalho!</h3>
                          <p className="text-muted-foreground text-center max-w-md">
                            Não encontrei problemas significativos no seu código.
                            Continue assim!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {analysis.issues.map((issue, index) => (
                            <Card key={index} className={getSeverityColor(issue.severity)}>
                              <CardHeader className="pb-3">
                                <div className="flex items-start gap-3">
                                  {getSeverityIcon(issue.severity)}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-xs">
                                        Linha {issue.line}
                                      </Badge>
                                      <Badge
                                        variant={
                                          issue.severity === "error"
                                            ? "destructive"
                                            : issue.severity === "warning"
                                            ? "secondary"
                                            : "default"
                                        }
                                      >
                                        {issue.severity === "error"
                                          ? "Erro"
                                          : issue.severity === "warning"
                                          ? "Atenção"
                                          : "Dica"}
                                      </Badge>
                                    </div>
                                    <p className="font-semibold text-sm">{issue.message}</p>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div>
                                  <p className="text-sm font-medium mb-1">Por quê?</p>
                                  <p className="text-sm text-muted-foreground">
                                    {issue.explanation}
                                  </p>
                                </div>
                                {issue.suggestion && (
                                  <div>
                                    <p className="text-sm font-medium mb-1 text-green-600 dark:text-green-400">
                                      ✓ Como corrigir:
                                    </p>
                                    <pre className="text-xs bg-background/50 p-3 rounded border overflow-x-auto">
                                      <code>{issue.suggestion}</code>
                                    </pre>
                                  </div>
                                )}
                                {issue.reference && (
                                  <div>
                                    <p className="text-xs text-muted-foreground italic">
                                      📚 {issue.reference}
                                    </p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="refactored">
                    <ScrollArea className="h-[450px]">
                      {analysis.refactoredCode ? (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Aqui está uma versão melhorada do seu código:
                          </p>
                          <pre className="text-sm bg-muted p-4 rounded-lg border overflow-x-auto">
                            <code>{analysis.refactoredCode}</code>
                          </pre>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              navigator.clipboard.writeText(analysis.refactoredCode || "");
                              toast({
                                title: "Código copiado!",
                                description: "O código refatorado foi copiado para sua área de transferência.",
                              });
                            }}
                          >
                            Copiar código refatorado
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                          <FileCode className="h-16 w-16 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            Nenhuma refatoração sugerida para este código.
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="practices">
                    <ScrollArea className="h-[450px]">
                      {analysis.bestPractices.length > 0 ? (
                        <div className="space-y-3">
                          {analysis.bestPractices.map((practice, index) => (
                            <Card key={index} className="bg-primary/5">
                              <CardContent className="pt-6">
                                <div className="flex gap-3">
                                  <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                  <p className="text-sm">{practice}</p>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                          <CheckCircle2 className="h-16 w-16 text-green-500" />
                          <p className="text-muted-foreground">
                            Seu código já segue boas práticas!
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
