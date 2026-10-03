import Matter from 'matter-js';
import { createRequire } from 'node:module';
const engineKind = process.env.AUDIT_ENGINE ?? 'matter';
if (engineKind === 'phaser') {
  const require = createRequire(import.meta.url);
  for (const [key, path] of Object.entries({Engine:'core/Engine',Bodies:'factory/Bodies',Body:'body/Body',Composite:'body/Composite',Events:'core/Events'})) {
    (Matter as unknown as Record<string, unknown>)[key] = require(`../node_modules/phaser/src/physics/matter-js/lib/${path}.js`);
  }
}
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { balance } from '../src/config/balance';
import { runCascadePhysicalDrops } from '../simulation/plinko/cascadeRunner';

// Read-only instrumentation of the existing runner. A deep swept crossing with
// both endpoints outside and no solver contact is evidence of tunnelling.
const originalUpdate = Matter.Engine.update;
const revision = process.env.AUDIT_REVISION ?? execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const runs = Number(process.env.AUDIT_RUNS ?? 10000);
const seed = 67043000;
const results: unknown[] = [];
for (const [name, levels] of Object.entries({
  bare: [0, 0, 0, 0], biasOnly: [0, 0, 0, 4],
  specialsWithoutBias: [5, 4, 5, 0], max: [5, 4, 5, 4],
})) {
  let maxStep = 0, maxPegZoneStep = 0, sweptMisses = 0, ballSteps = 0;
  const examples: unknown[] = [];
  Matter.Engine.update = (engine, delta) => {
    const all = Matter.Composite.allBodies(engine.world);
    const pegs = all.filter(b => b.isStatic && b.circleRadius === balance.plinko.geometry.pegRadius);
    const before = all.filter(b => !b.isStatic).map(b => ({b, x:b.position.x, y:b.position.y}));
    const result = originalUpdate(engine, delta);
    const contacts = new Set(engine.pairs.list.filter(p => p.isActive).map(p => [p.bodyA.id,p.bodyB.id].sort((a,b)=>a-b).join(':')));
    for (const {b,x,y} of before) {
      ballSteps++;
      const dx=b.position.x-x, dy=b.position.y-y, d2=dx*dx+dy*dy;
      maxStep=Math.max(maxStep,Math.sqrt(d2));
      if(y<=362) maxPegZoneStep=Math.max(maxPegZoneStep,Math.sqrt(d2));
      for(const p of pegs) {
        if(p.position.x < Math.min(x,b.position.x)-16 || p.position.x > Math.max(x,b.position.x)+16 || p.position.y < Math.min(y,b.position.y)-16 || p.position.y > Math.max(y,b.position.y)+16) continue;
        if(!d2 || contacts.has([b.id,p.id].sort((a,b)=>a-b).join(':'))) continue;
        const r=balance.plinko.geometry.ballRadius+balance.plinko.geometry.pegRadius;
        if(Math.hypot(x-p.position.x,y-p.position.y)<=r || Math.hypot(b.position.x-p.position.x,b.position.y-p.position.y)<=r) continue;
        const t=Math.max(0,Math.min(1,((p.position.x-x)*dx+(p.position.y-y)*dy)/d2));
        // Circle bodies are polygons: use a conservative inner radius margin.
        if(Math.hypot(x+t*dx-p.position.x,y+t*dy-p.position.y)<r*0.9) {
          sweptMisses++;
          if(examples.length<5) examples.push({from:[x,y],to:[b.position.x,b.position.y],peg:[p.position.x,p.position.y]});
        }
      }
    }
    return result;
  };
  const [amplifierLevel, returnLevel, splitterLevel, jackpotBiasLevel] = levels as [number,number,number,number];
  const samples=runCascadePhysicalDrops(balance,{runs,seed,batchSize:64,pocketMultipliers:balance.plinko.basePockets,specialLevels:{amplifierLevel,returnLevel,splitterLevel,jackpotBiasLevel}});
  const pockets=Array(10).fill(0) as number[];
  for(const s of samples) s.pocketCounts.forEach((v,i)=>pockets[i]!+=v);
  const total=pockets.reduce((a,b)=>a+b,0);
  const row={name,runs,totalTerminalBalls:total,pockets,edgeBallRate:(pockets[0]!+pockets[9]!)/total,dropWithEdgeRate:samples.filter(s=>s.pocketCounts[0]!+s.pocketCounts[9]!>0).length/runs,stuck:samples.filter(s=>s.stuck).length,maxStep,maxPegZoneStep,sweptMisses,ballSteps,examples};
  results.push(row); console.log(JSON.stringify(row));
}
Matter.Engine.update=originalUpdate;
writeFileSync(`reports/physics/2026-10-03/audit-${engineKind}.json`,JSON.stringify({engineKind,revision,configSha256:createHash('sha256').update(readFileSync('balance.v0.json')).digest('hex'),seed,model:'existing Matter cascade runner; no economy changes; conservative swept peg test v1',results},null,2)+'\n');
