import { expect, type Page } from '@playwright/test';
import path from 'node:path';
const headers = new WeakMap<Page,Record<string,string>>();
export async function prepareIsolatedPage(page:Page) {
  const root=process.env.GEOGESTOR_E2E_ROOT;
  if(!root || !path.resolve(root).startsWith(path.resolve('scratch/commercial-e2e')+path.sep))throw Error('Armazenamento fictício isolado obrigatório');
  page.on('request',r=>{const h=r.headers();if(h['x-local-session'])headers.set(page,{'x-local-session':h['x-local-session'],...(h['x-api-token']?{'x-api-token':h['x-api-token']}:{})});});
  await page.addInitScript(port=>{(window as any).electronAPI={getApiPort:()=>port};},Number(process.env.GEOGESTOR_E2E_API_PORT));
}
export async function openIsolatedPage(page:Page,url:string){
  await page.goto(url);const locked=page.getByRole('heading',{name:'Desbloquear GeoGestor'});
  await expect(page.locator('#main-content').or(locked)).toBeVisible();
  if(await locked.isVisible()){await page.getByLabel('Senha local').fill('GeoGestor-E2E-2026');await page.getByRole('button',{name:'Desbloquear',exact:true}).click();}
  await expect(page.locator('#main-content')).toBeVisible();await expect(page.locator('#local-password')).toBeHidden();
}
export function isolatedGet(page:Page,url:string){return page.request.get(url,{headers:headers.get(page)||{}});}

export async function protectedSourceBytes(file:string){
 const fs=await import('node:fs/promises');const ref=JSON.parse(await fs.readFile('tests/e2e/fixtures/ui-protected-2026-10-18.json','utf8'));
 let bytes=Buffer.from((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n'));for(const n of ref.normalizations||[])if(n.path===file){const source=bytes.toString('utf8');expect(source.split(n.from)).toHaveLength(2);bytes=Buffer.from(source.replace(n.from,n.to));}return bytes;
}
