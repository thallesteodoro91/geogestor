# ADR-002 — Orçamentos integrados no monólito modular local

- Status: aceito
- Data: 2026-07-13

## Contexto

O GeoGestor é uma aplicação desktop local composta por React, Fastify e SQLite/libSQL. O módulo anterior de orçamentos mantinha parte relevante das regras no navegador, aceitava estados livres e não separava valor contratado, contas a receber e receita efetivamente recebida.

## Decisão

O domínio de orçamentos permanece no monólito modular local, com estas fronteiras:

- `@geogestor/contracts` contém a máquina de estados, os contratos Zod e o cálculo determinístico compartilhado;
- a API concentra persistência, transações, idempotência, auditoria e efeitos em projetos/financeiro;
- a interface apenas coleta dados, apresenta prévias e executa comandos explícitos;
- SQLite persiste valores monetários em centavos inteiros, percentuais em pontos-base e quantidades decimais como texto normalizado;
- emissão congela snapshots do cliente e do imóvel;
- versões emitidas ou aprovadas são imutáveis; alterações usam revisão formal;
- aprovação é uma única transação que valida o estado, vincula ou cria o projeto, cria parcelas previstas, registra histórico/auditoria e só então confirma o estado aprovado;
- parcela prevista não é receita recebida; caixa realizado nasce apenas na liquidação e é revertido no estorno;
- a evolução do banco usa uma migração SQL versionada e uma migração de runtime idempotente para bancos desktop legados.

## Consequências

O fluxo comercial e financeiro passa a compartilhar uma fonte de verdade e suporta repetição segura da aprovação. O custo é um modelo de dados maior e regras de transição mais rígidas. A autorização continua coerente com o produto atual, que opera como aplicativo desktop local de administrador único; perfis multiusuário exigirão uma decisão arquitetural futura.
