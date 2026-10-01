import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { balance } from '../src/config/balance.ts';
import { createInitialGameState } from '../src/core/state/GameState.ts';
import { createSaveState } from '../src/core/save/SaveState.ts';

const url=process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/';
const output=process.env.SMOKE_OUTPUT ?? '/workspace/67m-evidence/release-smoke';
mkdirSync(output,{recursive:true});
const initial=createSaveState(createInitialGameState(balance,67067000));
const terminal=structuredClone(initial);terminal.game.terminalReason='HEALTH_ZERO';terminal.game.needs.health=0;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium',args:['--disable-dev-shm-usage']});
const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true});
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
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
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
 const logical=await page.locator('canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height}));
 await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height*(606/720));
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
 assert.deepEqual(errors,[]);
 const result={status:'passed',sdk:'local structural Yandex stub, not hosted evidence',counter:113254061,checks:['production bootstrap','counter configuration and semantic goal','no debug panel','terminal save before ad','restart after close','independent platform blocker preserved','single restart event'],logicalCanvas:logical,pageErrors:errors};
 writeFileSync(`${output}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 await context.close();
}finally{await browser.close();}
