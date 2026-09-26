# Dispositivos A e B

## Dispositivo A

Ambiente exercitado: diretórios, banco criptografado e chave sintéticos. O bundle completo foi criado, testado isoladamente e restaurado em destino separado. Uma mutação posterior de banco e documento distinguiu inequivocamente estado atual e estado recuperado. Resultado técnico: aprovado em fixture.

Ambiente exigido pelo contrato: aplicativo instalado, seleção nativa, resposta 202, encerramento da API, worker, código de saída, reinício Electron e primeira tela reconciliada. Resultado: **BLOQUEADO** por ausência de candidato limpo/VM descartável.

## Dispositivo B

Ambiente exercitado: nova chave de dispositivo, destino vazio e bundle formato 4. A chave B sozinha foi recusada; o código autorizado abriu e restaurou banco/documento sem copiar a chave A. Resultado técnico do envelope portátil: aprovado.

Ambiente exigido: outro usuário Windows, VM ou equipamento, cópia somente do bundle + código/kit, reinício, paths diferentes, acentos/espaços, kit após reinicialização e reconciliação ampla. Resultado: **BLOQUEADO**.

## Protocolo mínimo para desbloquear

1. Gerar candidato em origem limpa e registrar commit, versão e SHA-256.
2. Criar snapshots externos de duas VMs Windows.
3. Popular A com o caderno amplo de oráculos, criar bundle e copiar somente bundle + método autorizado.
4. Restaurar A pelo fluxo gerenciado e reconciliar após reinício.
5. Restaurar B uma vez por código e outra, em snapshot limpo, por kit.
6. Medir RPO/RTO, reiniciar novamente e verificar idempotência.
