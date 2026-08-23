# GeoGestor

Software desktop para organizar a operação de empresas de topografia, georreferenciamento e gestão territorial. O GeoGestor reúne clientes, projetos, propriedades, atividades ambientais, orçamento, financeiro, relatórios e planejamento em um ambiente local e integrado.

## Recursos principais

- Cadastro e acompanhamento de clientes, propriedades e projetos.
- Organização de documentos, prazos, atividades e histórico operacional.
- Orçamentos, despesas, faturas, indicadores financeiros e relatórios.
- Ferramentas de apoio a topografia, georreferenciamento e gestão ambiental.
- Banco de dados local, rotinas de backup e recursos de recuperação.
- Aplicativo desktop para Windows, sem necessidade de servidor externo para o uso cotidiano.

## Instalação no Windows

1. Acesse a página de [Releases](https://github.com/thallesteodoro91/geogestor/releases).
2. Baixe o arquivo `GeoGestor Setup <versão>.exe` da versão desejada.
3. Execute o instalador e siga as etapas exibidas.
4. Abra o **GeoGestor** pelo menu Iniciar ou pelo atalho criado pelo instalador.

O instalador é destinado a computadores Windows de 64 bits. Nesta etapa ele não possui assinatura Authenticode por decisão do proprietário; o Windows pode apresentar aviso de origem desconhecida ou SmartScreen. O GeoGestor não deve ser anunciado como aplicativo de editor verificado.

## Requisitos recomendados

- Windows 10 ou Windows 11, 64 bits.
- 8 GB de memória RAM ou mais.
- Espaço disponível em disco para o aplicativo, documentos e cópias de segurança.

## Dados e backups

Os dados operacionais ficam no computador do usuário. Crie cópias de segurança regularmente e mantenha-as em local confiável e separado do computador principal. Não envie bancos de dados, documentos de clientes, arquivos `.env`, chaves de acesso ou cópias de segurança para este repositório.

## Uso para desenvolvimento

Para reproduzir os gates do projeto, use Node.js 24 e pnpm 11.8.0.

```powershell
pnpm install
pnpm run desktop:dev
```

Verificações obrigatórias antes de promover um candidato:

```powershell
pnpm.cmd --config.verify-deps-before-run=false run governance:check
pnpm.cmd --config.verify-deps-before-run=false run governance:test
pnpm.cmd --config.verify-deps-before-run=false run typecheck
pnpm.cmd --config.verify-deps-before-run=false run lint
pnpm.cmd --config.verify-deps-before-run=false run test:web
pnpm.cmd --config.verify-deps-before-run=false run test:api
pnpm.cmd --config.verify-deps-before-run=false run test:electron
pnpm.cmd --config.verify-deps-before-run=false run test:e2e
```

O fluxo `release:build-candidate` exige checkout limpo e não publica releases automaticamente. Consulte as minutas e procedimentos em `docs/commercial` antes de qualquer oferta comercial; documentos jurídicos permanecem sujeitos a revisão profissional.

## Atualização do software

O fluxo de uma nova versão é:

1. Alterar o código e atualizar o número de versão.
2. Executar as verificações e testes.
3. Gerar o instalador.
4. Criar uma tag e uma Release no GitHub, anexando o instalador e as notas da versão.

O código-fonte publicado fica no ramo [`main`](https://github.com/thallesteodoro91/geogestor/tree/main).

## Suporte e problemas

Para relatar um erro ou sugerir uma melhoria, abra uma [issue](https://github.com/thallesteodoro91/geogestor/issues) com uma descrição do ocorrido, passos para reproduzir o problema, versão do GeoGestor e versão do Windows. Nunca inclua dados de clientes, bancos de dados, senhas ou documentos confidenciais.
