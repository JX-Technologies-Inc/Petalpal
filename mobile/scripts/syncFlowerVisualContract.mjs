// Generated projection, not a second authority. Run from any directory; --check for CI.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CANONICAL_PRIMARY_GARDEN_MOODS, PRIMARY_GARDEN_MOOD_CONFIG,
  SECONDARY_FLOWER_MODIFIERS } from '../../lib/flower-variant-config.js';
import legacyCatalog from '../../data/flowerDB.js';
const target = fileURLToPath(new URL('../src/components/garden/flower-visuals/contract.generated.json', import.meta.url));
const value = JSON.stringify({ primaryBlooms: Object.fromEntries(CANONICAL_PRIMARY_GARDEN_MOODS.map(
  code => [code, PRIMARY_GARDEN_MOOD_CONFIG[code]])), secondaryModifiers: SECONDARY_FLOWER_MODIFIERS,
  legacyCatalog }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== value) throw new Error('Flower contract projection is stale');
  console.log('Flower contract projection matches backend');
} else {
  fs.mkdirSync(new URL('../src/components/garden/flower-visuals/', import.meta.url), { recursive: true });
  fs.writeFileSync(target, value);
}
