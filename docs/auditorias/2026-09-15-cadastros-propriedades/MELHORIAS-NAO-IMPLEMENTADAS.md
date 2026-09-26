# Melhorias não implementadas

| Melhoria | Benefício | Esforço | Risco | Decisão de produto? |
|---|---|---:|---:|---:|
| versão/ETag para catálogos | impede last-write-wins entre janelas | médio | médio | sim |
| versão/ETag para propriedade | detecta lost update em PATCH concorrente | médio | médio | sim |
| audit log de catálogos | trilha administrativa completa | médio | baixo | sim; Sessão 14 |
| resolução assistida de `propriedade_integridade_conflitos` | elimina conflitos legados sem perda automática | alto | alto | sim |
| busca por CCIR e ITR | localização operacional mais ampla | baixo | baixo | sim |
| busca/cliente/página na URL de Propriedades | deep link e histórico do navegador | médio | baixo | sim |
| índice FTS para alta cardinalidade | mantém busca responsiva em bases muito grandes | médio | médio | sim, após benchmark |
| campanha Windows com Narrator, alto contraste, zoom 200%, offline e lock | fecha bloqueios de evidência desktop | médio | baixo | não para teste; sim se surgir correção de produto |
| restauração/undo de catálogo ou propriedade | recuperação operacional | alto | alto | sim; fora do escopo atual |

Nenhuma dessas melhorias foi implementada porque amplia contrato, produto ou política além de uma correção comprovada e mínima.
