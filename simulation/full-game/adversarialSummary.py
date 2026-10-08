import csv, gzip, hashlib, json, pathlib, statistics, sys

root = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'reports/pacing/2026-10-08-adversarial')
groups, rows, all_runs = [], [], {}
median = lambda a: statistics.median(a) if a else None
for file in sorted(root.glob('*/*/runs.json.gz')):
    data = json.loads(gzip.decompress(file.read_bytes()))
    metadata = data['metadata']
    group = str(file.parent.relative_to(root))
    summaries = json.loads((file.parent/'summary.json').read_text())
    assert len(data['runs']) == metadata['count']
    assert len({r['seed'] for r in data['runs']}) == metadata['count']
    assert {r['result']['configHash'] for r in data['runs']} == {metadata['configHash']}
    all_runs[group] = data['runs']
    first_million, final_phase, purchase_gaps, last_splitter, last_return, last_amplifier = [], [], [], [], [], []
    for r in data['runs']:
        result = r['result']; trace = r['trace']
        seconds = sum(result['diagnostics']['activeSeconds'].values())
        win = result['outcome']=='VICTORY'
        million = next((t['seconds'] for t in trace if t['cash']>=1000000), None)
        purchases = [t for t in trace if t['action']['type'].startswith('BUY_')]
        if win:
            if million is not None: first_million.append(million/60); final_phase.append((seconds-million)/60)
            purchase_gaps.append(max([b['seconds']-a['seconds'] for a,b in zip(purchases,purchases[1:])] or [0])/60)
            for track, dest in [('splitter',last_splitter),('return',last_return),('amplifier',last_amplifier)]:
                # Trace is observed before purchase. Read the next durable level to
                # distinguish a maximum purchase from a lower tier.
                for i,t in enumerate(trace[:-1]):
                    a=t['action']
                    maximum={'splitter':5,'return':4,'amplifier':5}[track]
                    if a['type']=='BUY_PLINKO_SPECIAL' and a.get('track')==track and trace[i+1]['levels'][track]==maximum:
                        dest.append((seconds-t['seconds'])/60)
        rows.append(dict(group=group,seed=r['seed'],outcome=result['outcome'],minutes=seconds/60,gameDayIndex=result['state']['clock']['gameDayIndex'],work=result['counters']['workShifts'],drops=result['counters']['plinkoDrops'],food=result['counters']['foodActions'],sleep=result['counters']['sleeps'],events=result['counters']['eventsResolved'],dumpster=result['counters']['dumpsterSearches'],observedMinimumCash=min(t['cash'] for t in trace),firstMillionMinutes=None if million is None else million/60,purchaseGapMinutes=max([b['seconds']-a['seconds'] for a,b in zip(purchases,purchases[1:])] or [0])/60))
    summaries.update(group=group,firstMillionMedianMinutes=median(first_million),millionToWinMedianMinutes=median(final_phase),longestInternalPurchaseGapMedianMinutes=median(purchase_gaps),lastSplitterToWinMedianMinutes=median(last_splitter),lastReturnToWinMedianMinutes=median(last_return),lastAmplifierToWinMedianMinutes=median(last_amplifier))
    groups.append(summaries)
paired = {}
reference = {r['seed']:r for r in all_runs['holdout/cheapest-continuous-fast']}
for group in ['holdout/skip-splitter-continuous-fast','holdout/insurance-first-continuous-fast','holdout/cheapest-continuous-ordinary']:
    deltas=[]
    for r in all_runs[group]:
        a=reference[r['seed']]
        if a['result']['outcome']==r['result']['outcome']=='VICTORY':
            deltas.append((sum(r['result']['diagnostics']['activeSeconds'].values())-sum(a['result']['diagnostics']['activeSeconds'].values()))/60)
    paired[group]={'commonWins':len(deltas),'medianMinutesDelta':median(deltas)}
report={'runs':len(rows),'distinctSeeds':len({r['seed'] for r in rows}),'groups':groups,'paired':paired}
(root/'analysis.json').write_text(json.dumps(report,indent=2)+'\n')
with (root/'runs.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
# Keep the fastest successful trace and the insurance loss for exact inspection.
for label, candidates in [('fastest',[r for rs in all_runs.values() for r in rs if r['result']['outcome']=='VICTORY']),('insurance-loss',[r for r in all_runs['holdout/insurance-first-continuous-fast'] if r['result']['outcome']!='VICTORY'])]:
    if candidates:
        r=min(candidates,key=lambda r:sum(r['result']['diagnostics']['activeSeconds'].values()))
        (root/(label+'-replay.json')).write_text(json.dumps(r,indent=2)+'\n')
(root/'manifest.json').write_text(json.dumps({str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file() and p.name!='manifest.json'},indent=2)+'\n')
print(json.dumps({'runs':len(rows),'paired':paired,'holdout':[{k:v for k,v in g.items() if k!='metadata'} for g in groups if g['group'].startswith('holdout')]},indent=2))
