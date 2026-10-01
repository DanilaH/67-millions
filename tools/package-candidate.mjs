import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = resolve('dist');
const output = resolve(process.env.RELEASE_OUTPUT ?? 'artifacts/release');
mkdirSync(output, { recursive: true });
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
if (!readFileSync(resolve(root, 'index.html'), 'utf8').includes('game-root')) throw new Error('Build first');
const manifest = {
  status: 'candidate; acceptance gates outstanding; not an RC',
  codeRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0,
  configVersion: JSON.parse(readFileSync('balance.v0.json', 'utf8')).meta.version,
  configSha256: hash('balance.v0.json'),
  generatedAt: new Date().toISOString(),
  files: files(root).sort().map(file => ({ path: relative(root, file), sha256: hash(file) })),
};
const zip = resolve(output, '67m-candidate.zip');
// zip updates existing files, so use a fresh archive to avoid stale chunks.
const temporary = resolve(output, `candidate-${Date.now()}.zip`);
execFileSync('zip', ['-q', '-r', temporary, '.'], { cwd: root });
const { renameSync } = await import('node:fs'); renameSync(temporary, zip);
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ ...manifest, archiveSha256: hash(zip) }, null, 2) + '\n');
console.log(JSON.stringify({ archive: zip, configSha256: manifest.configSha256, codeRevision: manifest.codeRevision, status: manifest.status, dirty: manifest.dirty }));
