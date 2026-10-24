// scripts/gen-types.ts
// Regenerates lib/database.types.ts from the linked hosted Supabase project.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const outFile = fileURLToPath(new URL('../lib/database.types.ts', import.meta.url));
const header = '// lib/database.types.ts\n// Generated from the hosted schema. Regenerate with: npm run db:types\n';

const types = execSync('npx supabase gen types typescript --linked', { encoding: 'utf8' });
writeFileSync(outFile, header + types);
console.log(`db:types: wrote ${outFile}`);
