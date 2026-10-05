import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FullGameDecision, FullGameRunResult } from './runner';

type Trace = { action: FullGameDecision; seconds: number; cash: number; drops: number };
type Run = { batch: number; order: string; result: FullGameRunResult; trace: Trace[] };
const input = JSON.parse(gunzipSync(readFileSync(process.argv[2]!)).toString()) as { metadata: unknown; runs: Run[] };
const median = (values: (number | null)[]) => {
  const a = values.filter((v): v is number => v !== null).sort((a,b) => a-b);
  return a.length ? (a[Math.floor((a.length-1)/2)]! + a[Math.floor(a.length/2)]!) / 2 : null;
};
const rows = input.runs.map(run => {
  const {trace, result} = run;
  const first = (predicate: (t: Trace) => boolean) => trace.find(predicate)?.seconds ?? null;
  const purchases = trace.filter(t => t.action.type.startsWith('BUY_PLINKO_'));
  const limits = purchases.filter(t => t.action.type === 'BUY_PLINKO_MAX_BET');
  const duration = Object.values(result.diagnostics.activeSeconds ?? {}).reduce((a,b) => a+b,0);
  const million = first(t => t.cash >= 1_000_000);
  const minutesAt = (seconds: number | null) => seconds === null ? null : seconds/60;
  const gaps = purchases.map((t,i) => t.seconds - (purchases[i-1]?.seconds ?? 0));
  if (purchases.length) gaps.push(duration - purchases.at(-1)!.seconds);
  const intervals = purchases.slice(1).map((end,i) => {
    const start=purchases[i]!;
    const actions=trace.slice(trace.indexOf(start),trace.indexOf(end)+1);
    const actionSeconds:Record<string,number>={};
    for(let n=0;n<actions.length-1;n++) {
      const action=actions[n]!;
      actionSeconds[action.action.type]=(actionSeconds[action.action.type]??0)+actions[n+1]!.seconds-action.seconds;
    }
    const toLevel=purchases.slice(0,i+2).filter(p=>JSON.stringify(p.action)===JSON.stringify(end.action)).length;
    return {minutes:(end.seconds-start.seconds)/60,startMinutes:start.seconds/60,from:start.action,to:end.action,toLevel,actionSeconds};
  }).sort((a,b)=>b.minutes-a.minutes);
  return {batch:run.batch, order:run.order, seed:result.seed, outcome:result.outcome,
    minutes:duration/60, work:result.counters.workShifts,
    firstPurchaseMinutes:purchases[0] ? purchases[0].seconds/60 : null,
    firstCasinoMinutes:minutesAt(first(t=>t.action.type==='PLINKO')),
    cash100kMinutes:minutesAt(first(t=>t.cash>=100_000)),
    millionMinutes:million === null ? null : million/60,
    millionToEndMinutes:million === null ? null : (duration-million)/60,
    maxPurchaseGapMinutes:gaps.length ? Math.max(...gaps)/60 : null,
    lastTwoLimitsGapMinutes:limits.length===6 ? (limits[5]!.seconds-limits[4]!.seconds)/60 : null,
    mid3GapMinutes:intervals.find(g=>g.to.type==='BUY_PLINKO_POCKET' && g.to.track==='mid' && g.toLevel===3)?.minutes??null,
    internalPurchaseGapMinutes:intervals[0]?.minutes??null,
    longestInternalGap:intervals[0]??null,
    plinkoPurchases:purchases.length};
});
const summaries = [...new Set(rows.map(r=>`${r.batch}/${r.order}`))].map(key => {
 const all=rows.filter(r=>`${r.batch}/${r.order}`===key), wins=all.filter(r=>r.outcome==='VICTORY');
 return {key,count:all.length,wins:wins.length,successfulLastTwoLimitsCount:wins.filter(r=>r.lastTwoLimitsGapMinutes!==null).length,successfulMedians:Object.fromEntries(
  ['minutes','work','firstPurchaseMinutes','firstCasinoMinutes','cash100kMinutes','millionMinutes','millionToEndMinutes','maxPurchaseGapMinutes','lastTwoLimitsGapMinutes','internalPurchaseGapMinutes','mid3GapMinutes','plinkoPurchases'].map(k=>[k,median(wins.map(r=>r[k as keyof typeof r] as number|null))]))};
});
writeFileSync(process.argv[3]!,JSON.stringify({metadata:input.metadata,limitations:'Milestones observe decision-boundary cash, not transient cash within a burst. Medians condition on victory; compare survivor sets and per-seed rows before inferring causal pacing. Internal purchase gaps exclude initial/final waits; actionSeconds attributes time through the next decision (including its assumed delay) to the preceding action.',summaries,rows},null,2));
console.log(JSON.stringify(summaries,null,2));
