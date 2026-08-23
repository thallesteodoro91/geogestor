# Auditoria de rotas, contratos e resíduos — 2026-08-11

## Resumo executivo

A revisão foi executada em lotes pequenos, preservando a alteração local preexistente em `financeConsolidation.test.ts`. Nenhum banco, backup, documento, migração oficial, pasta ignorada ou arquivo de dados foi alterado.

O inventário atual contém 39 caminhos declarados na interface: 29 telas canônicas, 9 aliases de compatibilidade e 1 fallback. O backend contém 230 declarações de rota Fastify, 161 arquivos de produção no frontend e 84 no backend. Foram encontradas 116 referências de navegação na interface, incluindo links, chamadas de navegação e destinos internos.

## Correções realizadas

### Abertura de pastas de projetos

As telas de listagem e detalhes deixaram de chamar o endpoint inexistente `/api/projetos/:id/abrir-pasta`. A listagem resolve o caminho por `/api/arquivos/projeto/:id` e ambas reutilizam `/api/arquivos/open-folder`.

O fluxo preserva as proteções existentes do backend:

- validação do identificador antes da chamada;
- resolução do caminho pelo backend;
- criação/resolução da pasta gerenciada do projeto;
- contenção do caminho na raiz de dados;
- verificação de existência;
- abertura compatível com o desktop.

### Alertas e deep links

Os construtores canônicos agora ficam em `packages/contracts/src/app-navigation.ts`. Os destinos produzidos são:

| Origem | Destino canônico |
| --- | --- |
| Projeto | `/projetos/:id` |
| Cliente | `/clientes/:id` |
| Tarefa | `/tarefas?tarefaId=:id` |
| Conta a receber | `/financeiro?tab=faturas&parcela=:id` |
| Conta a pagar | `/financeiro?tab=pagar&despesa=:id` |
| Orçamento | `/orcamentos/:id/editar` |
| Licença | `/ambiental/licencas/:id` |
| Condicionante | `/ambiental/licencas/:licencaId?tab=conditions&condicionante=:id` |
| Compromisso | `/calendario/compromisso/:id` |
| Oportunidade | `/crm?oportunidade=:id` |

Financeiro, licenciamento e CRM consomem os identificadores, abrem o registro e removem o parâmetro transitório sem apagar outros filtros. Registros inexistentes geram orientação não intrusiva e a tela continua utilizável.

### API de orçamentos

Os três consumidores de produção e o smoke test do pacote foram migrados de `/api/financeiro/orcamentos` para `/api/orcamentos`:

- detalhes do cliente;
- visão financeira;
- listagem/estatísticas de projetos;
- verificação da API empacotada.

A chave de cache foi preservada onde já era compartilhada. Valores continuam em centavos e os campos do resumo canônico são adaptados explicitamente para os modelos analíticos atuais.

## Aliases mantidos

Todos os aliases foram mantidos por pelo menos esta versão. O redirecionamento agora preserva a query string recebida, com precedência para o destino canônico.

| Alias | Destino | Motivo |
| --- | --- | --- |
| `/contatos` | `/crm?view=leads` | compatibilidade com o módulo comercial antigo |
| `/dashboard-financeiro` | `/financeiro` | favoritos e atalhos antigos |
| `/gestao-financeira` | `/financeiro?tab=auxiliares` | compatibilidade financeira |
| `/despesas` | `/financeiro?tab=pagar` | alertas persistidos e favoritos |
| `/operacional` | `/projetos?visualizacao=estatisticas` | navegação operacional antiga |
| `/calculadora-ambiental` | `/ambiental?tab=car` | atalho antigo |
| `/licenciamento` | `/ambiental?tab=licenciamento` | atalho antigo |
| `/faturas` | `/financeiro?tab=faturas` | alertas persistidos e favoritos |
| `/relatorio-executivo` | `/relatorios?tipo=executivo` | documentos e favoritos antigos |

## Resíduos removidos

### Frontend

Foram removidos após confirmação de ausência no grafo de imports, build, testes válidos e Electron:

- `src/components/ResponsiveTable.tsx`;
- `src/core/finance.ts`;
- barrel sem consumidor `src/components/form-controls/index.ts`;
- `src/App.css` sem importação;
- `scratch-check.cjs` e `scratch-check.js`;
- `hero.png`, `react.svg` e `vite.svg`;
- `financeForm.ts` e seu teste, que exercitavam somente um módulo desconectado dos formulários reais.

Os formulários reais continuam cobertos por seus fluxos atuais, pelos testes de consolidação financeira e pelos testes das regras analíticas usadas em produção.

### Backend e raiz

Foram removidos scripts sem consumidor e com alto risco de execução acidental:

- `apps/api/fix_any.mjs`, `refactor.mjs`, `revert_unknown.mjs` e `fix-db.js`;
- `apps/api/src/scratch-db.ts` e `scratch-db-compromissos.ts`;
- `fix-db.js` e `fix-fetch.js` na raiz;
- `migrate-fields.ts`, `migrate-interacoes.ts` e `migrate-oportunidades.ts`.

As três migrações manuais apontavam diretamente para um banco fixo. Suas tabelas e colunas já são cobertas pelas migrações oficiais em `packages/database/drizzle`, pelas migrações de runtime e pelos testes de atualização de instalações antigas e do CRM.

