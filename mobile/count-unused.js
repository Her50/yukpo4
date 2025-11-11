const fs = require("fs");
const lines = fs.readFileSync("ts-prune-report.txt", "utf8").split(/\r?\n/).filter(Boolean);
const counts = new Map();
for (const line of lines) {
  const marker = '\\src\\';
  const idx = line.indexOf(marker);
  if (idx >= 0) {
    const rest = line.slice(idx + marker.length);
    const dir = rest.split('\\')[0] || '<root>';
    counts.set(dir, (counts.get(dir) || 0) + 1);
  } else {
    counts.set('<root>', (counts.get('<root>') || 0) + 1);
  }
}
const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
const output = entries.map(([dir, count]) => `${dir}: ${count}`).join('\n');
fs.writeFileSync('counts.txt', output, 'utf8');
