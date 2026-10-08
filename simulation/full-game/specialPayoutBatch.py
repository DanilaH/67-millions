"""Matched special-payout candidates, using the production physical audit runner."""
import concurrent.futures
import pathlib
import subprocess
import sys

count, seed = int(sys.argv[1]), int(sys.argv[2])
root = pathlib.Path(sys.argv[3])
configs = pathlib.Path('reports/pacing/2026-10-08-special-payouts/configs')
candidates = sys.argv[4].split(',')
strategies = sys.argv[5].split(',')
pace = sys.argv[6] if len(sys.argv) > 6 else 'fast'
def run(job):
    candidate, strategy = job
    output = root / candidate / f'{strategy}-{pace}'
    output.mkdir(parents=True, exist_ok=True)
    with output.with_suffix('.log').open('w') as log:
        subprocess.run(['node', '--import', 'tsx', 'simulation/full-game/adversarialAudit.ts',
                        strategy, str(count), str(seed), str(output), 'continuous', pace,
                        str(configs / f'{candidate}.json')], stdout=log, stderr=subprocess.STDOUT, check=True)
    print(candidate, strategy, pace, 'complete', flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(run, [(c, s) for c in candidates for s in strategies]))
