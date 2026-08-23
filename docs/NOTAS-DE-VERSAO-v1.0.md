# GeoGestor v1.0

## Importação geoespacial

- O fluxo de levantamentos aceita somente KML, KMZ, GeoJSON, Shapefile e GeoPackage vetorial.
- Arquivos raster são recusados como levantamento com orientação para correção.
- GeoPackage misto importa somente vetores e registra os conteúdos raster ignorados.
- GeoPackage somente raster é recusado como levantamento.
- MBTiles raster permanece disponível exclusivamente como mapa-base offline opcional.
- Levantamentos vetoriais e mapas-base possuem interface, contratos, relatórios e eventos de histórico separados.

## Orientação técnica

Ortofotos, modelos digitais de elevação, GeoTIFF e outros rasters técnicos devem ser tratados externamente em um SIG, como o QGIS. O mapa-base MBTiles não altera coordenadas, geometrias, cálculos ou a localização dos levantamentos.

## Instalação

Quando o candidato limpo for homologado e publicado, o instalador correspondente será `GeoGestor Setup 1.0.exe` para Windows de 64 bits. Não renomeie nem reutilize instaladores históricos de outras versões.

Crie e verifique um backup antes da atualização. Os testes automatizados exercitam preservação do banco, documentos, projetos, levantamentos e configurações, mas atualização sobre instalação real permanece pendente do checklist humano.

## Assinatura e procedência

Authenticode não foi implementado nesta etapa por decisão do proprietário. O Windows pode exibir aviso de origem desconhecida ou SmartScreen; o instalador não possui editor verificado. Confirme a versão, o canal oficial e o SHA-256 publicado para o mesmo build antes de executar.
