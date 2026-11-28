import {test,expect,_electron as electron,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(180_000);
test.use({actionTimeout:12_000});
const output=path.resolve('docs/auditorias/2026-10-17-agenda-implementacao/evidencias');
const origin=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_WEB_PORT}`;
const api=`http://127.0.0.1:${process.env.GEOGESTOR_E2E_API_PORT}`;
const requireApi=createRequire(path.resolve('apps/api/package.json'));
const fakeId=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const client=fakeId(1),client2=fakeId(2),project=fakeId(3),task=fakeId(4);
const ids=Array.from({length:36},(_,i)=>fakeId(i+10));
const types=['Reunião','Visita de Campo','Ligação','Administrativo','Serviço','Entrega','Outro'];
const fake='EXEMPLO FICTÍCIO';
let headers:Record<string,string>={};

test.beforeAll(async({request})=>{
 const root=process.env.GEOGESTOR_E2E_ROOT;
 if(!root||!/^run-/.test(path.basename(root))||!root.includes(path.join('scratch','commercial-e2e')))throw Error('Somente banco novo fictício isolado');
 await fs.mkdir(output,{recursive:true});
 const {createClient}=requireApi('@libsql/client');const db=createClient({url:`file:${path.join(root,'geogestor.db')}`});
 await db.batch([
  ...[client,client2].map((id,i)=>({sql:"insert or ignore into clientes (id,nome,tipo_pessoa,situacao) values (?,?,'PF','Ativo')",args:[id,`${fake} — Cliente ${i+1} com nome extenso para verificar vínculos`]})),
  {sql:"insert or ignore into projetos (id,cliente_id,nome,status,data_inicio,data_entrega) values (?,?,?,'Em Andamento','2026-10-17','2026-10-18')",args:[project,client,`${fake} — Levantamento ambiental com nome extenso`]},
  {sql:"insert or ignore into tarefas (id,cliente_id,projeto_id,titulo,status,prioridade,data_limite) values (?,?,?,?,'Em Progresso','Média','2026-10-17')",args:[task,client,project,`${fake} — Conferir relatório`]},
  ...ids.map((id,i)=>({sql:'insert or ignore into compromissos (id,titulo,tipo,data,hora,cliente_id,projeto_id,descricao) values (?,?,?,?,?,?,?,?)',args:[id,`${fake} — ${types[i%7]} ${String(i+1).padStart(2,'0')}`,types[i%7],i<7?'2026-10-17':'2026-10-18',i%3===0?null:`${String(8+i%12).padStart(2,'0')}:30`,client,project,`${fake} — Observações, instruções e local de demonstração. Sem informações operacionais.`]}))
 ],'write');db.close();
 const auth=await request.post(api+'/api/auth/unlock',{data:{password:'GeoGestor-E2E-2026'}});expect(auth.ok()).toBe(true);
 headers={'x-local-session':(await auth.json()).token};
});
async function visit(page:Page,search='mes=2026-10&data=2026-10-17',assertCount=true){
 await page.goto(origin+'/calendario?'+search);
 const unlock=page.getByRole('heading',{name:'Desbloquear GeoGestor'});
 await expect(page.locator('#main-content').or(unlock)).toBeVisible();
 if(await unlock.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}
 await expect(page.getByRole('heading',{name:'Calendário',exact:true})).toBeVisible();
 if(assertCount)await expect(page.getByText('39 eventos em outubro de 2026.',{exact:true})).toBeVisible();
}
async function theme(page:Page,value:string){await page.evaluate(value=>{localStorage.setItem('geogestor_theme',value);document.documentElement.classList.toggle('dark',value==='dark');},value);}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);}
async function prepare(page:Page){await page.addInitScript(port=>{(window as any).electronAPI={getApiPort:()=>port};},Number(process.env.GEOGESTOR_E2E_API_PORT));await page.emulateMedia({reducedMotion:'reduce'});}
async function openModal(page:Page){await page.getByRole('button',{name:'Agendar compromisso',exact:true}).click();await expect(page.locator('#calendar-title')).toBeFocused();return page.getByRole('dialog',{name:/Agendar compromisso/});}
async function discard(page:Page){await page.getByRole('button',{name:'Cancelar',exact:true}).click();const confirmation=page.getByRole('alertdialog');if(await confirmation.isVisible())await confirmation.getByRole('button',{name:'Descartar compromisso',exact:true}).click();await expect(page.locator('#calendar-title')).toBeHidden();}
async function chooseFilter(page:Page,name:string,value:string){await page.getByRole('combobox',{name}).click();await page.getByRole('option',{name:value,exact:true}).click();}
test('antes: registra interface e áreas protegidas com dados fictícios',async({page})=>{
 test.skip(process.env.GEOGESTOR_AGENDA_BASELINE!=='1');
 await prepare(page);await page.setViewportSize({width:1440,height:1000});await visit(page);
 for(const color of ['light','dark']){
  await expect(page.getByRole('dialog')).toHaveCount(0);await theme(page,color);await page.screenshot({path:path.join(output,`antes-agenda-${color}.png`),animations:'disabled'});
  await page.getByRole('button',{name:'Agendar compromisso',exact:true}).click();
  await expect(page.locator('#calendar-title')).toBeFocused();
  await page.screenshot({path:path.join(output,`antes-modal-${color}.png`),animations:'disabled'});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
 }
});

