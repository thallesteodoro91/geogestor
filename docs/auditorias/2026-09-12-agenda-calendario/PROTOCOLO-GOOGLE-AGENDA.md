# Protocolo Google Agenda

## Estado desta auditoria

**Integração real: BLOQUEADA.** Não havia conta Google isolada de QA nem autorização para usar conta pessoal. Nenhum login, consentimento, criação, edição ou exclusão remota foi realizado.

## O que foi validado localmente

- URL OAuth usa loopback `127.0.0.1`, escopo de calendário, `access_type=offline` e `prompt=consent`.
- `state` tem 32 bytes aleatórios, codificação base64url, expira em 10 minutos e é consumido uma única vez.
- Callback recusa erro, ausência de código e `state` ausente, inválido, expirado ou reutilizado antes de trocar token.
- `GET /api/configuracoes` não devolve client secret, access token ou refresh token.
- Segredos/tokens persistidos usam `LocalSecretService`; PATCH aceita limpar tokens, mas não lê segredo mascarado como novo valor.
- Status diferencia chaves configuradas, token conectado e sincronização ativa.
- Scheduler possui trava contra sobreposição e agora exige ativo + refresh token.
- Sync manual também recusa estado desativado.
- Paginação remota percorre `nextPageToken` com lotes de 250.
- Mapeamento local/remoto preserva data civil/hora em `America/Sao_Paulo` e atualiza `ultimoSyncGoogle`.
- Falha parcial é explicitada como erro; não retorna sucesso total silencioso.

## Protocolo necessário para desbloqueio

1. Criar conta e calendário exclusivos de QA, sem dados pessoais.
2. Registrar credenciais OAuth exclusivas para o ambiente de teste e confirmar redirect loopback.
3. Capturar baseline vazio e IDs remotos criados.
4. Testar conexão, cancelamento, `state` adulterado/reutilizado e callback duplicado.
5. Criar localmente: dia inteiro, 00:00, 23:59, bissexto, acentos e descrição longa; sincronizar e reconciliar por ID.
6. Criar remotamente os mesmos casos e validar importação civil.
7. Editar local e remoto separadamente; depois editar ambos antes da sincronização para validar política de conflito.
8. Excluir local e remoto separadamente; validar tombstone/política escolhida e ausência de ressurreição/duplicação.
9. Revogar consentimento, expirar access token, corromper refresh token e simular 401, 403, 404, 429 e 5xx.
10. Simular indisponibilidade/offline, retomada, paginação acima de 250 e duas solicitações concorrentes.
11. Verificar que logs, respostas, diagnóstico e banco exportado não expõem segredos em texto puro.
12. Remover todos os eventos e revogar/excluir as credenciais de QA ao terminar.

## Política observada e risco

O algoritmo atual envia o estado local antes de ler o Google. Para eventos já vinculados, isso equivale a precedência local e pode sobrescrever edição remota anterior. Evento removido no Google é recriado pelo local. Exclusão local não possui tombstone remoto, e “Desfazer” recria com novo ID sem `googleEventId`. Esses comportamentos exigem decisão de produto antes de chamar a integração de bidirecional perfeita.

## Critério de aprovação futura

A integração só deve mudar de BLOQUEADA para APROVADA quando todos os passos acima forem executados com evidência, limpeza confirmada e política de conflito/exclusão formalizada.

