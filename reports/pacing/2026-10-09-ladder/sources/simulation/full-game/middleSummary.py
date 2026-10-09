"""Matched middle-stake audit; timing is modeled, not human playtesting."""
import csv, gzip, hashlib, json, pathlib, statistics, sys

root = pathlib.Path(sys.argv[1])
median = lambda xs: statistics.median(xs) if xs else None
quantile = lambda xs, p: sorted(xs)[int((len(xs)-1)*p)] if xs else None
rows, groups, indexed, caches = [], [], {}, []
measurements = {}
for file in sorted(root.glob('*/*/income-cache.json')):
    cache = json.loads(file.read_text())
    boot = json.loads(pathlib.Path(str(file)+'.bootstrap.json').read_text())
    assert cache['identity']['model'] == 'normalized-paired-single-root-capacity-proxy-v2'
    assert cache['identity']['count'] == boot['count'] == 128
    assert cache['identity']['seedStart'] == boot['seedStart'] == 67146000
    assert len(cache['measurements']) >= boot['boardsPreloaded']
    caches.append(dict(path=str(file.relative_to(root)), boards=len(cache['measurements']),
        preloaded=boot['boardsPreloaded'], executions=(len(cache['measurements'])-boot['boardsPreloaded'])*128))
    for key, value in cache['measurements'].items():
        if key in measurements: assert measurements[key] == value, key
        measurements[key] = value

for file in sorted(root.glob('*/*/*/runs.json.gz')):
    phase, candidate, label = file.parent.relative_to(root).parts
    assert phase in ['selection', 'holdout', 'ordinary', 'recovery', 'stopping']
    data = json.loads(gzip.decompress(file.read_bytes())); meta = data['metadata']
    config = json.loads((root/'configs'/f'{candidate}.json').read_text())
    assert hashlib.sha256((root/'configs'/f'{candidate}.json').read_bytes()).hexdigest() == meta['configHash']
    assert len(data['runs']) == meta['count'] == len({r['seed'] for r in data['runs']})
    for path, digest in meta['sources'].items():
        assert hashlib.sha256((root/'sources'/path).read_bytes()).hexdigest() == digest, path
    group = str(file.parent.relative_to(root)); group_rows = []
    for r in data['runs']:
        result, trace = r['result'], r['trace']; assert result['configHash'] == meta['configHash']
        if meta['strategy']=='income-path': assert result['state']['plinkoInsuranceLevel']==0
        if meta['strategy']=='income-path-insurance' and result['outcome']=='VICTORY': assert result['state']['plinkoInsuranceLevel']==3
        if meta['strategy']=='skip-late-stakes': assert result['state']['plinkoMaxBetLevel']<=3
        times = result['diagnostics']['activeSeconds']; seconds = sum(times.values())
        buys = [t for t in trace if t['action']['type'].startswith('BUY_PLINKO_')]
        gaps = [(b['seconds']-a['seconds'])/60 for a,b in zip(buys,buys[1:])]
        million = next((t['seconds']/60 for t in trace if t['cash']>=1000000), None)
        stake_buys = [t for t in buys if t['action']['type']=='BUY_PLINKO_MAX_BET']
        drawdowns = []
        for i, (a,b) in enumerate(zip(trace, trace[1:])):
            # Same-day drained casino sessions avoid auto-Barry debits. Exclude
            # pending event choices. Cash recovery may include work and purchases.
            if a['action']['type']!='PLINKO' or a['cash']<=0 or b['action']['type']=='EVENT_CHOICE': continue
            if a['clock']['gameDayIndex']!=b['clock']['gameDayIndex'] or b['cash']>a['cash']*.9: continue
            recovered=next((t for t in trace[i+1:] if t['cash']>=a['cash']), None)
            drawdowns.append(dict(beforeCash=a['cash'],afterCash=b['cash'],
                recoveryMinutes=None if recovered is None else (recovered['seconds']-b['seconds'])/60))
        paybacks = []
        for t in stake_buys:
            levels=t['levels']; level=levels['maxBet']; key='/'.join(str(levels[k]) for k in ['center','mid','jackpot','amplifier','return','splitter','guides'])
            m=measurements.get(key)
            if not m: continue
            a,b=config['plinko']['maxBetLevels'][level:level+2]
            delta=(m['mean']-1)*(b['maxBet']-a['maxBet'])*t['capacity']/m['seconds']
            paybacks.append(dict(level=level+1, atMinutes=t['seconds']/60,
                proxyNetGainPerSecond=delta, proxyPaybackSeconds=b['price']/delta if delta>0 else None))
        row=dict(group=group,seed=r['seed'],outcome=result['outcome'],minutes=seconds/60,
            firstMillionMinutes=million,finalPhaseMinutes=None if million is None else seconds/60-million,
            firstCasinoPurchaseMinutes=buys[0]['seconds']/60 if buys else None,
            longestInternalGapMinutes=max(gaps or [0]),
            finalNoPurchaseMinutes=(seconds-buys[-1]['seconds'])/60 if buys else seconds/60,
            work=result['counters']['workShifts'],workMinutes=times['work']/60,idleMinutes=times['idle']/60,
            drops=result['counters']['plinkoDrops'],casinoPurchases=len(buys),
            finalStakeLevel=result['state']['plinkoMaxBetLevel'],finalCash=result['state']['cash'],
            stakeUnlockMinutes={str(t['levels']['maxBet']+1):t['seconds']/60 for t in stake_buys},
            nearZeroCashRecoveries=result['diagnostics']['nearZeroCashRecoveries'],stakePaybackProxies=paybacks)
        row['observedCasinoDrawdowns']=drawdowns
        group_rows.append(row);rows.append(row)
    indexed[group]={r['seed']:r for r in group_rows}; wins=[r for r in group_rows if r['outcome']=='VICTORY']
    fields=['minutes','firstMillionMinutes','finalPhaseMinutes','firstCasinoPurchaseMinutes','longestInternalGapMinutes','finalNoPurchaseMinutes','work','workMinutes','idleMinutes','drops','casinoPurchases']
    groups.append(dict(group=group,count=len(group_rows),wins=len(wins),
        outcomes={v:sum(r['outcome']==v for r in group_rows) for v in sorted({r['outcome'] for r in group_rows})},
        winnerMedians={f:median([r[f] for r in wins if r[f] is not None]) for f in fields},
        fastestWinMinutes=min([r['minutes'] for r in wins],default=None),
        allLongestGapP90=quantile([r['longestInternalGapMinutes'] for r in group_rows],.9),
        allLongestGapMax=max(r['longestInternalGapMinutes'] for r in group_rows),
        winnerStakeUnlockMedians={str(level):median([r['stakeUnlockMinutes'][str(level)] for r in wins if str(level) in r['stakeUnlockMinutes']]) for level in range(1,7)},
        winnerStakeProxyPaybackMedians={str(level):median([p['proxyPaybackSeconds'] for r in wins for p in r['stakePaybackProxies'] if p['level']==level and p['proxyPaybackSeconds'] is not None]) for level in range(1,7)}))
    episodes=[d for r in group_rows for d in r['observedCasinoDrawdowns']]
    groups[-1]['observedCasinoDrawdowns']=dict(thresholdFraction=.1,count=len(episodes),recovered=sum(d['recoveryMinutes'] is not None for d in episodes),
        medianRecoveredMinutes=median([d['recoveryMinutes'] for d in episodes if d['recoveryMinutes'] is not None]),
        recoveredP90Minutes=quantile([d['recoveryMinutes'] for d in episodes if d['recoveryMinutes'] is not None],.9))
