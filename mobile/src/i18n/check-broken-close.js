const fs = require('fs');
const path = require('path');
function walk(dir, r = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, r);
        else if (p.endsWith('.tsx') || p.endsWith('.ts')) r.push(p);
    }
    return r;
}
const files = [];
['mobile/src/screens', 'mobile/src/components'].forEach(d => walk(d, files));
let total = 0;
for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Pattern: )  /Text>  without < before /Text>
        if (line.includes('/Text>') && !line.includes('</Text>') && !line.includes('replace') && !line.includes('regex') && !line.includes('//')) {
            total++;
            console.log(rel + ':' + (i + 1) + ' | ' + line.trim().substring(0, 150));
        }
    }
}
console.log('\nBroken /Text> remaining:', total);
