# Melhorias não implementadas

Estas propostas não são correções dos contratos atuais e exigem decisão de produto/técnica antes de implementação.

| Prioridade | Proposta | Benefício | Esforço | Risco/dependência |
|---|---|---|---|---|
| 1 | Paginação real do endpoint de cálculos e virtualização do histórico | Evita resposta ilimitada e sustenta grande volume | Médio | Migração de contrato API/UI; preservar consumidores legados |
| 2 | Matriz nativa de acessibilidade/visual automatizada (360–1440 px, 200%, dark, high contrast, reduced motion) | Fecha 3 bloqueios recorrentes | Médio | Requer infraestrutura Windows e baseline visual estável |
| 3 | Harness de rede para tiles lento/HTTP/offline→online/retry | Prova recuperação do mapa-base sem confundir overlay/cálculo | Médio | Simulador de rede determinístico e política do provedor |
| 4 | Testes reais de NVDA/Narrator e touch/drag | Valida experiência assistiva e gestos | Alto | Hardware/desktop interativo; análise humana |
| 5 | Suite de interoperabilidade com QGIS e pontos oficiais | Aumenta rastreabilidade metrológica das transformações | Médio/alto | Definir fonte oficial, época, datum, tolerâncias e responsabilidade técnica |
| 6 | Histórico com filtro, paginação, edição/exclusão e política anti-duplicata idempotente no servidor | Melhora operação e protege contra clientes externos repetindo POST | Alto | Nova funcionalidade/contrato; decisão de UX e chave idempotente |
| 7 | Importar/exportar metadados completos em round-trip documentado | Evita perda ao reimportar arquivos enriquecidos | Médio | Definir schema versionado e compatibilidade CSV/KML/DXF |
| 8 | Estado de aba/modo/SRC na URL | Permite deep-link, voltar/avançar e suporte técnico reproduzível | Médio | Decisão de produto e migração de URLs |
| 9 | Worker/Web Worker e progresso cancelável para import/export/PDF grandes | Evita bloqueio da thread em volumes extremos | Alto | Novo desenho assíncrono; limites e cancelamento |
| 10 | Métodos adicionais (nivelamento, poligonal, PTL, fator combinado, volume) | Amplia capacidade topográfica | Muito alto | Normas, modelo metrológico, validação profissional e aprovação expressa |

Antes de uma publicação, o fluxo oficial também deve regenerar/revisar o manifesto de hashes do instalador 1.0.4 e decidir o tratamento dos artefatos 1.0.2/1.0.3 ausentes.
