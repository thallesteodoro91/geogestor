# Falhas e rollback

**Ensaios físicos não executados.** Não há snapshot de VM aprovado para adulteração de bundle, falta de espaço, pasta indisponível, interrupção antes da promoção, injeção entre banco/documentos ou cancelamento. Nenhum estado ativo foi tocado; nenhuma conclusão sobre rollback no aplicativo instalado pode ser dada.

A integração sintética existente exercita falha injetada após instalar documentos e compara o estado anterior em diretórios de teste. O relatório de 19/09 contém esse resultado; ele permanece evidência de fixture, não evidência de recuperação física no candidato atual.
