

## Reordenacao da Tela de Configuracoes

### Criterios de Priorizacao

A reordenacao segue a logica de **frequencia de uso + impacto direto no usuario**:

- **Topo**: O que o usuario acessa/modifica com mais frequencia (perfil pessoal, aparencia)
- **Meio**: Configuracoes de empresa e equipe (importantes, mas definidas poucas vezes)
- **Base**: Ferramentas utilitarias e informacoes de referencia (uso esporadico)

### Nova Ordem Proposta

| Posicao | Card | Justificativa |
|---------|------|---------------|
| 1 | **Perfil do Usuario** | Configuracao mais pessoal e acessada com mais frequencia (nome, email, avatar) |
| 2 | **Aparencia** | Acao rapida (toggle de tema), usada com frequencia |
| 3 | **Informacoes da Empresa** (TenantSettingsCard) | Configuracao importante mas definida poucas vezes |
| 4 | **Plano e Assinatura** (PlanInfoCard) | Verificacao periodica de uso de recursos e status |
| 5 | **Gestao de Equipe** | Gerenciamento de membros e convites, uso periodico |
| 6 | **Template de Orcamento** | Configuracao especifica do fluxo de trabalho |
| 7 | **Dados e Backup** (Importacao/Exclusao) | Operacao utilitaria, uso esporadico |
| 8 | **Notificacoes** | Atualmente e um placeholder sem interatividade real |
| 9 | **Dados de Demonstracao** (admin) | Uso raro, apenas para testes |
| 10 | **Informacoes do Sistema** | Referencia pura, sem interacao, fica por ultimo |

### Detalhes Tecnicos

**Arquivo modificado:** `src/pages/Configuracoes.tsx`

Apenas reordenar os blocos JSX dentro do `<div className="grid gap-6">` (linhas 374-689). Nenhuma logica ou componente precisa ser alterado -- e apenas mover a posicao dos cards no render:

```text
Ordem dos blocos JSX:
1. Perfil do Usuario (Card inline, linhas 385-433)
2. Aparencia (Card inline, linhas 435-455)
3. TenantSettingsCard (componente, linha 375)
4. PlanInfoCard (componente, linhas 377-381)
5. TeamManagementSection (componente, linha 383)
6. Template de Orcamento (Card inline, linhas 478-569)
7. Dados e Backup (Card inline, linhas 619-662)
8. Notificacoes (Card inline, linhas 457-475)
9. Dados de Demonstracao (Card inline, admin, linhas 571-617)
10. Informacoes do Sistema (Card inline, linhas 664-688)
```

Nenhuma dependencia entre os cards -- todos sao independentes e podem ser movidos livremente.

