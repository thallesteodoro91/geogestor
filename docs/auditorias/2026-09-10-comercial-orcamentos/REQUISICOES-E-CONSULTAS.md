# Requisições, respostas e consultas sanitizadas

Todos os exemplos abaixo foram executados contra SQLite e perfil descartáveis. IDs foram substituídos por marcadores.

## Endpoints de Orçamentos

| Método e endpoint | Cenários comprovados | Resultado/efeito |
|---|---|---|
| `GET /api/orcamentos` | legado, busca e status | 200; coleção compatível e rascunho localizado. |
| `GET /api/orcamentos?mode=page` | vazio, filtros, erro 500 controlado | 200 paginado; 500 foi distinguido de vazio e recuperado. |
| `GET /api/orcamentos/kpis` | aprovado, recebimento parcial, revisão | 200; aprovado/recebido/a receber reconciliados. |
| `GET /api/orcamentos/options` | modelos, perfis, parâmetros e projetos | 200; todos os catálogos presentes após a correção. |
| `GET /api/orcamentos/filter-options` | projeto existente e filtros | 200; projeto ativo retornado com `clientId`. |
| `POST /api/orcamentos` | completo, campo extra, data impossível, 61 parcelas | 201 no válido; 400 nos inválidos, sem efeito parcial. |
| `GET /api/orcamentos/:id` | rascunho, aprovado, revisão, ausente | 200 ou 404 uniforme; histórico e versões presentes. |
| `PATCH /api/orcamentos/:id` | edição de rascunho | 200; trim, prazo e total preservados. |
| `POST /api/orcamentos/:id/emit` | rascunho válido | 200; código sequencial, snapshot e status Emitido. |
| `POST /api/orcamentos/:id/transitions` | Enviado, Em negociação, Rejeitado e Cancelado | 200 nas transições válidas; motivo persistido quando exigido. |
| `POST /api/orcamentos/:id/approve` | projeto novo, existente, repetição e conflito | 200; operação atômica, idempotente e com rollback comprovado. |
| `POST /api/orcamentos/:id/viewed` | primeira visualização | 200; timestamp persistido e ação removida da UI. |
| `POST /api/orcamentos/:id/duplicate` | rascunho | 201; novo ID em Rascunho, sem efeitos financeiros. |
| `POST /api/orcamentos/:id/revisions` | aprovado com motivo | 201; mesmo grupo, versão 2 e filhos com novos IDs. |
| `DELETE /api/orcamentos/:id` | duplicata em rascunho | 204 e leitura posterior 404. |
| `POST /api/orcamentos/templates` | modelo sintético | 201; conteúdo preservado. |
| `PATCH /api/orcamentos/templates/:id` | existente e UUID ausente | 200 no existente; 404 no ausente após correção. |
| `POST /api/orcamentos/tax-profiles` | perfil ISS | 201 e reapresentação em opções. |
| `POST /api/orcamentos/pricing-parameters` | criação e chave equivalente | 201; mesma identidade após trim/lower e valor atualizado. |

## Exemplo sanitizado de criação

```json
{
  "clientId": "<CLIENTE-PRINCIPAL>",
  "propertyId": "<IMOVEL-RURAL>",
  "description": "QA-AUDIT-S04-…-Proposta completa com acentuação",
  "issueDate": "2026-09-10",
  "validUntil": "2099-12-31",
  "globalDiscount": { "type": "fixo", "value": "852" },
  "globalAddition": { "type": "percentual", "value": "10" },
  "items": "<4 itens: serviço, despesa, taxa e opcional>",
  "costs": "<3 custos classificados>",
  "taxes": "<5 tributos>",
  "payment": { "type": "parcelas", "installments": "<33,33%; 33,33%; 33,34%>" }
}
```

Resposta relevante:

```json
{
  "status": "rascunho",
  "subtotalServicos": 14752,
  "subtotalDespesas": 7600,
  "subtotalTaxas": 3500,
  "impostosPrevistos": 1948,
  "custoTotalEstimado": 12500,
  "honorariosLiquidos": 14991,
  "lucroEstimado": 12335,
  "margemPontosBase": 5850,
  "markupPontosBase": 9868,
  "valorTotal": 28783
}
```

## Aprovação sanitizada

```http
POST /api/orcamentos/<ORCAMENTO>/approve
Content-Type: application/json

{
  "idempotencyKey": "approval-s04-…",
  "project": { "mode": "existing", "projectId": "<PROJETO-DO-CLIENTE>", "name": null }
}
```

Efeito SQLite observado:

```text
orcamentos.status = aprovado
orcamento_projetos = 1
parcelas.valor = [9593, 9593, 9597]
parcelas.valor_pago = [0, 0, 0]
parcelas.status_pagamento = [Pendente, Pendente, Pendente]
recebimentos = 0
oportunidades.estagio = Ganho
oportunidades.projeto_id = <PROJETO-DO-CLIENTE>
```

Duas novas requisições concorrentes retornaram HTTP 200 com `idempotent: true`; as contagens permaneceram um vínculo e três parcelas.

## Consultas de verificação

```sql
select valor_total, subtotal_servicos, subtotal_despesas,
       subtotal_taxas, impostos_previstos, custo_total_estimado, lucro_estimado
from orcamentos where id = ?;

select valor, valor_pago, status_pagamento
from parcelas where orcamento_id = ? order by numero;

select count(*) from recebimentos;
select count(*) from orcamento_projetos where orcamento_id = ?;
select estagio, projeto_id from oportunidades where id = ?;
```

As falhas de aprovação foram verificadas com consultas equivalentes: orçamento permaneceu Emitido, sem parcela e sem projeto novo. A revisão preservou uma parcela paga, cancelou somente a futura e financiou apenas o saldo de 63.000 centavos.

## Logs mínimos

- Todas as requisições E2E retornaram os códigos esperados; não houve stack trace exposto ao navegador.
- O erro de lista foi uma resposta 500 sintética com `{ "error": "Falha controlada S04" }`, apresentada de forma recuperável.
- A falha inicial de PDF foi `File 'Roboto-Medium.ttf' not found in virtual file system`; após a correção, os quatro PDFs foram produzidos.
- O smoke do pacote falhou depois da consulta bem-sucedida a Orçamentos com `A configuração inicial não gerou o registro de auditoria esperado.`

