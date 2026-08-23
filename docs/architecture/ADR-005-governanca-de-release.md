# ADR-005 — Versão, evidências e governança de release

## Status

Aceito para a preparação do GeoGestor 1.x em 13/08/2026.

## Decisão

- `package.json` da raiz é a fonte canônica da versão técnica. No estado desta decisão, ela é `1.0.0`, apresentada comercialmente como **GeoGestor 1.0**.
- API, desktop e Ajuda devem declarar/validar a versão canônica. A interface recebe a versão da raiz durante o build, sem depender do `0.0.0` técnico do workspace web.
- Instaladores históricos não podem ser renomeados, reaproveitados nem ter seus hashes publicados como se pertencessem à versão atual.
- Um candidato comercial exige commit conhecido, checkout limpo e metadado `dirty:false`. Build de worktree alterado é somente técnico e não recebe parecer de candidato final.
- A ordem é: gates de código e dados, build único, SBOM CycloneDX, hash do instalador finalizado, smoke e verificação de conteúdo/proveniência.
- O SBOM inclui dependências de produção diretas e transitivas, origem, licença declarada quando existente, integridade disponível no lockfile e workspaces consumidores. Licença ausente não é inferida.
- A CI executa os gates e o build, mas não publica releases ou instaladores automaticamente.

## Exceção de assinatura

Authenticode não será implementado nesta etapa por decisão do proprietário. A verificação continua sendo executada e registrada como informativa. `NotSigned`, isoladamente, não reprova os demais gates; o relatório deve registrar:

`Assinatura digital: não implementada por decisão do proprietário — risco residual aceito.`

O produto não pode declarar editor verificado, e o comportamento real do SmartScreen permanece pendente de homologação humana.

## Consequências

O repositório pode produzir builds técnicos a partir de worktree alterado para fins de verificação, mas somente um novo build de commit limpo poderá ser promovido. Documentação, SBOM e hashes devem pertencer à mesma execução do instalador; qualquer divergência bloqueia a promoção.
