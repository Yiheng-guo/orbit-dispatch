import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createLevel,clockwiseDistance} from '../src/levels.js';

const url=process.env.GAME_URL||'http://localhost:4173/';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('test-results',{recursive:true});
async function noOverflow(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
async function solve(p,i){
  const level=createLevel(i);
  for(const c of level.cells){
    if(c.fixed||c.solution===null)continue;
    for(let n=0;n<clockwiseDistance(c.mask,c.solution);n++){
      if(await p.locator('#result').isVisible())break;
      await p.locator(`[data-cell="${c.id}"]`).click();
    }
  }
  assert.equal(await p.locator('#phase').textContent(),'通联成功');
  assert.equal(await p.locator('#result-stars').textContent(),'✦✦✦');
}
try{
  await page.goto(url);await page.locator('#start').waitFor();await noOverflow(page);
  await page.screenshot({path:'test-results/desktop-entry.png',fullPage:true});
  await page.locator('#start').click();
  await page.locator('[data-cell="10"]').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('#remaining').textContent(),String(createLevel(0).budget).padStart(2,'0'));
  await page.locator('[data-cell="11"]').focus();await page.keyboard.press('Enter');
  const used=await page.locator('#remaining').textContent();
  await page.keyboard.press('u');assert.notEqual(await page.locator('#remaining').textContent(),used);
  await page.locator('#help').click();
  await page.keyboard.press('r');assert.equal(await page.locator('#help-dialog').getAttribute('open'),'');
  await page.keyboard.press('Escape');
  await page.locator('#restart').click();
  await page.screenshot({path:'test-results/desktop-play.png',fullPage:true});
  for(let i=0;i<6;i++){
    await page.locator(`[data-level="${i}"]`).click();await solve(page,i);
    if(i===5)await page.screenshot({path:'test-results/desktop-finale.png',fullPage:true});
  }
  assert.equal(await page.locator('#total-stars').textContent(),'18 / 18 ✦');
  await page.reload();assert.equal(await page.locator('#total-stars').textContent(),'18 / 18 ✦');
  await page.locator('#start').click();await page.locator('[data-level="0"]').click();
  await page.locator('#hint').click();assert.equal(await page.locator('.cell.hinted').count(),1);
  // Use the public hint action repeatedly; assistance must be reflected in the result.
  for(let n=0;n<30&&await page.locator('#result').isHidden();n++){
    await page.locator('#hint').click();await page.locator('.cell.hinted').click();
  }
  assert.equal(await page.locator('#result-stars').textContent(),'✦☆☆');
  await page.locator('[data-level="0"]').click();
  for(let n=0;n<createLevel(0).budget;n++)await page.locator('[data-cell="0"]').click();
  assert.equal(await page.locator('#phase').textContent(),'调度耗尽');
  await page.locator('#next').click();assert.equal(await page.locator('#phase').textContent(),'信号接入中');
  for(let n=0;n<3;n++)await page.locator('#restart').click();
  await page.locator('[data-cell="0"]').click();
  assert.equal(await page.locator('#remaining').textContent(),String(createLevel(0).budget-1).padStart(2,'0'));
  await page.locator('#feedback').click();await page.locator('[data-feeling="clear"]').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
  const download=await downloadPromise;const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(exported.game,'orbit-dispatch');assert.ok(exported.events.some(e=>e.type==='feedback'));
  await page.keyboard.press('Escape');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));
  await mp.goto(url);await mp.locator('#start').tap();await noOverflow(mp);
  const before=await mp.locator('#remaining').textContent();await mp.locator('[data-cell="11"]').tap();
  assert.equal(Number(before)-Number(await mp.locator('#remaining').textContent()),1);
  await mp.screenshot({path:'test-results/mobile-play.png',fullPage:true});
  await mp.setViewportSize({width:360,height:780});await noOverflow(mp);
  await mp.screenshot({path:'test-results/mobile-360.png',fullPage:true});
  await mp.locator('#help').tap();assert.equal(await mp.locator('#help-dialog').isVisible(),true);
  await mp.locator('#help-dialog [data-close]').last().tap();
  await mobile.close();
  const denied=await browser.newContext();
  await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage denied');}}));
  const dp=await denied.newPage();dp.on('pageerror',e=>errors.push(e.message));
  await dp.goto(url);await dp.locator('#start').click();await dp.locator('[data-cell="11"]').click();
  assert.ok((await dp.locator('#message').textContent()).includes('未允许保存'));
  await denied.close();
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: six wins, terminal/retry/undo, hints, reload, keyboard/modal, export, 390/360 touch emulation, storage denial, console errors.');
}finally{await browser.close();}
