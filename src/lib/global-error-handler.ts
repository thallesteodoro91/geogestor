import { toast } from "sonner";

export function setupGlobalErrorHandler() {
  // Capturar rejeições de Promise não tratadas
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[GlobalErrorHandler] Unhandled Promise rejection:", event.reason);

    // Mensagem genérica para o usuário
    toast.error("Erro de conexão", {
      description: "Não foi possível completar a operação. Verifique sua conexão e tente novamente.",
    });

    // Prevenir que o erro apareça no console duplicado
    event.preventDefault();
  });

  // Capturar erros JavaScript não tratados
  window.addEventListener("error", (event) => {
    // Ignorar erros de scripts externos (CORS)
    if (event.filename && !event.filename.includes(window.location.origin)) {
      return;
    }

    console.error("[GlobalErrorHandler] Uncaught error:", event.error);

    toast.error("Erro inesperado", {
      description: "Algo deu errado. Por favor, recarregue a página.",
    });
  });
}
