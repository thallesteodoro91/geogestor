# Auditoria de acessibilidade — Configurações

Data: 08/08/2026  
Escopo: oito seções do menu Configurações, largura de 800 × 520 px, temas claro/escuro e operações críticas.

## Critérios WCAG 2.1 AA cobertos

- 1.3.1 e 1.3.2: títulos, regiões, tabelas, rótulos e ordem de leitura semântica.
- 1.4.3 e 1.4.11: contraste de texto, controles, foco e estados de erro.
- 2.1.1 e 2.1.2: navegação completa por teclado e ausência de armadilhas de foco.
- 2.4.1, 2.4.3, 2.4.6 e 2.4.7: atalho para conteúdo, ordem de foco, títulos e foco visível.
- 3.2.1 e 3.2.2: foco e preenchimento não mudam a seção sem confirmação.
- 3.3.1, 3.3.2 e 3.3.3: erros identificados junto ao campo e com orientação de correção.
- 4.1.2 e 4.1.3: nomes e estados acessíveis; progresso, salvamento e erros anunciados.

## Checklist manual

- [ ] Percorrer busca, navegação, formulários, barra de salvamento e modais usando apenas `Tab`, `Shift+Tab`, `Enter`, `Espaço` e `Esc`.
- [ ] Confirmar que o foco permanece visível e retorna ao controle de origem ao fechar cada modal.
- [ ] Confirmar que o modal mantém o foco dentro dele e não permite interação com o conteúdo ao fundo.
- [ ] Verificar leitura com Narrador do Windows: títulos, rótulos, estado selecionado, erros, progresso e resultado de operações.
- [ ] Ampliar para 200% e confirmar ausência de rolagem horizontal na página em 800 × 520 px.
- [ ] Verificar temas claro, escuro e “usar o sistema”, incluindo mudança do tema do Windows com a tela aberta.
- [ ] Ativar “reduzir animações” no Windows e confirmar ausência de movimentos indispensáveis à compreensão.
- [ ] Testar confirmação de alterações não salvas ao trocar de seção e ao fechar o aplicativo.
- [ ] Conferir que “Testar restauração” e “Restaurar de verdade” são distinguíveis por texto, cor e ordem do fluxo.
- [ ] Conferir que nenhuma informação depende apenas de cor: estados têm rótulo textual e/ou ícone.

## Verificação automatizada

- [x] Axe executado nas oito seções com as tags `wcag2a`, `wcag2aa`, `wcag21a` e `wcag21aa`: nenhuma violação crítica ou séria.
- [x] Layout sem overflow global em 800 × 520 px nas oito seções.
- [x] Ativação das oito seções validada com foco e `Enter`.
- [x] Busca interna validada com termo técnico e navegação até o controle correspondente.
- [x] Barra de alterações pendentes validada com ações de salvar e descartar disponíveis.
- Evidência visual: `scratch/settings-audit/configuracoes-800px.png`.

## Resultado

Verificação automatizada aprovada em 08/08/2026. A homologação humana com Narrador, zoom de 200%, alto contraste e teclado permanece registrada no checklist acima por depender de observação direta no Windows.
