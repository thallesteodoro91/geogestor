# Relatório de auditoria — Sessão 10: Topografia

## Resultado real

**Status da sessão: APROVADA COM RESSALVAS.**

As funções topográficas implementadas ficaram dentro das tolerâncias declaradas após **23 correções comprovadas**. A cobertura final contém **133 itens**: **68 APROVADOS**, **36 APROVADOS APÓS CORREÇÃO**, **1 REPROVADO**, **21 BLOQUEADOS** e **7 NÃO APLICÁVEIS**. Não há defeito funcional conhecido aberto entre os 23 reproduzidos, mas a sessão não recebe aprovação irrestrita porque parte da validação nativa/assistiva e de estresse real permaneceu bloqueada e o manifesto do candidato de release falhou.

Estado do roteiro de aceite: **escalated para riscos residuais**, não `accepted`, pois nem todo critério pôde receber prova ambiental. Não é necessária uma decisão humana para iniciar a próxima auditoria; é necessária ação de release antes de publicar este instalador.

## Cobertura em números

- **3/3 abas** exercitadas na aplicação: Conversor GMS/Decimal, Distância e azimute, Área e perímetro.
- **8/8 modos funcionais** percorridos por E2E, teste focado ou ambos: 4 conversores, 2 distâncias e 2 polígonos.
- **5 EPSG explícitos** confrontados diretamente: 4326, 4674, 31974, 31982 e 32722; famílias SIRGAS 2000/WGS 84, UTM N/S e zonas 18–25 também cobertas no catálogo/testes.
- **37/37 valores** de produção comparados com PROJ/GeographicLib/Shapely/manual dentro das tolerâncias.
- **4/4 formatos espaciais** baixados pela UI e reabertos: CSV, GeoJSON, KML, DXF.
- **1/1 PDF** baixado, extraído e renderizado: 2/2 páginas íntegras.
- **10/10 validações externas de arquivo** aprovadas.
- **3/3 estados E2E finais da Topografia** aprovados, além do setup: total Playwright 4/4; Axe sem violações nos estados capturados.

## Exatidão matemática e geodésica

O ponto de Florianópolis em SIRGAS 2000, EPSG:4674→31982, resultou no oráculo em **X 742003,210469342 m** e **Y 6945275,21488603 m**. Os desvios do GeoGestor foram, respectivamente, **6,98×10⁻¹⁰ m** e **9,31×10⁻¹⁰ m**, com round-trip máximo **7,11×10⁻¹⁵°**.

São Paulo→Rio no GRS80/Karney foi **361260,8611460836 m** e **79,305445859348°**; os desvios foram **0 m** e **2,84×10⁻¹⁴°**. Quase antípoda e antimeridiano permaneceram finitos. Pontos coincidentes agora exibem 0 m e azimute indeterminado.

O quadrado plano 10×10 m fechou em **100 m² e 40 m**, sem desvio; retângulo, triângulo e irregular também tiveram desvio zero. O polígono geográfico pequeno teve área **10940,29728782177 m²** e perímetro **419,0811109626364 m**, com desvios máximos **5,96×10⁻⁸ m²** e **5,68×10⁻¹⁴ m**. Orientação invertida não alterou área absoluta/perímetro.

A convergência do ponto conhecido foi **−1,136258829477666°** e o fator de escala **1,0003229671041056**. Após correção, os desvios foram **8,6860×10⁻⁶°** e **3,7574×10⁻¹²**. O maior desvio de toda a comparação foi **0,00009068593754335552°** no azimute de um segmento quase coincidente, abaixo da tolerância específica **0,001°** e da apresentação **0,01°**.

## Defeitos e correções

Foram encontrados **0 P0, 11 P1, 11 P2 e 1 P3**; **23/23 corrigidos**. Os P1 abrangeram sinal/hemisfério, geometria/exportação inválida, DXF, metadados, borda/fator UTM, gate espacial, schema/vínculo API, perda de metadados na transformação e duas falhas sérias WCAG. Os P2 abrangeram carry GMS, importação, PDF, coincidência/restauração, legado, ordem/recorte do histórico, busca SRC e duplo submit. O P3 era uma mensagem que nomeava o sinal errado.

O ciclo começou com **180 passes e 8 falhas** focadas. Defeitos integrados adicionais foram capturados pelos próprios E2E/Axe/validadores. A lista completa, passos, causa, arquivos e reteste está em `ACHADOS.md`.

## Importação, exportação e PDF

A importação agora rejeita arquivo vazio, colunas iguais, delimitador/decimal ambíguo e excesso de linhas/bytes/colunas; preserva aspas e a primeira duplicata válida. O limite exato de **10.000 linhas** passou em **97,6871 ms**, e o caso UTF-8 de **2 MB** em **147,7752 ms**.

