# Interface do GeoGestor

Esta pasta contém a interface React do GeoGestor Desktop. O produto atual é uma aplicação local: a interface é executada no Electron e se comunica com a API Fastify embarcada. Não existe dependência operacional do antigo ambiente Lovable.

## Execução local

Na raiz do repositório, instale as dependências e inicie o ambiente de desenvolvimento:

```powershell
pnpm install
pnpm dev:web
```

Quando for necessário executar apenas este pacote:

```powershell
pnpm --filter web dev
```

A URL da API é resolvida dinamicamente no aplicativo desktop. No navegador de desenvolvimento, ela pode ser configurada por `VITE_API_URL`; sem configuração, o padrão é `http://127.0.0.1:3001`.

## Verificações

Execute a partir da raiz:

```powershell
pnpm typecheck
pnpm test:web
pnpm --filter web build
```

O build da interface também é incorporado ao empacotamento do Electron. Uma alteração de navegação deve ser validada no navegador e no aplicativo desktop.

## Rotas e links internos

- Os padrões canônicos, parâmetros de deep link e construtores usados pelos alertas ficam em `packages/contracts/src/app-navigation.ts`.
- Links novos devem usar rotas canônicas, não aliases antigos.
- Os aliases em `App.tsx` existem para favoritos e alertas persistidos e devem preservar a query string recebida.
- Toda query que identifica um registro deve ser consumida com segurança pela tela, sem inutilizá-la quando o registro não existir.
- Alterações nos links produzidos pelo backend devem atualizar o teste de contrato em `src/utils/appNavigation.test.ts`.

## Relação com API e Electron

As requisições passam por `src/services/apiClient.ts`, que resolve a porta da API local e aplica a autenticação efêmera do desktop. Recursos que dependem do sistema operacional, como abrir uma pasta, devem reutilizar operações protegidas da API ou a ponte do Electron; caminhos fornecidos diretamente pela interface não devem ser executados sem validação no backend.
