#!/usr/bin/env node
/**
 * Fix all broken </Text> closing tags across the codebase.
 * Previous i18n scripts replaced ">FrenchText</Text>" but broke the closing tag,
 * producing patterns like: >{t('key')}/Text> instead of >{t('key')}</Text>
 * 
 * This script finds all instances of )/Text> and replaces with )</Text>
 * Also handles: ')/Text>, ")/Text>, })/Text>
 */
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

let totalFixes = 0;
let filesFixed = 0;

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Pattern: t('...')}/Text>  →  t('...')}</Text>
    // Also:    t('...')}  /Text>  →  t('...')} </Text>
    // Core issue: /Text> should be </Text>
    // But we must NOT touch legitimate code like .replace(/<br\s*\/?>/gi) or regex patterns
    
    // Strategy: replace )/Text> with )</Text> when preceded by t('...')
    // More broadly: any )/Text> that isn't inside a string/regex
    
    // Simple and safe approach: replace the pattern  )}/Text>  with  )}</Text>
    //                           and                  )/Text>   with  )</Text>
    //                           but NOT inside regex patterns or .replace calls
    
    const lines = content.split('\n');
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip lines that are comments, regex patterns, or .replace calls
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        if (trimmed.includes('.replace(') && trimmed.includes('regex')) continue;
        
        // Check if line has broken /Text> (without < before it)
        if (line.includes('/Text>') && !line.includes('</Text>')) {
            // Replace all occurrences of /Text> with </Text> on this line
            // But be careful: only replace when it's clearly a closing JSX tag
            const newLine = line.replace(/(\))\s*\/Text>/g, '$1</Text>')
                               .replace(/(})\s*\/Text>/g, '$1</Text>')
                               .replace(/(["'])\s*\/Text>/g, '$1</Text>');
            
            if (newLine !== line) {
                lines[i] = newLine;
                modified = true;
                totalFixes++;
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        filesFixed++;
    }
}

console.log(`=== Fix Broken Close Tags ===`);
console.log(`Files fixed: ${filesFixed}`);
console.log(`Total /Text> → </Text> fixes: ${totalFixes}`);
