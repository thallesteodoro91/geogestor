# Avisos e atribuições de terceiros — minuta

> **MINUTA TÉCNICA — REVISÃO JURÍDICA OBRIGATÓRIA ANTES DA PUBLICAÇÃO**

Esta relação não substitui os textos integrais das licenças. O build gera `sbom.cdx.json` e `sbom.json` em CycloneDX 1.6 com dependências diretas e transitivas, origem, integridade disponível no lockfile e workspaces consumidores. Licenças ausentes permanecem sem classificação até revisão humana.

## Componentes visíveis e relevantes

| Componente atual | Uso | Declaração local do pacote | Origem declarada no manifesto local | Ação antes da publicação |
|---|---|---|---|---|
| `@fontsource/geist-sans` 5.2.5 | Fonte Geist Sans | OFL-1.1; arquivo `LICENSE` presente | `github.com/fontsource/font-files`; `fontsource.org/fonts/geist-sans` | Distribuir o aviso/licença da fonte conforme exigido e conferir os arquivos efetivamente empacotados. |
| `@phosphor-icons/react` 2.1.10 | Ícones da interface | MIT; arquivo `LICENSE` presente | `phosphor-icons/react`; `phosphoricons.com` | Preservar aviso aplicável. |
| `leaflet` 1.9.4 | Mapa interativo | BSD-2-Clause; arquivo `LICENSE` presente | `github.com/Leaflet/Leaflet`; `leafletjs.com` | Preservar copyright e licença. |
| `react-leaflet` 5.0.0 e `@react-leaflet/core` 3.0.0 | Integração React/Leaflet | Hippocratic-2.1 em ambos; arquivo `LICENSE.md` presente em ambos | `github.com/PaulLeCam/react-leaflet`; `react-leaflet.js.org` | Revisão jurídica específica obrigatória para confirmar a adequação ao uso comercial pretendido. Este registro não interpreta a licença. |
| `pdfmake` 0.3.11 | Geração de PDF | MIT; arquivo `LICENSE` presente | `github.com/bpampuch/pdfmake`; `pdfmake.org` | Preservar aviso aplicável e revisar componentes incorporados. |
| `react` 19.2.7 e `react-dom` 19.2.7 | Interface | MIT; arquivo `LICENSE` presente em ambos | `github.com/facebook/react`; `react.dev` | Preservar avisos aplicáveis conforme o SBOM. |

## OpenStreetMap

Quando tiles do OpenStreetMap são exibidos, a interface deve manter a atribuição visível:

`© OpenStreetMap contributors`

com link para `https://www.openstreetmap.org/copyright`. Tiles não podem ser redistribuídos ou armazenados fora dos termos do provedor adotado. Camadas próprias, grade local e MBTiles do usuário devem permanecer identificados separadamente do mapa-base.

## Fontes e PDFs

A fonte visual Geist Sans declara OFL-1.1 no pacote instalado. A aplicação também carrega `pdfmake/build/vfs_fonts` e usa Roboto em documentos.

Na instalação local congelada, os quatro binários Roboto decodificados de `pdfmake/build/vfs_fonts.js` são byte a byte idênticos aos arquivos em `pdfmake/fonts/Roboto`. Os metadados internos dos TTFs registram `Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic)` e declaram SIL Open Font License 1.1. Evidência SHA-256:

| Arquivo | SHA-256 do VFS e do TTF local |
|---|---|
| `Roboto-Italic.ttf` | `b9e7d02d28dd215bd1dbb164d2d75bc1bbccf754a17390efc8678feb78017577` |
| `Roboto-Medium.ttf` | `4cb9d8a346d7d9190ef145daad9a85d58e2592043b199cdb8ed52ff535c64047` |
| `Roboto-MediumItalic.ttf` | `1b4daee5311f0bcd8e1b79d44d1d5ba675a72abb6624d2b0ed77fda1c65d77b1` |
| `Roboto-Regular.ttf` | `ab9c18a75da1636435afd2398ffce325496644a8f258f918c92c4baf34a68625` |

Essa evidência identifica origem e declaração de licença do artefato efetivamente carregado. Ela não substitui a revisão jurídica nem a inclusão do texto/aviso aplicável no material distribuído.

## Ícones e recursos visuais

Phosphor Icons declara MIT. Os demais SVGs, imagens, logotipo e recursos em `apps/web/src/assets` devem ter origem/autoria documentada; recursos sem consumidor ou origem comprovada não devem ser classificados automaticamente nem publicados sem decisão humana.

## Procedimento de fechamento

1. Gerar o SBOM na mesma execução do instalador final.
2. Revisar todos os componentes sem licença declarada e todas as expressões não permissivas.
3. Incorporar textos integrais exigidos ao instalador/pacote ou ao material distribuído.
4. Registrar responsável, data, versão do SBOM e decisão jurídica.

## Limites desta verificação técnica

- As versões foram confirmadas em `apps/web/package.json`, `pnpm-lock.yaml` e nos manifests da instalação local.
- Os arquivos de licença citados acima existem nos respectivos diretórios locais em `apps/web/node_modules` após a instalação congelada.
- A atribuição OpenStreetMap foi confirmada no código em `apps/web/src/utils/mapTileConfig.ts`; os termos operacionais do provedor ainda exigem revisão antes da publicação.
- O SBOM final deve ser tratado como inventário canônico do conjunto efetivamente distribuído. Componentes transitivos, recursos próprios sem origem documentada e qualquer item sem licença declarada permanecem pendentes; nenhuma licença foi inferida.
