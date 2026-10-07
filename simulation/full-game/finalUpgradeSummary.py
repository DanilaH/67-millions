import json,gzip,pathlib,statistics,sys
root=pathlib.Path(sys.argv[1]);rows=[]
def med(a):
 a=[v for v in a if v is not None];return statistics.median(a) if a else None
for p in sorted(root.glob('*/runs.json.gz')):
 x=json.load(gzip.open(p))
 for r in x['runs']:
  t=r['trace'];res=r['result'];seconds=sum(res['diagnostics']['activeSeconds'].values());bu=[z for z in t if z['action']['type'].startswith('BUY_PLINKO_')]
  buys={track:next((z['seconds']/60 for z in bu if z['action'].get('track')==track and z['levels'][track]==level-1),None) for track,level in [('splitter',5),('return',4),('amplifier',5)]}
  million=next((z['seconds']/60 for z in t if z['cash']>=1e6),None)
  if x['metadata']['skipFinal']:assert buys[x['metadata']['skipFinal']] is None
  rows.append({'scenario':p.parent.name,'seed':res['seed'],'outcome':res['outcome'],'minutes':seconds/60,'work':res['counters']['workShifts'],'drops':res['counters']['plinkoDrops'],'longestGap':max([(b['seconds']-a['seconds'])/60 for a,b in zip(bu,bu[1:])] or [0]),'millionToEnd':seconds/60-million if million is not None else None,'buys':buys})
summaries=[]
for name in sorted({r['scenario'] for r in rows}):
 group=[r for r in rows if r['scenario']==name];wins=[r for r in group if r['outcome']=='VICTORY']
 summaries.append({'scenario':name,'runs':len(group),'wins':len(wins),'medians':{k:med([r[k] for r in wins]) for k in ['minutes','work','drops','longestGap','millionToEnd']},'purchases':{k:sum(r['buys'][k] is not None for r in group) for k in ['splitter','return','amplifier']},'remainingAfterPurchase':{k:med([r['minutes']-r['buys'][k] for r in wins if r['buys'][k] is not None]) for k in ['splitter','return','amplifier']}})
pairs=[]
for prefix in ['', 'holdout-']:
 for mode in ['burst','continuous-spend']:
  base={r['seed']:r for r in rows if r['scenario']==prefix+'buy-'+mode}
  for name in sorted({r['scenario'] for r in rows if r['scenario'].startswith(prefix) and r['scenario'].endswith('-'+mode)}):
   if name==prefix+'buy-'+mode:continue
   new={r['seed']:r for r in rows if r['scenario']==name};common=[s for s in base.keys()&new.keys() if base[s]['outcome']==new[s]['outcome']=='VICTORY']
   if common:pairs.append({'baseline':prefix+'buy-'+mode,'candidate':name,'commonWins':len(common),'medianDelta':{k:med([new[s][k]-base[s][k] for s in common if base[s][k] is not None and new[s][k] is not None]) for k in ['minutes','work','drops','longestGap','millionToEnd']}})
(root/'analysis.json').write_text(json.dumps({'summaries':summaries,'pairs':pairs,'rows':rows},indent=2)+'\n')
for s in summaries:print(s)
for p in pairs:print(p)
