# Melhorias não implementadas

| Prioridade | Melhoria | Critério de aceite sugerido |
|---:|---|---|
| 1 | Gerar PDF marcado/estruturado | `/StructTreeRoot` presente; tabelas, títulos e ordem de leitura validados em PAC; `/Lang=pt-BR`; título preenchido. |
| 2 | Homologar com leitor de tela | Roteiro NVDA e/ou JAWS documentado, sem perda de ordem ou contexto nos cinco tipos de documento. |
| 3 | Homologar impressão nativa | Microsoft Print to PDF e impressora física, A4, escala 100%, sem corte em primeira/última página e em tabela longa. |
| 4 | E2E integral de 100 itens | Criar orçamento pelo fluxo suportado e baixar emitido/rascunho pelos botões da interface. |
| 5 | Metadados documentais | Título, assunto e idioma presentes; sem PII além do necessário. |
| 6 | Validação com terceiro parser no CI | Instalar `qpdf --check` e guardar saída junto ao protocolo. |
| 7 | SLA formal de geração | Definir limite para 100 itens e falhar teste noturno quando excedido. |
| 8 | Matriz de drivers | Registrar Windows PDF, impressora laser e jato de tinta em escala 100% e “ajustar”. |
| 9 | Fixture com virada de mês/ano e horário de verão histórico | Confirmar filtros civis em bordas e ausência de deslocamento de data. |
| 10 | Assinatura/identidade opcional | Avaliar assinatura digital e metadados de versão para documentos emitidos, sem expor segredos. |

