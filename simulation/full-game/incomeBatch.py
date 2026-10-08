"""Full-game policies execute real transactions; income proxy only ranks purchases."""
import concurrent.futures, pathlib, subprocess, sys
count, seed = int(sys.argv[1]), int(sys.argv[2])
root=pathlib.Path(sys.argv[3]); candidates=sys.argv[4].split(','); strategies=sys.argv[5].split(',')
pace=sys.argv[6] if len(sys.argv)>6 else 'fast'
probe_count=int(sys.argv[7]) if len(sys.argv)>7 else 128
probe_seed=int(sys.argv[8]) if len(sys.argv)>8 else 67146000
config_dir=pathlib.Path(sys.argv[9]) if len(sys.argv)>9 else pathlib.Path('reports/pacing/2026-10-08-income/configs')
def run(candidate):
    # One writer per config cache. Reuse measured boards across policies.
    for strategy in strategies:
        output=root/candidate/f'{strategy}-{pace}';output.mkdir(parents=True,exist_ok=True)
        with output.with_suffix('.log').open('w') as log:
            subprocess.run(['node','--import','tsx','simulation/full-game/adversarialAudit.ts',strategy,str(count),str(seed),str(output),'continuous',pace,
                str(config_dir/f'{candidate}.json'),str(probe_count),str(probe_seed),str(root/candidate/'income-cache.json')],stdout=log,stderr=subprocess.STDOUT,check=True)
        print(candidate,strategy,pace,'complete',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(run,candidates))
