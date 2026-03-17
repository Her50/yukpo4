#!/usr/bin/env node
/**
 * translate-all-missing.js — v3 Parallel
 * 
 * Translates ALL French-identical values into each target language.
 * - Deduplicates: each unique French text translated ONCE per language
 * - 10 parallel requests for speed
 * - Protects {{interpolation}} variables
 * - Graceful error handling (keeps French on failure)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const LOCALES_DIR = path.join(__dirname, 'locales');
const FR = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'fr.json'), 'utf8'));

const GOOGLE_LANGS = {
    'af':'af','am':'am','ar':'ar','bn':'bn','bm':'bm','de':'de','ee':'ee',
    'es':'es','ha':'ha','hi':'hi','ht':'ht','id':'id','ig':'ig','it':'it',
    'ja':'ja','ko':'ko','ln':'ln','mg':'mg','ms':'ms','nl':'nl','pl':'pl',
    'pt':'pt','ru':'ru','rw':'rw','sn':'sn','so':'so','st':'st','sw':'sw',
    'th':'th','ti':'ti','tl':'tl','tr':'tr','uk':'uk','vi':'vi','xh':'xh',
    'yo':'yo','zh':'zh-CN','zu':'zu'
};

const SKIP = new Set(['fr', 'en']);
const CONCURRENCY = 10;
const DELAY_BETWEEN_CHUNKS = 250;

function flatten(obj, prefix = '') {
    const r = {};
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) Object.assign(r, flatten(v, key));
        else if (typeof v === 'string') r[key] = v;
    }
    return r;
}

function setNested(obj, keyPath, value) {
    const parts = keyPath.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function protectVars(text) {
    const vars = [];
    const safe = text.replace(/\{\{(\w+)\}\}/g, (_, name) => { vars.push(name); return `[V${vars.length}]`; });
    return { safe, vars };
}

function restoreVars(text, vars) {
    return text.replace(/\[V(\d+)\]/gi, (_, n) => {
        const idx = parseInt(n) - 1;
        return idx < vars.length ? `{{${vars[idx]}}}` : `[V${n}]`;
    });
}

function translateOne(text, tl) {
    return new Promise((resolve) => {
        const q = encodeURIComponent(text);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${tl}&dt=t&q=${q}`;

        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                if (res.statusCode === 429) {
                    resolve({ ok: false, retry: true });
                    return;
                }
                try {
                    const p = JSON.parse(d);
                    if (p && p[0]) {
                        resolve({ ok: true, text: p[0].map(s => s[0]).join('') });
                    } else {
                        resolve({ ok: false });
                    }
                } catch { resolve({ ok: false }); }
            });
        });
        req.on('error', () => resolve({ ok: false }));
        req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false }); });
    });
}

async function translateWithRetry(text, tl, maxRetry = 2) {
    for (let i = 0; i <= maxRetry; i++) {
        const result = await translateOne(text, tl);
        if (result.ok) return result.text;
        if (result.retry) await sleep(2000 * (i + 1));
        else if (i < maxRetry) await sleep(500);
    }
    return null;
}

async function processChunk(items, tl) {
    return Promise.all(items.map(async ({ frVal, safe, vars }) => {
        const translated = await translateWithRetry(safe, tl);
        if (translated) {
            return { frVal, translated: restoreVars(translated, vars) };
        }
        return { frVal, translated: null };
    }));
}

async function main() {
    const frFlat = flatten(FR);
    const frKeys = Object.keys(frFlat);
    console.log(`📖 fr.json: ${frKeys.length} keys\n`);

    const files = fs.readdirSync(LOCALES_DIR)
        .filter(f => f.endsWith('.json') && !SKIP.has(f.replace('.json', '')))
        .sort();

    let grandTotal = 0;
    const startTime = Date.now();

    for (const file of files) {
        const lang = file.replace('.json', '');
        const gtLang = GOOGLE_LANGS[lang];

        if (!gtLang) {
            console.log(`⏭️  ${file.padEnd(12)} — not supported by Google Translate`);
            continue;
        }

        const filePath = path.join(LOCALES_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const targetFlat = flatten(data);

        const keysToTranslate = frKeys.filter(k =>
            k in targetFlat && targetFlat[k] === frFlat[k] && frFlat[k].length > 1
        );

        if (keysToTranslate.length === 0) {
            console.log(`✔️  ${file.padEnd(12)} — already translated`);
            continue;
        }

        // Deduplicate
        const valueToKeys = new Map();
        for (const k of keysToTranslate) {
            const v = frFlat[k];
            if (!valueToKeys.has(v)) valueToKeys.set(v, []);
            valueToKeys.get(v).push(k);
        }

        const uniqueValues = Array.from(valueToKeys.keys());
        const items = uniqueValues.map(frVal => {
            const { safe, vars } = protectVars(frVal);
            return { frVal, safe, vars };
        });

        const elapsed = () => ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        process.stdout.write(`🔄 ${file.padEnd(12)} ${keysToTranslate.length} keys (${uniqueValues.length} unique) `);

        // Process in chunks of CONCURRENCY
        const translationCache = new Map();
        let ok = 0, fail = 0;

        for (let i = 0; i < items.length; i += CONCURRENCY) {
            const chunk = items.slice(i, i + CONCURRENCY);
            const results = await processChunk(chunk, gtLang);

            for (const r of results) {
                if (r.translated) {
                    translationCache.set(r.frVal, r.translated);
                    ok++;
                } else {
                    fail++;
                }
            }

            await sleep(DELAY_BETWEEN_CHUNKS);

            if ((i / CONCURRENCY) % 50 === 49) {
                process.stdout.write(`${ok}..`);
            }
        }

        // Apply to file
        for (const [frVal, translated] of translationCache) {
            for (const key of valueToKeys.get(frVal)) {
                setNested(data, key, translated);
            }
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        grandTotal += ok;
        console.log(`✅ ${ok}/${uniqueValues.length} [${elapsed()}min]`);
    }

    const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n📊 Done! ${grandTotal} translations in ${totalMin} minutes`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
