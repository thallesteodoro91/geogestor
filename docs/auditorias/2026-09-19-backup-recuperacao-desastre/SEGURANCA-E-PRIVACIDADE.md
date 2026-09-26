# Segurança e privacidade

## Aprovado

- API local protegida por token, sessão e CORS/loopback; produção sem token falha fechada.
- Restauração real recusa modo web/dev não gerenciado.
- Autorização HMAC vincula caminho, expira e é de uso único.
- A19-02 liga o teste isolado ao fingerprint SHA-256 do bundle e verifica novamente no worker.
- Banco protegido e documento não revelaram os valores sintéticos procurados em bytes.
- Credenciais Google sintéticas foram removidas do banco do bundle e continuaram ausentes após restauração.
- Formato 4 exige envelopes `device` e `recovery`; tag/chave incompatível falha fechada.
- Código e kit não entram nos artefatos; sessão de kit é opaca, em memória, com TTL e consumo único.
- Acesso administrativo ao código/kit possui resposta uniforme e `Retry-After`.
- Pasta sincronizada continua descrita como não observável.

## Bloqueado

- ACL efetiva entre dois usuários Windows para bundle, chave e kit.
- Inspeção de dump de memória/crash em processo instalado.
- Ransomware, exclusão remota, incêndio e comprometimento do usuário não são cobertos nem prometidos.

O inventário real registrou apenas categorias, contagens e tamanhos. Não foram lidos conteúdos, chaves, kits, tokens ou códigos reais.
