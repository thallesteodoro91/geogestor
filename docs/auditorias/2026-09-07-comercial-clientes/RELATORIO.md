# Sessão 02 — Comercial — Clientes

## Parecer

**Status: APROVADA COM RESSALVAS**

As rotas `/clientes` e `/clientes/:id` ficaram aprovadas para o escopo funcional integrado exercitado. Foram inventariados **45 itens**: **29 aprovados sem defeito**, **11 aprovados após correção**, **0 reprovados pendentes**, **4 bloqueados por limitações de ambiente/matriz não executada** e **1 não aplicável**. Foram encontrados **10 defeitos (4 P1 e 6 P2)** e todos foram corrigidos e retestados.

Não houve mutação do banco padrão do usuário. Toda gravação ocorreu em bancos e diretórios descartáveis sob `scratch`, com prefixo `QA-AUDIT-S02-`. As execuções aprovadas removeram seus próprios ambientes automaticamente; nove diretórios de tentativas interrompidas/testes focados desta sessão foram removidos de forma explícita e a inexistência de cada alvo foi confirmada.

## Escopo e ambiente

- Período da auditoria: 07–08/09/2026.
- Aplicativo: GeoGestor `v1.0.4`.
- Git base observado: `a16551a`, com árvore de trabalho já modificada antes da sessão.
- Sistema: Microsoft Windows NT `10.0.26200.0`.
- Arquitetura: React/Vite, API Fastify local, Electron e SQLite/libSQL.
- Navegador integrado de teste: Microsoft Edge/Playwright, `1120 × 680`, `pt-BR`, movimento reduzido.
- API e web: portas aleatórias por execução, vinculadas somente a `127.0.0.1`.
- Persistência QA: `scratch/commercial-e2e/run-*/geogestor.db` e raiz de arquivos isolada na mesma execução.
- Relatório anterior considerado: `docs/auditorias/2026-09-07-visao-geral/`.

## Cobertura obtida

Foram comprovados na interface, API e/ou banco, conforme aplicável:

- listagem vazia e com 32 clientes, busca, filtros combinados, ordenação, paginação e persistência do estado na URL/reload;
- estado vazio real e estado sem resultados diferenciados;
- abertura, fechamento, cancelamento sem alterações, recusa e confirmação do descarte de rascunho;
- validações obrigatórias, foco no primeiro erro, CPF, máscaras, espaços nas bordas, acentos, caixa da UF e todos os grupos do formulário usados pelo fluxo PF;
- criação, leitura, edição, recarga, persistência e exclusão lógica de cliente sintético;
- abas e resumos de visão geral, propriedades, serviços/projetos, ambiental, orçamentos, jornada/histórico, tarefas, agenda e central de arquivos/mapa;
- vínculo de propriedade, projeto e orçamento criado para o cliente e refletido nos resumos correspondentes;
- upload de PNG pequeno com acentos e extensão maiúscula, pré-visualização autenticada, download, exclusão e confirmação da remoção física;
- renomeação do cliente com movimentação segura da pasta e preservação do arquivo;
- restrição de exclusão quando existem vínculos ativos, exclusão após desativação dos vínculos, remoção do histórico e resposta 404 para acesso/edição repetidos;
- trilha de auditoria para histórico e exclusão;
- ausência de erros de console na jornada principal, ausência de violações Axe WCAG 2.2 A/AA nas telas auditadas e ausência de rolagem horizontal no viewport de evidência.

A matriz detalhada está em [MATRIZ-DE-COBERTURA.md](./MATRIZ-DE-COBERTURA.md).

## Defeitos corrigidos

| ID | Gravidade | Resultado |
|---|---:|---|
| S02-F01 | P1 | Exclusão de cliente passou a bloquear propriedades, projetos, orçamentos, tarefas, compromissos, documentos/mapas e oportunidades ativos. |
| S02-F02 | P1 | Cliente excluído e seu histórico não permanecem acessíveis; exclusão repetida retorna 404 e a operação é transacional/auditada. |
| S02-F03 | P1 | Histórico agora rejeita data impossível e projeto/orçamento de outro cliente, exige cliente ativo e grava auditoria. |
| S02-F04 | P1 | Pré-visualização usa `fetch` autenticado + Blob URL, sem token efêmero na URL e sem depender de exceção de sessão por query string. |
| S02-F05 | P2 | Cache de arquivos é invalidado após renomear/mover a pasta do cliente. |
| S02-F06 | P2 | Modal de pré-visualização recebeu semântica de diálogo, estado anunciado, erro acessível, fechamento por Escape e nomes acessíveis nos botões por ícone. |
| S02-F07 | P2 | Contraste foi corrigido em notas, subtítulo do formulário, estado vazio do mapa e toast de sucesso. |
| S02-F08 | P2 | Estado vazio filtrado deixou de afirmar incorretamente que nenhum cliente está cadastrado. |
| S02-F09 | P2 | Texto de exclusão agora descreve a restrição por vínculos e informa corretamente que arquivos físicos são preservados. |
| S02-F10 | P2 | Navegação, busca e filtros passaram a refluir sem corte; teste impede rolagem horizontal nas evidências. |

