# Retenção, capacidade, RPO e RTO

## Retenção

O teste final gerou 25 versões com datas controladas e exercitou mínimo, recente, diário e mensal. A versão mais recente de cada tipo é preservada. `.db` legado fica fora da limpeza. Diretórios incompletos ou corrompidos permanecem para inspeção.

A19-03 removeu a confiança em `manifest.totals.bytes` para a decisão do teto. O cálculo usa o tamanho real dos arquivos presentes no diretório do bundle. Se os mínimos protegidos excederem o teto, os mais recentes de cada tipo continuam preservados.

## Tempos medidos na fixture final

| Operação | Tempo |
|---|---:|
| criação completa | 2.754,08 ms |
| teste isolado | 4.355,20 ms |
| restauração A | 2.552,94 ms |
| restauração B com outra chave/código | 10.414,94 ms |
| janela até a mutação não protegida | 9.340 ms |

RPO observado significa somente que o bundle voltou ao instante protegido e excluiu a mutação posterior. RTO não inclui interação humana, reinício do Electron, boot do Windows, cópia de mídia ou hardware diferente.

## Bloqueios

Sem disco removível/rede/volume limitado não se mediram desconexão, pressão real de espaço nem bytes fisicamente alocados em sistemas comprimidos. Sem candidato instalado não existe RTO de produto.
