# Matriz de compatibilidade

| Formato | Schema | Chave/dispositivo | Resultado observado |
|---:|---|---|---|
| 1 | atual/compatível | dispositivo original; checksums opcionais | legível como legado não verificado |
| 2 | atual/compatível | dispositivo original | validado com checksums |
| 3 | atual/compatível | chave do dispositivo original | criado, validado e restaurado |
| 4 | atual/compatível | dispositivo ou recuperação | criado e restaurado com outra chave por código |
| 1–4 | schema futuro 999 | qualquer | recusado |
| `.db` sem manifesto | n/a | qualquer | recusado como legado não restaurável |
| diretório com `PENDING` | qualquer | qualquer | recusado |
| formato 4 sem os dois envelopes | atual | qualquer | recusado após correção |

Migrations após restauração em candidato instalado não foram exercitadas fisicamente nesta sessão.
