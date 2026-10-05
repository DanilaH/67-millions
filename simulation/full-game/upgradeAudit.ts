import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseBalanceConfig } from '../../src/config/balance';
import { createInitialGameState, type GameState } from '../../src/core/state/GameState';
import { SeededRandom } from '../../src/core/rng/SeededRandom';
import { gzipSync } from 'node:zlib';
import { createSharedWorld } from './sharedWorld';

// Paired independent roots isolate upgrade effects; they do not model purchases,
// mixed launch rhythms or a human strategy. No configuration is changed.
const raw = readFileSync('balance.v0.json', 'utf8');
const config = parseBalanceConfig(JSON.parse(raw));
const count = Number(process.argv[2] ?? 1000);
if (!Number.isInteger(count) || count < 1) throw Error('runs must be a positive integer');
const output = process.argv[3] ?? 'reports/pacing/2026-10-05-upgrades';
const seedStart = Number(process.argv[4] ?? 67106000);
if (!Number.isInteger(seedStart) || seedStart < 1 || seedStart > 0xffffffff) throw Error('seed must be a nonzero uint32');
// Adjacent xorshift seeds have correlated first draws. Sample one reproducible
// stream instead, and reuse those root seeds for every upgrade variant.
const seedStream = new SeededRandom(seedStart);
const seeds = Array.from({length: count}, () => { seedStream.next(); return seedStream.snapshot().state; });
const tracks = [
  ['center', 'plinkoCenterLevel', config.plinko.centerUpgrades.at(-1)!.level],
  ['mid', 'plinkoMidLevel', config.plinko.midUpgrades.at(-1)!.level],
  ['jackpot', 'plinkoJackpotLevel', config.plinko.jackpotUpgrades.at(-1)!.level],
  ['amplifier', 'plinkoAmplifierLevel', config.plinko.amplifier.at(-1)!.level],
  ['return', 'plinkoReturnLevel', config.plinko.return.at(-1)!.level],
  ['splitter', 'plinkoSplitterLevel', config.plinko.splitter.at(-1)!.level],
  ['jackpotBias', 'plinkoJackpotBiasLevel', config.plinko.jackpotBias.at(-1)!.level],
] as const;
const maximum: Partial<GameState> = Object.fromEntries(tracks.map(([,key,max]) => [key,max]));
const variants: { name: string; levels: Partial<GameState> }[] = [{ name: 'base', levels: {} }];
for (const [name,key,max] of tracks) for (let level=1;level<=max;level++) variants.push({name:`only-${name}-${level}`,levels:{[key]:level}});
variants.push({name:'maximum',levels:maximum});
for(const [name,key] of tracks) variants.push({name:`maximum-without-${name}`,levels:{...maximum,[key]:0}});
const samples: { variant: string; seed: number; payout: number; stake: number; ticks: number }[] = [];
const rows=[];
for(const variant of variants) {
  const values=[];
  const pockets=Array<number>(config.plinko.basePockets.length).fill(0);
  let edgeRoots=0, amplifierRoots=0, returnRoots=0, splitterRoots=0;
  for(let i=0;i<count;i++) {
    const world=createSharedWorld({...createInitialGameState(config,seeds[i]!),cash:100000,...variant.levels},config);
    try {
      if(!world.launch(1))throw Error('launch rejected');
      let ticks=0;
      while(world.active && ticks<3600){world.step();ticks++;}
      if(world.active)throw Error(`unresolved ${variant.name} seed ${seeds[i]!}`);
      const snapshot=world.snapshot();
      const result=snapshot.settlements[0]!;
      const d=snapshot.diagnostics;
      d.pockets.forEach((n,i)=>{pockets[i]!+=n;});
      if(d.pockets[0]!+d.pockets.at(-1)!>0)edgeRoots++;
      if(d.amplifierProcs)amplifierRoots++;
      if(d.returnProcs)returnRoots++;
      if(d.splitterProcs)splitterRoots++;
      samples.push({variant:variant.name,seed:seeds[i]!,payout:result.payout,stake:result.stake,ticks});
      values.push(result.payout/result.stake);
    } finally {world.destroy();}
  }
  values.sort((a,b)=>a-b);
  const mean=values.reduce((a,b)=>a+b,0)/count;
  rows.push({pockets,edgeRootShare:edgeRoots/count,amplifierRootShare:amplifierRoots/count,returnRootShare:returnRoots/count,splitterRootShare:splitterRoots/count,name:variant.name,levels:variant.levels,runs:count,meanGrossReturn:mean,medianGrossReturn:(values[Math.floor((count-1)/2)]!+values[Math.floor(count/2)]!)/2,lossShare:values.filter(v=>v<1).length/count,standardError:count>1?Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(count-1)/count):null});
  process.stderr.write(`${variant.name}: ${mean.toFixed(3)}x\n`);
}
mkdirSync(output,{recursive:true});
const metadata={sourceRevision:execSync('git rev-parse HEAD').toString().trim(),configHash:createHash('sha256').update(raw).digest('hex'),seedStart,rootSeedSampling:'consecutive states of xorshift32 stream, not adjacent integer seeds',runsPerVariant:count,model:'shared-world Phaser resolver v1; single roots; full core settlement',limitations:'No insurance or upgraded max bet; no interaction with purchasing policy; gross return includes stake. Paired seeds. Means can be dominated by rare tails. Not human win probabilities.'};
writeFileSync(`${output}/summary.json`,JSON.stringify({metadata,rows},null,2));
writeFileSync(`${output}/samples.csv.gz`,gzipSync('variant,seed,payout,stake,ticks\n'+samples.map(s=>[s.variant,s.seed,s.payout,s.stake,s.ticks].join(',')).join('\n')+'\n'));
