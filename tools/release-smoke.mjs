import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { balance } from '../src/config/balance.ts';
import { createInitialGameState } from '../src/core/state/GameState.ts';
import { startWork } from '../src/core/work/work.ts';
import { createDishesSession } from '../src/minigames/dishes/dishesModel.ts';
import { createTrashSession } from '../src/minigames/trash/trashModel.ts';
import { createSaveState } from '../src/core/save/SaveState.ts';
import { commitBareDrop } from '../src/core/plinko-rules/drop.ts';

const url=process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/';
const output=process.env.SMOKE_OUTPUT ?? '/workspace/67m-evidence/release-smoke';
mkdirSync(output,{recursive:true});
const initial=createSaveState(createInitialGameState(balance,67067000));
const terminal=structuredClone(initial);terminal.game.terminalReason='HEALTH_ZERO';terminal.game.needs.health=0;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium',args:['--disable-dev-shm-usage']});
const errors=[];
try {
 const context=await browser.newContext({viewport:{width:Number(process.env.SMOKE_WIDTH ?? 1280),height:Number(process.env.SMOKE_HEIGHT ?? 720)},hasTouch:true});
 await context.route('https://mc.yandex.ru/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await context.addInitScript(({initial})=>{
  if(!localStorage.getItem('67m.save'))localStorage.setItem('67m.save',JSON.stringify(initial));
  window.__goals=[];window.__sdkHandlers={};window.__gameplayStarts=0;window.__gameplayStops=0;window.__adRequests=0;
  window.ym=(...args)=>window.__goals.push(args);
  window.YaGames={init:async()=>({
   environment:{i18n:{lang:'ru'}},
   features:{LoadingAPI:{ready:()=>{window.__gameReady=true;}},GameplayAPI:{start:()=>{window.__gameplayStarts++;},stop:()=>{window.__gameplayStops++;}}},
   on:(event,listener)=>{window.__sdkHandlers[event]=listener;},off:()=>{},getStorage:async()=>localStorage,
   getPlayer:async()=>({getData:async()=>({}),setData:async data=>{window.__cloudData=data;}}),
   adv:{showFullscreenAdv:({callbacks})=>{window.__adRequests++;window.__adCallbacks=callbacks;callbacks.onOpen?.();},showRewardedVideo:()=>{},showBannerAdv:async()=>({}),hideBannerAdv:async()=>({stickyAdvIsShowing:false}),getBannerAdvStatus:async()=>({stickyAdvIsShowing:false})}
  })};
 },{initial});
 const page=await context.newPage();
 const cdp=await context.newCDPSession(page);
 let inputRect, lastPoint, touching=false;
 const touch=process.env.SMOKE_TOUCH==='true';
 const move=async(x,y,options)=>{lastPoint={x:inputRect.x+x*inputRect.width/1280,y:inputRect.y+y*inputRect.height/720};if(touch){if(touching)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[lastPoint]});}else await page.mouse.move(lastPoint.x,lastPoint.y,options);};
 const down=async()=>{if(touch){touching=true;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[lastPoint]});}else await page.mouse.down();};
 const up=async()=>{if(touch){touching=false;await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else await page.mouse.up();};
 const click=async(x,y)=>{await move(x,y);await down();await up();};
 page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.__gameReady && document.querySelector('#startup-preload')?.dataset.state==='hidden',null,{timeout:20000});
 await page.goto(url,{waitUntil:'networkidle'});await ready();
 assert.equal(await page.locator('#game-root canvas').count(),1);
 assert.equal(await page.locator('#debug-root').getAttribute('hidden'),'');
 const goals=await page.evaluate(()=>window.__goals);
 assert.ok(goals.some(args=>args[0]===113254061 && args[1]==='reachGoal' && args[2]==='game_start'));
 await page.screenshot({path:`${output}/map.png`});
 await page.evaluate(save=>localStorage.setItem('67m.save',JSON.stringify(save)),terminal);
 await page.reload({waitUntil:'networkidle'});await ready();
 await page.screenshot({path:`${output}/summary.png`});
 const canvas=await page.locator('canvas').boundingBox();assert.ok(canvas);
 inputRect=canvas;
 const logical=await page.locator('canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height}));
 await click(640,606);
 await page.waitForFunction(()=>window.__adRequests===1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('67m.save')).game.terminalReason),'HEALTH_ZERO');
 await page.evaluate(()=>window.__sdkHandlers.game_api_pause());
 const starts=await page.evaluate(()=>window.__gameplayStarts);
 await page.evaluate(()=>window.__adCallbacks.onClose(true));
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('67m.save')).game.terminalReason===null);
 assert.equal(await page.evaluate(()=>window.__gameplayStarts),starts);
 await page.evaluate(()=>window.__sdkHandlers.game_api_resume());
 await page.waitForFunction(count=>window.__gameplayStarts>count,starts);
 const restartedGoals=await page.evaluate(()=>window.__goals.filter(args=>args[1]==='reachGoal'&&args[2]==='game_start'));
 assert.equal(restartedGoals.length,2);
 for (const [job, minute] of [['dishes',18*60],['trash',60],['courier',10*60]]) {
  const workSave=structuredClone(initial);workSave.game.clock.minuteOfDay=minute;
  const reserved=startWork(workSave.game,balance,job,1);workSave.game=reserved.state;workSave.activeAction=reserved.action;
  await page.evaluate(save=>localStorage.setItem('67m.save',JSON.stringify(save)),workSave);
  await page.reload({waitUntil:'networkidle'});await ready();await page.waitForTimeout(300);inputRect=await page.locator('canvas').boundingBox();
  await page.screenshot({path:`${output}/${job}.png`});
  if(job==='dishes') {
   const spots=createDishesSession(balance).spots;
   await move(spots[0].x,spots[0].y);await down();
   for(const spot of spots){await move(spot.x,spot.y);await page.waitForTimeout(17);}
   await up();
  } else if(job==='trash') {
   const session=createTrashSession(balance);
   for(const bag of session.bags){await move(bag.x,bag.y);await down();await move(session.target.x+150,session.target.y+150,{steps:6});await up();await page.waitForTimeout(30);}
  } else {
   await move(180,365);await down();
   for(const point of [[180,600],[1100,600],[1100,365]]){await move(...point,{steps:8});await page.waitForTimeout(25);}
   await up();await click(1180,670);
  }
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('67m.save')).activeAction===null,null,{timeout:12000});
  const completed=await page.evaluate(()=>JSON.parse(localStorage.getItem('67m.save')));
  assert.ok(completed.game.cash>workSave.game.cash,`${job}: actual input must settle a successful payout`);
  const workGoals=await page.evaluate(()=>window.__goals.filter(args=>args[1]==='reachGoal'&&args[2]==='work_completed'));
  assert.equal(workGoals.length,1,`${job}: one success event after authoritative settlement`);
 }
 const committed=commitBareDrop(initial.game,null,balance,'production-restore',1);
 await page.evaluate(save=>localStorage.setItem('67m.save',JSON.stringify(save)),{...initial,game:committed.state,pendingDrop:committed.pendingDrop});
 await page.reload({waitUntil:'networkidle'});await ready();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('67m.save')).pendingDrop?.physics?.fixedTicksElapsed>=15,null,{timeout:12000});
 await page.evaluate(()=>window.__sdkHandlers.game_api_pause());await page.waitForTimeout(100);
 const checkpoint=await page.evaluate(()=>JSON.parse(localStorage.getItem('67m.save')));
 assert.ok(checkpoint.pendingDrop.physics.solver,'production checkpoint includes warm solver state');
 await page.evaluate(()=>window.__sdkHandlers.game_api_resume());
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('67m.save')).pendingDrop===null,null,{timeout:20000});
 const uninterrupted=await page.evaluate(()=>JSON.parse(localStorage.getItem('67m.save')));
 await page.evaluate(save=>localStorage.setItem('67m.save',JSON.stringify(save)),checkpoint);
 await page.reload({waitUntil:'networkidle'});await ready();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('67m.save')).pendingDrop===null,null,{timeout:20000});
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('67m.save')));
 assert.equal(restored.game.cash,uninterrupted.game.cash,'production mid-Drop reload keeps payout');
 assert.equal(restored.game.rngState,uninterrupted.game.rngState,'production mid-Drop reload keeps RNG');
 const resolvedGoals=await page.evaluate(()=>window.__goals.filter(args=>args[1]==='reachGoal'&&args[2]==='plinko_resolved'));
 assert.equal(resolvedGoals.length,1,'restored Drop settles once');
 await page.reload({waitUntil:'networkidle'});await ready();
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('67m.save')))).game.cash,restored.game.cash,'settled production reload cannot duplicate payout');
 const originalViewport=page.viewportSize();await page.setViewportSize({width:360,height:640});await page.waitForFunction(()=>document.querySelector('#rotate-gate').getAttribute('aria-hidden')==='false');await page.setViewportSize(originalViewport);await page.waitForFunction(()=>document.querySelector('#rotate-gate').getAttribute('aria-hidden')==='true');assert.equal(await page.locator('canvas').evaluate(canvas=>canvas.width),1280);
 const legacy=structuredClone(checkpoint);legacy.version=13;delete legacy.pendingDrop.physics.solver;
 const legacyRaw=JSON.stringify(legacy);
 await page.evaluate(raw=>localStorage.setItem('67m.save',raw),legacyRaw);
 await page.reload({waitUntil:'networkidle'});await ready();await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>localStorage.getItem('67m.save')),legacyRaw,'legacy pose-only Drop fails safely without rewriting or refund');
 assert.deepEqual(errors,[]);
 const result={status:'passed',sdk:'local structural Yandex stub, not hosted evidence',counter:113254061,viewport:page.viewportSize(),input:touch?'actual CDP touch events':'mouse pointer events',checks:['production bootstrap','counter configuration and semantic goal','no debug panel','terminal save before ad','restart after close','independent platform blocker preserved','single restart event','dishes actual pointer input and payout','trash drag input and payout','courier route input and payout','production cold restore enters casino','exact production mid-Drop payout and RNG','single restored settlement event','no duplicate payout after settled reload','legacy pose-only save refused without mutation','portrait gate and return without changing logical canvas'],logicalCanvas:logical,pageErrors:errors};
 writeFileSync(`${output}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 await context.close();
}finally{await browser.close();}
