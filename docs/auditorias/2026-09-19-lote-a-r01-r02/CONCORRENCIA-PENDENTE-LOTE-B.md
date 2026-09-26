# R02 — política funcional de concorrência pendente para o Lote B

Data da verificação: 23/09/2026.

## O que o Lote A protege

- O teste multiprocesso usa dois processos reais da API e um SQLite exclusivo e descartável.
- Restrições objetivas de integridade continuam atômicas entre processos: uma matrícula normalizada só pode identificar uma propriedade ativa e a soma de recebimentos ativos não pode ultrapassar o principal da parcela.
- Contenção transitória (`SQLITE_BUSY`) nas gravações prioritárias de propriedade, recebimento, reordenação do CRM e catálogos recebe tentativas limitadas dentro da mesma requisição. Transações de recebimento, CRM e catálogos usam uma conexão nova por tentativa, evitando reutilizar uma conexão após falha de commit.
- Uma falha concorrente não deixa a conexão presa nem impede leituras posteriores.
- Os testes também verificam leitura de estado confirmado durante uma escrita, reatribuição contra exclusão,
  mutação durante uma cópia de backup e ativação simultânea de ciclos em dois processos.
- O snapshot do backup é aceito somente quando íntegro e coerente, contendo a mutação inteira ou não a contendo.
  Nenhuma preferência por ordem de vitória é inferida.
- Reordenações simultâneas do CRM terminam com uma permutação inteira, e substituições simultâneas de catálogos terminam com uma versão inteira; nenhum teste impõe qual requisição deve prevalecer.

Esses comportamentos são invariantes técnicas; não definem quem deve vencer uma edição funcional concorrente.

## Conflito reproduzido e deliberadamente não decidido

Dois processos podem ler a mesma propriedade e enviar alterações simultâneas. O contrato atual não envia versão, ETag ou base da edição. Assim, não há informação suficiente para distinguir uma sobrescrita intencional de uma atualização perdida. O teste do Lote A exige somente que o estado final seja um registro completo e válido e aceita tanto sucesso quanto conflito explícito. Ele não fixa “última gravação vence” como regra de produto.

O mesmo problema conceitual se aplica a catálogos substituídos em bloco, reordenação do funil, alteração/remoção de vínculos e ativação exclusiva de ciclos estratégicos. Restrições de unicidade podem impedir estados impossíveis, mas não resolvem a intenção do usuário.

## Alternativas para decisão no Lote B

| Alternativa | Contrato esperado | Principal consequência |
|---|---|---|
| ETag/versionamento otimista | leitura retorna versão; alteração exige `If-Match`; versão divergente retorna `409`/`412` | evita perda silenciosa e pede resolução ao usuário |
| Última gravação vence, explícita | API aceita a gravação mais recente e registra versão anterior/autor | simples, porém admite perda intencional de atualização |
| Bloqueio pessimista | edição adquire lease com expiração e proprietário | reduz conflitos, mas exige recuperação de locks abandonados |
| Merge de campos | API compara base, versão atual e patch e mescla campos independentes | preserva alterações compatíveis, mas exige regras por agregado |

## Decisões necessárias antes da implementação

1. Quais agregados exigem rejeição de conflito e quais aceitam última gravação.
2. Se a versão será contador, timestamp monotônico ou ETag opaco.
3. Como a interface apresentará comparação, recarga e reaplicação do trabalho local.
4. Se operações em bloco (catálogos e ordenações) admitem merge ou exigem substituição exclusiva.
5. Política de auditoria para atualização perdida, conflito rejeitado e override consciente.

Nenhuma dessas políticas funcionais foi escolhida ou implementada no Lote A.
