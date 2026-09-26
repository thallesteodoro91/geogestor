# Matriz de cobertura — revalidação da Sessão 02

Data: 23/09/2026. **APROVADO** exige evidência desta rodada na interface e, quando há gravação, na API/SQLite/FS. **BLOQUEADO** indica comprovação parcial, sem defeito necessariamente reproduzido. O [inventário original](../2026-09-07-comercial-clientes/MATRIZ-DE-COBERTURA.md) serviu de linha de base; seus resultados não foram contados como novos testes. E2E = `session02-clients.spec.ts` (2/2); ciclo = `session02-client-lifecycle.integration.test.ts` (1/1); API adicional = `clientes.integration.test.ts` e `clientes-list.integration.test.ts` (2/2).

| ID | Página / controle | Resultado esperado e camadas | Cenários e evidência desta rodada | Situação |
|---|---|---|---|---|
| C02-01 | `/clientes`, menu e URL | Abrir lista via navegação e rota; `GET /api/clientes` | E2E pelo menu e recarga | APROVADO |
| C02-02 | Busca e filtros responsivos | Controles utilizáveis sem overflow; frontend | E2E lista em 360/768/1024/1440 px | APROVADO |
| C02-03 | Lista vazia real | Mensagem para `clientes=0`; API/SQLite | E2E + [captura 01](evidencias/01-clientes-vazio.png) | APROVADO |
| C02-04 | Busca sem resultado | Mensagem distinta de cadastro vazio; `GET /api/clientes?q=` | E2E com termo inexistente | APROVADO |
| C02-05 | Cabeçalho e contador | Total e controles coerentes com API | E2E com 0/32; [capturas 01/02](evidencias/) | APROVADO |
| C02-06 | Modal de cadastro | Abrir e cancelar sem gravar; frontend/SQLite | E2E com modal limpo | APROVADO |
| C02-07 | Rascunho alterado | Recusar/aceitar descarte; nenhuma gravação | E2E com os dois caminhos | APROVADO |
| C02-08 | Campos obrigatórios | Mensagens e foco no primeiro erro; frontend | E2E com formulário vazio | APROVADO |
| C02-09 | CPF/telefone/CEP/UF | Máscaras e normalização; `POST /api/clientes` | E2E válido e obrigatório inválido; integração API | APROVADO |
| C02-10 | Grupos do formulário PF | Cadastro, contato, endereço, origem, perfis e notas persistidos; `clientes` | E2E preenchimento; consulta SQLite no teste | APROVADO |
| C02-11 | Salvar cliente | `POST /api/clientes` cria registro e reflete na lista | E2E; API adicional | APROVADO |
| C02-12 | Persistência | Cliente permanece após recarga; SQLite | E2E recarga e leitura direta do banco isolado | APROVADO |
| C02-13 | Edição | `PATCH /api/clientes/:id` atualiza nome/status e recarga | E2E + API adicional | APROVADO |
| C02-14 | Renomear pasta | Caminho do anexo acompanha cliente sem perder arquivo; FS/API | E2E antes/depois do rename | APROVADO |
| C02-15 | Busca por nome | Nome encontrado e ausente; query API | E2E + API adicional | APROVADO |
| C02-16 | Filtros combinados | Status/origem/categoria coerentes com resultado | E2E status+origem; integração API status+origem+categoria | APROVADO |
| C02-17 | Ordenação | Opção Z–A e resposta ordenada; API | E2E seleção; integração API | APROVADO |
| C02-18 | Paginação | Próxima/anterior e totais corretos; API/SQLite | E2E 32 registros; integração com mais de 500 | APROVADO |
| C02-19 | Estado na URL | Filtros/página sobrevivem à recarga | E2E `q`, `status`, `pagina` | APROVADO |
| C02-20 | Menu contextual | Editar/excluir acessíveis e executados | E2E clique e ações; teclado específico em C02-40 | APROVADO |
| C02-21 | `/clientes/:id` | Deep link, título, retorno semântico e 404 para excluído; `GET`/dashboard | E2E + ciclo API; teste de link falhou antes e passou após S02R-F01; [capturas 03/04](evidencias/) | APROVADO |
| C02-22 | Abas do detalhe | Rota da aba e conteúdo vinculado | E2E percorre Propriedades, Serviços, Ambiental, Orçamentos, Financeiro e Arquivos | APROVADO |
| C02-23 | Notas/formulário/feedback | Texto legível e sem violações Axe nas telas amostradas | E2E Axe + [captura 03](evidencias/03-cliente-detalhes.png) | APROVADO |
| C02-24 | Anotações fixas | Acentos e quebra persistem em `clientes.anotacoes` | E2E, SQLite e detalhe | APROVADO |
| C02-25 | Histórico CRM | Criar interação, rejeitar data impossível e vínculo alheio, auditar | E2E + ciclo API 400/201 + `audit_logs` | APROVADO |
| C02-26 | Propriedade vinculada | Resumo exibe propriedade do cliente; `propriedades.cliente_id` | E2E com propriedade sintética | APROVADO |
| C02-27 | Projeto vinculado | Resumo exibe projeto do cliente; `projetos.cliente_id` | E2E com projeto sintético | APROVADO |
| C02-28 | Orçamento vinculado | Aba exibe orçamento do cliente; `orcamentos.cliente_id` | E2E com orçamento sintético | APROVADO |
| C02-29 | Tarefas/agenda relacionadas | Resumos corretos com zero e com vínculos ativos | E2E cobre vazio; sem caso preenchido em ambas | BLOQUEADO |
| C02-30 | Mapa | Estado vazio e geometria válida/inválida, zoom/camadas | E2E captura estado vazio; não exercitou controles e geometrias | BLOQUEADO |
| C02-31 | Upload | PNG com acentos e extensão maiúscula no disco e API | E2E `POST /api/arquivos`, listagem e caminho | APROVADO |
| C02-32 | Preview | Blob autenticado e modal fecha por Escape; `GET /api/arquivos/preview` | E2E HTTP 200, diálogo/Escape | APROVADO |
| C02-33 | Download | Conteúdo corresponde ao anexo; `GET /api/arquivos/download` | E2E HTTP 200 e tamanho igual | APROVADO |
| C02-34 | Excluir arquivo | Confirmação remove item da UI e arquivo físico; `DELETE /api/arquivos` | E2E HTTP 200, lista sem item, `stat=false` | APROVADO |
| C02-35 | Exclusão com vínculos | `DELETE /api/clientes/:id` rejeita cada dependência ativa | E2E 409 com propriedade/projeto/orçamento simultâneos; ciclo 409 com propriedade; tipos restantes não isolados | BLOQUEADO |
| C02-36 | Exclusão controlada | 204, soft delete, histórico oculto e 404 posterior | E2E + ciclo API, SQLite e [captura 04](evidencias/04-cliente-excluido.png) | APROVADO |
| C02-37 | Confirmação de exclusão | Cancelar mantém cliente; confirmar aplica regra | E2E cancelamento, 409 e confirmação posterior | APROVADO |
| C02-38 | Isolamento QA | DB/FS próprios e limpeza dos runs | `GEOGESTOR_E2E_ROOT`; dois runs removidos; testes de API removidos | APROVADO |
| C02-39 | Segurança de arquivos | Autenticação, confinamento, path traversal, ID alheio | Preview/download autenticados; ataques seguros não exercitados nesta rodada | BLOQUEADO |
| C02-40 | Acessibilidade completa | Teclado, foco, Escape, diálogo, Axe e anúncios | Axe sem violações e Escape testados; sequência integral de teclado/leitor não exercitada | BLOQUEADO |
| C02-41 | Leitor de tela nativo | Narrator/NVDA/JAWS com fluxo completo | Ferramenta assistiva nativa não executada | BLOQUEADO |
| C02-42 | Matriz visual nativa | Claro/escuro, 360–1440 px e zoom de 200% no Electron | E2E sem overflow nas larguras e lista em escuro; zoom/Electron nativo ausentes | BLOQUEADO |
| C02-43 | Resiliência | Offline, lentidão, reconexão, duas edições concorrentes | Sem injeção controlada desses estados | BLOQUEADO |
| C02-44 | Arquivos hostis | Vazio, duplicado, longo, MIME inválido, tamanho limite | PNG válido apenas nesta jornada; matriz hostil não executada | BLOQUEADO |
| C02-45 | CRUD integral externo | CRM/Projetos/Orçamentos/Propriedades além do vínculo iniciado no cliente | Fora do escopo autorizado para Sessão 02 | NÃO APLICÁVEL |

**Total: 45 itens — 35 APROVADOS (34 diretos e 1 após correção), 9 BLOQUEADOS, 1 NÃO APLICÁVEL, 0 REPROVADOS pendentes.** Os dez defeitos corrigidos na auditoria de 07–08/09 não são achados novos desta revalidação.
