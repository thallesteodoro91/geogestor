# Roteiro futuro de assinatura Authenticode

> **MINUTA TÉCNICA — REVISÃO JURÍDICA OBRIGATÓRIA ANTES DA PUBLICAÇÃO**

Assinatura digital: não implementada por decisão do proprietário — risco residual aceito.

Este roteiro é informativo e não implementa assinatura, não altera os gates técnicos atuais e não autoriza compra, armazenamento de segredo ou publicação.

## Decisões e etapas futuras

1. **Certificado:** o proprietário deve escolher o tipo de certificado de assinatura de código aceito para o canal comercial e identificar titular, fornecedor, validade, renovação e custo.
2. **Armazenamento seguro:** definir onde a chave privada ficará protegida, quem poderá usá-la, como será auditado o acesso e como ocorrerão revogação, recuperação e rotação. A chave não deve entrar no repositório, pacote, logs ou artefatos de CI.
3. **Escopo de assinatura:** definir a assinatura do executável principal e do instalador final, sempre depois da geração e antes da publicação. Qualquer alteração posterior invalida a correspondência do artefato assinado.
4. **Timestamp:** selecionar serviço de timestamp compatível, registrar URL/política e validar o comportamento quando o certificado expirar.
5. **Verificação:** validar cadeia, assinatura, timestamp, nome do editor, hash e estado no Windows; registrar evidência do executável e do instalador exatos.
6. **SmartScreen:** executar homologação em Windows limpo e registrar a apresentação real. A assinatura não autoriza prometer reputação ou ausência imediata de alertas.
7. **Custos e governança:** o proprietário deve aprovar fornecedor, orçamento, responsáveis, política de segredos, contingência e impacto na CI antes de qualquer implementação.

## Critério de futura adoção

A adoção somente poderá ser considerada concluída quando o proprietário aprovar as decisões acima, os artefatos finais forem assinados e a verificação técnica/humana estiver registrada para o mesmo hash publicado.
