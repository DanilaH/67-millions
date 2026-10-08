import csv, gzip, hashlib, json, pathlib, statistics, sys

root=pathlib.Path(sys.argv[1]); median=lambda a:statistics.median(a) if a else None
groups=[];rows=[];indexed={}
for file in sorted(root.glob('*/*/*/runs.json.gz')):
    if file.relative_to(root).parts[0] not in ['selection','holdout','ordinary','ablation']:continue
    data=json.loads(gzip.decompress(file.read_bytes())); metadata=data['metadata']
    group=str(file.parent.relative_to(root)); assert len(data['runs'])==metadata['count']
    assert len({r['seed'] for r in data['runs']})==metadata['count']
    assert {r['result']['configHash'] for r in data['runs']}=={metadata['configHash']}
    group_rows=[]
    for r in data['runs']:
        result,trace=r['result'],r['trace']; minutes=sum(result['diagnostics']['activeSeconds'].values())/60
        if metadata['strategy']=='income-path-insurance' and result['outcome']=='VICTORY':
            assert result['state']['plinkoInsuranceLevel']==3,'Insurance policy did not purchase insurance'
        if metadata['strategy']=='income-path':assert result['state']['plinkoInsuranceLevel']==0
        if metadata['incomeEstimator']:assert metadata['incomeEstimator']['model']=='normalized-paired-single-root-capacity-proxy-v2'
        million=next((t['seconds']/60 for t in trace if t['cash']>=1000000),None)
        buys=[t['seconds']/60 for t in trace if t['action']['type'].startswith('BUY_')]
        row=dict(group=group,seed=r['seed'],outcome=result['outcome'],minutes=minutes,
                 firstMillionMinutes=million,finalPhaseMinutes=None if million is None else minutes-million,
                 purchaseGapMinutes=max([b-a for a,b in zip(buys,buys[1:])] or [0]),
                 work=result['counters']['workShifts'],drops=result['counters']['plinkoDrops'],purchases=result['counters']['purchases'],
                 finalReturnLevel=result['state']['plinkoReturnLevel'],finalCash=result['state']['cash'])
        rows.append(row);group_rows.append(row)
    indexed[group]={r['seed']:r for r in group_rows}
    summary=json.loads((file.parent/'summary.json').read_text());wins=[r for r in group_rows if r['outcome']=='VICTORY']
    summary.update(group=group,finalPhaseMedianMinutes=median([r['finalPhaseMinutes'] for r in wins if r['finalPhaseMinutes'] is not None]),
        purchaseGapMedianMinutes=median([r['purchaseGapMinutes'] for r in wins]),medianFinalReturnAll=median([r['finalReturnLevel'] for r in group_rows]))
    groups.append(summary)
paired={}
for group,candidate in indexed.items():
    if '/control/' in group:continue
    reference=group.split('/');reference[1]='control';reference='/'.join(reference)
    if reference not in indexed:continue
    common=[(indexed[reference][s],r) for s,r in candidate.items() if r['outcome']==indexed[reference][s]['outcome']=='VICTORY']
    paired[group]=dict(commonWins=len(common),medianMinutesDelta=median([b['minutes']-a['minutes'] for a,b in common]),
        medianFinalPhaseDelta=median([b['finalPhaseMinutes']-a['finalPhaseMinutes'] for a,b in common if b['finalPhaseMinutes'] is not None and a['finalPhaseMinutes'] is not None]),
        medianPurchaseGapDelta=median([b['purchaseGapMinutes']-a['purchaseGapMinutes'] for a,b in common]))
if 'ablation/control/skip-late-stakes-fast' in indexed:
    control=indexed['ablation/control/cheapest-fast'];candidate=indexed['ablation/control/skip-late-stakes-fast']
    common=[(control[s],r) for s,r in candidate.items() if control[s]['outcome']==r['outcome']=='VICTORY']
    paired['ablation/skip-late-stakes-vs-cheapest']=dict(commonWins=len(common),medianMinutesDelta=median([b['minutes']-a['minutes'] for a,b in common]))
caches=[]
bootstrap=json.loads((root/'holdout/bootstrap.json').read_text()) if (root/'holdout/bootstrap.json').exists() else None
for p in sorted(root.glob('*/*/income-cache.json')):
    if p.relative_to(root).parts[0] not in ['selection','holdout','ordinary']:continue
    x=json.loads(p.read_text());preloaded=bootstrap['boardsPreloaded'] if bootstrap and p.relative_to(root).parts[0]=='holdout' else 0
    assert len(x['measurements'])>=preloaded
    caches.append(dict(path=str(p.relative_to(root)),identity=x['identity'],boards=len(x['measurements']),preloadedBoards=preloaded,executions=x['identity']['count']*(len(x['measurements'])-preloaded)))
analysis=dict(runs=len(rows),distinctFullGameSeeds=len({r['seed'] for r in rows}),groups=groups,paired=paired,incomeCaches=caches,
    physicalExecutions=sum(c['executions'] for c in caches),limitations='Winner medians condition on survival. Different policies/configurations reuse seeds. Income proxy is a noisy heuristic, not optimal play or human difficulty.')
(root/'analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
with (root/'runs.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
(root/'manifest.json').write_text(json.dumps({str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file() and p.name!='manifest.json'},indent=2)+'\n')
print(json.dumps({k:v for k,v in analysis.items() if k!='groups'},indent=2))
