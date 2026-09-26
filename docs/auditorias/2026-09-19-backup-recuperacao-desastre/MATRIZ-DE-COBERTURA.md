# Matriz de cobertura

Legenda: `APROVADO`, `APROVADO APÓS CORREÇÃO`, `BLOQUEADO`.

| ID | Controle/cenário | Nível | Resultado | Evidência principal |
|---|---|---:|---|---|
| B01 | Documentos obrigatórios e linha de base | A | APROVADO | leitura integral e reconciliação documental |
| B02 | Inventário sanitizado de perfis, bancos, backups e processos | A | APROVADO | metadados somente leitura, sem conteúdo |
| B03 | Formatos 1–4 e formato atual condicionado à recuperação portátil | A/B | APROVADO | integração e código |
| B04 | Endpoints, Electron IPC, serviços e workers | A | APROVADO | rastreabilidade estática |
| B05 | Menu, indicador global e deep link/foco | A | APROVADO | E2E 5/5 |
| B06 | Estados de proteção e prioridade de falha/checksum | A | APROVADO | testes de status 8/8 |
| B07 | Política: schema estrito, limites e persistência | A/B | APROVADO | API completa e typecheck |
| B08 | Teclado, alvo 44 px, reflow e claro/escuro | A | APROVADO | E2E + axe |
| B09 | CSV/histórico completo contra todos os estados e lentidão | A | BLOQUEADO | sem percurso manual completo nesta execução |
| B10 | Ajuda e `/pos-atualizacao` coerentes | A | APROVADO | testes web e inspeção |
| B11 | Preflight de banco/documentos/espaço | B | APROVADO | API e integração |
| B12 | Recusa de sobreposição backup/documentos | B | APROVADO | serviço de política |
| B13 | Prova de escrita e remoção do arquivo temporário | B | APROVADO | serviço + testes API |
| B14 | Unidade removível, rede e sincronizador reais | B/D | BLOQUEADO | hardware/provedor não autorizados |
| B15 | Corrida de espaço entre preflight e execução | D | BLOQUEADO | exige volume descartável controlável |
| B16 | Criação somente do banco | B | APROVADO | bundle v3, um arquivo de banco |
| B17 | Snapshot coerente e validação SQLite | B | APROVADO | clone protegido, quick/FK/schema |
| B18 | Exclusão de credenciais sem perda operacional | B | APROVADO | credenciais sintéticas nulas após restauração |
| B19 | Atomicidade, inventário físico e arquivo extra | B/C | APROVADO APÓS CORREÇÃO | A19-04 |
| B20 | Exclusão mútua/cancelamento seguro | B | APROVADO | coordinator/operações e testes |
| B21 | Backup de banco não limpa pendência de documento | B | APROVADO | atividade/status |
| B22 | Completo contém banco e documentos autorizados | B | APROVADO | hashes e reconciliação |
| B23 | Raiz de documentos ausente | B | APROVADO APÓS CORREÇÃO | A19-01 |
| B24 | Link/reparse point não é seguido/omitido silenciosamente | B | APROVADO | enumeração estrita |
| B25 | Arquivo mudando/bloqueado/permissão negada em Windows real | B/D | BLOQUEADO | sem volume físico descartável |
| B26 | Matriz completa de grandes, Unicode, extensão e nomes longos | B | BLOQUEADO | fixture final cobriu conteúdo acentuado, não toda a matriz |
| B27 | Mutação durante backup permanece pendente | B | APROVADO | teste dedicado |
| B28 | Scheduler, intervalos, timezone e estado separado | B | APROVADO | testes do scheduler |
| B29 | Startup e reavaliação de pendência no shutdown | B | APROVADO | testes scheduler/Electron |
| B30 | Aviso real de encerramento e fechar Windows | C/D | BLOQUEADO | requer aplicativo instalado |
| B31 | Retenção em 25 versões controladas | B | APROVADO APÓS CORREÇÃO | A19-03; teste 4/4 |
| B32 | PENDING/corrompido/legado preservados | B | APROVADO | retenção final |
| B33 | Limite por tamanho físico | B | APROVADO APÓS CORREÇÃO | A19-03 |
| B34 | Código `GG-R1`, envelopes e kit scrypt/AES-GCM | B/C | APROVADO | testes recovery/session |
| B35 | Senha administrativa e rate limit uniforme | B | APROVADO | integração auth |
| B36 | Confirmação persistente do kit no Electron | B | APROVADO | Electron 18/18 |
| B37 | Sessão opaca, TTL e uso único | B/C | APROVADO | testes de sessão |
| B38 | Checksum/tamanho/tag/envelope e chave errada | C | APROVADO | integração/recovery |
| B39 | Schema futuro e `.db` legado recusados | C | APROVADO | integração |
| B40 | Mesmo bundle entre teste e restore | C | APROVADO APÓS CORREÇÃO | A19-02; fingerprint em duas etapas |
| B41 | Path traversal e contenção física | C | APROVADO | validação + testes de arquivos |
| B42 | Teste isolado reconcilia banco/documento | C | APROVADO | 4,355 s |
| B43 | Limpeza da área temporária | C | APROVADO | `temporaryDataRemoved` + runner |
| B44 | Restauração e reinício do aplicativo instalado A | C | BLOQUEADO | nenhum candidato limpo/VM |
| B45 | Outro perfil/equipamento B por código e kit | C | BLOQUEADO | código simulado passou; físico/kit pós-reinício pendente |
| B46 | Rollback após instalar documentos | C | APROVADO | falha injetada, bytes e documento anteriores restaurados |
| B47 | Energia, disco cheio, remoção, update malsucedido | D | BLOQUEADO | sem VM snapshot externo |
| B48 | Token, CORS, loopback e modo não gerenciado | A/B | APROVADO | API completa e bloqueios de release |
| B49 | WCAG automatizada, teclado, foco e reduced motion | A | APROVADO | web 202/202 + E2E |
| B50 | NVDA, Narrator e alto contraste Windows real | C | BLOQUEADO | ensaio humano necessário |
| B51 | Carga prolongada, milhares de arquivos e handles | B/C | BLOQUEADO | benchmark específico não executado |
| B52 | Instalação/update/desinstalação do mesmo hash | C/D | BLOQUEADO | worktree sujo; sem candidato |

Totais: **36 APROVADO, 4 APROVADO APÓS CORREÇÃO, 12 BLOQUEADO**.