test('critérios estáveis, histórico, três origens e lista completa',async({page})=>{
 await prepare(page);await visit(page);
 const agenda=page.getByRole('complementary',{name:'Agenda do dia'});
 await expect(agenda.locator('article')).toHaveCount(9);
 await expect(agenda.getByRole('button',{name:/^Excluir /})).toHaveCount(7);
 const search=page.getByLabel('Buscar eventos no calendário');await search.fill('reuniao');await expect(search).toBeFocused();
 await expect(page.getByText('6 de 39 eventos encontrados em outubro de 2026.')).toBeVisible();
 await search.fill('');await chooseFilter(page,'Filtrar por tipo de evento','Reunião');
 await page.getByRole('button',{name:'Próximo mês',exact:true}).click();
 await expect(page).toHaveURL(/tipo=Reuni%C3%A3o/);await expect(page.getByText('0 de 0 eventos encontrados em novembro de 2026.')).toBeVisible();
 await page.goBack();await expect(page.getByText('6 de 39 eventos encontrados em outubro de 2026.')).toBeVisible();
 await chooseFilter(page,'Filtrar por status do evento','Em Progresso');
 await expect(page).toHaveURL(/status=Em\+Progresso/);await expect(page.getByText('0 de 39 eventos encontrados em outubro de 2026.')).toBeVisible();
 await page.getByRole('button',{name:'Próximo mês',exact:true}).click();await expect(page).toHaveURL(/status=Em\+Progresso/);
 await page.goBack();await page.getByRole('button',{name:'Limpar filtros',exact:true}).first().click();
 await page.getByRole('button',{name:'Lista',exact:true}).click();await expect(page).toHaveURL(/visao=lista/);
 await expect(page.locator('.calendar-month-list article')).toHaveCount(39);
 const detail=page.locator(`.calendar-month-list a[href="/calendario/compromisso/${ids[0]}"]`);await detail.click();
 await page.getByRole('link',{name:'Voltar para o calendário'}).click();await expect(page).toHaveURL(/visao=lista/);
 await page.getByRole('button',{name:'Mês',exact:true}).click();
 const selected=page.getByRole('gridcell',{selected:true}).getByRole('button');await selected.focus();await selected.press('ArrowRight');
 await expect(page).toHaveURL(/data=2026-10-18/);await expect(page.getByRole('gridcell',{selected:true}).getByRole('button')).toBeFocused();
 await expect(agenda.locator('article')).toHaveCount(30);
 const google=new URL((await agenda.getByRole('link',{name:/ao Google Agenda/}).first().getAttribute('href'))!);expect(google.searchParams.get('action')).toBe('TEMPLATE');
 await noOverflow(page);
});

