# Caderno de oráculos

## Regras usadas

- Valores são persistidos e comparados em centavos.
- Contratado: soma dos orçamentos aprovados e não excluídos no período.
- Recebido: recebimentos válidos, não estornados/excluídos, pela data de caixa.
- Pendente: parcelas exigíveis ainda não integralmente recebidas.
- Vencido: parte pendente cuja data de vencimento é anterior a “hoje” em `America/Sao_Paulo`.
- Despesas pagas: despesas com situação paga, não excluídas, pela data de pagamento/caixa.
- Caixa: recebido menos despesas pagas.
- Impostos: base contratada multiplicada pela alíquota aplicável no cenário.
- Conversão: projetos/orçamentos aprovados sobre propostas elegíveis, conforme contrato existente.
- Projeto ativo: todo status que não normalize para concluído ou cancelado.
- Área ativa: somente área positiva e conhecida de projeto ativo; nulo e zero não entram no denominador conhecido.
- Prazo próximo: de hoje até 30 dias, inclusive; +31 dias fica fora.

## Oráculo principal da integração da API

| Medida | Esperado |
| --- | ---: |
| Contratado | 27.000 ¢ |
| Recebido | 14.000 ¢ |
| Pendente | 11.000 ¢ |
| Vencido | 11.000 ¢ |
| Despesas pagas | 3.000 ¢ |
| Caixa | 11.000 ¢ |
| Impostos | 2.700 ¢ |
| Conversão | 71,4% |
| Projetos totais | 9 |
| Projetos ativos | 5 |
| Concluídos | 3 |
| Cancelados | 1 |
| Atrasados | 1 |
| Próximos do prazo | 2 |
| Área ativa | 15,5 ha |
| Projetos ativos com área conhecida | 3 |

O período anterior de comparação produz 7.000 ¢ contratados, 7.000 ¢ recebidos, 0 pendente e 7.000 ¢ de caixa. O fixture inclui orçamento rascunho, cancelado e excluído; parcela paga, parcial, pendente, vencida, legada e sobrepaga; recebimento válido, estornado/excluído; despesa paga, pendente e excluída; projetos com acento/caixa variáveis, status vazio, área nula/zero e prazos nas quatro fronteiras temporais.

## Oráculo E2E da aplicação real

Data de negócio: 18/09/2026, banco temporário exclusivo.

| Medida | Esperado |
| --- | ---: |
| Contratado | 10.000 ¢ |
| Recebido | 4.000 ¢ |
| Pendente/vencido | 6.000 ¢ |
| Despesas pagas | 5.400 ¢ |
| Caixa | -1.400 ¢ |
| Impostos | 1.000 ¢ |
| Conversão | 20% (1/5) |
| Projetos totais | 18 |
| Ativos | 16 |
| Concluídos | 1 |
| Cancelados | 1 |
| Atrasados | 13 |
| Próximos do prazo | 2 |
| Área ativa | 27,5 ha |
| Ativos com área conhecida | 15 |
| Alertas distintos | 5 |

As despesas são 3.000 ¢ do caso financeiro mais 24 despesas de 100 ¢, totalizando 5.400 ¢ e 25 categorias. Os dados incluem texto longo e a cadeia literal `<img src=x onerror=alert(1)>`; ela deve aparecer apenas como texto inerte na UI e no PDF.

## Oráculo volumétrico

Foram criadas 1.500 despesas pagas atuais, distribuídas em 25 categorias, com valores `100 + i` para `i = 0…1499`.

`Σ(100 + i) = 1.500 × 100 + (1.499 × 1.500 / 2) = 1.274.250 ¢`.

Resultado observado: 1.500 registros, 1.274.250 ¢, 12,7 ms de consulta no processo de teste e variação de 0,2 MiB de heap. O número é evidência comparativa deste ambiente, não um SLA de produção.

## Critérios de exclusão confirmados

- Rascunhos, cancelados e excluídos não entram no contratado.
- Recebimentos estornados/excluídos não entram no recebido.
- Despesa pendente ou excluída não entra em despesas pagas nem nas categorias.
- Topografia não altera KPIs financeiros ou de projetos.
- Projeto concluído/cancelado não entra em ativos, área ativa ou agenda ativa.
- Área nula/zero não é inventada nem usada como área conhecida.
- +30 dias entra em “próximo”; +31 dias não entra.
- Pagamentos parciais e sobrepagamentos são limitados à obrigação elegível, sem saldo negativo fictício.

