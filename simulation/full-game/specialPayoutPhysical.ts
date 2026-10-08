import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parseBalanceConfig } from '../../src/config/balance';
import { createInitialGameState } from '../../src/core/state/GameState';
import { createSharedWorld } from './sharedWorld';

const count = Number(process.argv[2] ?? 2000);
const output = process.argv[3]!;
if (!Number.isInteger(count) || count < 1 || !output) throw Error('Invalid arguments');
const seeds = Array.from({length:count}, (_, i) => createHash('sha256').update(`67145000:${i}`).digest().readUInt32BE(0) || 1);
const rows: object[] = [];
const samples: object[] = [];
for (const candidate of ['control', 'combined']) {
  const raw = readFileSync(`reports/pacing/2026-10-08-special-payouts/configs/${candidate}.json`, 'utf8');
  const config = parseBalanceConfig(JSON.parse(raw));
  const maximum = {plinkoCenterLevel:2, plinkoMidLevel:3, plinkoJackpotLevel:3,
    plinkoAmplifierLevel:5, plinkoReturnLevel:4, plinkoSplitterLevel:5, plinkoJackpotBiasLevel:4};
  const variants = [
    {name:'bare', levels:{}},
    {name:'early', levels:{plinkoCenterLevel:1, plinkoMidLevel:1, plinkoJackpotLevel:1,
      plinkoAmplifierLevel:1, plinkoReturnLevel:1, plinkoSplitterLevel:1, plinkoJackpotBiasLevel:1}},
    {name:'middle', levels:{plinkoCenterLevel:2, plinkoMidLevel:2, plinkoJackpotLevel:2,
      plinkoAmplifierLevel:3, plinkoReturnLevel:2, plinkoSplitterLevel:3, plinkoJackpotBiasLevel:2}},
    {name:'maximum', levels:maximum},
    {name:'amplifier-4', levels:{...maximum, plinkoAmplifierLevel:4}},
    {name:'splitter-4', levels:{...maximum, plinkoSplitterLevel:4}},
  ];
  for (const variant of variants) {
    const values: number[] = [];
    for (const seed of seeds) {
      const world = createSharedWorld({...createInitialGameState(config, seed), cash:100000, ...variant.levels},config);
      try {
        if (!world.launch(1)) throw Error('Launch rejected');
        let ticks=0;
        while(world.active && ticks < 3600) {world.step(); ticks++;}
        if(world.active) throw Error(`Unresolved ${candidate}/${variant.name}/${seed}`);
        const s = world.snapshot(), settlement=s.settlements[0]!;
        values.push(settlement.payout/settlement.stake);
        samples.push({candidate,variant:variant.name,seed,ticks,payout:settlement.payout,stake:settlement.stake,pockets:s.diagnostics.pockets});
      } finally {world.destroy();}
    }
    const mean=values.reduce((a,b)=>a+b,0)/count;
    rows.push({candidate,variant:variant.name,count,meanGrossReturn:mean,
      standardError: count > 1 ? Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/(count-1)/count) : null,
      configHash:createHash('sha256').update(raw).digest('hex')});
    console.error(candidate,variant.name,mean);
  }
}
mkdirSync(output,{recursive:true});
writeFileSync(`${output}/summary.json`,JSON.stringify({seedSampling:'SHA256(67145000:index) first uint32, matched roots',model:'production shared-world adapter, single roots, no insurance',rows},null,2));
writeFileSync(`${output}/samples.json.gz`,gzipSync(JSON.stringify(samples)));