test('falha parcial, carregamento lento e parâmetros inválidos sem apagar critérios válidos',async({page})=>{
 await prepare(page);await visit(page);
 await page.route('**/api/compromissos?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'EXEMPLO FICTÍCIO — serviço temporariamente indisponível'})}));
 await visit(page,'mes=2026-10&data=2026-10-17&tipo=Reuni%C3%A3o&status=Em+Progresso&extra=preservado',false);
 await expect(page.getByText(/Os demais dados continuam disponíveis/)).toBeVisible();
 await expect(page).toHaveURL(/tipo=Reuni%C3%A3o/);await expect(page).toHaveURL(/status=Em\+Progresso/);await expect(page).toHaveURL(/extra=preservado/);
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).first().click();
 await expect(page.getByRole('complementary',{name:'Agenda do dia'}).locator('article')).toHaveCount(2);
 await page.unroute('**/api/compromissos?*');await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
 await expect(page.getByText('39 eventos em outubro de 2026.',{exact:true})).toBeVisible();
 let release!:()=>void;const hold=new Promise<void>(r=>release=r);
 await page.route('**/api/compromissos?*',async route=>{await hold;await route.continue();});
 await chooseFilter(page,'Filtrar por tipo de evento','Ligação');await page.getByRole('button',{name:'Próximo mês',exact:true}).click();
 await expect(page).toHaveURL(/tipo=Liga%C3%A7%C3%A3o/);release();await expect(page.getByText('0 de 0 eventos encontrados em novembro de 2026.')).toBeVisible();
 await page.unroute('**/api/compromissos?*');
 await visit(page,'mes=2026-10&data=2026-10-17&tipo=Inexistente',false);await expect(page.getByText(/Há um tipo ou situação não reconhecido/)).toBeVisible();await expect(page).toHaveURL(/tipo=Inexistente/);
});

test('modal: teclado, vínculos, dia inteiro, limites e proteção de descarte',async({page})=>{
 await prepare(page);await visit(page);const dialog=await openModal(page);
 await expect(page.locator('#calendar-title')).toHaveAttribute('maxlength','180');await expect(page.locator('#calendar-description')).toHaveAttribute('maxlength','4000');
 await dialog.getByRole('button',{name:'Agendar compromisso',exact:true}).click();await expect(page.locator('#calendar-title')).toBeFocused();
 await expect(page.getByText('Informe um título para identificar o compromisso.')).toBeVisible();
 await page.locator('label[for="calendar-title"]').click();await expect(page.locator('#calendar-title')).toBeFocused();
 await page.locator('#calendar-title').fill(`${fake} — Novo compromisso`);
 await page.locator('#calendar-type').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await expect(page.locator('select[name="tipo"]')).toHaveValue('Reunião');
 await page.locator('#calendar-date').click();const picker=page.getByRole('dialog',{name:'Selecionar data do compromisso',exact:true});
 await expect(picker.locator('[data-calendar-date][tabindex="0"]')).toBeFocused();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect(page.locator('input[name="data"]')).toHaveValue('2026-10-18');await expect(page.locator('#calendar-date')).toBeFocused();
 await page.locator('#calendar-date').click();await page.keyboard.press('Escape');await expect(picker).toBeHidden();await expect(dialog).toBeVisible();
 const time=page.locator('#calendar-time');await time.fill('930');await time.press('Tab');await expect(time).toHaveValue('09:30');
 await time.focus();await expect(page.getByRole('option',{name:'09:30',exact:true})).toHaveAttribute('tabindex','-1');await time.press('Escape');
 await page.locator('label[for="calendar-all-day"]').click();await expect(time).toBeDisabled();await page.locator('label[for="calendar-all-day"]').click();await expect(time).toHaveValue('09:30');
 await page.locator('#calendar-project').fill('EXEMPLO');await page.getByRole('option',{name:/Levantamento ambiental/}).click();
 await expect(page.locator('input[name="clienteId"]')).toHaveValue(client);await expect(page.locator('input[name="projetoId"]')).toHaveValue(project);
 await page.locator('#calendar-client').fill('Cliente 2');await page.getByRole('option',{name:/Cliente 2 com nome extenso/}).click();
 await expect(page.locator('input[name="projetoId"]')).toHaveValue('');await expect(page.getByText(/seleção de projeto foi removida/)).toBeVisible();
 await page.locator('#calendar-description').fill(`${fake} — Preservar observações`);
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByRole('alertdialog')).toBeVisible();
 await page.getByRole('button',{name:'Continuar preenchendo',exact:true}).click();await expect(page.locator('#calendar-title')).toHaveValue(`${fake} — Novo compromisso`);
 await page.getByRole('button',{name:'Fechar modal',exact:true}).click();await page.getByRole('button',{name:'Continuar preenchendo',exact:true}).click();
 await page.locator('#calendar-title').focus();await page.keyboard.press('Escape');await expect(page.getByRole('alertdialog')).toBeVisible();
 await page.getByRole('button',{name:'Descartar compromisso',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.getByRole('button',{name:'Agendar compromisso',exact:true})).toBeFocused();
});

