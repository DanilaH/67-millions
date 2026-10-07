import pathlib,json,gzip,statistics,sys
root=pathlib.Path(sys.argv[1]);rows=[]
def med(a):
 a=[v for v in a if v is not None];return statistics.median(a) if a else None
for p in sorted(root.glob('*/runs.json.gz')):
 data=json.load(gzip.open(p))
 for r in data['runs']:
  res=r['result'];t=r['trace'];end=sum(res['diagnostics']['activeSeconds'].values())/60
  buys=[z for z in t if z['action']['type'].startswith('BUY_PLINKO_') or z['action']['type']=='AUDIT_BUY_CAPACITY']
  paid=[z for z in buys if z['action']['type']=='AUDIT_BUY_CAPACITY']
  ladder=data['metadata']['paidCapacity']
  if ladder:
   assert [z['action']['capacity'] for z in paid]==[z['capacity'] for z in ladder[:len(paid)]]
   assert [z['action']['price'] for z in paid]==[z['price'] for z in ladder[:len(paid)]]
   assert t[0]['capacity']==2
  else:assert not paid and t[0]['capacity']==6
  if data['metadata']['capacityPolicy']=='skip':assert not paid and all(z['capacity']==2 for z in t)
  million=next((z['seconds']/60 for z in t if z['cash']>=1e6),None)
  rows.append(dict(scenario=p.parent.name,seed=res['seed'],outcome=res['outcome'],minutes=end,work=res['counters']['workShifts'],drops=res['counters']['plinkoDrops'],millionToEnd=end-million if million is not None else None,longestGap=max([(b['seconds']-a['seconds'])/60 for a,b in zip(buys,buys[1:])] or [0]),capacityCost=sum(z['action']['price'] for z in paid),capacityPurchases=len(paid),unlockMinutes={str(n):next((z['seconds']/60 for z in t if z['capacity']>=n),None) for n in [3,4,6]},lateUpgradeRemaining={k:next((end-z['seconds']/60 for z in buys if z['action'].get('track')==k and z['levels'][k]==v-1),None) for k,v in [('return',4),('amplifier',5),('splitter',5)]}))
metrics=['minutes','work','drops','millionToEnd','longestGap','capacityCost','capacityPurchases'];summaries=[];pairs=[]
for name in sorted({r['scenario'] for r in rows}):
 group=[r for r in rows if r['scenario']==name];wins=[r for r in group if r['outcome']=='VICTORY']
 summaries.append(dict(scenario=name,runs=len(group),wins=len(wins),medians={k:med([r[k] for r in wins]) for k in metrics},unlocks={str(n):med([r['unlockMinutes'][str(n)] for r in wins]) for n in [3,4,6]},lateUpgradeRemaining={k:med([r['lateUpgradeRemaining'][k] for r in wins]) for k in ['splitter','return','amplifier']}))
for prefix in ['selection-','holdout-']:
 for mode in ['burst','continuous-spend']:
  baseline={r['seed']:r for r in rows if r['scenario']==prefix+'baseline-'+mode}
  for name in sorted({r['scenario'] for r in rows if r['scenario'].startswith(prefix) and r['scenario'].endswith('-'+mode)}):
   new={r['seed']:r for r in rows if r['scenario']==name};common=[s for s in baseline.keys()&new.keys() if baseline[s]['outcome']==new[s]['outcome']=='VICTORY']
   if common:pairs.append(dict(baseline=prefix+'baseline-'+mode,candidate=name,commonWins=len(common),medianDelta={k:med([new[s][k]-baseline[s][k] for s in common if new[s][k] is not None and baseline[s][k] is not None]) for k in metrics}))
(root/'analysis.json').write_text(json.dumps(dict(summaries=summaries,pairs=pairs,rows=rows),indent=2)+'\n')
for r in summaries:print(r['scenario'],r['wins'],'/',r['runs'],r['medians'],r['unlocks'])
