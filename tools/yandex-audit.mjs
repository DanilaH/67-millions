import { auditYandexBuildDirectory } from '@danilah/mini-games-kit/yandex-tooling';

const rawLimit = process.env.YANDEX_MAX_UNCOMPRESSED_BYTES;
const maxUncompressedBytes = rawLimit ? Number(rawLimit) : undefined;
if (rawLimit && (!Number.isFinite(maxUncompressedBytes) || maxUncompressedBytes <= 0)) {
  throw new Error('YANDEX_MAX_UNCOMPRESSED_BYTES must be a positive number when provided');
}

const report = await auditYandexBuildDirectory('dist', {
  ...(maxUncompressedBytes === undefined ? {} : { maxUncompressedBytes }),
});

console.log(`Yandex upload root: ${report.fileCount} files, ${(report.uncompressedBytes / 1024 / 1024).toFixed(2)} MiB uncompressed.`);
for (const warning of report.warnings) console.warn(`warning: ${warning}`);
if (report.errors.length > 0) {
  for (const error of report.errors) console.error(`error: ${error}`);
  process.exitCode = 1;
}