test('envio: falhas preservam campos, nova tentativa, trava imediata e sucesso confirmado',async({page,request})=>{
 await prepare(page);await visit(page);await chooseFilter(page,'Filtrar por tipo de evento','Reunião');
 const dialog=await openModal(page);const title=`${fake} — Falha e nova tentativa`;
 await page.locator('#calendar-title').fill(title);await page.locator('#calendar-description').fill(`${fake} — Não perder descrição`);await page.locator('#calendar-time').fill('10:45');await page.locator('#calendar-title').click();
 let mode='http',postCount=0,release!:()=>void;let pending=new Promise<void>(r=>release=r);
 await page.route('**/api/compromissos',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}postCount++;
  if(mode==='http'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'EXEMPLO FICTÍCIO — serviço indisponível.'})});return;}
  if(mode==='network'){await route.abort('connectionfailed');return;}
  await pending;await route.continue();
 });
 const submit=dialog.getByRole('button',{name:'Agendar compromisso',exact:true});await submit.click();
 await expect(page.locator('#calendar-submit-error')).toContainText('serviço indisponível');await expect(page.locator('#calendar-submit-error')).toBeFocused();
 await expect(page.locator('#calendar-title')).toHaveValue(title);await expect(page.locator('#calendar-description')).toHaveValue(`${fake} — Não perder descrição`);await expect(page.locator('#calendar-time')).toHaveValue('10:45');
 await page.screenshot({path:path.join(output,'falha-resposta-campos-preservados.png')});
 mode='network';await submit.click();await expect(page.locator('#calendar-submit-error')).toContainText('comunicar com o serviço local');await expect(page.locator('#calendar-title')).toHaveValue(title);
 mode='slow';const before=await submit.boundingBox();
 await page.locator('#calendar-appointment-form').evaluate((form:HTMLFormElement)=>{form.requestSubmit();form.requestSubmit();});
 await expect(dialog.getByRole('button',{name:'Agendando…',exact:true})).toBeDisabled();
 expect(await dialog.getByRole('button',{name:'Agendando…',exact:true}).boundingBox()).toEqual(before);
 await expect(page.locator('#calendar-title')).toBeDisabled();await expect(page.getByRole('button',{name:'Cancelar',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Fechar modal',exact:true})).toBeDisabled();await expect.poll(()=>postCount).toBe(3);
 await page.route('**/api/compromissos?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'EXEMPLO FICTÍCIO — atualização falhou'})}));
 release();await expect(dialog).toBeHidden();await expect(page.getByText(/Ele não aparece com os filtros atuais/)).toBeVisible();await expect(page).toHaveURL(/tipo=Reuni%C3%A3o/);await expect(page.getByText(/Os demais dados continuam disponíveis/)).toBeVisible();
 const rows=await request.get(api+'/api/compromissos?inicio=2026-10-17&fim=2026-10-17',{headers});expect((await rows.json()).filter((item:any)=>item.titulo===title)).toHaveLength(1);expect(postCount).toBe(3);
 await page.unroute('**/api/compromissos?*');await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await expect(page.getByText('6 de 40 eventos encontrados em outubro de 2026.')).toBeVisible();
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).first().click();await expect(page.getByText(/Ele não aparece com os filtros atuais/)).toBeHidden();await expect(page.getByText('40 eventos em outubro de 2026.',{exact:true})).toBeVisible();
});

test('exclusão confirmada e desfazer preservam cliente, projeto e tarefa',async({page,request})=>{
 await prepare(page);await visit(page,'mes=2026-10&data=2026-10-17',false);
 const title=`${fake} — Reunião 01`;await page.getByRole('button',{name:'Excluir '+title,exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Excluir compromisso',exact:true}).click();
 await expect(page.getByRole('complementary',{name:'Agenda do dia'}).getByText(title,{exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Desfazer',exact:true}).click();await expect(page.getByRole('complementary',{name:'Agenda do dia'}).getByText(title,{exact:true})).toBeVisible();
 for(const route of ['/api/clientes/'+client,'/api/projetos/'+project,'/api/tarefas/'+task])expect((await request.get(api+route,{headers})).ok()).toBe(true);
});

async function popupBounds(page:Page){
 for(const popup of await page.locator('.geo-popover-surface:visible').all()){
  const r=await popup.boundingBox(),viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  expect(r!.x).toBeGreaterThanOrEqual(0);expect(r!.y).toBeGreaterThanOrEqual(0);expect(r!.x+r!.width).toBeLessThanOrEqual(viewport.width+1);expect(r!.y+r!.height).toBeLessThanOrEqual(viewport.height+1);
 }
}
async function checkModalLayout(page:Page,suffix:string,capture:(name:string)=>Promise<void>){
 const dialog=await openModal(page);await page.locator('#calendar-title').fill(`${fake} — Conferência visual`);
 const submit=dialog.getByRole('button',{name:'Agendar compromisso',exact:true});
 await submit.focus();await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Fechar modal',exact:true})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(submit).toBeFocused();
 await page.locator('#calendar-title').scrollIntoViewIfNeeded();await noOverflow(page);await capture(`modal-${suffix}.png`);
 if(suffix.startsWith('1440-')){const results=await new AxeBuilder({page}).include('.calendar-appointment-modal').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations,JSON.stringify(results.violations,null,2)).toEqual([]);}
 for(const selector of ['#calendar-type','#calendar-date','#calendar-time','#calendar-client','#calendar-project']){
  const control=page.locator(selector);await control.scrollIntoViewIfNeeded();await control.click();
  await expect(page.locator('.geo-popover-surface:visible').first()).toBeVisible();await popupBounds(page);await capture(`seletor-${selector.slice(10)}-${suffix}.png`);
  await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await expect(page.locator('.geo-popover-surface:visible')).toHaveCount(0);
 }
 await page.locator('#calendar-description').fill(`${fake} — Descrição longa confortável para observações e ponto de encontro.`);
 await page.locator('#calendar-description').scrollIntoViewIfNeeded();
 const rect=await submit.boundingBox(),viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
 expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.y+rect!.height).toBeLessThanOrEqual(viewport.height);await noOverflow(page);
 await capture(`modal-observacoes-${suffix}.png`);await discard(page);
}
test('interface renderizada nos dois temas, telas ampla, intermediária e estreita',async({page})=>{
 await prepare(page);
 const measurements:any[]=[];
 for(const width of [1440,1100,390])for(const color of ['light','dark']){
  await page.setViewportSize({width,height:1000});await visit(page,'mes=2026-10&data=2026-10-17',false);await theme(page,color);
  await page.screenshot({path:path.join(output,`agenda-${width}-${color}.png`)});await noOverflow(page);
  await page.getByRole('button',{name:'Mês',exact:true}).click();
  const bounds=await page.locator('.calendar-month-panel,.calendar-daily-panel').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{width:r.width,x:r.x,y:r.y,bottom:r.bottom,right:r.right};}));
  if(width===1440){expect(bounds[1].width).toBeGreaterThanOrEqual(352);expect(bounds[1].y).toBeCloseTo(bounds[0].y,1);}
  if(width===1100)expect(bounds[1].y).toBeGreaterThan(bounds[0].bottom);
  await noOverflow(page);measurements.push({width,color,bounds});
  const found=Number((await page.locator('section[aria-label="Filtros do calendário"] [role="status"]').innerText()).match(/^\d+/)![0]);
  await page.getByRole('button',{name:'Lista',exact:true}).click();await expect(page.locator('.calendar-month-list article')).toHaveCount(found);expect(found).toBeGreaterThanOrEqual(39);await noOverflow(page);
  await page.screenshot({path:path.join(output,`lista-${width}-${color}.png`)});
  if(width===1440){const results=await new AxeBuilder({page}).include('.calendar-workspace').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations,JSON.stringify(results.violations,null,2)).toEqual([]);}
  await checkModalLayout(page,`${width}-${color}`,async name=>{await page.screenshot({path:path.join(output,name)});});
 }
 await fs.writeFile(path.join(output,'medidas-layout.json'),JSON.stringify(measurements,null,2));
});

