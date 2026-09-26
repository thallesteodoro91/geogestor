# Auditoria de backup, restauração e recuperação de desastre

Data: 19/09/2026. Versão observada: 1.0.4. HEAD inicial: `a16551a8b63e73f42d826297df893488e5ab88ca`. O worktree já estava amplamente modificado; nenhuma mudança preexistente foi revertida.

## Decisão executiva

**Prontidão geral para recuperação de desastre: REPROVADA.** A criação, validação, teste isolado, recuperação portátil sintética e rollback passaram depois de quatro correções. Contudo, o aplicativo instalado não foi restaurado e reiniciado fisicamente, e não houve segundo perfil/equipamento Windows real. Esses dois ensaios são essenciais à promessa de recuperação de desastre.

| Decisão independente | Resultado | Fundamento |
|---|---|---|
| Criação de backup do banco | **APROVADA** | Bundle exclusivo do banco criado e validado; um banco, checksums, manifesto, `COMPLETE`, criptografia e credenciais sintéticas excluídas. |
| Criação de backup completo | **APROVADA** | Banco e documento reconciliados; raiz ausente agora bloqueia a promoção; arquivo extra não manifestado é recusado. |
| Automação, política e retenção | **APROVADA COM RESSALVAS** | Scheduler, pendências e 25 versões sintéticas passaram; mídia removível, rede, disco cheio real e encerramento do Windows ficaram bloqueados. |
| Restauração no computador original | **BLOQUEADA** | Restauração A foi provada em processo/diretórios descartáveis, mas não no aplicativo instalado com reinício do Electron. |
| Recuperação em outro perfil/equipamento | **BLOQUEADA** | Uma segunda chave restaurou o formato 4 por código em destino isolado, sem copiar a chave A; faltou outro usuário/VM/equipamento real e o fluxo por kit após reinício. |
| Segurança, privacidade e acessibilidade | **APROVADA COM RESSALVAS** | Criptografia, exclusão de credenciais, rate limit, autorização, axe e teclado passaram. NVDA/Narrator, alto contraste real, ACL entre usuários e inspeção de memória ficaram bloqueados. |
| Prontidão geral | **REPROVADA** | Não se converte prova isolada em recuperação física A/B. |

## Cobertura e resultados

- Matriz: **52 controles** — 36 aprovados, 4 aprovados após correção, 12 bloqueados, 0 reprovados pendentes e 0 não aplicáveis.
- Defeitos: **0 P0, 2 P1 e 2 P2**; os quatro foram corrigidos e retestados. Pendentes de código no escopo: 0.
- Testes: API completa **192/192**; integração final de backup **1/1**; retenção final **4/4**; web **202/202**; Electron **18/18**; E2E focado **5/5**; typecheck, lint, `git diff --check` e build da API aprovados.
- Bundles sintéticos criados pelo serviço na integração final: **3** (banco v3, completo v3 e portátil completo v4).
- Variantes validadas: formatos **1, 2, 3 e 4**. Foram recusados, entre outros, banco adulterado, arquivo extra, schema futuro, `.db` legado, chave/dispositivo incompatível, confirmação errada e raiz de documentos ausente.
- Restaurações sintéticas bem-sucedidas: teste isolado, destino A, segunda restauração consecutiva e destino B com outra chave. Falha injetada após instalar documentos restaurou banco e documentos anteriores.

## RPO e RTO observados

| Ambiente | RPO observado | RTO observado |
|---|---:|---:|
| Fixture A isolada | 9,340 s entre conclusão do bundle e primeira mutação deliberadamente não protegida | 2,553 s para restauração do bundle no destino A; não inclui reinício Electron |
| Fixture B com outra chave | o bundle preservou exatamente o estado protegido; alterações posteriores ficaram fora, como esperado | 10,415 s por código de recuperação; não inclui seleção humana, kit nem reinício |
| Aplicativo instalado / equipamento real | não medido | não medido — bloqueado |

Esses tempos são medições da fixture desta máquina, não garantias de produto.

## Correções comprovadas

1. **A19-01, P1:** backup completo promovia bundle de banco quando a raiz de documentos desaparecia. Agora a raiz é obrigatória, existente e diretório regular; links/reparse points não são omitidos silenciosamente.
2. **A19-02, P1:** o teste isolado era ligado apenas ao caminho/nonce. Agora a autorização guarda a impressão SHA-256 do manifesto e marcador testados, compara antes do 202 e novamente no worker.
3. **A19-03, P2:** o limite de retenção confiava em `manifest.totals.bytes`. Agora usa os bytes reais dos arquivos do bundle e preserva itens incompletos/corrompidos para inspeção.
4. **A19-04, P2:** arquivo extra fora do manifesto não invalidava o bundle. Agora o inventário físico é confrontado com o manifesto antes de tocar nos dados ativos.

## Limites honestos

Não foram executados VM snapshot, queda de energia, disco cheio real, remoção de unidade, desinstalação, atualização malsucedida, troca de usuário Windows, NVDA/Narrator ou restauração do aplicativo instalado. O inventário de dados reais foi somente leitura e sanitizado; nenhum banco, backup ou segredo real foi aberto, copiado ou alterado.

## Recomendação

**NÃO CONSIDERAR RECUPERÁVEL FORA DESTE COMPUTADOR** até executar o protocolo físico do Dispositivo B e, no mesmo candidato por hash, a restauração/reinício do Dispositivo A.

## Índice

- [Matriz de cobertura](./MATRIZ-DE-COBERTURA.md)
- [Fluxo e fronteiras de confiança](./FLUXO-E-FRONTEIRAS-DE-CONFIANCA.md)
- [Especificação observada](./ESPECIFICACAO-FORMATOS.md)
- [Caderno de oráculos](./CADERNO-DE-ORACULOS.md)
- [Compatibilidade](./MATRIZ-DE-COMPATIBILIDADE.md)
- [Dispositivos A e B](./DISPOSITIVOS-A-B.md)
- [Falhas e rollback](./MATRIZ-FALHAS-ROLLBACK.md)
- [Retenção, capacidade, RPO e RTO](./RETENCAO-CAPACIDADE-RPO-RTO.md)
- [Segurança e privacidade](./SEGURANCA-E-PRIVACIDADE.md)
- [Acessibilidade e homologação Windows](./ACESSIBILIDADE-HOMOLOGACAO-WINDOWS.md)
- [Achados](./ACHADOS.md)
- [Comandos e resultados](./COMANDOS-E-RESULTADOS.md)
- [Arquivos alterados](./ARQUIVOS-ALTERADOS.md)
- [Melhorias não implementadas](./MELHORIAS-NAO-IMPLEMENTADAS.md)
- [Limpeza e resíduos](./LIMPEZA-E-RESIDUOS.md)
