# Pendências para homologação

> **Complemento final:** CSV UTF-8 inválido, extensão/conteúdo, ZIP protegido/truncado/expansivo, XML inválido, XSS em prévia, lados do limite de 20 MiB e associação de clientes inativos/excluídos/inexistentes/homônimos foram exercitados pela interface sintética. Ver [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md). Permanecem pendentes a reconciliação completa por linha, volumes máximos válidos na UI, métricas por fase, reinício real em fila/processamento, instalação e restauração física, zoom nativo e leitor de tela. O bloqueio legado permanece.

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

## Pendências atuais após o reteste

1. O usuário confirmou que a migração `skygeo_revisada.xlsx` era apenas teste. Para início de uso, avaliar banco novo e separado, preservando o atual; se for necessário manter o banco atual, criar exceção controlada e testada somente para esse `importId`. Não exigir o arquivo original para comprovar a finalidade de teste nem retropreencher hash sem prova.
2. Reconciliar por linha válidos, inválidos, duplicados, atualizados, rejeitados e parciais de Clientes, Projetos e Contatos; incluir clientes inexistentes, inativos e excluídos pela UI real.
3. Cobrir arquivo real exatamente em 20 MiB e acima no frontend, além de volume máximo completo pela UI; medir leitura, parsing, hashing, prévia, processamento, memória e consumo de disco separadamente.
4. Cobrir ZIP/XML malformado e expansivo, XSS na UI, XLSX protegido e encoding inválido com fixtures pequenas e descartáveis. A API já rejeita metadados com caminho/extensão inválida e chaves reservadas; ainda falta validar conteúdo versus extensão no parser e o percurso completo de segurança.
5. Ensaiar prévia completa alterada, expirada e reutilizada, confirmações concorrentes, falha entre cada entidade, outbox/pastas e reinício com worker em fila ou processamento.
6. Comprovar esquemas após reinício do processo da API; executar teclado completo, anúncios, contraste, zoom de 200%, larguras 360/768/1024/1440 px e apoio de axe. A persistência após recarga com cache ausente/corrompido já passou.
7. Repetir exportação de erros pela UI e confirmar sanitização e histórico por linha em todos os modos. Não materializar totais financeiros históricos sem regra explícita.

Os itens 2, 3, 4, 5 e 6 da lista histórica abaixo contêm partes já executadas; esta lista atual explicita o restante.

1. Definir migração/estratégia para ledgers anteriores à impressão digital de conteúdo. As linhas originais não estão preservadas para retropreenchimento automático; hash adulterado de importação antiga ainda precisa de política própria.
2. Ampliar corpus de ambiguidade de cabeçalho, incluindo títulos, linhas 1/2/6/20, abas e limite de janela. O caso com célula vazia já exige escolha manual e passou nos dois modos.
3. Preservar número real da linha de origem após linhas vazias e CSV multilinha, em ambos os modos.
4. Produzir XLSX sintéticos com abas, tipos nativos, workbook malformado/protegido e descompressão limitada; validar pela interface real.
5. Ampliar a migração completa pela UI para várias linhas e formatos, com oráculo por relação e centavo, outbox e consumidores financeiros. Um caso sintético de linha única foi concluído nesta rodada.
6. Cobrir limites 20 MiB, 25 MiB, 500/501, 20.000/20.001 e 300/301 em frontend e servidor.
7. Exercitar reinício da API com run em fila/processamento, concorrência multiprocesso e falhas injetadas entre entidades.
8. Executar matriz de UX/WCAG em 360/768/1024/1440 px, zoom 200%, alto contraste e leitor de tela quando disponível.
9. Substituir integralmente o ramo privado do teste de integração por fixture sintética de 64 colunas e múltiplas linhas. Nesta rodada ele passou a exigir opt-in e permaneceu desabilitado.

Não se trata de aprovação implícita desses itens. Nenhuma alteração de produto foi feita para interpretar colunas ambíguas ou materializar totais históricos.
