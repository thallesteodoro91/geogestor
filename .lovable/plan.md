

## Plano: Importação Unificada e Inteligente

### Diagnóstico

O sistema atual já possui um SmartImporter robusto com detecção automática de entidade, mapeamento por sinônimos e importação em lote. Os problemas reais são:

1. **Página ImportacaoDados força escolha prévia** — 5 cards separados obrigam o usuário a decidir o tipo antes de subir o arquivo, contrariando o fluxo natural
2. **Validação rígida demais** — latitude/longitude usa `validatePositiveNumber` (rejeita negativos, erro para coordenadas do Brasil), CPF/CNPJ falham com dados parciais, `validateRequiredNumber` rejeita valores com formatação brasileira
3. **Tolerância zero por padrão** — `skipErrors` começa false, bloqueando importação inteira se 1 linha falha
4. **Sem criação automática de entidades dependentes** — se planilha de orçamentos tem coluna "cliente", o sistema tenta vincular mas não cria clientes novos
5. **Detecção de entidade fraca** — threshold de 40% é baixo e não detecta planilhas mistas

### Mudanças

---

#### 1. Simplificar ImportacaoDados — Upload direto (sem cards)

Remover os 5 cards de seleção. A página passa a ter apenas a zona de upload + o SmartImporter. O tipo é detectado automaticamente após o upload.

**Arquivo:** `src/pages/ImportacaoDados.tsx`

---

#### 2. Corrigir validações críticas no SmartImporter

- `validatePositiveNumber` → `validateNumber` (aceitar negativos para lat/lng)
- Latitude: validação específica (-90 a 90)
- Longitude: validação específica (-180 a 180)
- CPF/CNPJ: tornar tolerante (aceitar parciais sem bloquear)
- Sanitizar moeda mais agressivamente (R$ 1.500,00 → 1500.00)
- Sanitizar datas: aceitar dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy e formatos Excel numéricos
- `skipErrors` default → `true` (importar válidos automaticamente)

**Arquivo:** `src/components/import/SmartImporter.tsx`

---

#### 3. Ampliar sinônimos de mapeamento

Adicionar variações comuns que usuários reais usam:
- "nome do cliente", "nome_cliente", "cliente_nome" → nome
- "telefone1", "tel1", "fone1" → telefone  
- "valor", "vlr", "preço" → valor_unitario/valor_da_despesa
- "dt", "data" (genérico) → data principal da entidade
- "prop", "propriedade", "fazenda", "lote" → nome_da_propriedade
- "obs", "observacao", "observações" → anotacoes/observacoes

**Arquivo:** `src/components/import/SmartImporter.tsx`

---

#### 4. Criação automática de clientes durante importação

Quando importar propriedades/serviços/orçamentos e a planilha tiver coluna "cliente":
- Se o nome bater com cliente existente → vincular por id
- Se não existir → criar automaticamente o cliente (só com nome) e vincular

Atualizar `linkToClients` para criar clientes inexistentes.

**Arquivo:** `src/components/import/SmartImporter.tsx`

---

#### 5. Melhorar feedback de erros

- Mostrar erro específico por célula no preview (já faz parcialmente)
- Adicionar tooltip nos campos com erro mostrando o valor original e o que era esperado
- Na tela de resultado, agrupar erros por tipo (ex: "5 datas inválidas, 3 valores vazios")

**Arquivo:** `src/components/import/SmartImporter.tsx`

---

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/pages/ImportacaoDados.tsx` |
| Editar | `src/components/import/SmartImporter.tsx` |

Nenhuma migração de banco necessária.

