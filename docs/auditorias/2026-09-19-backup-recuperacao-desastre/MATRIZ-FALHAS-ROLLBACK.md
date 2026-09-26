# Falhas, interrupções e rollback

| Ponto/cenário | Resultado | Evidência |
|---|---|---|
| Raiz de documentos ausente antes da cópia | aprovado após correção | nenhuma promoção completa |
| Bundle com banco adulterado | aprovado | tamanho/checksum recusado |
| Arquivo extra fora do manifesto | aprovado após correção | validação recusa antes da restauração |
| Schema futuro | aprovado | recusado |
| Chave de outro dispositivo sem recuperação | aprovado | mensagem uniforme orienta código/kit |
| Bundle trocado depois do teste | aprovado após correção | fingerprint ligado ao nonce e ao worker |
| Falha após instalar documentos | aprovado | banco e documento anteriores restaurados |
| Segunda restauração consecutiva | aprovado | nenhum handle residual bloqueou o ciclo |
| Diretório `PENDING` na retenção | aprovado | preservado, não promovido nem removido |
| Manifesto corrompido na retenção | aprovado | preservado para inspeção |
| Antes/depois de rename, queda de energia e fallback de cópia Windows | bloqueado | exige VM snapshot |
| Disco cheio, unidade removida, ACL alterada e arquivo bloqueado | bloqueado | exige volume descartável |
| Falha durante fechamento API/reinício Electron | bloqueado | exige aplicativo instalado |

Nenhum estado híbrido foi observado nos cenários automatizados executados. Essa afirmação não cobre os pontos físicos bloqueados.
