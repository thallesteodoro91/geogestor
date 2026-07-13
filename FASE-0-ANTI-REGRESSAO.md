# Fase 0 - Blindagem anti-regressao do GeoGestor

Este documento deve ser usado antes de qualquer correcao funcional, refatoracao ou ajuste visual.
O objetivo e impedir que uma melhoria tecnica altere comportamento, visual, icones, dados ou fluxo ja validado.

## Regra geral

- Corrigir somente o problema aprovado.
- Nao misturar correcao funcional com redesign.
- Nao trocar componente visual sem aprovacao explicita.
- Nao alterar backend por conveniencia quando o problema puder ser resolvido com escopo menor.
- Nao executar formatacao geral do projeto.
- Nao alterar nomes, ordem de campos, icones, cores, badges, filtros ou navegacao sem aprovacao.

## Checklist obrigatorio antes de editar

- Problema confirmado:
- Arquivos que podem ser alterados:
- Arquivos que nao podem ser alterados:
- Comportamentos que devem permanecer iguais:
- Dados que nao podem ser modificados automaticamente:
- Como validar antes/depois:
- Risco de regressao:

## Contatos

Nao alterar sem aprovacao:

- Icones por tipo/categoria de contato.
- Mapeamento visual entre tipos como cliente industrial, produtor rural, pessoa fisica, fornecedor ou lead.
- Ordem dos campos no cadastro e na edicao.
- Layout da lista.
- Filtros, busca, badges e cards.
- Comportamento do botao editar.
- Conversao de contato para cliente.
- Valores de tipo, origem, status, empresa ou observacoes quando o usuario nao alterou esses campos.

Validacao minima:

- Abrir lista de contatos.
- Criar contato simples.
- Editar contato existente.
- Confirmar que o icone/categoria nao muda sozinho.
- Confirmar que salvar nao muda origem, status ou empresa sem acao do usuario.

## Clientes

Nao alterar sem aprovacao:

- Icones e badges por categoria.
- Ordem dos campos de cadastro/edicao.
- Layout da lista e da central do cliente.
- Abas, cards e KPIs ja existentes.
- Vinculos com projetos, documentos, historico e orcamentos.

Validacao minima:

- Abrir lista.
- Abrir detalhe/central.
- Editar dados basicos.
- Confirmar que categoria e situacao permanecem iguais quando nao editadas.

## Projetos

Nao alterar sem aprovacao:

- Status, tipos e vinculo com cliente.
- Campos tecnicos de topografia, ambiental, licenciamento e pericia.
- Layout da lista e detalhes.
- Acoes de pasta, arquivos, mapas e relatorios.

Validacao minima:

- Listar projetos.
- Criar projeto vinculado a cliente.
- Editar projeto sem perder tipo, status ou cliente.

## Orcamentos e ART

Nao alterar sem aprovacao:

- Layout do modal.
- Calculo visual exibido para servicos, marcos, impostos, ART e despesas internas.
- Status e forma de pagamento.
- Geracao de PDF e identidade visual do template.
- Campos de ART.

Validacao minima:

- Criar orcamento com item de servico.
- Criar orcamento com ART.
- Criar orcamento com despesa interna.
- Editar e confirmar que itens/despesas permanecem.
- Gerar PDF.

## Financeiro

Nao alterar sem aprovacao:

- KPIs, DRE, faturas, despesas, filtros e agrupamentos.
- Status de pagamento.
- Relacao entre orcamentos, parcelas, despesas, clientes e projetos.

Validacao minima:

- Abrir financeiro.
- Ver orcamentos/faturas/despesas.
- Confirmar totais antes/depois.

## Configuracoes

Nao alterar sem aprovacao:

- Abas existentes.
- Campos gerais.
- Aparencia.
- Backup.
- Google Calendar.
- Template de orcamento.
- Reset do sistema.

Validacao minima:

- Abrir configuracoes.
- Salvar dados gerais.
- Reabrir e confirmar persistencia.
- Confirmar que abas e campos continuam no mesmo lugar.

## Importacao

Nao alterar sem aprovacao:

- Fluxo em etapas.
- Importacao de clientes e contatos quando ja funcionarem.
- Mapeamento manual de colunas.
- Esquemas salvos.

Validacao minima:

- Importar cliente.
- Importar contato.
- Importar projeto apenas se o endpoint estiver implementado.
- Confirmar mensagem final e destino correto.

## Calendario e Google Agenda

Nao alterar sem aprovacao:

- Eventos locais.
- Fluxo de conectar/desconectar Google.
- Sincronizacao manual.
- Campos de data/hora.

Validacao minima:

- Abrir calendario.
- Criar/visualizar evento.
- Confirmar que eventos locais nao sao removidos.

## Teste final por lote

Antes de encerrar qualquer lote de implementacao:

- Nao houve alteracao visual fora do escopo.
- Nao houve troca de icones.
- Nao houve mudanca de ordem de campos.
- Nao houve mudanca em textos de botoes fora do escopo.
- Nao houve alteracao automatica de categoria/tipo/status.
- Console sem erro novo conhecido.
- Fluxo corrigido passou no criterio de aceite.

## Decisoes adotadas para esta implementacao

- O GeoGestor permanece como aplicativo desktop local.
- Nao foi introduzido login de usuario, recuperacao de senha ou permissao por perfil.
- Google permanece restrito a integracao com Agenda; nao e usado como login.
- O comportamento atual de sincronizacao da Agenda foi preservado.
- As telas financeiras separadas foram preservadas.
- A configuracao inicial voltou a ser obrigatoria somente quando nao existe configuracao no banco.
- Em falha temporaria da API, o sistema nao redireciona para configuracao inicial e nao tenta recriar dados.
- Nenhum refinamento visual global foi autorizado ou aplicado.

## Estado das fases

- Fase 0: blindagem anti-regressao aplicada.
- Fase 1: contratos de Configuracoes, Projetos e Orcamentos corrigidos e testados.
- Fase 2: chamadas das paginas migradas para a porta dinamica e token do Electron.
- Fase 3: typecheck, lint, testes de API e build completo aprovados.
- Fase 4: arquitetura desktop local preservada e configuracao inicial reativada para instalacoes novas.
- Fase 5: nenhuma mudanca visual aplicada; refinamentos continuam condicionados a aprovacao tela a tela.
- Fase 6: build e smoke test de producao com banco temporario aprovados; abertura manual do executavel permanece como aceite do usuario.

## Refinamento visual futuro

Refinamento visual so deve ocorrer depois da estabilizacao funcional e com aprovacao tela a tela.

Nao fazer em lote:

- Troca global de icones.
- Troca global de cores.
- Troca global de gradientes.
- Troca global de cards.
- Mudanca de raio, sombra ou espacamento em varias telas ao mesmo tempo.
- Reorganizacao de formularios.
- Reordenacao de campos.

Cada ajuste visual futuro deve ter:

- Tela afetada.
- Antes/depois.
- Elementos que nao podem mudar.
- Criterio de aceite visual.
- Confirmacao do usuario antes de seguir para a proxima tela.
