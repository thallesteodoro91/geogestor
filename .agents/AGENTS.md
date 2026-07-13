# Diretrizes e Regras do Projeto GeoGestor

## 🎨 Diretrizes de Estética e Polimento Visual

1. **Sobriedade Executiva sem Monocromia**:
   - O GeoGestor é um software profissional de engenharia, topografia e gestão fundiária. A interface deve ser sóbria e elegante, mas **nunca monocromática** ou excessivamente cinza.
   - Evite deixar botões de ação invisíveis em repouso (`opacity-0`) em tabelas ou cards principais. As ações principais devem estar sempre acessíveis.

2. **Diferenciação Sutil entre Botões Adjacentes**:
   - Sempre que houver 2 ou mais botões de ação lado a lado (ex: Editar, Baixar, WhatsApp, Excluir), **diferencie-os através de tons de cor suaves e distintos**:
     - **Editar / Salvar**: Tons suaves de azul ou índigo (`bg-indigo-50 text-indigo-600 border-indigo-200/80` ou dark `indigo-950/40`).
     - **Visualizar / Baixar**: Tons limpos de azul celeste (`bg-sky-50 text-sky-600 border-sky-200/80`).
     - **WhatsApp / Sucesso**: Tons discretos de esmeralda (`bg-emerald-50 text-emerald-600 border-emerald-200/80`).
     - **Excluir (Lixeira)**: Tons evidentes e permanentes de vermelho sóbrio (`bg-red-50 text-red-600 border-red-200/80` ou dark `red-950/40`).
   - A diferenciação deve ser discreta e harmoniosa, demarcando a função de cada botão sem transformar a tela em um "carnaval" de cores fortes.

---

## 🖥️ Diretrizes de Compilação e Atualização Desktop (Electron)

1. **Sincronização de Versões p/ Auto-Updater**:
   - Ao gerar uma nova versão do aplicativo Desktop, sincronize explicitamente o número da versão (`vX.Y.Z`) em três locais:
     1. `package.json` (raiz)
     2. `apps/desktop/package.json`
     3. Tela de Configurações (`apps/web/src/pages/Configuracoes.tsx`)
   - O mecanismo de atualização local (`checkForLocalUpdates` no `main.js`) depende de um novo `timestamp` de compilação no instalador `.exe` gerado em `apps/desktop/dist/`. Sempre execute o build completo via `pnpm run build` para garantir o empacotamento assinado e acionamento correto do instalador no Windows.
