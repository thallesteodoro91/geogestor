# Auditoria de back-end e segurança local — 2026-08-01

## Situação atual

A senha local bloqueia o uso do GeoGestor e protege a sessão, mas não criptografa integralmente o arquivo SQLite. Essa comunicação deve permanecer explícita até que a proteção em repouso seja comprovada em instalação, backup e restauração.

As correções de navegação, carregamento sob demanda e paginação não dependem da adoção de criptografia e, por isso, foram tratadas primeiro.

## Proteção integral recomendada

1. Adotar SQLCipher ou outra implementação madura e mantida de SQLite criptografado, sem algoritmos próprios.
2. Gerar uma chave aleatória por instalação e protegê-la com Windows DPAPI no escopo do usuário atual.
3. Nunca derivar diretamente a chave do banco da senha de bloqueio do aplicativo.
4. Criptografar os backups antes de gravá-los e incluir versão do formato, identificador da chave e verificação de integridade.
5. Implementar rotação transacional: criar nova chave, validar cópia, trocar o ponteiro ativo e manter recuperação controlada da chave anterior.
6. Criar uma migração assistida para instalações existentes: backup verificado, cópia criptografada, teste de abertura e substituição atômica somente após sucesso.
7. Testar perda de credencial do Windows, troca de usuário, restauração em outro computador e recuperação administrativa antes de liberar o recurso.

### Critérios para considerar a criptografia pronta

- O SQLite e seus arquivos WAL/SHM não revelam conteúdo em texto claro.
- O backup não abre sem a chave protegida.
- Migração e restauração falham de forma segura, preservando a cópia anterior.
- A rotação de chave é testada com interrupção simulada em cada etapa.
- A aplicação explica ao usuário as consequências de perder a chave.

## Plano incremental de manutenibilidade

Os arquivos de maior risco não devem ser reescritos em uma única entrega. As fronteiras propostas são:

| Hotspot | Extração segura | Teste exigido antes da extração |
| --- | --- | --- |
| `financeiro.routes.ts` | schemas, handlers de recebimento, despesas e consultas | transações, estorno, idempotência e auditoria |
| `runtime-migrations.service.ts` | uma migração por módulo e executor/ledger comum | repetição, conflito, fast path e recuperação |
| `server.ts` | composição de plugins, segurança local e ciclo de vida | readiness, CORS, token e desligamento |
| `arquivos.routes.ts` | validação de caminhos, operações e outbox | travessia de diretório, colisão e retry |
| `orcamentos.service.ts` | cálculo, transições, persistência e projeções financeiras | centavos, impostos, versões, aprovação e rollback |

### Ordem recomendada

1. Consolidar testes de comportamento e contratos externos.
2. Extrair validações puras, sem alterar consultas ou transações.
3. Extrair consultas somente com comparação de resultados e plano de execução.
4. Extrair domínio transacional mantendo uma única fronteira de commit.
5. Reduzir os arquivos de rotas a validação, autorização e chamada do serviço.

A entrega atual mantém os contratos legados de clientes, acrescenta paginação opt-in e cria um endpoint leve de opções. Refatorações maiores ficam deliberadamente separadas para não misturar risco financeiro e migrações com a correção de performance.
