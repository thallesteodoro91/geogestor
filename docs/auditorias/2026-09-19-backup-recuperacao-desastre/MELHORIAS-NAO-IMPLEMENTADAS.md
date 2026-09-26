# Melhorias não implementadas

| Melhoria | Benefício | Esforço | Risco/motivo |
|---|---|---:|---|
| Runner físico A/B com snapshots Windows | fecha a promessa de desastre | alto | requer VM/equipamento e candidato limpo |
| Instrumentação persistente de RPO/RTO por etapa | medição operacional mais precisa | médio | altera contrato/telemetria; não necessária à correção |
| Teste de milhares de arquivos e carga prolongada | detecta handles/memória | médio | precisa perfil de performance dedicado |
| Confirmação independente de provedor remoto | prova off-site real | alto | novo provedor/sincronização exige aprovação expressa |
| Assinatura/autenticação integral do manifesto | endurece origem do bundle | alto | mudança de formato/estratégia criptográfica; fora do escopo autorizado |
| UI de inventário e descarte de `before-restore` | reduz resíduos operacionais | médio | exige decisão de produto e retenção |

Nenhum provedor de nuvem, novo formato ou nova estratégia criptográfica foi introduzido.
