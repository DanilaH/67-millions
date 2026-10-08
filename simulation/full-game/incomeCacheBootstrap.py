"""Reuse isolated measurements only after proving the probe configs equivalent."""
import copy, hashlib, json, pathlib, sys
root=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]); wanted=sys.argv[3].split(',')
names=['control','caps-only','coupled']; merged={}; sources=[]; projection=None
def strip_prices(value):
    if isinstance(value,dict):return {k:strip_prices(v) for k,v in value.items() if k!='price'}
    if isinstance(value,list):return [strip_prices(v) for v in value]
    return value
for name in names:
    config_path=root/'configs'/f'{name}.json'; config=json.loads(config_path.read_text())
    probe=copy.deepcopy(config);probe.pop('meta');probe['plinko']['maxBetLevels']=probe['plinko']['maxBetLevels'][:1]
    probe=strip_prices(probe)
    if projection is None:projection=probe
    assert probe==projection,'Cannot share measurements of different physical configs'
    cache_path=root/'selection'/name/'income-cache.json';cache=json.loads(cache_path.read_text())
    assert cache['identity']['count']==128 and cache['identity']['seedStart']==67146000
    assert cache['identity']['model']=='normalized-paired-single-root-capacity-proxy-v2'
    for key,value in cache['measurements'].items():
        if key in merged:assert merged[key]==value,f'Mismatched board {key}'
        merged[key]=value
    sources.append(dict(candidate=name,hash=hashlib.sha256(cache_path.read_bytes()).hexdigest(),boards=len(cache['measurements'])))
target.mkdir(parents=True,exist_ok=True)
for name in wanted:
    cache=json.loads((root/'selection'/name/'income-cache.json').read_text())
    p=target/name/'income-cache.json';p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(dict(identity=cache['identity'],measurements=merged),indent=2)+'\n')
(target/'bootstrap.json').write_text(json.dumps(dict(sources=sources,candidates=wanted,boardsPreloaded=len(merged),count=128,seedStart=67146000,
    projectionHash=hashlib.sha256(json.dumps(projection,sort_keys=True).encode()).hexdigest(),limitations='Ranking probe seeds reused; full-game holdout RNG seeds must be fresh. Reused boards are not newly executed probes.'),indent=2)+'\n')
print('Verified and merged',len(merged),'boards')
