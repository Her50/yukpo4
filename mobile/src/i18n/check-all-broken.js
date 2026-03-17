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

let brokenClose = 0, glued = 0, brokenBackslash = 0;

for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        // 1. Broken /Text> (missing <)
        if (line.includes('/Text>') && !line.includes('</Text>') && !line.includes('.replace') && !line.includes('regex')) {
            brokenClose++;
            console.log('[BROKEN-CLOSE] ' + rel + ':' + (i + 1));
        }
        // 2. GLUED: t('key')FrenchWord
        if (line.match(/t\('[^']+'\)[A-Za-zÀ-ÿ]{3,}/)) {
            glued++;
            console.log('[GLUED] ' + rel + ':' + (i + 1) + ' | ' + trimmed.substring(0, 120));
        }
        // 3. Backslash-t: \t('key') in JSX context (not tab in string)
        if (line.match(/[A-Za-zÀ-ÿ]\\t\('[^']+'\)/) && !line.includes('console') && !line.includes('\\t\\n')) {
            brokenBackslash++;
            console.log('[BACKSLASH-T] ' + rel + ':' + (i + 1) + ' | ' + trimmed.substring(0, 120));
        }
    }
}
console.log('\n=== Summary ===');
console.log('Broken /Text>:', brokenClose);
console.log('GLUED apostrophe:', glued);
console.log('Backslash-t:', brokenBackslash);
console.log('TOTAL issues:', brokenClose + glued + brokenBackslash);
