// Regenera lib/commits.generated.ts a partir del historial de git, para que el
// apartado «Versión y cambios» de Ajustes liste TODOS los commits y qué se hizo
// en cada uno (la app no tiene acceso a git en producción).
//
//   node scripts/gen-commits.mjs
//
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SEP = '\x1f';
const raw = execSync(`git log --pretty=format:'%h${SEP}%ad${SEP}%s' --date=short`, { encoding: 'utf8' });

const commits = raw
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [hash, date, subject] = line.split(SEP);
    return { hash, date, subject };
  });

const out =
  `/* eslint-disable */\n` +
  `// AUTO-GENERADO por scripts/gen-commits.mjs — NO editar a mano.\n` +
  `// Regenerar tras nuevos commits: node scripts/gen-commits.mjs\n\n` +
  `export interface CommitEntry {\n  hash: string;\n  /** YYYY-MM-DD */\n  date: string;\n  subject: string;\n}\n\n` +
  `export const COMMITS: CommitEntry[] = ${JSON.stringify(commits, null, 2)};\n`;

writeFileSync(new URL('../lib/commits.generated.ts', import.meta.url), out);
console.log(`✅ Generados ${commits.length} commits en lib/commits.generated.ts`);