paired={}
for group, runs in indexed.items():
    parts=group.split('/'); baseline='control-depleted' if parts[0]=='recovery' else 'control'
    if parts[1]==baseline: continue
    parts[1]=baseline; reference=indexed['/'.join(parts)]
    assert runs.keys()==reference.keys()
    common=[(reference[s],r) for s,r in runs.items() if reference[s]['outcome']==r['outcome']=='VICTORY']
    paired[group]=dict(commonWins=len(common), candidateOnlyWins=sum(r['outcome']=='VICTORY' and reference[s]['outcome']!='VICTORY' for s,r in runs.items()),
        controlOnlyWins=sum(r['outcome']!='VICTORY' and reference[s]['outcome']=='VICTORY' for s,r in runs.items()),
        medianDeltas={f:median([b[f]-a[f] for a,b in common if a[f] is not None and b[f] is not None]) for f in ['minutes','finalPhaseMinutes','longestInternalGapMinutes','finalNoPurchaseMinutes','work','workMinutes','idleMinutes']})
analysis=dict(runs=len(rows),distinctFullGameSeeds=len({r['seed'] for r in rows}),groups=groups,paired=paired,
    incomeCaches=caches,newPhysicalExecutions=sum(c['executions'] for c in caches),distinctRankingSeeds=128,
    limitations='Matched seeds reused across policies/configs; paths diverge. Winner medians condition on survival. Payback proxies use isolated means, ignore insurance/risk and real concurrent throughput. Recovery is a depleted initial-cash intervention, not an actual preceding losing cascade. Milestones observe decision-boundary cash.')
(root/'analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
with (root/'runs.csv').open('w',newline='') as f:
    fields=[k for k in rows[0] if k not in ['stakePaybackProxies','observedCasinoDrawdowns']]
    w=csv.DictWriter(f,fieldnames=fields,lineterminator='\n');w.writeheader()
    w.writerows({k:json.dumps(r[k],separators=(',',':')) if isinstance(r[k],(dict,list)) else r[k] for k in fields} for r in rows)
print(json.dumps({k:v for k,v in analysis.items() if k not in ['groups','incomeCaches']},indent=2))
