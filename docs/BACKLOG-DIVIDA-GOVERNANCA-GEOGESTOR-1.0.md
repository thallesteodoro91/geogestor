# Backlog priorizado da dívida de governança — GeoGestor 1.0

Data de consolidação: 13/08/2026

Este backlog organiza dívida histórica já diagnosticada. Não autoriza refatoração ampla, exclusão de recursos, leitura de arquivos de ambiente ou remoção de diretórios. A baseline continua bloqueando casos novos e aumentos sem exigir a eliminação imediata do histórico.

| Prioridade | Item e evidência atual | Risco | Impacto | Esforço | Dependências | Recomendação | Classificação atual |
|---|---|---|---|---|---|---|---|
| P1 | 71 links internos literais, agrupados em 51 assinaturas na baseline | Médio: divergência futura entre rotas e consumidores | Médio/alto em navegação e deep links | Alto | Catálogo `APP_ROUTES`, testes de rota e jornadas E2E | Migrar somente quando o fluxo for tocado; exigir teste e reduzir a contagem sem regravar a baseline para esconder aumento. | Recomendável; não bloqueante enquanto a baseline não aumenta |
| P1 | Candidatos de repetição de endpoints; o gate de 13/08 registrou 119 padrões repetidos no inventário completo, 88 em produção e 20 candidatos priorizados | Alto nos contratos legados de finanças/reset; inconclusivo nos demais | Alto se uma consolidação romper consumidor, teste ou compatibilidade | Médio/alto | Inventário por método/caminho/camada, `compatibility-registry.json`, telemetria local permitida e janela de depreciação | Revisar primeiro os contratos registrados; distinguir alias, teste e duplicação funcional antes de centralizar ou remover. | Recomendável; bloqueante apenas para remoção sem evidência/compatibilidade |
| P2 | Área histórica ignorada `temp-lovable`, com um arquivo de ambiente detectado somente pelo nome | Potencial risco operacional de credencial histórica; conteúdo e validade não verificados | Potencialmente alto fora do build; sem evidência de inclusão no pacote | Médio e dependente do proprietário | Confirmação de uso, inventário externo autorizado, rotação/revogação e política de retenção | Não ler nem alterar nesta tarefa. O proprietário deve confirmar uso e rotacionar/revogar externamente quando aplicável; excluir somente com autorização e prévia segura. | Recomendável; torna-se bloqueante se houver evidência de segredo ativo exposto ou inclusão no pacote/versionamento |
| P2 | 26 recursos visuais sem consumidor comprovado | Baixo/médio: aumento do pacote ou origem/autoria incompleta | Baixo no runtime; médio para revisão de terceiros | Médio | Revisão visual humana, grafo de imports, comparação com pacote final e comprovação de origem | Preservar até revisão conjunta de uso e autoria; remover individualmente apenas com ausência comprovada e teste visual. | Recomendável; não bloqueante no estado inconclusivo |

## Ordem de execução futura

1. Tratar contratos de endpoint com risco alto já registrados, sem remover compatibilidade antes da condição documentada.
2. Reduzir links literais oportunisticamente junto aos fluxos tocados e testados.
3. Resolver externamente a retenção e possível rotação associada a `temp-lovable`, sem abrir conteúdo em auditoria técnica comum.
4. Revisar os 26 recursos na próxima consolidação visual/licenças.

## Regra permanente

- Novos links literais ou aumento de assinatura histórica: **bloqueante** pelo gate de governança.
- Redução da baseline: permitida e informada como melhoria.
- Repetição de endpoint ou recurso sem consumidor: sinal de revisão, não prova automática de defeito.
- Remoção de endpoint, alias, recurso ou diretório: exige evidência específica, testes proporcionais e autorização quando houver dados, segredos ou artefatos fora da propriedade da automação.
