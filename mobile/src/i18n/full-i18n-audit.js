#!/usr/bin/env node
/**
 * FULL i18n AUDIT - Comprehensive check of internationalization coverage
 * Checks: screens with/without t(), Alert.alert, toaster, notifications, locale coverage
 */
const fs = require('fs');
const path = require('path');

function walk(dir, r = []) {
    try {
        for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f);
            try {
                if (fs.statSync(p).isDirectory()) walk(p, r);
                else if (p.endsWith('.tsx') || p.endsWith('.ts')) r.push(p);
            } catch(e) {}
        }
    } catch(e) {}
    return r;
}

const screenFiles = walk('mobile/src/screens');
const componentFiles = walk('mobile/src/components');
const allFiles = [...screenFiles, ...componentFiles];

console.log('=== FULL i18n AUDIT ===\n');

// ============================================
// 1. SCREENS WITHOUT useLanguageSafe / t()
// ============================================
console.log('--- 1. SCREENS WITHOUT i18n HOOK ---');
const screensWithout = [];
const screensWith = [];
for (const f of screenFiles) {
    if (!f.endsWith('.tsx')) continue;
    const content = fs.readFileSync(f, 'utf8');
    const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
    const hasHook = content.includes('useLanguageSafe') || content.includes('useTranslation');
    const hasT = /\bt\s*\(/.test(content);
    if (!hasHook && !hasT) {
        screensWithout.push(rel);
    } else {
        screensWith.push(rel);
    }
}
console.log(`  Screens WITH i18n: ${screensWith.length}`);
console.log(`  Screens WITHOUT i18n: ${screensWithout.length}`);
if (screensWithout.length > 0) {
    screensWithout.forEach(s => console.log(`    ❌ ${s}`));
}

// ============================================
// 2. COMPONENTS WITHOUT i18n
// ============================================
console.log('\n--- 2. COMPONENTS WITHOUT i18n HOOK ---');
const compsWithout = [];
const compsWith = [];
for (const f of componentFiles) {
    if (!f.endsWith('.tsx')) continue;
    const content = fs.readFileSync(f, 'utf8');
    const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
    const hasHook = content.includes('useLanguageSafe') || content.includes('useTranslation');
    const hasT = /\bt\s*\(/.test(content);
    // Check if file has any user-facing text (JSX with >text<)
    const hasJSX = content.includes('</Text>') || content.includes('</View>');
    if (!hasHook && !hasT && hasJSX) {
        compsWithout.push(rel);
    } else if (hasHook || hasT) {
        compsWith.push(rel);
    }
}
console.log(`  Components WITH i18n: ${compsWith.length}`);
console.log(`  Components WITHOUT i18n (with JSX): ${compsWithout.length}`);
if (compsWithout.length > 0 && compsWithout.length <= 30) {
    compsWithout.forEach(s => console.log(`    ❌ ${s}`));
} else if (compsWithout.length > 30) {
    compsWithout.slice(0, 15).forEach(s => console.log(`    ❌ ${s}`));
    console.log(`    ... and ${compsWithout.length - 15} more`);
}

// ============================================
// 3. Alert.alert() with hardcoded French
// ============================================
console.log('\n--- 3. ALERT.ALERT() WITH HARDCODED FRENCH ---');
const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
let alertTotal = 0;
let alertFrench = 0;
let alertFrenchFiles = [];
for (const f of allFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
    const lines = content.split('\n');
    let fileFrenchAlerts = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Alert.alert(')) {
            alertTotal++;
            // Check if the Alert args contain French NOT wrapped in t()
            const afterAlert = line.substring(line.indexOf('Alert.alert('));
            // Get the string args (rough check)
            const stringArgs = afterAlert.match(/['"][^'"]*[àâçéèêëîïôûùüÿñæœ][^'"]*['"]/g);
            if (stringArgs) {
                // Check if they're inside t() calls
                const notInT = stringArgs.filter(s => {
                    const idx = afterAlert.indexOf(s);
                    const before = afterAlert.substring(Math.max(0, idx - 3), idx);
                    return !before.includes("t(");
                });
                if (notInT.length > 0) {
                    alertFrench++;
                    fileFrenchAlerts++;
                    console.log(`    ❌ ${rel}:${i+1} - ${notInT[0].substring(0, 60)}`);
                }
            }
        }
    }
}
console.log(`  Total Alert.alert() calls: ${alertTotal}`);
console.log(`  With hardcoded French: ${alertFrench}`);
console.log(`  ✅ Internationalized: ${alertTotal - alertFrench}`);

// ============================================
// 4. TOAST/TOASTER NOTIFICATIONS
// ============================================
console.log('\n--- 4. TOAST/TOASTER NOTIFICATIONS ---');
let toastTotal = 0;
let toastFrench = 0;
for (const f of allFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/toaster\.(show|success|error|warning|info)\s*\(/) || 
            line.match(/Toast\.(show|success|error)\s*\(/)) {
            toastTotal++;
            const stringArgs = line.match(/['"][^'"]*[àâçéèêëîïôûùüÿñæœ][^'"]*['"]/g);
            if (stringArgs) {
                const idx = line.indexOf(stringArgs[0]);
                const before = line.substring(Math.max(0, idx - 3), idx);
                if (!before.includes("t(")) {
                    toastFrench++;
                    console.log(`    ❌ ${rel}:${i+1} - ${stringArgs[0].substring(0, 60)}`);
                }
            }
        }
    }
}
console.log(`  Total toast calls: ${toastTotal}`);
console.log(`  With hardcoded French: ${toastFrench}`);

// ============================================
// 5. PUSH NOTIFICATION CONTENT
// ============================================
console.log('\n--- 5. PUSH/LOCAL NOTIFICATIONS ---');
let notifTotal = 0;
let notifFrench = 0;
for (const f of allFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/Notifications?\.(schedule|present|post)/) || 
            line.match(/(notification|notif)\s*[:=].*\{/) ||
            line.match(/title\s*:\s*['"].*notification/i)) {
            if (line.match(/['"][^'"]*[àâçéèêëîïôûùüÿñæœ][^'"]*['"]/)) {
                notifFrench++;
                console.log(`    ❌ ${rel}:${i+1}: ${line.trim().substring(0, 100)}`);
            }
            notifTotal++;
        }
    }
}
console.log(`  Notification-related lines: ${notifTotal}`);
console.log(`  With hardcoded French: ${notifFrench}`);

// ============================================
// 6. LOCALE FILES COVERAGE
// ============================================
console.log('\n--- 6. LOCALE FILES COVERAGE ---');
const localeDir = 'mobile/src/i18n/locales';
let localeFiles = [];
try {
    localeFiles = fs.readdirSync(localeDir).filter(f => f.endsWith('.json'));
} catch(e) {}
console.log(`  Locale files found: ${localeFiles.join(', ')}`);

if (localeFiles.length >= 2) {
    const fr = JSON.parse(fs.readFileSync(path.join(localeDir, 'fr.json'), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(localeDir, 'en.json'), 'utf8'));
    
    let frCount = 0, enCount = 0;
    let missingInEn = [], missingInFr = [];
    
    for (const [ns, keys] of Object.entries(fr)) {
        for (const k of Object.keys(keys)) {
            frCount++;
            if (!en[ns] || !en[ns][k]) missingInEn.push(ns + '.' + k);
        }
    }
    for (const [ns, keys] of Object.entries(en)) {
        for (const k of Object.keys(keys)) {
            enCount++;
            if (!fr[ns] || !fr[ns][k]) missingInFr.push(ns + '.' + k);
        }
    }
    
    console.log(`  FR keys: ${frCount}`);
    console.log(`  EN keys: ${enCount}`);
    console.log(`  Missing in EN (exist in FR): ${missingInEn.length}`);
    console.log(`  Missing in FR (exist in EN): ${missingInFr.length}`);
    
    // Check if EN translations are just copies of FR (not actually translated)
    let copiedKeys = 0;
    let sampleCopied = [];
    for (const [ns, keys] of Object.entries(fr)) {
        for (const [k, v] of Object.entries(keys)) {
            if (en[ns] && en[ns][k] && en[ns][k] === v && frChars.test(v)) {
                copiedKeys++;
                if (sampleCopied.length < 5) sampleCopied.push(ns + '.' + k + ' = "' + v.substring(0, 50) + '"');
            }
        }
    }
    console.log(`  EN keys that are just copies of FR (not translated): ${copiedKeys}`);
    if (sampleCopied.length > 0) {
        sampleCopied.forEach(s => console.log(`    ⚠️  ${s}`));
    }
    
    // Check for other languages
    const otherLocales = localeFiles.filter(f => f !== 'fr.json' && f !== 'en.json');
    if (otherLocales.length > 0) {
        console.log(`  Other locales: ${otherLocales.join(', ')}`);
    } else {
        console.log(`  ⚠️  Only FR and EN locales exist - no other languages`);
    }
}

// ============================================
// 7. SUPPORTED_LANGUAGES vs actual locale files
// ============================================
console.log('\n--- 7. SUPPORTED LANGUAGES vs LOCALE FILES ---');
const langFiles = walk('mobile/src');
let supportedLangs = [];
for (const f of langFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const match = content.match(/SUPPORTED_LANGUAGES\s*=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?/);
    if (match) {
        const codes = match[1].match(/code:\s*'([^']+)'/g);
        if (codes) {
            supportedLangs = codes.map(c => c.match(/code:\s*'([^']+)'/)[1]);
        }
        break;
    }
}
console.log(`  SUPPORTED_LANGUAGES codes: ${supportedLangs.join(', ')}`);
console.log(`  Locale files available: ${localeFiles.map(f => f.replace('.json', '')).join(', ')}`);
const missingLocales = supportedLangs.filter(l => !localeFiles.includes(l + '.json'));
if (missingLocales.length > 0) {
    console.log(`  ❌ Languages declared but NO locale file: ${missingLocales.join(', ')}`);
} else {
    console.log(`  ✅ All supported languages have locale files`);
}

// ============================================
// 8. HARDCODED FRENCH IN ERROR MESSAGES (throw/reject)
// ============================================
console.log('\n--- 8. ERROR MESSAGES WITH HARDCODED FRENCH ---');
let errorFrench = 0;
for (const f of allFiles) {
    const content = fs.readFileSync(f, 'utf8');
    const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.match(/throw new Error\(/) || line.match(/Promise\.reject\(/)) && 
            frChars.test(line) && !line.includes("t(")) {
            errorFrench++;
            if (errorFrench <= 10) console.log(`    ❌ ${rel}:${i+1}`);
        }
    }
}
console.log(`  Error throws with hardcoded French: ${errorFrench}`);

// ============================================  
// SUMMARY
// ============================================
console.log('\n========================================');
console.log('  SUMMARY');
console.log('========================================');
console.log(`  Screens with i18n:     ${screensWith.length}/${screensWith.length + screensWithout.length}`);
console.log(`  Components with i18n:  ${compsWith.length}/${compsWith.length + compsWithout.length}`);
console.log(`  Alerts internationalized: ${alertTotal - alertFrench}/${alertTotal}`);
console.log(`  Toasts internationalized: ${toastTotal - toastFrench}/${toastTotal}`);
console.log(`  Locales: ${localeFiles.length} files (${localeFiles.map(f=>f.replace('.json','')).join(', ')})`);
console.log(`  Supported languages: ${supportedLangs.length} (${supportedLangs.join(', ')})`);
console.log(`  Missing locale files: ${missingLocales.length}`);
console.log('========================================');
