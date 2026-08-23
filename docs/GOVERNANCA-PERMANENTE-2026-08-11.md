# Governança permanente do GeoGestor — 2026-08-11

> **REGISTRO HISTÓRICO SUPERADO EM 2026-08-13:** este documento preserva o estado observado em 11/08. A fonte técnica canônica atual é o `package.json` da raiz, hoje em `1.0.0` e apresentada comercialmente como GeoGestor 1.0; evidências históricas abaixo não autorizam build ou publicação.

## Resultado

A governança preventiva deixou de depender do diff do Git. O projeto agora compara todo o código de produção com uma baseline permanente de navegação, permite a redução da dívida histórica e bloqueia novas assinaturas ou aumentos mesmo em um repositório limpo.

Nenhuma funcionalidade, regra de negócio, tela, rota ativa, alias, banco, migração, backup ou dado do usuário foi alterado nesta etapa.

## Diagnóstico anterior às alterações

| Classificação | Evidência | Decisão |
| --- | --- | --- |
| problema comprovado | o verificador de links analisava apenas o diff e arquivos novos | substituir pela comparação integral com baseline |
| melhoria preventiva | não existia uma referência estável das 71 ocorrências históricas | registrar arquivo, assinatura normalizada e quantidade |
| melhoria preventiva | o relatório de endpoints misturava usos de produção e testes | classificar por camada, teste, contrato e padrão dinâmico |
| melhoria preventiva | a limpeza E2E não possuía uma prévia reutilizável | acrescentar comando exclusivamente informativo |
| inconclusivo | 26 recursos visuais continuam sem consumidor comprovado | preservar integralmente |
| inconclusivo | repetição de endpoints não comprova duplicação funcional | manter diagnóstico não bloqueante |
| recomendação externa | existe uma área histórica `temp-lovable` com um arquivo de ambiente detectado somente pelo nome | não ler nem alterar; confirmar uso e rotacionar externamente |

Não foi encontrada configuração de integração contínua no projeto. Por isso, a validação foi mantida no fluxo local único já existente, sem criar automação de publicação.

## Baseline de links internos

O arquivo `governance/hardcoded-navigation-baseline.json` registra:

- schema versionado;
- política que proíbe tratar a baseline como autorização para nova dívida;
- revisão com data, total e justificativa explícita;
- 71 ocorrências históricas;
- 51 assinaturas agrupadas por arquivo, conteúdo normalizado e quantidade;
- nenhuma dependência de números de linha.

O verificador percorre todo `apps/web/src`, exclui testes e compara o estado atual com a baseline. O resultado atual é:

| Medida | Resultado |
| --- | ---: |
| total histórico | 71 |
| total atual | 71 |
| ocorrências removidas | 0 |
| novas assinaturas | 0 |
| quantidades aumentadas | 0 |
| validação | aprovada |

Uma remoção futura é aceita e informada como melhoria. Uma assinatura nova ou o aumento de uma assinatura histórica bloqueia a governança. Alterações excepcionais da baseline exigem uma nova revisão com data, total correspondente e justificativa.

## Endpoints repetidos

O diagnóstico foi ampliado sem substituir ou centralizar endpoints:

| Classificação | Padrões |
| --- | ---: |
| repetidos em produção | 84 |
| contratos entre frontend e backend | 45 |
| repetições no frontend, incluindo cobertura de testes | 52 |
| repetições no backend, incluindo cobertura de testes | 6 |
| exclusivos de testes | 11 |
| padrões totais após incluir testes e normalizar dinâmicos | 114 |

Os 20 candidatos com maior sinal são priorizados no diagnóstico estruturado. A classificação reconhece testes, prefixos registrados no backend e terminações dinâmicas. Todos continuam informativos: repetição não é tratada como prova de defeito.

## Pré-visualização E2E

O comando `pnpm e2e:cleanup:preview`:

- não remove arquivos;
- examina somente diretórios `run-*` dentro da raiz permitida;
- recusa links simbólicos e marcadores inválidos;
- lista como candidatos apenas execuções com propriedade comprovada;
- preserva e contabiliza as demais sem expô-las como removíveis.

Na execução desta etapa, foram encontrados 0 candidatos comprovadamente próprios e 186 diretórios históricos sem marcador. Todos foram preservados.

## Ambiente e credenciais

A verificação confirma somente a presença da área histórica `temp-lovable` e conta arquivos de ambiente pelo nome. Nenhum conteúdo, token, senha, chave ou URL foi lido ou exibido.

Recomendação externa:

1. confirmar se a credencial histórica ainda possui uso;
2. revogar ou rotacionar a credencial quando possível;
3. manter valores reais fora do controle de versão;
4. usar apenas modelos sem segredos, como `.env.example`.

Arquivos `.env` reais rastreados passam a ser bloqueados; modelos `.env.example` e `.env.sample` continuam permitidos.

## Arquivos modificados nesta etapa

- `governance/hardcoded-navigation-baseline.json`;
- `scripts/governance-checks.mjs`;
- `scripts/governance-checks.test.mjs`;
- `scripts/e2e-artifacts.mjs`;
- `scripts/e2e-artifacts.test.mjs`;
- `scripts/preview-e2e-cleanup.mjs`;
- `package.json`;
- `docs/CHECKLIST-GOVERNANCA.md`;
- `docs/GOVERNANCA-PREVENTIVA-2026-08-11.md`;
- este relatório.

## Validações

| Verificação | Resultado |
| --- | --- |
| governança estática | aprovada; 0 bloqueios |
| baseline específica | 71 históricas, 71 atuais, 0 novas, 0 aumentadas |
| políticas preventivas | 9/9 |
| tipagem frontend | aprovada |
| tipagem API | aprovada |
| frontend | 90/90 |
| API | 107/107 |
| Electron | 15/15 |
| prévia E2E | 0 removidos; 186 diretórios históricos preservados |
| integridade do diff | aprovada; apenas avisos informativos de LF/CRLF |

O E2E completo não foi repetido porque esta etapa não mudou o fluxo de execução, páginas ou infraestrutura funcional do teste; a nova função de prévia é independente e foi coberta por teste isolado. A última execução completa da etapa anterior permanece aprovada em 45/45.

## Preservações e riscos remanescentes

- versão mantida em `1.0.0`;
- nome GeoGestor preservado;
- `Financeiro`, `Visão geral` e seus menus preservados;
- navegação, aliases e compatibilidade preservados;
- interface e logotipo preservados;
- banco, dados, WAL/SHM, backups e migrações intocados;
- 26 recursos visuais inconclusivos preservados;
- nenhum resíduo histórico removido;
- 71 links históricos permanecem como dívida controlada;
- 84 padrões de endpoint de produção permanecem como diagnóstico, não como erro;
- a rotação de eventual credencial histórica continua sendo uma ação externa.

Não houve publicação, empacotamento, instalador, release, commit, branch, tag, push ou pull request.
