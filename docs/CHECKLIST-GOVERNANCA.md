# Checklist preventivo do GeoGestor

Use antes de concluir uma alteração ou iniciar a geração de um instalador.

- [ ] A nova página está declarada em `APP_ROUTES`?
- [ ] O link interno usa `APP_ROUTES`, `APP_PATHS`, `appLinks` ou `withAppQuery`?
- [ ] A baseline de links internos permaneceu igual ou diminuiu, sem nova assinatura literal?
- [ ] Qualquer alteração excepcional da baseline possui revisão, total e justificativa explícita?
- [ ] A rota possui teste de destino, estado e parâmetros relevantes?
- [ ] Títulos, menus, Ajuda e nomes acessíveis usam a nomenclatura atual?
- [ ] Um alias novo possui justificativa, teste, destino canônico e condição de retirada?
- [ ] Um endpoint compatível ou campo legado foi registrado em `governance/compatibility-registry.json`?
- [ ] Foi verificado se já existe componente, serviço, tipo ou formatador equivalente?
- [ ] Um recurso visual novo possui consumidor comprovável?
- [ ] O teste ou build cria arquivos temporários em uma raiz exclusiva e marcada?
- [ ] A limpeza alcança somente arquivos criados pela própria execução?
- [ ] A versão da raiz, API, desktop e Ajuda continua sincronizada?
- [ ] `data`, backups reais, WAL/SHM e migrações permanecem fora do alcance?
- [ ] Foco, teclado, contraste, responsividade e movimento reduzido continuam preservados?
- [ ] `pnpm governance:check` passou durante o desenvolvimento?
- [ ] `pnpm governance:verify` passou antes do candidato final?

## Comandos

- `pnpm governance:check`: barreiras estáticas rápidas e diagnósticos não destrutivos.
- `pnpm governance:test`: testes das políticas de governança e caminhos temporários.
- `pnpm governance:verify`: tipagem, testes, E2E completo, limpeza da execução aprovada e integridade do diff.
- `pnpm e2e:cleanup:preview`: lista apenas execuções E2E com propriedade comprovada e nunca remove arquivos.

O comando completo não empacota, instala, assina ou publica o GeoGestor.
