// One-shot migration runner using @libsql/client's batch API.
// Usage: node scripts/run-migration.mjs <migration-file>
//
// libSQL remote (Turso) treats each shell stdin statement as its own request,
// so BEGIN / COMMIT can't span statements. batch() wraps the array of
// statements in a single server-side transaction.
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

// Run with: node --env-file=.env.local scripts/run-migration.mjs <file>

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/run-migration.mjs <file>');
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');

// Strip BEGIN/COMMIT/PRAGMA (handled outside the batch) and SQL comments.
// Then split on ';' boundaries that aren't inside string literals.
function splitStatements(sql) {
  const stripped = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');

  const statements = [];
  let buf = '';
  let inString = false;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (c === "'" && stripped[i - 1] !== '\\') inString = !inString;
    if (c === ';' && !inString) {
      const trimmed = buf.trim();
      if (trimmed) statements.push(trimmed);
      buf = '';
    } else {
      buf += c;
    }
  }
  if (buf.trim()) statements.push(buf.trim());
  return statements;
}

const all = splitStatements(raw);
const pragmas = all.filter((s) => /^\s*PRAGMA\s/i.test(s));
const txCtrl = all.filter((s) => /^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(s));
const body = all.filter(
  (s) => !pragmas.includes(s) && !txCtrl.includes(s),
);

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log(`migration: ${file}`);
console.log(`  pragmas:    ${pragmas.length}`);
console.log(`  statements: ${body.length}`);

try {
  // PRAGMAs run outside the batch (they auto-commit).
  for (const p of pragmas.filter((s) => /foreign_keys\s*=\s*OFF/i.test(s))) {
    await client.execute(p);
  }
  // Atomic transaction for the schema work.
  await client.batch(body, 'write');
  for (const p of pragmas.filter((s) => /foreign_keys\s*=\s*ON/i.test(s))) {
    await client.execute(p);
  }
  console.log('✓ migration applied');
} catch (err) {
  console.error('✗ migration failed:', err.message);
  process.exit(1);
}
