# Matriz de cobertura

Legenda: **Aprovado**, **Aprovado após correção**, **Bloqueado**, **Não aplicável**. Não houve item `Reprovado pendente`.

| ID | Rota/seção/ferramenta | Risco | Contrato e persistência | Situação |
|---|---|---:|---|---|
| C01 | Configurações — carregamento e rota direta | A | UI + APIs de configuração | Aprovado |
| C02 | Configurações — nove seções | A | `secao=` e painel correspondente | Aprovado |
| C03 | Configurações — `foco=` e URL | A | foco contextual, scroll e URL | Aprovado |
| C04 | Configurações — busca interna | A | título, descrição, teclado e destino | Aprovado |
| C05 | Configurações — formulário sujo | A | permanecer, descartar e salvar | Aprovado |
| C06 | Configuração inicial | C | perfil/banco descartáveis e redirecionamento | Aprovado |
| C07 | Empresa — campos e validação | A | `PATCH /api/configuracoes`, SQLite | Aprovado |
| C08 | Empresa — dados + logo atômicos | B | configuração + modelo na mesma transação | Aprovado após correção |
| C09 | Empresa — logos app/PDF separados | A | configuração operacional/cache | Aprovado |
| C10 | Empresa — resposta sem segredos | A | DTO sanitizado | Aprovado |
| C11 | Arquivos — caminho e abertura | A | caminho absoluto/Electron | Aprovado |
| C12 | Arquivos — preflight copy/move/use | B | FS descartável + operação/histórico | Aprovado |
| C13 | Operações perigosas — confirmação literal | C | diretório, restauração e reset | Aprovado após correção |
| C14 | Arquivos — conflito, checksum e rollback | C | árvore sintética descartável | Aprovado |
| C15 | Segurança — ativar/desativar/trocar senha | B | hash, política e sessão local | Aprovado |
| C16 | Segurança — tentativa incorreta/rate limit | B | autorização local | Aprovado |
| C17 | Segurança — mensagem não promete SQLCipher | A | contrato/cópia da UI | Aprovado |
| C18 | Alertas — nove categorias e persistência | A | configuração + consumidores imediatos | Aprovado |
| C19 | Alertas — entrega nativa do SO | B | Electron + permissão real do Windows | Bloqueado |
| C20 | Modelos — identidade de PDF | A | logo, cores, termos e PDF | Aprovado |
| C21 | Modelos — checklist CRUD/cópia/aplicação | B | SQLite + Tarefas/Projetos | Aprovado |
| C22 | Google — segredo/status/OAuth local | B | cofre, flags e estado de uso único | Aprovado |
| C23 | Google — autenticação/sync externa | B | conta e agenda QA autorizadas | Bloqueado |
| C24 | Aparência — claro/escuro/persistência | A | tema e preferência | Aprovado |
| C25 | Backup — banco, manifesto e checksum | B | bundle descartável + histórico | Aprovado |
| C26 | Backup — completo e árvore de arquivos | B | DB + documentos sintéticos | Aprovado |
| C27 | Backup — retenção e estados | B | recentes/diários/mensais | Aprovado |
| C28 | Backup — teste de restauração | C | autorização e bundle isolado | Aprovado |
| C29 | Backup — restauração real isolada | C | integração em instalação descartável | Aprovado |
| C30 | Backup — corrupção/schema/manifesto | C | bundles sintéticos adulterados | Aprovado |
| C31 | Recuperação — código/kit sem exposição | C | scrypt + AES-256-GCM | Aprovado |
| C32 | Recuperação — reinício do app instalado | C | pacote instalado e sessão física | Bloqueado |
| C33 | Manutenção — saúde/diagnóstico sanitizado | A | `/api/sistema/diagnostico` | Aprovado |
| C34 | Manutenção — histórico operacional/CSV | A | operações, ordem e limites | Aprovado |
| C35 | Manutenção — exclusão mútua | C | backup/restauro/migração/reset | Aprovado |
| C36 | Manutenção — reset e backup prévio | C | instância descartável | Aprovado |
| C37 | Manutenção — falha injetada/rollback | C | transação descartável | Aprovado |
| C38 | Manutenção — recuperação pós-reset | C | snapshot descartável | Aprovado |
| C39 | Importação simples — CSV | B | Clientes/Projetos/Contatos | Aprovado |
| C40 | Importação simples — XLSX | B | abas, cabeçalhos e tipos | Aprovado |
| C41 | Importação — automapeamento/manual | B | preview e campos obrigatórios | Aprovado |
| C42 | Importação — limites e arquivos inválidos | B | 500/501 e contrato global | Aprovado |
| C43 | Importação — parcial/zero sucesso | B | linhas, status e erros CSV | Aprovado |
| C44 | Importação — idempotência/replay | B | `Idempotency-Key` | Aprovado |
| C45 | Importação — concorrência | B | uma execução/um resultado | Aprovado |
| C46 | Importação — falha de auditoria/rollback | C | transação integral | Aprovado |
| C47 | Migração completa — prévia/reconciliação | C | digest, uso único e centavos | Aprovado |
| C48 | Esquemas — cache ausente/corrompido | B | SQLite autoritativo + `localStorage` | Aprovado após correção |
| C49 | Esquemas — persistência/busca/exclusão | B | configuração operacional e reload | Aprovado |
| C50 | Esquemas — aplicar/editar/renomear | A | recursos não oferecidos no contrato atual | Não aplicável |
| C51 | Qualidade — códigos e severidade | C | fixtures isoladas, até 200 amostras | Aprovado |
| C52 | Qualidade — filtros e CSV/PDF | A | módulo/gravidade/cliente | Aprovado |
| C53 | Qualidade — somente leitura | A | ausência de mutação | Aprovado |
| C54 | Pós-atualização — saúde/qualidade/backup | A | três APIs e precedência | Aprovado |
| C55 | Auditoria — paginação/filtros/totais | A | `GET /api/audit-logs` | Aprovado |
| C56 | Auditoria — DELETE e exclusão lógica | A | banco/API/UI | Aprovado |
| C57 | Auditoria — legado/JSON/sanitização | B | duas rotas de leitura | Aprovado após correção |
| C58 | Auditoria — texto/data/usuário/exportação | A | recursos ausentes do contrato atual | Não aplicável |
| C59 | Acessibilidade automatizada | A | axe nas rotas/seções | Aprovado |
| C60 | Teclado, foco e reflow automatizados | A | 360/768/1024/1440 e controles | Aprovado |
| C61 | Narrator, alto contraste e zoom 200% reais | A | recursos físicos do Windows | Bloqueado |
| C62 | Offline/reconexão e lock SQLite reais | C | falha física controlada | Bloqueado |
| C63 | Versão app/API/web/desktop | A | 1.0.4; web 0.0.0 interno | Aprovado |
| C64 | Candidato de release/manifesto | C | `release:verify-candidate` | Bloqueado |
| C65 | Regressão financeira herdada | C | suíte API completa | Bloqueado |
| C66 | Concorrência otimista de catálogos/propriedades | B | versionamento ausente | Bloqueado |

## Contagem final

| Situação | Quantidade |
|---|---:|
| Aprovado | 52 |
| Aprovado após correção | 4 |
| Reprovado pendente | 0 |
| Bloqueado | 8 |
| Não aplicável | 2 |
| **Total** | **66** |

Os registros agrupam combinações positivo/negativo/vazio/limite/erro/retry/concorrência quando pertencem ao mesmo contrato. Detalhes de endpoints, persistência, oráculos e limpeza estão nos documentos adjacentes.
