import fs from 'fs';
import path from 'path';

// Use require for CJS babel parser
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');

const parseOpts = {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
  strictMode: false,
};

function scanDir(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) {
      scanDir(full, results);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(full);
    }
  }
  return results;
}

const files = scanDir('src');
const errors = [];

for (const file of files) {
  try {
    const code = fs.readFileSync(file, 'utf-8');
    parse(code, parseOpts);
  } catch (e) {
    errors.push({
      file: file.replace(/\\/g, '/'),
      line: e.loc && e.loc.line,
      col: e.loc && e.loc.column,
      msg: e.message ? e.message.split('\n')[0] : String(e)
    });
  }
}

process.stdout.write(`Syntax errors found: ${errors.length}\n`);
for (const e of errors) {
  process.stdout.write(`${e.file}:${e.line}:${e.col} - ${e.msg}\n`);
}
