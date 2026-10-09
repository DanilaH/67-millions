import csv, gzip, hashlib, json, pathlib, statistics, sys
root=pathlib.Path(sys.argv[1]); med=lambda xs:statistics.median(xs) if xs else None
rows=[];groups=[];indexed={}
level_fields=['plinkoCenterLevel','plinkoMidLevel','plinkoJackpotLevel','plinkoAmplifierLevel','plinkoReturnLevel','plinkoSplitterLevel','plinkoJackpotBiasLevel','plinkoMaxBetLevel','plinkoCapacityLevel','plinkoInsuranceLevel']
for file in sorted(root.glob('*/*/*/runs.json.gz')):
    phase,candidate,label=file.parent.relative_to(root).parts
    if phase not in ['selection','holdout','ordinary']:continue
    data=json.loads(gzip.decompress(file.read_bytes()));meta=data['metadata'];group=str(file.parent.relative_to(root))
    assert len(data['runs'])==meta['count']==len({r['seed'] for r in data['runs']})
    assert meta['configHash']==hashlib.sha256((root/'configs'/f'{candidate}.json').read_bytes()).hexdigest()
    for path,digest in meta['sources'].items():assert hashlib.sha256((root/'sources'/path).read_bytes()).hexdigest()==digest,path
    group_rows=[]
    for r in data['runs']:
        result=r['result'];trace=r['trace'];assert result['configHash']==meta['configHash']
        buys=[t for t in trace if t['action']['type'].startswith('BUY_PLINKO_')]
        state=result['state'];purchases=sum(state[f] for f in level_fields)
        assert purchases==len(buys),'Trace must cover every casino purchase'
        cutoff=meta['purchaseCutoff'];assert cutoff is None or purchases<=cutoff
        if cutoff is not None:
            for t in buys:
                prior=sum(t['levels'].values())+t['insurance']+(t['capacity']-2 if t['capacity']<6 else 3)
                assert prior<cutoff,'Purchased after cutoff'
        seconds=sum(result['diagnostics']['activeSeconds'].values())
        milestones={str(v):next((t['seconds']/60 for t in trace if t['cash']>=v),None) for v in [100000,1000000,10000000]}
        gaps=[(b['seconds']-a['seconds'])/60 for a,b in zip(buys,buys[1:])]
        row=dict(group=group,seed=r['seed'],outcome=result['outcome'],minutes=seconds/60,
            work=result['counters']['workShifts'],drops=result['counters']['plinkoDrops'],purchases=purchases,
            cutoffReached=cutoff is not None and purchases==cutoff,
            longestInternalGapMinutes=max(gaps or [0]),lastPurchaseMinutes=buys[-1]['seconds']/60 if buys else None,
            afterLastPurchaseMinutes=(seconds-buys[-1]['seconds'])/60 if buys else None,
            millionToFinishMinutes=None if milestones['1000000'] is None else seconds/60-milestones['1000000'],
            milestones=milestones,finalLevels={f:state[f] for f in level_fields})
        rows.append(row);group_rows.append(row)
    indexed[group]={r['seed']:r for r in group_rows};wins=[r for r in group_rows if r['outcome']=='VICTORY']
    groups.append(dict(group=group,count=len(group_rows),wins=len(wins),outcomes={v:sum(r['outcome']==v for r in group_rows) for v in sorted({r['outcome'] for r in group_rows})},
        fastestWinMinutes=min([r['minutes'] for r in wins],default=None),
        cutoffReached=sum(r['cutoffReached'] for r in group_rows),
        winnerMedians={f:med([r[f] for r in wins if r[f] is not None]) for f in ['minutes','work','drops','purchases','longestInternalGapMinutes','lastPurchaseMinutes','afterLastPurchaseMinutes','millionToFinishMinutes']},
        finalLevelWinnerMedians={f:med([r['finalLevels'][f] for r in wins]) for f in level_fields}))
paired={}
for group, runs in indexed.items():
    parts=group.split('/');label=parts[-1]
    if '-stop-none-' in label:continue
    cutoff=label.split('-stop-')[1].split('-')[0];parts[-1]=label.replace(f'-stop-{cutoff}-','-stop-none-');reference=indexed['/'.join(parts)]
    assert runs.keys()==reference.keys()
    common=[(reference[s],r) for s,r in runs.items() if reference[s]['outcome']==r['outcome']=='VICTORY']
    paired[group]=dict(commonWins=len(common),controlOnlyWins=sum(r['outcome']!='VICTORY' and reference[s]['outcome']=='VICTORY' for s,r in runs.items()),
        candidateOnlyWins=sum(r['outcome']=='VICTORY' and reference[s]['outcome']!='VICTORY' for s,r in runs.items()),
        medianDeltas={f:med([b[f]-a[f] for a,b in common if a[f] is not None and b[f] is not None]) for f in ['minutes','work','drops','longestInternalGapMinutes','afterLastPurchaseMinutes','millionToFinishMinutes']})
analysis=dict(runs=len(rows),distinctSeeds=len({r['seed'] for r in rows}),groups=groups,paired=paired,
    physicalPaidRoots=sum(r['drops'] for r in rows),limitations='Bounded cutoff/order search, not optimal stopping. Matched seeds diverge after purchases. Winner medians condition on survival. Modeled active time, not human pacing. No isolated income-ranking probes.')
(root/'analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
with (root/'runs.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');writer.writeheader()
    writer.writerows({k:json.dumps(v,separators=(',',':')) if isinstance(v,dict) else v for k,v in r.items()} for r in rows)
print('Validated',len(rows),'sessions;',analysis['distinctSeeds'],'distinct seeds')
