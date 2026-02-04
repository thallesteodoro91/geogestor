

# Plano: Testes do Componente KPICard

## Objetivo
Criar testes de componentes React usando Vitest e React Testing Library para garantir a qualidade e comportamento correto do componente `KPICard`.

## Analise do Componente

O componente `KPICard` possui as seguintes props:

| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `title` | string | Sim | Titulo do KPI |
| `value` | string | Sim | Valor formatado do KPI |
| `change` | string | Nao | Variacao percentual |
| `changeType` | "positive" / "negative" / "neutral" | Nao (default: "neutral") | Tipo de variacao |
| `icon` | LucideIcon | Sim | Icone do KPI |

### Comportamentos a Testar

1. **Renderizacao basica**: Titulo e valor visiveis
2. **Variacao positiva**: Icone `TrendingUp` e estilo verde
3. **Variacao negativa**: Icone `TrendingDown` e estilo vermelho
4. **Variacao neutra**: Sem icone de tendencia
5. **Sem variacao**: Badge de variacao nao aparece quando `change` nao e passado

## Estrutura do Arquivo de Teste

```text
src/components/dashboard/KPICard.test.tsx
├── describe('KPICard')
│   ├── it('deve renderizar titulo e valor corretamente')
│   ├── it('deve renderizar icone do KPI')
│   ├── it('deve renderizar variacao positiva com icone TrendingUp')
│   ├── it('deve renderizar variacao negativa com icone TrendingDown')
│   ├── it('deve renderizar variacao neutra sem icone de tendencia')
│   └── it('nao deve renderizar badge quando change nao e fornecido')
```

## Detalhes Tecnicos

### Dependencias Utilizadas
- `vitest`: Framework de testes
- `@testing-library/react`: Utilitarios de renderizacao e queries
- `@testing-library/jest-dom`: Matchers customizados (toBeInTheDocument, etc.)

### Padrao de Testes (seguindo `finance.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPICard } from './KPICard';
import { DollarSign, TrendingUp } from 'lucide-react';

describe('KPICard', () => {
  it('deve renderizar titulo e valor corretamente', () => {
    render(
      <KPICard
        title="Receita"
        value="R$ 1.000,00"
        icon={DollarSign}
      />
    );
    
    expect(screen.getByText('Receita')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
  });
  
  // ... mais testes
});
```

### Verificacao de Icones

Para verificar a presenca de icones SVG do Lucide, usaremos `data-testid` ou queries por role:

```typescript
// TrendingUp aparece quando changeType="positive"
it('deve renderizar variacao positiva com icone TrendingUp', () => {
  render(
    <KPICard
      title="Receita"
      value="R$ 1.000,00"
      change="+ 15%"
      changeType="positive"
      icon={DollarSign}
    />
  );
  
  // Verifica o texto da variacao (sem o sinal)
  expect(screen.getByText('15%')).toBeInTheDocument();
  
  // Verifica que o container tem a classe de cor verde
  const badge = screen.getByText('15%').closest('div');
  expect(badge).toHaveClass('text-accent');
});
```

## Casos de Teste Detalhados

### 1. Renderizacao Basica
```typescript
it('deve renderizar titulo e valor corretamente', () => {
  render(<KPICard title="Receita" value="R$ 1.000,00" icon={DollarSign} />);
  
  expect(screen.getByText('Receita')).toBeInTheDocument();
  expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
});
```

### 2. Variacao Positiva
```typescript
it('deve renderizar variacao positiva com estilo verde', () => {
  render(
    <KPICard
      title="Receita"
      value="R$ 1.000,00"
      change="+ 15%"
      changeType="positive"
      icon={DollarSign}
    />
  );
  
  const changeText = screen.getByText('15%');
  expect(changeText).toBeInTheDocument();
  
  // Verifica estilo positivo
  const badge = changeText.closest('div');
  expect(badge).toHaveClass('text-accent');
  expect(badge).toHaveClass('bg-accent/10');
});
```

### 3. Variacao Negativa
```typescript
it('deve renderizar variacao negativa com estilo vermelho', () => {
  render(
    <KPICard
      title="Despesas"
      value="R$ 500,00"
      change="- 10%"
      changeType="negative"
      icon={DollarSign}
    />
  );
  
  const changeText = screen.getByText('10%');
  const badge = changeText.closest('div');
  expect(badge).toHaveClass('text-destructive');
});
```

### 4. Sem Variacao
```typescript
it('nao deve renderizar badge quando change nao e fornecido', () => {
  render(<KPICard title="Total" value="100" icon={DollarSign} />);
  
  // Apenas titulo e valor devem estar presentes
  expect(screen.getByText('Total')).toBeInTheDocument();
  expect(screen.getByText('100')).toBeInTheDocument();
  
  // Nao deve haver texto de porcentagem
  expect(screen.queryByText('%')).not.toBeInTheDocument();
});
```

## Arquivo a Criar

| Arquivo | Acao |
|---------|------|
| `src/components/dashboard/KPICard.test.tsx` | **Criar** - Testes do componente |

## Execucao dos Testes

Os testes serao executados automaticamente pelo Vitest. O setup ja esta configurado em:
- `vitest.config.ts`: Configuracao do Vitest com jsdom
- `src/test/setup.ts`: Extensao de matchers do jest-dom

## Beneficios

1. **Qualidade**: Garante que o componente funciona conforme esperado
2. **Regressao**: Detecta quebras em futuras alteracoes
3. **Documentacao**: Testes servem como documentacao viva do comportamento
4. **Confianca**: Permite refatoracoes seguras

