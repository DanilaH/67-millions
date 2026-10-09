"""Bounded casino-purchase cutoff comparison using the existing real runner."""
import concurrent.futures, os, pathlib, subprocess, sys
count, seed, root, cutoffs = int(sys.argv[1]), int(sys.argv[2]), pathlib.Path(sys.argv[3]), sys.argv[4].split(',')
pace=sys.argv[5] if len(sys.argv)>5 else 'fast'
policies=sys.argv[6].split(',') if len(sys.argv)>6 else ['cheapest','stake-first','insurance-first']
def run(task):
    name, cutoff=task
    for policy in policies:
        output=root/name/f'{policy}-stop-{cutoff}-{pace}';output.mkdir(parents=True,exist_ok=True)
        env={k:v for k,v in os.environ.items() if k!='AUDIT_STOP_AFTER_PURCHASES'}
        if cutoff!='none':env['AUDIT_STOP_AFTER_PURCHASES']=cutoff
        with output.with_suffix('.log').open('w') as log:
            subprocess.run(['node','--import','tsx','simulation/full-game/adversarialAudit.ts',policy,str(count),str(seed),str(output),'continuous',pace,
                f'reports/pacing/2026-10-08-middle/configs/{name}.json'],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
        print(name,policy,cutoff,pace,'complete',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(run,[(name,c) for name in ['control','priced-middle'] for c in cutoffs]))