## Itens mantidos por segurança ou compatibilidade

### Recursos visuais

Após retirar os três recursos padrão, restaram 26 ícones rastreados sem referência textual. Eles não foram removidos porque pertencem ao conjunto visual recentemente modificado e nomes de arquivos, isoladamente, não provam ausência de uso futuro ou dinâmico.

### Endpoints antigos ou técnicos

Nenhum endpoint foi removido neste lote.

- `/api/financeiro/orcamentos` foi mantido porque três testes ainda exercitam paginação e o contrato legado de itens/despesas. Não há mais consumidor de produção conhecido.
- `/api/financeiro/dre`, `/resumo-mensal` e `/resumo-gerencial` foram mantidos porque testes de regras financeiras ainda os usam como contratos observáveis.
- `/api/arquivos/upload` e `/restore` foram mantidos como operações técnicas; a interface usa o upload por streaming.
- `/api/alertas/configuracoes/restaurar` foi mantido como recuperação de configuração.
- `/api/sistema/backups/recuperacao` e seus subcaminhos foram mantidos porque fazem parte da recuperação e da geração de kit/código.
- `DELETE /api/sistema/reset` foi mantido como alias protegido e coberto por testes de bloqueio; a interface usa `/api/sistema/reset-dados`.
- Downloads, previews, `/api/ready`, `/api/health` e `/api/google/callback` permanecem ativos.

### Contratos depreciados

Os campos depreciados de relatórios foram adiados. `financeiro` ainda é consumido pela interface e por testes. Os demais continuam preenchidos pelo backend e podem proteger PDFs, exportações ou integrações internas antigas. Nenhum campo legado de banco foi removido.

### Scripts manuais de inicialização

`start-dev.cmd`, `start-web-localhost.cmd`, `serve-web-dist.mjs` e `launch-web-dist.mjs` foram mantidos. A ausência em `package.json` não comprova que deixaram de ser usados manualmente.

## Pastas ignoradas — nenhuma excluída

| Pasta | Arquivos | Tamanho aproximado | Modificação mais recente | Avaliação |
| --- | ---: | ---: | --- | --- |
| `scratch` | 122.307 | 15,17 GiB | 2026-08-11 16:26 | fora do build; contém bancos e evidências de testes; revisar antes de excluir |
| `temp-lovable` | 46.708 | 637,6 MiB | 2026-06-21 16:13 | fora do build; contém `.env`, cópia antiga, dependências e possível credencial histórica |
| `work` | 0 | 0 | — | vazio no momento da auditoria |
| `data` | 163 | 78,9 MiB | 2026-08-09 22:48 | dados e backups do GeoGestor; não excluir |

Recomendação: arquivar ou excluir `scratch` e `temp-lovable` somente após autorização explícita e inspeção das bases, evidências e possíveis segredos. `data` deve permanecer preservada.

## Política preventiva adotada

- padrões de rota, parâmetros e construtores de deep link compartilhados;
- teste de contrato entre construtores e padrões do React Router;
- teste dos links efetivamente emitidos pelo serviço de alertas;
- teste da preservação de query strings nos aliases;
- README do frontend substituído por documentação real do produto desktop;
- comentários residuais do antigo ambiente Lovable reescritos sem alterar o visual.

## Riscos restantes

1. A API de orçamentos legada ainda precisa de uma decisão de versão para retirar o contrato de itens/despesas e seus testes.
2. Os 26 ícones sem referência devem ser revistos junto da próxima consolidação visual.
3. Os contratos depreciados de relatório precisam de uma janela formal de compatibilidade.
4. `scratch` e `temp-lovable` ocupam espaço significativo e exigem decisão humana antes de qualquer exclusão.

## Validação final

Resultados aprovados após a limpeza:

- `pnpm typecheck`;
- 86/86 testes do frontend;
- 107/107 testes da API;
- 15/15 testes do Electron;
- teste de integração dos links efetivamente emitidos pelos alertas;
- build de produção do frontend;
- build integrado de contratos, banco, API, frontend e instalador Windows;
- verificação de whitespace do Git (`git diff --check`).

O E2E comercial completo foi executado com banco e serviços temporários. Resultado: 11 cenários aprovados, 6 falharam e 25 não foram executados porque as suítes seriais interromperam os grupos após a primeira falha. A comparação com o diff confirmou que as telas responsáveis não foram modificadas nesta limpeza. As pendências encontradas foram:

1. duas expectativas ainda procuram o título antigo `Gestão financeira 360`, enquanto a tela atual usa `Financeiro`;
2. o teste de configuração inicial compartilha a mesma base temporária com outras suítes e pode encontrar o sistema já configurado;
3. o teste da Central de Ajuda consulta um seletor genérico antes de aguardar a conclusão da navegação;
4. o teste de relatórios espera `aria-pressed` em um seletor de período que atualmente funciona como popover;
5. a seção de backups contém uma região horizontal rolável que o Axe considera inacessível por teclado no Safari.

Esses pontos foram registrados, mas não corrigidos neste lote porque são anteriores e independentes da auditoria de rotas, links e resíduos. Alterá-los junto desta limpeza ampliaria o escopo e dificultaria distinguir regressão de manutenção acumulada.