Os passos, causas e retestes estão em [ACHADOS.md](./ACHADOS.md).

## Evidências

- [Lista vazia e controles responsivos](./evidencias/01-clientes-vazio.png)
- [Lista com 32 registros e paginação](./evidencias/02-clientes-populado.png)
- [Detalhes, mapa, vínculos e jornada](./evidencias/03-cliente-detalhes.png)
- [Estado após exclusão](./evidencias/04-cliente-excluido.png)
- [Comandos e resultados](./COMANDOS-E-RESULTADOS.md)

## Arquivos alterados e motivo

| Arquivo | Motivo da sessão |
|---|---|
| `apps/api/src/routes/clientes.routes.ts` | Regras de existência, validação de histórico, restrição/cascata transacional e auditoria. |
| `apps/api/src/session02-client-lifecycle.integration.test.ts` | Regressão integrada do ciclo de vida, vínculos, histórico e exclusão. |
| `apps/web/src/pages/Clientes/ListagemClientes.tsx` | Estados vazios, cópia de exclusão, invalidação de arquivos e reflow da barra local. |
| `apps/web/src/pages/Clientes/ClienteDetalhes.tsx` | Pré-visualização autenticada por Blob, semântica/teclado e estados de carregamento/erro. |
| `apps/web/src/pages/Clientes/ClienteDetalhes/ClienteDocumentosTab.tsx` | Nomes acessíveis em ações de arquivo. |
| `apps/web/src/pages/Clientes/ClienteDetalhes/ClienteMapaCard.tsx` | Contraste do estado vazio do mapa. |
| `apps/web/src/pages/Clientes/ClienteDetalhes/ClienteSecondaryTabs.tsx` | Contraste e legibilidade das notas/abas secundárias. |
| `apps/web/src/pages/Clientes/ClienteFormFields.tsx` | Contraste do subtítulo do formulário. |
| `apps/web/src/index.css` | Contraste AA do toast de sucesso. |
| `tests/e2e/setup-initial.spec.ts` | Raiz de arquivos do setup isolada por execução. |
| `tests/e2e/session02-clients.spec.ts` | Jornada E2E da sessão, Axe, rede/API/DB/FS, cancelamentos e evidências. |

`apps/api/src/server.ts` e `apps/web/src/services/apiClient.ts` foram inspecionados durante a correção de autenticação; a solução final não amplia a exceção de sessão por URL e mantém o construtor público de preview sem credencial na query string.

## Riscos residuais e bloqueios

1. Não foi executado leitor de tela real (NVDA/JAWS/Narrator); a verificação ficou limitada à árvore semântica, teclado e Axe.
2. Não foi executada a matriz nativa completa do Electron em tema escuro, 360/768/1024/1440 px e zoom de 200%. O viewport integrado de 1120 px ficou sem overflow após a correção.
3. Não houve injeção controlada de queda/reconexão, operação lenta nem dois escritores concorrentes no mesmo cliente.
4. A jornada integrada de arquivo usou PNG válido. Arquivo vazio, duplicado, nome muito longo e matriz completa de tipos hostis ficaram cobertos apenas parcialmente por validações/regressões gerais, não por uma única jornada visual desta sessão.

Nenhum desses bloqueios deixou um defeito funcional confirmado em aberto, mas eles impedem classificar a sessão como aprovação irrestrita.

## Melhorias não implementadas

| Prioridade | Proposta | Benefício | Esforço | Risco |
|---|---|---|---|---|
| 1 | Definir limites de negócio explícitos para nome, observações e demais textos livres no contrato e nos controles. | Evita payloads excessivos e torna mensagens de limite previsíveis. | Médio | Médio: exige decisão de produto e compatibilidade com dados existentes. |
| 2 | Acrescentar uma matriz E2E parametrizada de formatos/tamanhos de arquivo e visores nativos do Electron. | Reduz risco de regressão em MIME, shell/open e integrações específicas do desktop. | Médio | Baixo. |
| 3 | Adicionar cenário de concorrência otimista para edição de cliente. | Detecta perda silenciosa da última gravação em dois processos. | Alto | Médio: pode exigir versão/ETag e decisão de UX. |

## Recomendação

É seguro iniciar a sessão seguinte, mantendo os quatro bloqueios acima no backlog de regressão transversal. A Sessão 02 não possui P0/P1/P2 pendente comprovado.
