# Acessibilidade e homologação Windows

## Automatizado

- Web: 202/202.
- E2E focado: 5/5, incluindo configuração inicial.
- Axe com tags WCAG 2.0/2.1/2.2 A/AA: zero violações nas superfícies exercitadas.
- Teclado: indicador, modal, `Escape`, retorno de foco, controles numéricos e checkbox.
- Alvos: controles da política com pelo menos 44 px.
- Reflow: 1536×960, 1280×720, 1366×768, 800×520 e 640×720 sem overflow horizontal no percurso.
- Temas claro/escuro, `aria-live`, progressbar, labels, hierarquia e foco de deep link.
- Testes estáticos recusam `transition: all` e controles pequenos nos componentes auditados.

## Bloqueado

NVDA, Narrator, alto contraste do Windows, DPI 125/150/200%, zoom 200% com 320 CSS px, diálogos nativos e aviso de encerramento do Electron exigem homologação humana no candidato final. Esses itens não foram inferidos dos testes automatizados.
