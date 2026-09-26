# Memória independente — Análise CAR

**Data de referência:** 11/09/2026, fuso `America/Sao_Paulo`  
**Natureza:** triagem quantitativa preliminar. Não certifica inscrição, regularidade, localização de Reserva Legal ou conformidade perante órgão ambiental.

## Fórmulas conferidas

Para área total `T`, percentual regional `p`, APP declarada `A`, vegetação nativa fora de APP `V` e remanescente em 22/07/2008 `R`:

1. Referência geral: `G = T × p`.
2. APP computável: `AC = A` somente quando `A > 0` e as três declarações do art. 15 são verdadeiras; caso contrário, `AC = 0`.
3. Vegetação computada: `VC = V + AC`.
4. Candidatura ao art. 67: módulos fiscais `<= 4`, imóvel existente em 22/07/2008 e `R` informado.
5. Referência aplicada: `RA = R` se candidato e `R < G`; nos demais casos `RA = G`.
6. Déficit quantitativo preliminar: `max(0, RA − VC)`.
7. Excedente potencial: `max(0, VC − RA)`.

As contas abaixo foram feitas a partir dessas expressões e valores literais, sem chamar a função de produção.

## Percentuais regionais — imóvel de 100 ha

| Formação informada | Percentual | Conta independente | Referência esperada | UI/função |
|---|---:|---:|---:|---|
| Demais regiões do Brasil | 20% | `100 × 0,20` | 20,00 ha | 20,00 ha — confere |
| Amazônia Legal — floresta | 80% | `100 × 0,80` | 80,00 ha | 80,00 ha — confere |
| Amazônia Legal — cerrado | 35% | `100 × 0,35` | 35,00 ha | 35,00 ha — confere |
| Amazônia Legal — campos gerais | 20% | `100 × 0,20` | 20,00 ha | 20,00 ha — confere |

## Art. 15 — APP no cômputo

Base: `T=100,00 ha`, demais regiões, `G=20,00 ha`, `A=10,00 ha`, `V=15,00 ha`.

| Declarações satisfeitas | APP computável | Vegetação computada | Déficit | Excedente | Resultado |
|---:|---:|---:|---:|---:|---|
| 0/3 | 0,00 ha | 15,00 ha | 5,00 ha | 0,00 ha | confere |
| 1/3 | 0,00 ha | 15,00 ha | 5,00 ha | 0,00 ha | confere |
| 2/3 | 0,00 ha | 15,00 ha | 5,00 ha | 0,00 ha | confere |
| 3/3 | 10,00 ha | 25,00 ha | 0,00 ha | 5,00 ha | confere no E2E |

As três declarações testadas foram: ausência de nova conversão, APP conservada/em recuperação e inscrição no CAR requerida. Elas são autodeclarações de entrada; o software não as comprova.

## Art. 67 — pequena propriedade/posse rural

Base: `T=100,00 ha`, `G=20,00 ha`, `A=0`, `V=8,00 ha`, imóvel declarado existente em 22/07/2008.

| Módulos | Remanescente R | Referência aplicada | Déficit | Interpretação quantitativa |
|---:|---:|---:|---:|---|
| 4,00 | 10,00 ha | 10,00 ha | 2,00 ha | R menor que G; art. 67 aplicado |
| 4,00 | 20,00 ha | 20,00 ha | 12,00 ha | igualdade não reduz G |
| 4,00 | 25,00 ha | 20,00 ha | 12,00 ha | R superior não aumenta/reduz G |
| 4,01 | 10,00 ha | 20,00 ha | 12,00 ha | fora do critério `<= 4 MF` |
| 4,00 | ausente | sem resultado válido | n/a | remanescente obrigatório para candidato |

O campo de módulos fiscais é uma entrada declarada. A calculadora não determina o módulo fiscal municipal nem comprova o enquadramento do imóvel.

## Art. 68

Marcar indício de supressão regular conforme a legislação da época produz apenas **“Análise documental necessária”**. O valor não altera automaticamente `RA`, déficit ou excedente e não gera conclusão de regularidade. Esse comportamento foi confirmado na UI E2E.

## Limites centesimais

Base: `T=100,00 ha`, demais regiões, `G=20,00 ha`, APP não computada.

| Vegetação V | Conta | Resultado esperado | Resultado calculado |
|---:|---|---:|---:|
| 20,00 ha | `20,00 − 20,00` | déficit 0,00; excedente 0,00 | confere |
| 19,99 ha | `20,00 − 19,99` | déficit 0,01 ha | confere |
| 20,01 ha | `20,01 − 20,00` | excedente 0,01 ha | confere |

O cálculo mantém precisão numérica e formata a apresentação com duas casas e `Intl.NumberFormat('pt-BR')`; não arredonda a entrada antes das operações.

## Entradas inválidas verificadas

Foram recusados: total vazio para análise concluída, zero, negativo, texto, notação científica, `NaN`, infinito implícito/valor não finito, APP negativa ou acima do imóvel, vegetação acima do imóvel, soma APP+vegetação acima do total, módulos não positivos, remanescente negativo/acima do imóvel e candidato ao art. 67 sem remanescente.

O parser aceita `100,50` e `100.50`; não aceita separadores de milhar nem notação científica, evitando ambiguidades de localidade.

## Persistência e reabertura

O E2E salvou um cálculo denominado `QA-AUDIT-S06-20260911-CAR localizado`, conferiu uma única linha em `calculos_salvos`, reabriu o histórico e preservou tipo `ambiental`, data civil, entradas e resultado. Um registro sintético com JSON inválido foi apresentado como “Dados legados inválidos”, sem stack trace ou quebra da lista. O banco temporário foi removido pelo runner.

## Escopo que a calculadora não cobre

- geometria, localização ou aprovação espacial da Reserva Legal;
- sobreposições, APPs e áreas de uso restrito não declaradas;
- regularidade de supressão, documentação histórica e decisão do art. 68;
- ZEE, normas estaduais, PRA, compensações e passivos qualitativos;
- validação oficial do CAR ou decisão do órgão competente.
