# Desempenho observado

> **Reteste final:** a barreira de 20 MiB foi exercitada pela UI: 20.971.520 bytes passaram pelo limite de arquivo e foram recusados pelo limite de 20.000 caracteres por célula; 20.971.521 bytes foram recusados antes da leitura. O teste E2E corrigido durou 6,7 s na primeira regressão e não é uma medida isolada das fases. Leitura, parsing, hashing, prévia e processamento, bem como pico de memória e disco sob máximo válido, continuam **não medidos**. Nenhuma aprovação de desempenho foi emitida. Ver [RETESTE-FINAL-2026-09-25.md](RETESTE-FINAL-2026-09-25.md).

> **Atualização de 25/09/2026:** [RETESTE-2026-09-25.md](RETESTE-2026-09-25.md) contém os resultados mais recentes e prevalece sobre contagens ou pendências antigas abaixo. A decisão atual é **NÃO IMPORTAR DADOS REAIS ATÉ CORRIGIR E RETESTAR**.

O reteste E2E final de quatro cenários durou **1,2 minuto** no Playwright, com testes individuais de 17,2 s (XLSX corrompido), 10,6 s (linha 21), 11,5 s (homônimos) e 15,3 s (cache inválido). Esses números incluem navegação e esperas de UI. Leitura, parsing, hashing, prévia e processamento não foram medidos separadamente. Os testes de limite da API verificaram resposta, não desempenho em carga. A aprovação de desempenho máximo segue **não emitida**.

| Medida | Amostra | Tempo |
|---|---|---:|
| Integração de API após correções | 1 teste com lote de 500 contatos e migração assíncrona pequena | 6,03 s no último ensaio |
| E2E CSV real final | 1 arquivo, 1 linha, interface/API/consumidor | 11,1 s para o teste; 12,6 s incluindo executor Playwright |
| E2E CSV + XLSX final | 2 arquivos, 2 linhas, interface/API/consumidor | 11,0 s e 10,9 s; 23,5 s no Playwright |
| E2E final após proteção por conteúdo | 3 arquivos, 3 linhas, dois modos | 11,1 s, 11,0 s e 11,4 s; 35,2 s no Playwright |
| E2E final após associação de cliente com números | 5 arquivos, 5 linhas, dois modos | 11,1 s, 11,1 s, 11,5 s e 12,2 s; 47,5 s no Playwright |
| E2E final com escolha manual de cabeçalho | 7 arquivos, 7 linhas, dois modos | 6 cenários; aproximadamente 1,0 min no Playwright |
| E2E final com escolha manual em CSV e XLSX | 8 arquivos, 8 linhas, dois modos | 7 cenários; aproximadamente 1,0 min no Playwright |
| Build web no E2E final | 6.070 módulos | 2,86 s no ensaio anterior; resultado final também passou |

Esses tempos não isolam parsing, hashing, prévia, fila, worker e filesystem. Mediana, pico de memória, 20 MiB, 20.000 linhas, 300 colunas e XLSX comprimido não foram medidos. Sem SLA oficial, nenhuma conclusão de desempenho máximo foi emitida.
