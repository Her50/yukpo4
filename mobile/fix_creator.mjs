import fs from 'fs';
const f = 'src/components/CreatorStudioCard.tsx';
const c = fs.readFileSync(f, 'utf-8');
const lines = c.split('\n');
// Line 32 (index 31): fix apostrophe in single-quoted string
// Original: description: 'Jusqu'à 1 m³ · idéal colis "pas très importants"',
lines[31] = "        description: \"Jusqu'\\u00E0 1 m\\u00B3 \\u00B7 id\\u00E9al colis \\\"pas tr\\u00E8s importants\\\"\",";
fs.writeFileSync(f, lines.join('\n'), 'utf-8');
process.stdout.write('Fixed: ' + lines[31] + '\n');