CSV, GeoJSON, KML e DXF preservaram ordem, origem EPSG:31982, metadados e altitude. GeoJSON/KML saíram em WGS 84 com longitude/latitude e cinco posições para quatro vértices; DXF manteve quatro `VERTEX`, `POLYLINE` fechada por flag e X/Y/Z projetados. O CSV neutralizou `=QA-V1` como `'=QA-V1`.

O PDF de **27.694 bytes**, SHA-256 `C190C60333A3F596C3C197F9AD36B9F98E054B698D1AF3BDD58C8E99E20F5186`, contém título, data, cliente/projeto sintéticos, responsável, SIRGAS 2000/UTM 22S/EPSG:31982, método, 100 m²/40 m, coordenadas, metadados, croqui, advertência e assinatura. As duas páginas foram inspecionadas sem corte ou sobreposição.

## Persistência, atomicidade e auditoria

O backend continua corretamente limitado a persistir; não recalcula nem certifica. A API passou a exigir objetos JSON para entradas/resultado, rejeitar campos extras/tipos/data/vínculos inválidos, derivar o cliente pelo projeto e ordenar de forma determinística. `deletedAt` é respeitado; JSON legado inválido/primitivo é marcado e não reaberto.

A falha de auditoria foi injetada dentro da transação: a API respondeu 500 controlado e o cálculo `Deve reverter` não existiu após o rollback. O fluxo UI com duplo clique gerou uma única POST/registro. A reabertura restaurou modo, EPSG, vértices e metadados e recalculou a interface.

## Regressão final

- Web: **192/192**, 0 falhas.
- API: **185/185**, 0 falhas.
- Electron: **18/18**, 0 falhas.
- E2E da sessão: **4/4**, 0 falhas.
- Typecheck, lint, build completo Windows/NSIS e smoke empacotado: exit 0.
- Benchmark geoespacial: 1.000 features/500.000 vértices em 88,94 ms, delta aproximado de heap 37.589.016 bytes.

O teste adicional `release:verify-candidate` ficou **REPROVADO**: manifesto ainda referencia instaladores 1.0.2/1.0.3 ausentes e o 1.0.4 recém-construído diverge em tamanho/SHA-256. O pacote construiu e passou no smoke, mas não deve ser publicado antes da governança oficial de hashes.

## Bloqueios e não aplicáveis

Os **21 bloqueios** incluem leitor de tela real, touch/drag real, matriz visual nativa/200%/alto contraste, restart nativo, voltar/avançar/deep-link, clipboard negado, tile lento/reconexão/retry, mapa extremo, seleção física/MIME/falha de leitura, download bloqueado, PDF extremo/loader falho, histórico lento/erro, payload enorme, concorrência SQLite multiprocesso, volume produtivo e upgrade de instalação antiga. Nenhum foi convertido em aprovação por inferência.

Os **7 não aplicáveis** são recálculo/certificação backend, edição/exclusão de histórico e métodos ausentes (nivelamento/estação livre/irradiação, poligonal/compensação, volume/azimute astronômico, PTL/fator combinado, novos EPSG/formatos/algoritmos).

## Segurança e limpeza

O banco real permaneceu com **1.990.656 bytes**, data 2026-08-30 14:12:58 −03:00 e o mesmo SHA-256 antes/depois: `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`.

Foram removidas **20 raízes E2E falhas** próprias, a execução final limpou sua própria raiz, o banco API foi removido no `finally` e o ambiente temporário dos oráculos foi excluído. Restaram 0 raízes marcadas da Sessão 10 e nenhum ambiente `QA-AUDIT-S10-20260913-oracles`. Permanecem somente evidências sanitizadas deste relatório.

## Riscos para a Sessão 11 — Relatórios

Retestar especialmente: PDF longo/multipágina e falha do loader, cancelamento/bloqueio de download, leitor de tela real, matriz 360–1440/200%/alto contraste, volume produtivo, concorrência multiprocesso SQLite, restart/upgrade Electron e manifesto de release. Relatórios também deve confirmar que não reutiliza resultados topográficos persistidos como se fossem recalculados ou certificados pelo backend.

## Recomendação

**Pode iniciar a Sessão 11 — Relatórios**, mantendo os bloqueios acima como riscos herdados. Em paralelo, **não publique** o instalador 1.0.4 atual até regenerar e revisar o manifesto de hashes pelo processo oficial de release.

## Entregáveis

- `MATRIZ-DE-COBERTURA.md` — 133 classificações reconciliadas.
- `ACHADOS.md` — 23 defeitos, causa/correção/reteste.
- `CADERNO-DE-ORACULOS.md` — valores completos, métodos e tolerâncias.
- `PROTOCOLO-DE-ARQUIVOS.md` — import/export/PDF e limpeza.
- `COMANDOS-E-RESULTADOS.md` — versões e resultados exatos.
- `ARQUIVOS-ALTERADOS.md` — relação do diff da sessão.
- `MELHORIAS-NAO-IMPLEMENTADAS.md` — backlog separado.
- `EVIDENCIAS.md` — índice das capturas, árvores, JSONs e arquivos.
