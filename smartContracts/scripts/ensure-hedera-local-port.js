const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const updates = [
  {
    file: 'node_modules/@hashgraph/hedera-local/build/constants.js',
    apply: (content) =>
      content.replace(
        /exports\.NECESSARY_PORTS\s*=\s*\[[^\]]+\];/,
        'exports.NECESSARY_PORTS = [5551, 8545, 5600, 5433, 50211, 8082, 6389];'
      ),
  },
  {
    file: 'node_modules/@hashgraph/hedera-local/src/constants.ts',
    apply: (content) =>
      content.replace(
        /export const NECESSARY_PORTS\s*=\s*\[[^\]]+\];/,
        'export const NECESSARY_PORTS = [5551, 8545, 5600, 5433, 50211, 8082, 6389];'
      ),
  },
  {
    file: 'node_modules/@hashgraph/hedera-local/docker-compose.yml',
    apply: (content) => content.replace(/-\s*6379:6379/g, '      - 6389:6379'),
  },
  {
    file: 'node_modules/@hashgraph/hedera-local/config.yaml',
    apply: (content) =>
      content.replace(
        /(target:\s*6379\s*\r?\n\s*published:\s*")6379(")/,
        '$16389$2'
      ),
  },
];

let patchedCount = 0;
let skippedCount = 0;

for (const update of updates) {
  const absolutePath = path.join(rootDir, update.file);

  if (!fs.existsSync(absolutePath)) {
    skippedCount += 1;
    continue;
  }

  const original = fs.readFileSync(absolutePath, 'utf8');
  const next = update.apply(original);

  if (next !== original) {
    fs.writeFileSync(absolutePath, next, 'utf8');
    patchedCount += 1;
  }
}

console.log(`[hedera-port-patch] patched=${patchedCount}, skipped=${skippedCount}`);
