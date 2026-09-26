# Índice de evidências sanitizadas

Todos os registros usam entidades sintéticas com prefixo `QA-AUDIT-S06-20260911-`. Nenhum dado pessoal ou caminho externo ao workspace foi incluído.

| Evidência | O que comprova |
|---|---|
| `01-estado-vazio-recuperado.png` | estado vazio, falha interceptada, retry e lista recuperada |
| `02-demanda-historico-e-prazos.png` | detalhe da demanda, fase, andamento e prazos |
| `03-licencas-fronteira-30-dias.png` | filtro inclusivo de 30 dias e exclusão da faixa 60 |
| `04-condicionante-link-profundo.png` | aba ativada, condicionante destacada/focada e status cumprido |
| `05-car-mobile-validacao.png` | reflow em 360 px e recusa de `1e4` |
| `laudo-vistoria.pdf` | Vistoria Técnica, 22.659 bytes |
| `laudo-fauna.pdf` | Monitoramento de Fauna, 22.857 bytes |
| `laudo-flora.pdf` | Inventário Florestal, 22.706 bytes |
| `laudo-outros.pdf` | Laudo Ambiental Genérico, 22.627 bytes |
| `api-amostra-sanitizada.json` | respostas e contagens independentes de API/banco |
| `limpeza.txt` | escopo e resultado da remoção de temporários |
| `SHA256SUMS.txt` | integridade das capturas, PDFs e amostra de API |

As capturas e PDFs foram produzidos pela última execução E2E aprovada. A suíte também executou Axe; o resultado final teve zero violação nas páginas percorridas.
