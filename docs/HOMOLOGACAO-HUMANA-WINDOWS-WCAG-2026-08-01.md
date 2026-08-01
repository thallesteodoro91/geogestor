# Homologação humana — Windows e WCAG 2.2 AA

Data de preparação: 01/08/2026
Pacote: GeoGestor Desktop 1.1.2
Instalador: `apps/desktop/dist/GeoGestor Setup 1.1.2.exe`

## Evidência automatizada já concluída

- 28 combinações de rota e tema avaliadas com Axe: zero violações WCAG A/AA.
- Movimento reduzido habilitado na auditoria automatizada.
- Viewports de celular, tablet e desktop aprovados no E2E.
- Navegação por teclado, foco visível, URL e leitura acessível cobertos nas jornadas E2E principais.
- Shell persistente e apenas um `main` durante navegação interna.

## Checklist que exige observação humana

Preencha “resultado observado”, “evidência” e “status” durante a homologação. Não marque como aprovado sem executar a ação no instalador final.

| Ação | Resultado esperado | Resultado observado | Windows/escala | Tema | Evidência | Status |
|---|---|---|---|---|---|---|
| Instalar sobre uma instalação existente com banco legado e abrir o aplicativo | Migração concluída sem perda; dados e vínculos conferidos por amostragem | A preencher | Windows 11 / 100% | Claro | Captura + relatório de qualidade | Pendente |
| Navegar por todas as páginas apenas com Tab, Shift+Tab, Enter, Espaço e Esc | Ordem lógica, foco sempre visível e nenhum bloqueio | A preencher | Windows 11 / 100% | Claro e escuro | Vídeo curto | Pendente |
| Navegar com NVDA pelas rotas principais | Nova página e atualizações assíncronas anunciadas; nomes e landmarks corretos | A preencher | Windows 11 / 100% | Claro e escuro | Registro do NVDA | Pendente |
| Alterar escala do Windows para 125%, 150% e 200% | Sem corte de texto, sobreposição ou rolagem horizontal indevida | A preencher | Windows 11 / 125–200% | Claro e escuro | Capturas por escala | Pendente |
| Usar viewport equivalente a 390 px e zoom de 200% | Conteúdo utilizável e controles acessíveis | A preencher | Windows 11 / 200% | Claro e escuro | Capturas | Pendente |
| Abrir e fechar modais, menus e comboboxes | Foco entra no componente e retorna ao acionador; Esc fecha quando aplicável | A preencher | Windows 11 / 100% | Claro e escuro | Vídeo curto | Pendente |
| Gerar orçamento curto e longo, relatório, laudo e PDF com acentos/valores altos | Arquivos íntegros, paginação correta e nenhum custo interno exposto | A preencher | Windows 11 / 100% | Claro | PDFs gerados | Pendente |
| Clicar duas vezes em “Gerar PDF” e simular falha | Um único processo; estado “Gerando PDF…” e recuperação clara | A preencher | Windows 11 / 100% | Claro | Vídeo + log sem segredo | Pendente |
| Criar, validar e restaurar backup no aplicativo instalado | Dados e documentos restaurados; backup corrompido ou chave errada é recusado | A preencher | Windows 11 / 100% | Claro | Relatório antes/depois | Pendente |
| Encerrar o processo durante migração, restauração e rotação | Reinício recupera o estado anterior íntegro | A preencher | Windows 11 / 100% | Claro | Matriz de interrupções | Pendente |
| Inspecionar cofre de chave e processos com ferramentas do Windows | Chave não aparece em texto claro nem chega ao processo de renderização | A preencher | Windows 11 / 100% | N/A | Relatório técnico | Pendente |

## Procedimento reproduzível

Use uma cópia do banco de produção anonimizada e pelo menos um documento de cada tipo aceito. Registre a versão do instalador, versão do Windows, escala, tema, data, responsável e evidência em cada execução.

1. **Teclado e modais:** abra as rotas principais, percorra cada controle com Tab e Shift+Tab, acione botões com Enter e Espaço e feche modais com Esc. Confirme visualmente a entrada e o retorno do foco ao acionador.
2. **NVDA:** com o leitor ativo, navegue pelo cabeçalho, navegação, filtros, tabelas, feedbacks assíncronos e modais. Registre nomes anunciados, landmarks e qualquer controle sem rótulo.
3. **Escala e zoom:** repita as rotas Dashboard, Clientes, Projetos, Orçamentos, Financeiro, Relatórios e Planejamento com escalas de 125%, 150% e 200%; em seguida use viewport de 390 px com zoom de 200%. Capture qualquer corte, sobreposição ou rolagem horizontal indevida.
4. **PDF:** gere orçamento, relatório e laudo com texto longo, acentos, valores altos e múltiplas páginas. Clique duas vezes em Gerar PDF e simule uma falha; deve haver somente uma operação ativa e uma mensagem clara de recuperação.
5. **Backup e restauração:** crie um backup completo, altere um cliente e um documento, restaure-o e compare os dados e arquivos com o estado anterior. Em seguida tente restaurar um backup inválido para confirmar falha segura.
6. **Migração e interrupção:** execute a atualização sobre uma cópia legada e, em cópias descartáveis, encerre o processo durante migração, restauração e rotação. Na reabertura, valide que a cópia anterior permanece íntegra ou que a recuperação foi concluída com segurança.
7. **Proteção local:** verifique os arquivos de banco, WAL, SHM e backup com ferramentas do Windows; confirme que não exibem conteúdo operacional em texto claro e que a chave não aparece em logs nem no processo de renderização.

## Critério de encerramento

A nota 10/10 depende de todos os itens acima aprovados no instalador final. Falhas devem registrar reprodução, evidência e correção antes de nova homologação.
