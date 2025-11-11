const fs = require('fs');
const lines = fs.readFileSync('ts-prune-report.txt', 'utf8').split(/\r?\n/).filter(Boolean);
console.log(lines.slice(0,5));
