# Caderno de oráculos

| Invariante | Oráculo independente | Resultado |
|---|---|---|
| Mesma instância | PID/porta/caminho absoluto + diretório exclusivo do run | Aprovado nos ambientes executados |
| Sem segredos em resposta/log/auditoria | busca por sentinelas e asserções negativas | Aprovado |
| Empresa e logo atômicos | ler configuração e modelo após falha/sucesso | Aprovado após A14-01 |
| Operação longa terminal | histórico/status após sucesso/falha/reload | Aprovado em integração |
| Sem commit parcial | contagem/valores antes e depois da falha injetada | Aprovado |
| Persistência | reload + nova leitura da API/SQLite/cache | Aprovado; reinício instalado bloqueado |
| Confirmação exata | ação desabilitada para caixa/espaço divergentes | Aprovado após A14-02 |
| Auditoria não quebra rollback | falha injetada e comparação do estado | Aprovado |
| Cache não supera SQLite | cache inválido + carregamento autoritativo | Aprovado após A14-04 |
| Idempotência | mesma chave/payload, chave/payload divergente e concorrência | Aprovado |
| pt-BR/Unicode/Windows | fixtures com acentos, datas e caminhos Windows | Aprovado |
| Qualidade somente leitura | contagens/hash antes/depois das consultas | Aprovado em fixture |
| Backup recuperável | manifesto + checksum + restore test + comparação | Aprovado em fixture |
| Regressão sem nova falha | comparar suíte final com baseline herdado | Aprovado: mesma única falha financeira |

## Oráculos específicos

- **Valores financeiros:** inteiros em centavos; nunca comparação de string formatada.
- **Árvore de arquivos:** quantidade, bytes, caminho relativo e checksum; symlink/reparse não pode escapar da raiz.
- **Auditoria:** total filtrado pertence ao conjunto completo, não à página; `before`/`after` sanitizados antes da resposta.
- **Pós-atualização:** crítico prevalece sobre aviso; saúde, qualidade e backup são fontes independentes.
- **Release:** tamanho e SHA do artefato devem coincidir com o manifesto; existência do instalador não basta.
