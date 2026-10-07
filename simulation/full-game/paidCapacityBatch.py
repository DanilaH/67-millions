import json,os,pathlib,subprocess,sys
root=pathlib.Path('reports/pacing/2026-10-07-paid-capacity')
specs=json.loads((root/'scenarios.json').read_text())
count=int(sys.argv[1]);seed=int(sys.argv[2]);prefix=sys.argv[3]
for name in sys.argv[4:]:
 spec=specs[name]
 for mode in ['burst','continuous-spend']:
  env=dict(os.environ)
  for key in ['AUDIT_PAID_CAPACITY','AUDIT_CAPACITY_LADDER','AUDIT_SKIP_FINAL']:env.pop(key,None)
  env.update(AUDIT_PURCHASE_POLICY='all',AUDIT_BATCHES='6',AUDIT_CAPACITY_POLICY=spec.get('policy','cheapest'))
  if spec.get('ladder'):env['AUDIT_PAID_CAPACITY']=json.dumps(spec['ladder'])
  output=root/(prefix+name+'-'+mode)
  with open('/tmp/paid-'+prefix+name+'-'+mode+'.log','w') as log:
   subprocess.run(['node','--import','tsx','simulation/full-game/timingAudit.ts',str(count),str(output),'2',str(root/spec['config']),str(seed),'BASELINE_GROWTH',mode],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
