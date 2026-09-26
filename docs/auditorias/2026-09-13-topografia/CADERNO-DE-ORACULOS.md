# Caderno de oráculos — Sessão 10

## Referências e política

Oráculos independentes executados em Python 3.12.14: **pyproj 3.7.2 / PROJ 9.5.1**, **GeographicLib 2.1** e **Shapely 2.1.2**. As fórmulas manuais de GMS, Gauss, Euclides, conversões SI e quadrantes cardeais formaram a segunda referência independente para os casos simples. O GeoGestor usa proj4 2.21.0 e geographiclib-geodesic 2.2.0; portanto, a implementação de produção não foi usada como único oráculo.

- Política de eixos do oráculo: `always_xy=True`, isto é, longitude/Este antes de latitude/Norte.
- SIRGAS 2000: EPSG:4674, elipsoide GRS 1980 (`a=6378137 m`, `1/f=298.257222101`).
- Projetado principal: EPSG:31982, SIRGAS 2000 / UTM 22S, X=Este e Y=Norte em metros.
- Tolerância computacional de projeção/round-trip: `1×10⁻⁶ m` e `1×10⁻¹⁰°`.
- Distâncias geodésicas: `1×10⁻⁶ m`, exceto quase coincidência (`1×10⁻⁶ m`) e apresentação da UI (`0,01 m` ou `0,001 km`).
- Azimutes: `1×10⁻⁹°`; quase coincidência, onde o rumo é numericamente condicionado, `0,001°`. UI: `0,01°`.
- Áreas: absoluta `1×10⁻⁴ m²`; apresentação: `0,01 m²`, `0,0001 ha` e `0,0001 km²` conforme escala.
- Convergência: `1×10⁻⁵°`; fator de escala: `1×10⁻⁹`. Essas tolerâncias são menores que a apresentação.

## Casos independentes principais

| Família | Entrada / método | Resultado independente | Resultado GeoGestor / desvio | Situação |
|---|---|---|---|---|
| GMS manual | −27,5945° | 27°35′40,2″ S | Round-trip normalizado; sem 60″ | APROVADO APÓS CORREÇÃO |
| Projeção Florianópolis | lon −48,54822°, lat −27,59487°, EPSG:4674→31982 | X 742003,210469342 m; Y 6945275,21488603 m | 6,98×10⁻¹⁰ m; 9,31×10⁻¹⁰ m | APROVADO |
| Round-trip | EPSG:31982→4674 | erro lat 3,55×10⁻¹⁵° | lat 3,55×10⁻¹⁵°; lon 7,11×10⁻¹⁵° | APROVADO |
| WGS 84 Sul | EPSG:4326→32722 | X 742003,210468489; Y 6945275,214796459 | Dentro de 1 µm | APROVADO |
| SIRGAS Norte | Boa Vista, EPSG:4674→31974 | X 758384,404168275; Y 312342,381115734 | Round-trip 4,44×10⁻¹⁶° | APROVADO |
| Borda de fuso/Equador | −54,000001°/−0,000001° e −54°/+0,000001° | fusos contíguos; coordenadas finitas | Sugestão de fuso corrigida | APROVADO APÓS CORREÇÃO |
| Metadados UTM | Florianópolis EPSG:31982 | convergência −1,136258829477666°; escala 1,0003229671041056 | desvios 8,6860×10⁻⁶° e 3,7574×10⁻¹² | APROVADO APÓS CORREÇÃO |
| São Paulo→Rio | GRS80/Karney | 361260,8611460836 m; 79,305445859348° | 0 m; 2,84×10⁻¹⁴° | APROVADO |
| Rio→São Paulo | GRS80/Karney | 361260,8611460836 m; 257,9402850116214° | Distância simétrica; azimute distinto | APROVADO |
| Coincidente | mesmo ponto | 0 m; azimute nulo/indeterminado | 0 m; texto explícito | APROVADO APÓS CORREÇÃO |
| Quase coincidente | separação ~0,148 mm | 0,000148413758563 m; 41,6991220995° | 2,64×10⁻¹⁰ m; 9,07×10⁻⁵° | APROVADO |
| Quase antípoda | Karney/GRS80 | 20003920,40011045 m; 0,00950022845° | desvio 0 m; 8,94×10⁻¹⁵° | APROVADO |
| Antimeridiano | 179,9°→−179,9° | 21927,8724779482 m; 89,982635165° | 3,64×10⁻¹² m; 2,84×10⁻¹⁴° | APROVADO |
| Segmento curto norte | ~10 m | 9,973165388999865 m; 0° | 3,53×10⁻¹⁰ m; 0° | APROVADO |
| Quadrado plano | 10×10 m, Gauss/Euclides | 100 m²; 40 m | 0; 0 | APROVADO |
| Retângulo | 20×5 m | 100 m²; 50 m | 0; 0 | APROVADO |
| Triângulo | catetos 10 m | 50 m²; 34,1421356237 m | 0; 0 | APROVADO |
| Irregular | Gauss/Euclides | 67,5 m²; 31,7845293819 m | 0; 0 | APROVADO |
| Polígono geográfico pequeno | GeographicLib/GRS80 | 10940,29728782177 m²; 419,0811109626364 m | 5,96×10⁻⁸ m²; 5,68×10⁻¹⁴ m | APROVADO |
| Polígono no antimeridiano | GeographicLib/GRS80 | 969868070,037529 m²; 131927,77540601 m | 0; 0 | APROVADO |

As versões invertidas dos polígonos plano, pequeno geográfico e antimeridiano produziram a mesma área absoluta e perímetro. As figuras simples também confirmaram `1 ha = 10.000 m²`, `1 km² = 1.000.000 m²` e `1 km = 1.000 m`.

## Reconciliação agregada

- Valores comparados automaticamente: **37**.
- Aprovações: **37/37**.
- Maior desvio numérico: **0,00009068593754335552°** no azimute quase coincidente, abaixo da tolerância especial de **0,001°** e do arredondamento visual de **0,01°**.
- Maior desvio de área: **5,960464477539063×10⁻⁸ m²**.
- Evidências brutas: `evidencias/oraculos-independentes.json` e `evidencias/comparacao-geogestor-oraculos.json`.

## Limite metodológico

Não foi operada a GUI do QGIS nem empregado ponto de controle oficial de campo. PROJ/pyproj, GeographicLib e cálculos manuais independentes cobrem os contratos matemáticos implementados, mas não substituem homologação geodésica ou responsabilidade técnica.