test('zoom real de 200% no aplicativo desktop, claro e escuro',async()=>{
 const requireRoot=createRequire(path.resolve('package.json'));let executablePath:string;
 try{executablePath=requireRoot('electron');}catch{executablePath=path.resolve('scratch/licensing-electron-runtime/runtime/electron.exe');}
 const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toUpperCase()!=='ELECTRON_RUN_AS_NODE')),GEOGESTOR_E2E_OFFSCREEN:'1'};
 const app=await electron.launch({executablePath,args:[path.resolve('tests/e2e/support/licensing-desktop.cjs')],env,timeout:30_000});
 try{
  const page=await app.firstWindow(),win=await app.browserWindow(page);page.setDefaultTimeout(12_000);
  page.on('dialog',d=>d.accept().catch(error=>{if(!String(error).includes('No dialog is showing'))throw error;}));
  await win.evaluate(w=>{w.webContents.setBackgroundThrottling(false);w.setContentSize(1000,800);w.webContents.setZoomFactor(2);});
  await expect.poll(()=>page.evaluate(()=>innerWidth)).toBe(500);
  const capture=async(name:string)=>{
   // Hidden offscreen windows need a full paint after layout changes; capturePage
   // alone can retain an outdated header layer even when its geometry is correct.
   await win.evaluate(w=>new Promise<void>((resolve,reject)=>{
    const painted=()=>{clearTimeout(timer);resolve();};
    const timer=setTimeout(()=>{w.webContents.removeListener('paint',painted);reject(new Error('Offscreen repaint timed out'));},3000);
    w.webContents.once('paint',painted);w.webContents.invalidate();
   }));
   await win.evaluate(async w=>{await w.capturePage(undefined,{stayHidden:true,stayAwake:true});});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const png=await win.evaluate(async w=>(await w.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
   await fs.writeFile(path.join(output,name),Buffer.from(png,'base64'));
  };
  await visit(page,'mes=2026-10&data=2026-10-17&visao=lista',false);
  await page.route('**/api/compromissos',route=>route.request().method()==='POST' ? route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'EXEMPLO FICTÍCIO — solicitação recusada.'})}) : route.continue());
  for(const color of ['light','dark']){
   await theme(page,color);await noOverflow(page);await page.locator('.calendar-workspace').scrollIntoViewIfNeeded();await capture(`agenda-zoom-200-${color}.png`);
   await checkModalLayout(page,`zoom-200-${color}`,capture);expect(await win.evaluate(w=>w.webContents.getZoomFactor())).toBe(2);
   const dialog=await openModal(page);await page.locator('#calendar-title').fill(`${fake} — Falha com zoom`);await dialog.getByRole('button',{name:'Agendar compromisso',exact:true}).click();
   await expect(page.locator('#calendar-submit-error')).toBeFocused();await expect(page.locator('#calendar-title')).toHaveValue(`${fake} — Falha com zoom`);await noOverflow(page);
   const geometry=await dialog.evaluate(el=>{const rect=(n:Element|null)=>{const r=n!.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height};};return{scrollTop:el.scrollTop,root:rect(el),heading:rect(el.querySelector('h2')),footer:rect(el.lastElementChild),submit:rect(el.querySelector('button[type="submit"]'))};});
   await fs.writeFile(path.join(output,`falha-zoom-geometria-${color}.json`),JSON.stringify(geometry,null,2));
   expect(geometry.heading.top).toBeGreaterThanOrEqual(geometry.root.top);expect(geometry.submit.bottom).toBeLessThanOrEqual(geometry.root.bottom);expect(geometry.scrollTop).toBe(0);
   await capture(`falha-zoom-200-${color}.png`);await discard(page);
  }
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
});
