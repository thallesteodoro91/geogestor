import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface GeoBotProps {
  kpis?: any;
}

export function GeoBot({ kpis }: GeoBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o GeoBot, seu consultor financeiro e operacional. Posso analisar seus KPIs, identificar tendências e sugerir ações estratégicas. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Adicionar contexto de KPIs se disponível
      const contextMessage = kpis
        ? `Contexto atual dos KPIs:
Receita Total: R$ ${kpis.receita_total?.toLocaleString('pt-BR')}
Lucro Bruto: R$ ${kpis.lucro_bruto?.toLocaleString('pt-BR')}
Margem Bruta: ${kpis.margem_bruta_percent?.toFixed(1)}%
Margem Líquida: ${kpis.margem_liquida_percent?.toFixed(1)}%
Margem de Contribuição: ${kpis.margem_contribuicao_percent?.toFixed(1)}%
Ponto de Equilíbrio: R$ ${kpis.ponto_equilibrio_receita?.toLocaleString('pt-BR')}
Taxa de Conversão: ${kpis.taxa_conversao_percent?.toFixed(1)}%
Ticket Médio: R$ ${kpis.ticket_medio?.toLocaleString('pt-BR')}
Total de Serviços: ${kpis.total_servicos}
Serviços Concluídos: ${kpis.servicos_concluidos}

Pergunta do usuário: ${input}`
        : input;

      const messagesToSend = [
        ...messages,
        { role: "user", content: contextMessage },
      ];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geobot-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: messagesToSend }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Limite de requisições atingido. Tente novamente em alguns instantes.");
        }
        if (response.status === 402) {
          throw new Error("Créditos de IA esgotados. Adicione mais créditos ao workspace.");
        }
        throw new Error("Erro ao processar sua mensagem.");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let textBuffer = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantMessage,
                };
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar mensagem",
        variant: "destructive",
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    { icon: TrendingUp, text: "Analise as margens financeiras", question: "Como estão as margens bruta e líquida? Há algum ponto de atenção?" },
    { icon: AlertCircle, text: "Identifique riscos", question: "Quais são os principais riscos financeiros e operacionais no momento?" },
  ];

  return (
    <Card className="interactive-lift flex flex-col h-[600px] border-geobot-border bg-geobot-bg">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-geobot-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-geobot text-white">
          <Brain className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">GeoBot</h3>
          <p className="text-xs text-muted-foreground">Consultor Financeiro & Operacional</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-geobot text-white shrink-0">
                  <Brain className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-geobot text-white shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                <p className="text-sm text-muted-foreground">Analisando...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Questions */}
      {messages.length === 1 && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs text-muted-foreground">Sugestões:</p>
          <div className="grid grid-cols-2 gap-2">
            {quickQuestions.map((q, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="justify-start text-xs h-auto py-2"
                onClick={() => {
                  setInput(q.question);
                }}
              >
                <q.icon className="w-3 h-3 mr-2 shrink-0" />
                <span className="truncate">{q.text}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-geobot-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Pergunte sobre os dados financeiros..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 bg-geobot hover:bg-geobot/90"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}