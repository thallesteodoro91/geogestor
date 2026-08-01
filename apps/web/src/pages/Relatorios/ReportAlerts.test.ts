import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reportAlertCopy } from './reportAlertCopy';

describe('reportAlertCopy', () => {
  it('formata valores e pluraliza parâmetros estruturados', () => {
    assert.match(reportAlertCopy({
      id: 'receita',
      code: 'overdue_revenue',
      severity: 'critical',
      href: '/financeiro',
      valueCents: 123456
    }).description, /R\$\s?1\.234,56/);
    assert.match(reportAlertCopy({
      id: 'projeto',
      code: 'overdue_projects',
      severity: 'critical',
      href: '/projetos',
      count: 1
    }).description, /1 projeto ativo ultrapassou/);
  });
});
