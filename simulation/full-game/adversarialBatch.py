import concurrent.futures, pathlib, subprocess, sys

count = int(sys.argv[1]) if len(sys.argv) > 1 else 12
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 67141000
root = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else pathlib.Path('reports/pacing/2026-10-08-adversarial')
strategies = sys.argv[4:] or ['cheapest','insurance-first','insurance-cycle','stake-first','specials-first','hoard-12','worker','casino-only','ignore-needs']
jobs = [(s,'continuous','fast') for s in strategies]
if len(sys.argv) <= 4:
    jobs += [('cheapest','continuous','ordinary'),('insurance-cycle','continuous','ordinary'),('cheapest','burst','fast')]
def run(job):
    strategy, mode, pace = job
    name = f'{strategy}-{mode}-{pace}'
    root.mkdir(parents=True, exist_ok=True)
    with (root / f'{name}.log').open('w') as log:
        subprocess.run(['node','--import','tsx','simulation/full-game/adversarialAudit.ts',strategy,str(count),str(seed),str(root/name),mode,pace],stdout=log,stderr=subprocess.STDOUT,check=True)
    return name
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for name in pool.map(run, jobs):
        print(name, 'complete', flush=True)
