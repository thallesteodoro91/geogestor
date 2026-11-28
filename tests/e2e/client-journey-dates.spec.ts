import { test, expect, _electron as electron, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(240000);
const requireApi = createRequire(path.resolve('apps/api/package.json'));
const { createClient } = requireApi('@libsql/client');
const evidence = path.resolve('docs/auditorias/2026-10-13-jornada-datas/evidencias');
const apiOrigin = `http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const tabs = ['visao-geral', 'propriedades', 'servicos', 'ambiental', 'orcamentos', 'financeiro', 'arquivos'];
const tokens = new WeakMap<Page, string>();
const observedPages = new WeakSet<Page>();
const id = () => crypto.randomUUID();

async function seed() {
  const root = process.env.GEOGESTOR_E2E_ROOT;
  if (!root || !/^run-/.test(path.basename(root))) throw new Error('Banco isolado obrigatório');
  const db = createClient({ url: `file:${path.join(root, 'geogestor.db')}` });
  const client = id(), empty = id(), property = id(), project = id(), environmental = id(), budget = id(), parcel = id();
  try {
    await db.batch([
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao,email,celular,categoria,municipio,uf,anotacoes) values (?,?,'PF','Ativo','cliente@example.invalid','(48) 99999-0000','Produtor Rural','Florianópolis','SC',?)", args: [client, 'EXEMPLO FICTÍCIO — Cliente da central de acompanhamento ' + client.slice(0,4), 'Preferência fictícia: receber um registro resumido das atividades.'] },
      { sql: "insert into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')", args: [empty, 'EXEMPLO FICTÍCIO — Cliente sem registros'] },
      { sql: "insert into propriedades (id,cliente_id,nome,area_ha,matricula,car,municipio,uf,situacao_imovel) values (?,?,?,42.5,'MATRÍCULA-FICTÍCIA-001',?,'Florianópolis','SC','Em revisão documental')", args: [property, client, 'EXEMPLO FICTÍCIO — Fazenda das Araucárias com denominação extensa', 'PROTOCOLOFICTICIO'.repeat(10)] },
      { sql: "insert into projetos (id,cliente_id,propriedade_id,nome,tipo,status,data_inicio,data_entrega,descricao) values (?,?,?,?,'Topografia','Em Andamento','2026-09-01','2026-10-05',?)", args: [project, client, property, 'EXEMPLO FICTÍCIO — Levantamento planialtimétrico do imóvel rural', 'Levantamento fictício em preparação. Documentação recebida, próxima etapa a revisar com o cliente.'] },
      { sql: "insert into projetos (id,cliente_id,propriedade_id,nome,tipo,status,data_inicio,data_entrega,descricao) values (?,?,?,?,'Ambiental','Concluído','2026-09-02','2026-10-10',?)", args: [environmental, client, property, 'EXEMPLO FICTÍCIO — Acompanhamento do CAR com nome extenso', 'Acompanhamento documental fictício encerrado. Não representa aprovação do cadastro ambiental.'] },
      { sql: "insert into ambiental (id,projeto_id,cliente_id,propriedade_id,tipo_demanda,protocolo) values (?,?,?,?,'CAR','CAR-FICTÍCIO-001')", args: [id(), environmental, client, property] },
      { sql: "insert into licencas (id,projeto_id,cliente_id,numero,orgao,data_vencimento,status) values (?,?,?,'LICENÇA-FICTÍCIA-001','Órgão fictício','2026-10-05','Vencida')", args: [id(), project, client] },
      { sql: "insert into orcamentos (id,cliente_id,projeto_id,valor_total,status,codigo_orcamento,descricao,data_emissao,data_orcamento,created_at) values (?,?,?,500000,'aprovado','ORC-FICTÍCIO-001',?,'2026-09-10','2026-09-09','2026-09-01T12:00:00Z')", args: [budget, client, project, 'EXEMPLO FICTÍCIO — Escopo extenso para acompanhamento da execução e elaboração de produtos cartográficos.'] },
      { sql: "insert into orcamentos (id,cliente_id,valor_total,status,codigo_orcamento,descricao,created_at) values (?,?,150000,'rascunho','ORC-FICTÍCIO-002','EXEMPLO FICTÍCIO — Proposta ainda em elaboração','2026-09-16T12:00:00Z')", args: [id(), client] },
      { sql: "insert into parcelas (id,orcamento_id,valor,valor_pago,data_vencimento,status_pagamento) values (?,?,500000,200000,'2026-10-05','Pendente')", args: [parcel, budget] },
      { sql: "insert into recebimentos (id,parcela_id,valor_principal,valor_recebido,data_recebimento) values (?,?,200000,200000,'2026-09-15')", args: [id(), parcel] },
      { sql: "insert into despesas (id,cliente_id,projeto_id,descricao,valor,data,data_pagamento,categoria,status) values (?,?,?,'EXEMPLO FICTÍCIO — Deslocamento',50000,'2026-09-12','2026-09-12','Combustível','Pago')", args: [id(), client, project] },
      { sql: "insert into tarefas (id,cliente_id,projeto_id,titulo,status,prioridade,data_limite) values (?,?,?,'EXEMPLO FICTÍCIO — Conferir documentação','A Fazer','Alta','2026-10-05')", args: [id(), client, project] },
      { sql: "insert into compromissos (id,cliente_id,projeto_id,titulo,data,hora,tipo) values (?,?,?,'EXEMPLO FICTÍCIO — Revisão com cliente','2026-10-20','14:00','Reunião')", args: [id(), client, project] },
      { sql: "insert into interacoes_cliente (id,cliente_id,tipo,titulo,descricao,data,manual) values (?,?, 'Observação','EXEMPLO FICTÍCIO — Documentos recebidos','Documentos fictícios disponíveis; próxima análise a confirmar.','2026-10-01',1)", args: [id(), client] }
    ], 'write');
  } finally { db.close(); }
  return { client, empty, property, project, environmental, budget, root };
}

async function open(page: Page, client: string, tab = 'visao-geral', extra = '') {
  if (!observedPages.has(page)) { observedPages.add(page); page.on('request', request => { const token = request.headers()['x-local-session']; if (token) tokens.set(page, token); }); }
  await page.goto(`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}/clientes/${client}${tab === 'visao-geral' ? '' : '?tab=' + tab}${extra ? (tab === 'visao-geral' ? '?' : '&') + extra : ''}`);
  await expect(page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).or(page.locator('#cliente-tab-' + tab))).toBeVisible();
  if (await page.getByRole('heading', { name: 'Desbloquear GeoGestor' }).isVisible()) {
    await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
  }
  await expect(page.locator('#cliente-panel-' + tab)).toBeVisible();
}



test('datas da jornada em destaque, temas, largura estreita e filtros preservados',async({page})=>{
 const fixture=await seed();const results=[];
 for(const scenario of [{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:360,theme:'light'},{width:360,theme:'dark'}]){
  await page.setViewportSize({width:scenario.width,height:960});await open(page,fixture.client);await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),scenario.theme);
  const timeline=page.locator('section').filter({has:page.getByRole('heading',{name:/^Jornada do cliente/})}).last();await expect(timeline.locator('article')).toHaveCount(4);
  const dates=timeline.locator('article time');await expect(dates).toHaveCount(4);await expect(dates.first()).toHaveText('20/10/2026');
  const styles=await dates.first().evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect(),article=el.closest('article')!,title=article.querySelector('h3')!;return {fontSize:s.fontSize,fontWeight:s.fontWeight,color:s.color,background:s.backgroundColor,beforeTitle:r.bottom<title.getBoundingClientRect().top,overflow:article.scrollWidth-article.clientWidth};});
  expect(styles.fontSize).toBe('16px');expect(Number(styles.fontWeight)).toBeGreaterThanOrEqual(600);expect(styles.beforeTitle).toBe(true);expect(styles.overflow).toBeLessThanOrEqual(1);
  const axe=await new AxeBuilder({page}).include('#cliente-panel-visao-geral').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(axe.violations).toEqual([]);
  await timeline.scrollIntoViewIfNeeded();await timeline.screenshot({path:path.join(evidence,`jornada-${scenario.theme}-${scenario.width}.png`)});results.push({...scenario,styles,axe:axe.violations.length});
  await timeline.getByRole('button',{name:'Agenda',exact:true}).click();await expect(timeline.locator('article')).toHaveCount(1);await expect(timeline.locator('article time')).toHaveText('20/10/2026');await timeline.getByRole('button',{name:'Todos',exact:true}).click();
 }
 await fs.writeFile(path.join(evidence,'validacao.json'),JSON.stringify(results,null,2));
});
