import json,gzip,pathlib,statistics,subprocess,sys
root=pathlib.Path('reports/pacing/2026-10-07-final-check')
subprocess.run([sys.executable,'simulation/full-game/paidCapacitySummary.py',str(root)],stdout=subprocess.DEVNULL,check=True)
x=json.loads((root/'analysis.json').read_text())
def q(a,p):
 a=sorted(a);return a[round((len(a)-1)*p)] if a else None
extra=[]
for path in sorted(root.glob('*/runs.json.gz')):
 data=json.load(gzip.open(path));allrows=[r for r in x['rows'] if r['scenario']==path.parent.name];wins=[r for r in allrows if r['outcome']=='VICTORY'];gaps=[];initial=[];final=[]
 for run in data['runs']:
  t=run['trace'];bu=[z for z in t if z['action']['type'].startswith('BUY_PLINKO_') or z['action']['type']=='AUDIT_BUY_CAPACITY']
  duration=sum(run['result']['diagnostics']['activeSeconds'].values())/60
  initial.append(bu[0]['seconds']/60 if bu else duration)
  final.append(duration-bu[-1]['seconds']/60 if bu else duration)
  gaps.append(max([(b['seconds']-a['seconds'])/60 for a,b in zip(bu,bu[1:])] or [0]))
  if path.parent.name.startswith('stress-stop-at-12'):
   levels=run['result']['state'];assert sum(levels[k] for k in ['plinkoCenterLevel','plinkoMidLevel','plinkoJackpotLevel','plinkoAmplifierLevel','plinkoReturnLevel','plinkoSplitterLevel','plinkoJackpotBiasLevel'])<=12
 extra.append(dict(scenario=path.parent.name,outcomes={o:sum(r['outcome']==o for r in allrows) for o in sorted({r['outcome'] for r in allrows})},winMinutesP10=q([r['minutes'] for r in wins],.1),winMinutesP90=q([r['minutes'] for r in wins],.9),allLongestGapP90=q(gaps,.9),allLongestGapMax=max(gaps),initialPurchaseP90=q(initial,.9),finalNoPurchaseP90=q(final,.9),lossSeeds=[r['seed'] for r in allrows if r['outcome']!='VICTORY']))
pairs=[]
for mode in ['burst','continuous']:
 base={r['seed']:r for r in x['rows'] if r['scenario']=='price-100000-'+mode}
 for price in [25000,50000]:
  new={r['seed']:r for r in x['rows'] if r['scenario']==f'price-{price}-'+mode};common=[s for s in base.keys()&new.keys() if base[s]['outcome']==new[s]['outcome']=='VICTORY']
  if common:pairs.append(dict(mode=mode,price=price,commonWins=len(common),deltaMinutes=statistics.median(new[s]['minutes']-base[s]['minutes'] for s in common),deltaLongestGap=statistics.median(new[s]['longestGap']-base[s]['longestGap'] for s in common)))
(root/'stress-analysis.json').write_text(json.dumps(dict(groups=extra,pricePairs=pairs),indent=2)+'\n')
for r in extra:print(r)
for r in pairs:print(r)
# Attribute long internal purchase intervals to decisions for diagnostic context.
from collections import defaultdict
intervals=[]
for path in sorted(root.glob('stress-*/runs.json.gz')):
 for run in json.load(gzip.open(path))['runs']:
  trace=run['trace'];indices=[i for i,t in enumerate(trace) if t['action']['type'].startswith('BUY_PLINKO_') or t['action']['type']=='AUDIT_BUY_CAPACITY']
  for start,end in zip(indices,indices[1:]):
   duration=(trace[end]['seconds']-trace[start]['seconds'])/60
   if duration<3:continue
   activities=defaultdict(float)
   for i in range(start,end):activities[trace[i]['action']['type']]+=(trace[i+1]['seconds']-trace[i]['seconds'])/60
   intervals.append(dict(scenario=path.parent.name,seed=run['result']['seed'],outcome=run['result']['outcome'],minutes=duration,fromAction=trace[start]['action'],toAction=trace[end]['action'],activityMinutes=dict(activities)))
intervals.sort(key=lambda r:r['minutes'],reverse=True)
(root/'long-gaps.json').write_text(json.dumps(intervals,indent=2)+'\n')
