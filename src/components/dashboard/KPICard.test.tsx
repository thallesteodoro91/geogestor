import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { KPICard } from './KPICard';
import { DollarSign } from 'lucide-react';

describe('KPICard', () => {
  it('deve renderizar titulo e valor corretamente', () => {
    const { getByText } = render(
      <KPICard
        title="Receita"
        value="R$ 1.000,00"
        icon={DollarSign}
      />
    );
    
    expect(getByText('Receita')).toBeTruthy();
    expect(getByText('R$ 1.000,00')).toBeTruthy();
  });

  it('deve renderizar o icone do KPI', () => {
    const { container } = render(
      <KPICard
        title="Receita"
        value="R$ 1.000,00"
        icon={DollarSign}
      />
    );
    
    // Verifica que existe um SVG (icone Lucide) renderizado
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeTruthy();
  });

  it('deve renderizar variacao positiva com estilo verde', () => {
    const { getByText } = render(
      <KPICard
        title="Receita"
        value="R$ 1.000,00"
        change="+ 15%"
        changeType="positive"
        icon={DollarSign}
      />
    );
    
    // Verifica o texto da variacao (sem o sinal de +)
    const changeText = getByText('15%');
    expect(changeText).toBeTruthy();
    
    // Verifica que o container tem a classe de cor verde (accent)
    const badge = changeText.closest('div');
    expect(badge?.className).toContain('text-accent');
    expect(badge?.className).toContain('bg-accent/10');
  });

  it('deve renderizar variacao negativa com estilo vermelho', () => {
    const { getByText } = render(
      <KPICard
        title="Despesas"
        value="R$ 500,00"
        change="- 10%"
        changeType="negative"
        icon={DollarSign}
      />
    );
    
    // Verifica o texto da variacao (sem o sinal de -)
    const changeText = getByText('10%');
    expect(changeText).toBeTruthy();
    
    // Verifica que o container tem a classe de cor vermelha (destructive)
    const badge = changeText.closest('div');
    expect(badge?.className).toContain('text-destructive');
    expect(badge?.className).toContain('bg-destructive/10');
  });

  it('deve renderizar variacao neutra sem icone de tendencia especial', () => {
    const { getByText } = render(
      <KPICard
        title="Saldo"
        value="R$ 0,00"
        change="0%"
        changeType="neutral"
        icon={DollarSign}
      />
    );
    
    // Verifica o texto da variacao
    const changeText = getByText('0%');
    expect(changeText).toBeTruthy();
    
    // Verifica que o container tem a classe de cor neutra (muted)
    const badge = changeText.closest('div');
    expect(badge?.className).toContain('text-muted-foreground');
    expect(badge?.className).toContain('bg-muted/10');
  });

  it('nao deve renderizar badge quando change nao e fornecido', () => {
    const { getByText, queryByText } = render(
      <KPICard
        title="Total"
        value="100"
        icon={DollarSign}
      />
    );
    
    // Apenas titulo e valor devem estar presentes
    expect(getByText('Total')).toBeTruthy();
    expect(getByText('100')).toBeTruthy();
    
    // Nao deve haver texto de porcentagem (badge nao renderizado)
    expect(queryByText('%')).toBeNull();
    expect(queryByText('0%')).toBeNull();
  });

  it('deve remover sinais de + e - do texto de variacao', () => {
    const { getByText, queryByText } = render(
      <KPICard
        title="Lucro"
        value="R$ 2.000,00"
        change="+25%"
        changeType="positive"
        icon={DollarSign}
      />
    );
    
    // O sinal de + deve ser removido do texto exibido
    expect(getByText('25%')).toBeTruthy();
    expect(queryByText('+25%')).toBeNull();
  });
});
