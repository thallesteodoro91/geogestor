# Relatório de reauditoria — Sessão 06: Ambiental

**Período:** 14/09/2026, 19:35–19:53 (UTC−03:00)  
**Versão:** GeoGestor 1.0.4; branch `main`; commit-base `a16551a8b63e73f42d826297df893488e5ab88ca`  
**Escopo:** demandas ambientais, perícias, licenças, condicionantes, alertas, Análise CAR, histórico, PDFs, API, SQLite e pacote desktop  
**Resultado:** **APROVADO COM RESSALVAS**

## 1. Resultado executivo

A reauditoria confirmou o fechamento integral da matriz da Sessão 06 e não encontrou regressão de produto. Os **152 critérios** estão assim distribuídos:

| Situação | Quantidade |
|---|---:|
| APROVADO | 94 |
| APROVADO APÓS CORREÇÃO | 44 |
| REPROVADO | 0 |
| BLOQUEADO | 9 |
| NÃO APLICÁVEL | 5 |
| **Total** | **152** |

Os 18 defeitos históricos — **0 P0, 6 P1, 12 P2 e 0 P3** — permanecem corrigidos. A rodada atual encontrou somente um falso positivo do próprio E2E: a varredura Axe começava durante a animação de saída do modal CAR. O teste passou a aguardar a desmontagem do `dialog`; repetido, fechou em 5/5 e zero violações. Não houve alteração de código de produção nesta reauditoria.

## 2. Base auditada e isolamento

Foram lidos integralmente os relatórios das Sessões 01–05 e o dossiê Ambiental anterior. A árvore já estava suja por trabalhos de outras sessões; nada foi revertido nem atribuído indevidamente a esta rodada. A campanha usou prefixo `QA-AUDIT-S06-20260914-`, portas aleatórias, perfil, downloads e bancos temporários.

O banco real `data/geogestor.db` tinha e manteve 1.990.656 bytes, modificação em 30/08/2026 14:12:58 e SHA-256 `BBA88E06D9EE745787469319E0AAD6CF4434776EF14DCCD27FE694815FA89471`. Nenhum dado real foi alterado.

## 3. Cobertura funcional

Foram exercitados `/ambiental`, suas três abas e as rotas de detalhe; estado vazio, falha 500 e recuperação; criação e leitura de demanda/perícia; fase, andamento, histórico e próxima ação; quatro modelos de laudo; licenças LP/LI/LO/Renovação/Outros; filtros e fronteiras de −1/0/30/60/90/120/121 dias; condicionantes, cumprimento, contadores, alertas e deep link; Análise CAR, validações, salvamento e histórico.

As integrações focadas confirmaram contratos estritos, soft delete, vínculos ativos, prevenção de órfãos, status registrado versus efetivo, datas civis locais, atomicidade e auditoria. Texto adversarial foi tratado como conteúdo; UUIDs, datas impossíveis, payload extra e vínculos cruzados foram rejeitados.

## 4. CAR e base normativa

A memória independente confirmou as referências de Reserva Legal do art. 12 para imóvel de 100 ha: 80 ha em floresta da Amazônia Legal, 35 ha em cerrado, 20 ha em campos gerais e 20 ha nas demais regiões. O art. 15 somente computa APP quando as três condições declaradas estão satisfeitas; os arts. 67 e 68 são apresentados como triagem dependente de enquadramento e prova, jamais como regularidade automática.

As fontes oficiais foram reabertas em 14/09/2026: Lei nº 12.651/2012 compilada, páginas institucionais do CAR e da regularização ambiental e IN MMA nº 2/2014. Detalhes e contas reproduzíveis estão em [FONTES-NORMATIVAS.md](./FONTES-NORMATIVAS.md) e [CALCULOS-CAR.md](./CALCULOS-CAR.md).

## 5. Evidência técnica

