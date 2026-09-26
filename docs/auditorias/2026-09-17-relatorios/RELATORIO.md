# Auditoria da Sessão 11 — Relatórios

## Conclusão executiva

**Resultado: APROVADA COM RESSALVAS.** A rota `/relatorios`, os relatórios Financeiro, Projetos e Executivo e os documentos PDF foram auditados, corrigidos e retestados com banco SQLite descartável e dados sintéticos. Os 12 defeitos encontrados no escopo foram corrigidos: 4 de prioridade P1 e 8 de prioridade P2. Não restaram defeitos P0 ou P1 conhecidos no módulo de Relatórios.

A aprovação tem duas ressalvas herdadas, fora do escopo funcional da Sessão 11:

1. a suíte completa da API mantém uma falha reproduzível em `financial-removal-scenarios.integration.test.ts`, relacionada à remoção financeira e não aos relatórios;
2. a verificação de release reprova porque o manifesto existente não contém os instaladores 1.0.2/1.0.3 e não corresponde ao tamanho/hash do instalador 1.0.4 recém-gerado.

Também permanecem bloqueadas verificações que exigem infraestrutura ou interação física não disponível nesta execução: leitor de tela real, diálogo nativo de impressão/cancelamento, concorrência SQLite com contenção deliberada, alto contraste/zoom nativos e fluxo completo na interface do aplicativo empacotado.

## Escopo e ambiente

- Execução: 17–18/09/2026; pasta preserva a data de início da auditoria.
- Plataforma: Windows NT 10.0.26200.0, Node.js v24.17.0, pnpm 11.8.0.
- Aplicação: GeoGestor 1.0.4, React/Vite, Fastify/Drizzle/libSQL/SQLite, Electron 35.7.5, Recharts 3.8.1 e pdfmake 0.3.11.
- Fuso de negócio: `America/Sao_Paulo`.
- Dados: somente banco temporário criado por teste; nenhuma migração, seed ou escrita foi feita na base real.
- Banco real antes e depois: 1.990.656 bytes, SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`, modificação `2026-08-30 14:12:58`.

## Resultado quantitativo

| Item | Resultado |
| --- | ---: |
| Achados corrigidos | 12 |
| P0 | 0 |
| P1 | 4 |
| P2 | 8 |
| Critérios aprovados diretamente | 30 |
| Critérios aprovados após correção | 38 |
| Critérios bloqueados | 8 |
| Critérios reprovados fora do módulo | 2 |
| Critérios não aplicáveis | 3 |
| Testes web | 202/202 aprovados |
| Testes Electron | 18/18 aprovados |
| Testes E2E da Sessão 11 | 2/2 aprovados |
| Testes API completos | 188/189 aprovados; 1 falha herdada |
| PDFs canônicos | 3 arquivos, 7 páginas inspecionadas |

A distribuição exata dos critérios está em [MATRIZ-DE-COBERTURA.md](MATRIZ-DE-COBERTURA.md). Cada defeito, causa, correção e reteste está em [ACHADOS.md](ACHADOS.md).

## Principais correções

- O gráfico de despesas passou a usar apenas despesas pagas e a mesma data de caixa do KPI financeiro.
- O conceito de “hoje” foi centralizado no fuso de São Paulo, eliminando mudança indevida de vencimentos perto da meia-noite UTC.
- Status de projeto passaram por normalização canônica, incluindo `CONCLUÍDO`, sem inflar ativos, áreas ou prazos.
- Parâmetros de período agora rejeitam campos extras, valores repetidos, datas inválidas e períodos invertidos com resposta 400 segura.
- A tela passou a invalidar os relatórios após mutações bem-sucedidas na API e a abortar consultas substituídas.
- Estados vazios e contagens passaram a refletir pendências, composição real e registros filtrados.
- URL, filtros e mensagens de erro ficaram canônicos e associados aos respectivos campos.
- Tabelas, gráficos, avisos e documentos receberam escopo, critérios, limites visuais e identificadores consistentes.
- Download de PDF agora é aguardado e falhas deixam de ser anunciadas como sucesso.
- Os três PDFs ganharam seções específicas, identidade segura, paginação, cabeçalhos repetidos e proteção contra quebra de linhas longas entre páginas.

## Oráculos e reconciliação

O cenário principal da API reconciliou, em centavos:

- contratado: 27.000;
- recebido: 14.000;
- pendente e vencido: 11.000;
- despesas pagas: 3.000;
- caixa: 11.000;
- impostos: 2.700;
- conversão: 71,4%;
- projetos: 9 no total, 5 ativos, 3 concluídos, 1 cancelado, 1 atrasado e 2 próximos do prazo;
- área ativa: 15,5 ha em 3 projetos com área conhecida.

O cenário volumétrico acrescentou 1.500 despesas pagas distribuídas em 25 categorias e reconciliou 1.274.250 centavos em 12,7 ms, com variação observada de 0,2 MiB de heap no processo de teste. As fórmulas e exclusões estão detalhadas em [CADERNO-DE-ORACULOS.md](CADERNO-DE-ORACULOS.md).

## PDFs e inspeção visual

Os documentos Executivo, Financeiro e Projetos foram baixados pela interface real, validados por cabeçalho PDF, texto extraído, hashes e renderização Poppler. As sete páginas renderizadas foram inspecionadas visualmente. Não foram observados corte, sobreposição, linha órfã, ausência de cabeçalho, quebra de identidade ou execução de conteúdo HTML inserido como texto.

O protocolo completo, incluindo hashes, tamanhos e verificações por página, está em [PROTOCOLO-DE-DOCUMENTOS.md](PROTOCOLO-DE-DOCUMENTOS.md). As capturas e artefatos estão indexados em [EVIDENCIAS.md](EVIDENCIAS.md).

## Regressão e build

- lint: aprovado;
- typecheck: aprovado;
- web: 202/202;
- Electron: 18/18;
- E2E de Relatórios: 2/2 em 34,4 s;
- API: 188/189; a única falha foi reproduzida isoladamente e não atravessa o endpoint de relatórios;
- build desktop/instalador: aprovado;
- smoke da API empacotada: aprovado, mantendo o banco criptografado e sem segredos expostos;
- verificação do manifesto de release: reprovada por artefatos herdados inconsistentes.

Os comandos e resultados estão em [COMANDOS-E-RESULTADOS.md](COMANDOS-E-RESULTADOS.md).

## Recomendação

A **Sessão 12 — Planejamento** pode começar, pois o aceite funcional da Sessão 11 foi atingido e não há P0/P1 conhecido em Relatórios. Antes de publicar uma nova versão, devem ser tratados em trilhas próprias o teste de remoção financeira e a atualização do manifesto de release. Os ensaios bloqueados devem integrar a homologação de release, sem reabrir o escopo funcional já aprovado.
