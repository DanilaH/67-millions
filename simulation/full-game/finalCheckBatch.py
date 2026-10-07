import json,os,pathlib,subprocess,sys
root=pathlib.Path('reports/pacing/2026-10-07-final-check')
phase=sys.argv[1]
if phase=='price':
 jobs=[(f'price-{p}-{mode}',20,67130000,p,'cheapest',1,mode,'candidate.json') for p in [25000,50000,100000] for mode in ['burst','continuous']]
else:
 price=int(sys.argv[2])
 if phase=='stress':jobs=[(f'stress-{s}-reserve{r}',40,67131000,price,s,r,'continuous','candidate.json') for s in ['cheapest','stake-first','specials-first','stop-at-12'] for r in [1,0]]
 elif phase=='recovery':jobs=[(f'recovery-{c[:-5]}-reserve{r}',40,67132000,price,'cheapest',r,'continuous',c) for c in ['candidate.json','poor-start.json'] for r in [1,0]]
 else:raise ValueError(phase)
for name,count,seed,price,strategy,reserve,mode,cfg in jobs:
 env=dict(os.environ)
 for key in ['AUDIT_CAPACITY_LADDER','AUDIT_SKIP_FINAL']:env.pop(key,None)
 env.update(AUDIT_PURCHASE_POLICY='all',AUDIT_BATCHES='6',AUDIT_CAPACITY_POLICY='cheapest',AUDIT_STRATEGY=strategy,AUDIT_RESERVE_SCALE=str(reserve),AUDIT_DIVERSE_SEEDS='1',AUDIT_PAID_CAPACITY=json.dumps([dict(capacity=c,price=p) for c,p in zip([3,4,6],[5000,price,1000000])]))
 with open('/tmp/finalcheck-'+name+'.log','w') as log:
  subprocess.run(['node','--import','tsx','simulation/full-game/timingAudit.ts',str(count),str(root/name),'2',str(root/cfg),str(seed),'BASELINE_GROWTH',mode],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
