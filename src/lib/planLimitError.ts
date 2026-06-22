/**
 * Mapeia erros de `plan_limit_exceeded:<recurso>` (lançados pelos triggers
 * server-side) para mensagens amigáveis. Retorna null se o erro não for um
 * limite de plano — nesse caso o caller deve cair no toast genérico.
 */
export function getPlanLimitMessage(err: unknown): { title: string; description?: string } | null {
  const msg = (err as { message?: string })?.message ?? "";
  const m = msg.match(/plan_limit_exceeded:(\w+)/);
  if (!m) return null;
  const resource = m[1];
  const labels: Record<string, string> = {
    clientes: "Limite de clientes do plano atingido.",
    propriedades: "Limite de propriedades do plano atingido.",
    usuarios: "Limite de usuários do plano atingido.",
  };
  return {
    title: labels[resource] ?? "Limite do plano atingido.",
    description: "Faça upgrade para liberar mais cadastros.",
  };
}
