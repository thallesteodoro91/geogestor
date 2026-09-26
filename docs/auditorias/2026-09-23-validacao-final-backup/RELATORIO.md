# Validação final de restauração real e recuperação portátil

Data: 23/09/2026. Veredito: **BLOQUEADA**. A recomendação é **NÃO CONFIAR ATÉ CORRIGIR/DESTRAVAR** para recuperação de desastre fora deste computador.

## Motivos determinantes

1. A linha de base de 19/09/2026 registrou schema v16. O código atual incorpora migrações até v17 e mudou a validação/restauração do bundle. Isso constitui mudança material conforme o roteiro reduzido; a auditoria completa precisa ser refeita no candidato final.
2. O worktree está amplamente modificado e não há candidato atual, limpo, instalado e vinculado a commit e SHA-256. Os instaladores em `apps/desktop/dist` são artefatos históricos, sem vínculo comprovado com esta fonte.
3. Não foram comprovados dois ambientes Windows descartáveis, snapshots externos, caminhos exatos, ausência de dados reais nem chaves distintas. A busca local não encontrou processo GeoGestor nem registro de instalação; `Get-VM` não está disponível. Esses sinais não provam que nenhum ambiente externo exista, apenas que nenhum foi identificado para esta execução.

Pela condição de segurança do roteiro, nenhuma restauração, mutação de dados do usuário, instalação, build de candidato ou cópia de segredo foi iniciada.

## Resultado por cenário

| Cenário | Resultado | Evidência |
|---|---|---|
| Dispositivo A instalado, restauração e reinício Electron | **BLOQUEADO** | 0 restaurações físicas e 0 reinícios observados |
| Dispositivo B limpo por código | **BLOQUEADO** | 0 perfis B comprovados e 0 recuperações físicas |
| Dispositivo B limpo por kit | **BLOQUEADO** | 0 snapshots B-kit comprovados e 0 recuperações físicas |
| Regressão sintética de integração | **APROVADA no escopo automatizado** | 7/7 testes API; após a correção mínima, integração de backup repetida: 1/1 |
| Testes Electron | **APROVADOS no escopo automatizado** | 18/18 |
| Typecheck | **APROVADO** | duas execuções, exit 0 |
| Lint API | **CORRIGIDO** | erro de `preserve-caught-error` em `backup.service.ts:616`; reteste exit 0, 78 avisos não bloqueantes |

Nenhuma contagem, valor em centavos, árvore documental, SHA-256 de documentos, RPO ou RTO físico foi medido. Os tempos de fixtures não representam o ciclo instalado.

## Próxima execução necessária

Revalidar o pipeline completo após as migrações v14–v17 em fonte consolidada; gerar candidato limpo com hash; demonstrar snapshots e isolamento de A, B-código e B-kit; então criar dados exclusivamente sintéticos, oráculos independentes, bundle pela interface instalada e realizar os três ciclos físicos com reinícios. O mesmo candidato deve sustentar A e B.

Este dossiê registra o bloqueio e as verificações não destrutivas. Não o use como aprovação de recuperação.
