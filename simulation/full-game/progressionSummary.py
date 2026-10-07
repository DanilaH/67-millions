"""Summarize diagnostic timing traces; no game rules or candidate selection."""
import gzip, json, pathlib, statistics, sys
root = pathlib.Path(sys.argv[1])
median = lambda xs: statistics.median([x for x in xs if x is not None]) if any(x is not None for x in xs) else None
rows = []
for path in sorted(root.glob('*/runs.json.gz')):
    source = json.load(gzip.open(path))
    for run in source['runs']:
        result, trace = run['result'], run['trace']
        total = sum(result['diagnostics']['activeSeconds'].values())
        purchases = [t for t in trace if t['action']['type'].startswith('BUY_PLINKO_')]
        million = next((t['seconds'] for t in trace if t['cash'] >= 1_000_000), None)
        gaps = [(b['seconds'] - a['seconds'])/60 for a,b in zip(purchases,purchases[1:])]
        offers = []
        for t in purchases:
            action = t['action']; track = action.get('track', 'maxBet' if action['type']=='BUY_PLINKO_MAX_BET' else 'insurance')
            key = 'guides' if track == 'jackpotBias' else track
            offers.append({'track':track,'level':t['levels'].get(key,0)+1,'minute':t['seconds']/60,'remainingMinutes':(total-t['seconds'])/60})
        rows.append({'scenario':path.parent.name,'order':run['order'],'seed':result['seed'],'outcome':result['outcome'],
            'minutes':total/60,'work':result['counters']['workShifts'],'drops':result['counters']['plinkoDrops'],
            'gameDaysElapsed':result['counters']['gameMinutesAdvanced']/1440,
            'firstPurchase':purchases[0]['seconds']/60 if purchases else None,
            'longestInternalGap':max(gaps) if gaps else None,
            'millionToEnd':(total-million)/60 if million is not None else None,
            'lastPurchaseToEnd':(total-purchases[-1]['seconds'])/60 if purchases else None,
            'capacityUnlockMinutes':{str(n):next((t['seconds']/60 for t in trace if t['capacity']>=n),None) for n in [3,4,6]},
            'purchases':offers})
metrics=['minutes','work','drops','gameDaysElapsed','firstPurchase','longestInternalGap','millionToEnd','lastPurchaseToEnd']
summaries=[]
for scenario,order in sorted({(r['scenario'],r['order']) for r in rows}):
    group=[r for r in rows if (r['scenario'],r['order'])==(scenario,order)]
    wins=[r for r in group if r['outcome']=='VICTORY']
    summaries.append({'scenario':scenario,'order':order,'count':len(group),'wins':len(wins),
        'outcomes':{o:sum(r['outcome']==o for r in group) for o in sorted({r['outcome'] for r in group})},
        'winnerMedians':{k:median([r[k] for r in wins]) for k in metrics},
        'winnerCapacityUnlockMedians':{str(n):median([r['capacityUnlockMinutes'][str(n)] for r in wins]) for n in [3,4,6]}})
pairs=[]
for prefix,modes,candidates in [('', ['burst','continuous-spend'],['early','slow']),('holdout-', ['burst','continuous-spend'],['early']),('aggressive-', [''],['early','slow'])]:
    for mode in modes:
        suffix='-'+mode if mode else ''
        for candidate in candidates:
            for order in ['original','cheapest']:
                old={r['seed']:r for r in rows if r['scenario']==prefix+'baseline'+suffix and r['order']==order}
                new={r['seed']:r for r in rows if r['scenario']==prefix+candidate+suffix and r['order']==order}
                common=[s for s in old.keys()&new.keys() if old[s]['outcome']==new[s]['outcome']=='VICTORY']
                pairs.append({'baseline':prefix+'baseline'+suffix,'candidate':prefix+candidate+suffix,'order':order,'commonWinners':len(common),
                    'medianDelta':{k:median([new[s][k]-old[s][k] for s in common if new[s][k] is not None and old[s][k] is not None]) for k in metrics}})
(root/'analysis.json').write_text(json.dumps({'limitations':'Winner medians condition on survival; paired deltas condition on victory in both. Milestones sampled at decisions. Unlock proxies are free, not paid-track economics.', 'summaries':summaries,'pairs':pairs,'rows':rows},indent=2)+'\n')
print(json.dumps({'summaries':summaries,'pairs':pairs},indent=2))
