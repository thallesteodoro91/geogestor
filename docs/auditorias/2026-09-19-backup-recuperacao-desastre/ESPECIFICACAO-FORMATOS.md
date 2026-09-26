# Especificação observada

## Bundle

- Leitura compatível: formatos 1, 2, 3 e 4.
- Criação: formato 4 quando existem chave do banco e segredo de recuperação; formato 3 quando a recuperação portátil não está configurada.
- Arquivos de controle: `manifest.json`, `COMPLETE`; `PENDING` invalida o bundle.
- Banco: `database.db`, exatamente uma entrada `kind=database`.
- Documentos protegidos: objetos opacos em `objects/*.ggenc`; caminho lógico cifrado e autenticado.
- Legado sem criptografia pode usar `files/`; `.db` isolado sem manifesto não é restaurável automaticamente.

## Manifesto

Campos observados: `formatVersion`, `application=GeoGestor`, `createdAt`, `completedAt`, `schemaVersion`, `type`, `files`, `totals`, `credentialsExcluded`, `device` e `encryption`. Cada arquivo moderno possui tamanho e SHA-256. A validação agora confronta entradas com arquivos físicos e rejeita extras.

No formato 4, `encryption` exige AES-256-GCM, chave de dados aleatória por backup e exatamente dois envelopes independentes: `device` e `recovery`. A chave de dados não aparece em texto claro.

## Documento cifrado

Assinatura observada `GGBAK2\0`, IV de 12 bytes, ciphertext em streaming e tag GCM de 16 bytes. O SHA-256 do plaintext é preservado separadamente para reconciliação pós-restauração.

## Código e kit

- Código: prefixo `GG-R1`, Base32 segmentado; espaços, caixa e hífens são normalizados.
- Kit: `GeoGestor-Recovery-Kit`, versão 1.
- KDF: scrypt `N=131072`, `r=8`, `p=1`, chave de 32 bytes.
- Cifra: AES-256-GCM com AAD de domínio.
- Sessão de kit: token opaco, TTL de uma hora, memória e consumo único na restauração.

Nenhum valor de segredo, código, senha, chave, token ou autorização foi registrado neste dossiê.
