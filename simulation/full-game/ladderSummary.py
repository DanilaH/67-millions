"""Extend the existing middle-ladder analysis with stopping/payback evidence."""
import gzip, hashlib, json, pathlib, runpy, statistics, sys
root=pathlib.Path(sys.argv[1]);runpy.run_path('simulation/full-game/middleSummary.py',run_name='__main__')
analysis=json.loads((root/'analysis.json').read_text());indexed={};stopping={};purchases={}
for file in sorted(root.glob('*/*/*/runs.json.gz')):
    data=json.loads(gzip.decompress(file.read_bytes()));meta=data['metadata'];group=str(file.parent.relative_to(root));indexed[group]={r['seed']:r for r in data['runs']}
    for r in data['runs']:
        state=r['result']['state'];count=sum(state[f] for f in ['plinkoCenterLevel','plinkoMidLevel','plinkoJackpotLevel','plinkoAmplifierLevel','plinkoReturnLevel','plinkoSplitterLevel','plinkoJackpotBiasLevel','plinkoMaxBetLevel','plinkoCapacityLevel','plinkoInsuranceLevel'])
        buys=[t for t in r['trace'] if t['action']['type'].startswith('BUY_PLINKO_')]
        assert len(buys)==count
        if group.startswith('stopping/'):
            assert meta['purchaseCutoff']==32 and count<=32
        else:assert meta['purchaseCutoff'] is None
    purchases[group]=dict(finalCasinoPurchases=[sum(r['result']['state'][f] for f in ['plinkoCenterLevel','plinkoMidLevel','plinkoJackpotLevel','plinkoAmplifierLevel','plinkoReturnLevel','plinkoSplitterLevel','plinkoJackpotBiasLevel','plinkoMaxBetLevel','plinkoCapacityLevel','plinkoInsuranceLevel']) for r in data['runs']])
med=lambda xs:statistics.median(xs) if xs else None
minutes=lambda r:sum(r['result']['diagnostics']['activeSeconds'].values())/60
for group,runs in indexed.items():
    if not group.startswith('stopping/'):continue
    reference=indexed[group.replace('stopping/','holdout/',1)]
    assert runs.keys()<=reference.keys()
    common=[(reference[s],r) for s,r in runs.items() if reference[s]['result']['outcome']==r['result']['outcome']=='VICTORY']
    stopping[group]=dict(commonWins=len(common),medianMinutesDelta=med([minutes(b)-minutes(a) for a,b in common]),
        controlOnlyWins=sum(reference[s]['result']['outcome']=='VICTORY' and r['result']['outcome']!='VICTORY' for s,r in runs.items()),
        cutoffReached=sum(sum(r['result']['state'][f] for f in ['plinkoCenterLevel','plinkoMidLevel','plinkoJackpotLevel','plinkoAmplifierLevel','plinkoReturnLevel','plinkoSplitterLevel','plinkoJackpotBiasLevel','plinkoMaxBetLevel','plinkoCapacityLevel','plinkoInsuranceLevel'])==32 for r in runs.values()))
analysis.update(stoppingVsUnlimited=stopping,purchaseCounts=purchases)
(root/'analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
(root/'manifest.json').write_text(json.dumps({str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file() and p.name!='manifest.json'},indent=2)+'\n')
