// Keyboard-focus regression: real keyboard typing after pointer-opening the diary.
// Uses page.keyboard only (never locator.fill/pressSequentially on the textarea).
// /api/diary is answered by an explicitly labelled local fixture unless REAL_AI=1.
import {chromium} from '/home/hermes/.hermes/cache/scratch/riddle-browser/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.DIARY_URL||'http://127.0.0.1:5181';
const text='Hello. My name is Samarth. Who are you?';
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const failures=[];
let page;
const check=async(name,fn)=>{try{await fn();console.log('PASS',name);}catch(error){failures.push(name);const at=await page?.evaluate(()=>({active:document.activeElement?.id||document.activeElement?.tagName,state:document.body.dataset.state,ink:document.querySelector('#world').dataset.replyInk,value:document.querySelector('#inscription').value,quill:document.querySelector('#quill-object').getAttribute('aria-pressed')})).catch(()=>null);console.log('FAIL',name,'\n  ',error.message.replace(/\s+/g,' ').slice(0,220),'\n  ',JSON.stringify(at));}};
try {
 page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(!process.env.REAL_AI)await page.route('**/api/diary',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({reply:'FIXTURE: My name is Tom Riddle.'})}));
 const state=()=>page.evaluate(()=>document.body.dataset.state);
 const waitState=s=>page.waitForFunction(s=>document.body.dataset.state===s,s,{timeout:20000});
 const active=()=>page.evaluate(()=>document.activeElement?.id||document.activeElement?.tagName);
 const pressed=id=>page.locator(id).getAttribute('aria-pressed');
 const value=()=>page.locator('#inscription').inputValue();
 const fresh=async()=>{await page.reload({waitUntil:'networkidle'});await waitState('closed');await page.waitForTimeout(600);};
 const clickCenter=async id=>{await page.locator(id).waitFor({state:'visible',timeout:10000});const b=await page.locator(id).boundingBox();assert.ok(b,id+' has no box');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);};
 const tabTo=async id=>{for(let i=0;i<12;i++){await page.keyboard.press('Tab');if(await active()===id.slice(1))return;}throw new Error('could not Tab to '+id);};
 await page.goto(base,{waitUntil:'networkidle'});await waitState('closed');await page.waitForTimeout(600);

 await check('click resting quill -> open -> keyboard.type keeps every letter, quill still held, book still open',async()=>{
  await clickCenter('#quill-object');await waitState('ready');
  await page.keyboard.type(text,{delay:25});
  assert.equal(await value(),text);assert.equal(await state(),'ready');assert.equal(await pressed('#quill-object'),'true');
  // first keystroke after a reply still dissolves it (routing from body after submit blur)
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#world').dataset.replyInk==='visible',{},{timeout:60000});
  await page.keyboard.type('I');
  assert.equal(await value(),'I','first keystroke after a reply reaches the diary');
  await page.waitForFunction(()=>document.querySelector('#world').dataset.replyInk!=='visible',{},{timeout:3000});
  await page.waitForFunction(()=>document.querySelector('#world').dataset.replyInk==='blank',{},{timeout:10000});
 });
 await fresh();
 await check('click closed cover -> open -> keyboard.type keeps every letter, book still open',async()=>{
  await clickCenter('#book-object');await waitState('ready');
  await page.keyboard.type(text,{delay:25});
  assert.equal(await value(),text);assert.equal(await state(),'ready');
 });
 await fresh();
 await check('click Open button -> open -> keyboard.type keeps every letter',async()=>{
  await clickCenter('#open');await waitState('ready');
  await page.keyboard.type(text,{delay:25});
  assert.equal(await value(),text);assert.equal(await state(),'ready');
 });
 await fresh();
 await check('click held quill to put it down, then typing letters still reaches the diary',async()=>{
  await clickCenter('#quill-object');await waitState('ready');
  await page.waitForFunction(()=>document.querySelector('#quill-object').dataset.pose==='ready');
  await clickCenter('#quill-object');await page.waitForFunction(()=>document.querySelector('#quill-object').getAttribute('aria-pressed')==='false');
  await page.keyboard.type('Hi there',{delay:25});
  assert.equal(await value(),'Hi there');assert.equal(await state(),'ready');
 });
 await fresh();
 await check('Tab + Enter/Space deliberately activates object buttons; letters typed on a focused control reach the diary',async()=>{
  await tabTo('#book-object');await page.keyboard.press('Enter');await waitState('ready');
  assert.equal(await active(),'book-object','keyboard activation must not move focus');
  await page.keyboard.press('Space');await waitState('closed');
  await page.keyboard.press('Enter');await waitState('ready');
  await page.keyboard.type('Hi',{delay:25});assert.equal(await value(),'Hi');
  await page.keyboard.press('Shift+Tab');
  for(let i=0;i<12 && await active()!=='quill-object';i++)await page.keyboard.press('Shift+Tab');
  assert.equal(await active(),'quill-object');
  await page.waitForFunction(()=>document.querySelector('#quill-object').getAttribute('aria-pressed')==='true',{},{timeout:5000});
  await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#quill-object').getAttribute('aria-pressed')==='false');
  assert.equal(await active(),'quill-object','Space must stay a deliberate quill activation');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#quill-object').getAttribute('aria-pressed')==='true');
  assert.equal(await state(),'ready');assert.equal(await value(),'Hi');
 });
 await fresh();
 await check('about dialog opened while the book is opening keeps focus',async()=>{
  await clickCenter('#quill-object');await page.locator('#about').click();
  await waitState('ready');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.querySelector('#about-dialog').contains(document.activeElement)),true,'focus left the about dialog: '+await active());
  await page.keyboard.press('Escape');
 });
 await page.setViewportSize({width:390,height:844});await fresh();
 await check('phone: tapping the quill opens without forcing the keyboard (textarea not focused)',async()=>{
  await clickCenter('#quill-object');await waitState('ready');await page.waitForTimeout(300);
  assert.notEqual(await active(),'inscription');
 });
 await check('no page errors',async()=>assert.deepEqual(errors,[]));
 console.log(JSON.stringify({base,api:process.env.REAL_AI?'real':'explicit fixture',failures}));
} finally {await browser.close();}
if(failures.length)process.exit(1);
