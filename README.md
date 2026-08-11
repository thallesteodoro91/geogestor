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

O instalador é destinado a computadores Windows de 64 bits. O Windows pode solicitar uma confirmação de segurança antes da instalação.

## Requisitos recomendados

- Windows 10 ou Windows 11, 64 bits.
- 8 GB de memória RAM ou mais.
- Espaço disponível em disco para o aplicativo, documentos e cópias de segurança.

## Dados e backups

Os dados operacionais ficam no computador do usuário. Crie cópias de segurança regularmente e mantenha-as em local confiável e separado do computador principal. Não envie bancos de dados, documentos de clientes, arquivos `.env`, chaves de acesso ou cópias de segurança para este repositório.

## Uso para desenvolvimento

Para executar o projeto a partir do código-fonte, instale o Node.js 20 ou superior e o pnpm 11.

```powershell
pnpm install
pnpm run desktop:dev
```

Verificações recomendadas antes de publicar alterações:

```powershell
pnpm run typecheck
pnpm run test:electron
pnpm run release:build-candidate
```

## Atualização do software

O fluxo de uma nova versão é:

1. Alterar o código e atualizar o número de versão.
2. Executar as verificações e testes.
3. Gerar o instalador.
4. Criar uma tag e uma Release no GitHub, anexando o instalador e as notas da versão.

O código-fonte publicado fica no ramo [`main`](https://github.com/thallesteodoro91/geogestor/tree/main).

## Suporte e problemas

Para relatar um erro ou sugerir uma melhoria, abra uma [issue](https://github.com/thallesteodoro91/geogestor/issues) com uma descrição do ocorrido, passos para reproduzir o problema, versão do GeoGestor e versão do Windows. Nunca inclua dados de clientes, bancos de dados, senhas ou documentos confidenciais.