| Camada | Resultado atual |
|---|---|
| API completa | 185/185; 0 falhas; 120.458,393 ms |
| Web completa | 192/192; 0 falhas; 2.429,2381 ms |
| Electron | 18/18; 0 falhas; 207,4819 ms |
| API focada S06 | 1/1; 0 falhas; ~21,2 s |
| CAR/PDF focado | 8/8; 0 falhas; 157,5757 ms |
| E2E S06 final | 5/5; ~1,1 min |
| Axe | zero violação nas jornadas finais |
| Lint / typecheck | aprovados |
| `git diff --check` | aprovado; apenas avisos LF/CRLF preexistentes |
| Build completo | aprovado após repetir fora do sandbox |
| Smoke do pacote | aprovado |

O primeiro `pnpm build` não conseguiu atravessar a raiz do sandbox e falhou com `Access is denied`/arquivos não resolvidos. O mesmo comando fora dessa restrição gerou API, web, Electron, NSIS e blockmap sem erro; portanto, a ocorrência foi classificada como limitação do ambiente de auditoria, não defeito do produto.

O instalador reconstruído é `apps/desktop/dist/GeoGestor Setup 1.0.4.exe`, 89.964.915 bytes, SHA-256 `68B56170E47923D1ABA28C6492793F4EDC4B510E0BE96FA98744881E83BD455E`. O smoke comprovou inicialização sem senha, bloqueio local, banco criptografado e ausência de segredos expostos.

## 6. Inspeção das evidências

As cinco capturas foram abertas em resolução original. A jornada desktop mostrou estado vazio, detalhe com histórico, fronteira de licença em 30 dias e condicionante localizada por deep link; a captura de 360 px mostrou validação CAR sem rolagem horizontal da página. Os quatro PDFs são válidos, A4, uma página, não criptografados, texto extraível e contêm os títulos e dados sintéticos esperados. Eles não possuem estrutura de tags PDF; isso não impede o aceite funcional, mas permanece uma oportunidade de acessibilidade documental.

Hashes, tamanhos e finalidade estão em [evidencias/README.md](./evidencias/README.md).

## 7. Persistência, auditoria e limpeza

Os testes usaram bancos descartáveis e verificaram contagens/estado SQLite e `audit_logs`. A limpeza removeu três resíduos da execução — um snapshot de linha de base, um diretório da integração focada e uma execução E2E falha — além do diretório criado apenas para renderizar os PDFs. A execução E2E aprovada já havia sido removida pelo runner. A verificação final retornou `RemainingCurrentSession=0`; evidências sintéticas sob `docs/auditorias/2026-09-14-ambiental/evidencias` foram deliberadamente preservadas.

## 8. Ressalvas e riscos residuais

Permanecem bloqueados por falta de ambiente apropriado: desconexão nativa; impressão física; massa de milhares de licenças; concorrência multiprocesso; virada real de meia-noite; leitor de tela real; matriz visual completa em mais larguras/zoom/tema escuro; estresse de lock SQLite; upgrade sobre instalação anterior. São nove verificações identificadas, não resultados presumidos.

Melhorias não implementadas: paginação/virtualização das licenças, relógio injetável, reabertura detalhada de cálculo salvo, memória CAR exportável, comprovante estruturado de condicionante e geração de PDF com tags semânticas.

## 9. Arquivo alterado na rodada atual

Somente `tests/e2e/session06-environmental.spec.ts`: prefixo e diretório de evidência configuráveis por ambiente, expectativa do nome do PDF vinculada ao prefixo e espera explícita pela desmontagem do modal antes do Axe. Os arquivos de produção e testes ambientais já presentes na árvore vieram da auditoria anterior e foram apenas retestados.

## 10. Conclusão

Não há P0/P1 aberto nem critério reprovado. A Sessão 06 está apta para continuidade, com as nove validações dependentes de ambiente registradas como dívida pré-release. A recomendação permanece **seguir para a Sessão 07 — Financeiro**.

Consulte [MATRIZ-DE-COBERTURA.md](./MATRIZ-DE-COBERTURA.md), [ACHADOS.md](./ACHADOS.md) e [COMANDOS-E-RESULTADOS.md](./COMANDOS-E-RESULTADOS.md).
