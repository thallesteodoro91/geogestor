# Achados

## Corrigidos e retestados

| ID | Severidade | Achado | Correção | Evidência |
|---|---|---|---|---|
| S15-01 | P1 | Pesquisa global retornava entidades removidas e links mortos. | Filtros por remoção, pais ativos e teste isolado dos seis tipos. | API 190/190 e teste focado verde. |
| S15-02 | P1 | Gatilho da pesquisa global ficava oculto em telas móveis. | Botão compacto móvel de 40 × 40 px com `aria-label`. | Web 202/202 e E2E de Ajuda/acessibilidade. |
| S15-03 | P1 | Toast de sucesso empilhado tinha contraste 4,28:1. | Título de sucesso escurecido para `#004d1b`. | Sessão 06 focada passou sem violações Axe. |
| S15-04 | P2 | Comboboxes de filtros podiam renderizar com 32 px apesar da classe de 40 px. | Regra efetiva restrita à região “Busca e filtros”. | Auditoria dos 17 cabeçalhos passou no reteste. |
| S15-05 | P2 | Metadados da Ajuda declaravam versão mínima 1.0.1. | Alinhamento para 1.0.4 e teste de governança. | Web/governança verdes. |
| S15-06 | P2 | Nome do instalador fixava “1.0” e podia divergir da versão técnica. | `artifactName` derivado de `${version}`. | Governança 18/18. |
| S15-07 | P2 | Links internos repetidos desviavam do catálogo canônico. | Novos helpers e migração dos consumidores identificados. | Governança: dez literais removidos, zero novos. |
| S15-08 | P2 | Fixture financeira absoluta mudou de significado com o calendário. | Data futura relativa no teste. | API 190/190. |
| S15-09 | P2 | Testes usavam API nativa de `<select>` sobre combobox customizado e seletor textual ambíguo. | Interação por role/option e texto exato. | Retestes focados verdes. |

## Abertos ou bloqueantes

| ID | Severidade | Estado | Impacto | Próxima ação |
|---|---|---|---|---|
| S15-10 | P1 | aberto | Suíte E2E integral compartilha banco e contamina estados vazios, contagens e dados entre specs. | Isolar banco por spec ou resetar estado de modo determinístico; reexecutar 90/90. |
| S15-11 | P1 | bloqueado | Não existe candidato novo verificável porque a origem está suja. | Revisão humana, consolidação autorizada e build a partir de commit/tag limpo. |
| S15-12 | P1 | pendente humano | 19 ensaios Windows/WCAG não foram executados no instalador final. | Executar checklist por hash do candidato. |
| S15-13 | P2 | aberto | Pesquisa global processa coleções amplas em memória. | Criar benchmark e mover filtro/limite para consultas indexadas se necessário. |
| S15-14 | P2 | aberto | Fixtures E2E com datas fixas alteram o resultado conforme o dia corrente. | Usar relógio controlado ou datas relativas em todos os specs afetados. |
| S15-15 | P2 | aberto | Baseline ainda aceita 60 links literais e existem 28 ativos inconclusivos. | Redução incremental sem aumentar a baseline. |
| S15-16 | P2 | pendente externo | Revisão jurídica, terceiros e termos do provedor de mapas não concluídos. | Revisão por profissional habilitado antes da publicação. |
| S15-17 | risco aceito | documentado | Binário sem Authenticode pode acionar SmartScreen. | Teste humano do aviso e comunicação verdadeira. |

Assinatura digital: não implementada por decisão do proprietário — risco residual aceito.

## Falhas da execução E2E integral

As 13 falhas foram classificadas sem apagá-las: duas eram defeitos reais de UI (S15-03 e S15-04), duas eram seletores/mocks de teste desatualizados, e as demais estavam associadas sobretudo ao banco compartilhado, premissas de vazio/contagem e datas fixas. Como 21 casos dependentes não chegaram a rodar, o resultado integral permanece vermelho mesmo após os retestes focados.
