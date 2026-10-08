import csv, gzip, hashlib, json, pathlib, statistics, sys

root = pathlib.Path(sys.argv[1])
median = lambda a: statistics.median(a) if a else None
groups, rows, paired, runs_by_group = [], [], {}, {}
for file in sorted(root.glob('*/*/*/runs.json.gz')):
    data = json.loads(gzip.decompress(file.read_bytes()))
    group = str(file.parent.relative_to(root))
    assert len(data['runs']) == data['metadata']['count']
    assert len({r['seed'] for r in data['runs']}) == len(data['runs'])
    assert {r['result']['configHash'] for r in data['runs']} == {data['metadata']['configHash']}
    group_rows = []
    for r in data['runs']:
        result, trace = r['result'], r['trace']
        minutes = sum(result['diagnostics']['activeSeconds'].values()) / 60
        million = next((t['seconds'] / 60 for t in trace if t['cash'] >= 1000000), None)
        buys = [t['seconds']/60 for t in trace if t['action']['type'].startswith('BUY_')]
        row = dict(group=group, seed=r['seed'], outcome=result['outcome'], minutes=minutes,
                   firstMillionMinutes=million, finalPhaseMinutes=None if million is None else minutes-million,
                   maximumPurchaseGapMinutes=max([b-a for a,b in zip(buys,buys[1:])] or [0]),
                   work=result['counters']['workShifts'], drops=result['counters']['plinkoDrops'])
        group_rows.append(row); rows.append(row)
    runs_by_group[group] = {r['seed']:r for r in group_rows}
    summary=json.loads((file.parent/'summary.json').read_text())
    summary.update(group=group,finalPhaseMedianMinutes=median([r['finalPhaseMinutes'] for r in group_rows if r['outcome']=='VICTORY' and r['finalPhaseMinutes'] is not None]),
                   maximumPurchaseGapMedianMinutes=median([r['maximumPurchaseGapMinutes'] for r in group_rows if r['outcome']=='VICTORY']))
    groups.append(summary)
for group, candidate in runs_by_group.items():
    if '/combined/' not in group or group.startswith('selection/'): continue
    control = runs_by_group[group.replace('/combined/', '/control/')]
    common = [(control[s], r) for s,r in candidate.items() if control[s]['outcome']==r['outcome']=='VICTORY']
    paired[group] = dict(commonWins=len(common), medianMinutesDelta=median([b['minutes']-a['minutes'] for a,b in common]),
                        medianFinalPhaseDelta=median([b['finalPhaseMinutes']-a['finalPhaseMinutes'] for a,b in common if b['finalPhaseMinutes'] is not None and a['finalPhaseMinutes'] is not None]),
                        medianPurchaseGapDelta=median([b['maximumPurchaseGapMinutes']-a['maximumPurchaseGapMinutes'] for a,b in common]))
physics=json.loads(gzip.decompress((root/'physical/samples.json.gz').read_bytes()))
reference={(r['variant'],r['seed']):r for r in physics if r['candidate']=='control'}
physics_pairs=[(reference[r['variant'],r['seed']],r) for r in physics if r['candidate']=='combined']
assert all(a['ticks']==b['ticks'] and a['pockets']==b['pockets'] for a,b in physics_pairs), 'Payout-only candidate changed physical trajectories'
assert all(a['payout']==b['payout'] for a,b in physics_pairs if a['variant'] in ['bare','early']), 'Early rewards changed'
analysis=dict(runs=len(rows),distinctFullGameSeeds=len({r['seed'] for r in rows}),groups=groups,paired=paired,
              physicalExecutions=len(physics),distinctPhysicalSeeds=len({r['seed'] for r in physics}),pairedPhysicalPathsUnchanged=True,bareAndEarlyPayoutsUnchanged=True)
(root/'analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
with (root/'runs.csv').open('w',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n'); writer.writeheader(); writer.writerows(rows)
(root/'manifest.json').write_text(json.dumps({str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file() and p.name!='manifest.json'},indent=2)+'\n')
print(json.dumps({k:v for k,v in analysis.items() if k!='groups'},indent=2))
