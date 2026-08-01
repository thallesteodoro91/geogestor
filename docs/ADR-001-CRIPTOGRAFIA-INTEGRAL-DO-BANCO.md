# ADR 001 — Criptografia integral do banco local

- Status: aceito e implementado
- Data: 2026-08-01
- Escopo: GeoGestor Desktop para Windows

## Contexto

O GeoGestor usa Electron, Fastify, Drizzle e o driver nativo libSQL para um banco SQLite local. A senha da interface bloqueia a sessão, mas não deve ser usada como chave do banco. A solução precisa proteger o arquivo principal, WAL, SHM, cópias temporárias e backups, além de migrar instalações existentes sem perda.

## Decisão

Manter o driver libSQL já adotado e habilitar sua criptografia nativa de páginas por conexão. A chave do banco possui 256 bits aleatórios, é independente da senha de bloqueio e nunca chega ao processo de renderização.

No Windows, o processo principal do Electron guarda uma envolvente versionada em `database-key.v1.json`. O arquivo contém somente versão, identificador não reversível da chave, escopo e o texto cifrado produzido por `safeStorage`. Em uma instalação Windows normal, `safeStorage` usa a proteção do sistema operacional vinculada ao usuário atual.

Todas as conexões de produção recebem a chave exclusivamente pelo ambiente do processo filho. Chaves não são incluídas em argumentos de linha de comando, banco, logs, telemetria ou respostas HTTP.

Referências técnicas primárias:

- libSQL, criptografia em repouso: https://docs.turso.tech/features/data-at-rest-encryption
- Electron `safeStorage`: https://www.electronjs.org/docs/latest/api/safe-storage
- SQLCipher, alternativa avaliada: https://github.com/sqlcipher/sqlcipher

## Migração

1. Detectar arquivo vazio, banco legado com cabeçalho SQLite ou banco já protegido.
2. Executar checkpoint do WAL antes de copiar.
3. Criar uma cópia lógica criptografada em arquivo pendente por processo auxiliar isolado.
4. Validar `quick_check`, chaves estrangeiras, versão, identificador da aplicação, tabelas e contagens.
5. Mover o legado para uma cópia de recuperação e instalar a cópia validada por renomeação atômica.
6. Reabrir o banco instalado com a chave correta.
7. Em qualquer falha, remover somente o pendente inválido e restaurar o arquivo anterior.

O processo auxiliar é necessário no Windows porque o binding nativo pode reter identificadores de arquivo até o encerramento do processo. A chave é transmitida pelo ambiente isolado e removida do ambiente lógico assim que lida.

## Backups e restauração

O formato de backup v2 contém:

- banco já criptografado com a chave da instalação;
- documentos cifrados individualmente com AES-256-GCM;
- chave de backup derivada da chave do banco por HKDF-SHA-256 e sal aleatório;
- caminhos lógicos autenticados e nomes físicos opacos;
- hashes, tamanhos, versão e identificador da chave.

A validação completa ocorre antes de alterar os dados atuais. Chave incorreta, autenticação GCM inválida, hash divergente, tamanho divergente, caminho inseguro ou banco inconsistente interrompem a restauração. A troca usa arquivo pendente, cópia de recuperação e rollback.

Backups v1 continuam legíveis para compatibilidade, mas produção com chave configurada sempre cria v2.

## Rotação

A rotação cria uma cópia protegida pela nova chave, valida a cópia, mantém o banco anterior como recuperação e só então efetua a troca. Uma falha em qualquer etapa restaura o arquivo anterior. A operação deve ocorrer com a API parada; o utilitário e os cenários de interrupção estão cobertos por testes de integração.

## Alternativas descartadas

- Derivar a chave da senha de bloqueio: mistura autenticação da interface com proteção de dados, dificulta rotação e cria risco de chaves fracas.
- Criptografia própria de campos: não protege schema, índices, WAL, SHM nem temporários e aumenta o risco de implementação incorreta.
- SQLCipher nesta entrega: é uma alternativa madura, porém exigiria substituir e recompilar a pilha nativa existente, adaptar o Drizzle e ampliar o risco do instalador Windows. O libSQL já presente oferece criptografia de páginas e mantém a mesma interface de banco.
- `VACUUM INTO` para backup: testes comprovaram que a cópia resultante pode ser SQLite em texto claro; seu uso foi removido dos fluxos protegidos.

## Consequências e recuperação

Sem a chave protegida pelo Windows, o banco e os backups v2 não podem ser recuperados. Para restaurar em outro computador, é necessário um procedimento explícito de exportação protegida da chave ainda não exposto na interface. Copiar apenas o arquivo `.db` ou o backup não é suficiente.

Até a homologação do instalador final confirmar migração, restauração e rotação em Windows real, a interface não deve prometer proteção criptográfica além do que foi efetivamente validado.
