/**
 * Recopie livreScolaireHome.quickComparator* depuis fr.json vers toutes les locales
 * sauf fr et en (utile après raccourcissement des libellés).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');
const fr = JSON.parse(fs.readFileSync(path.join(localesDir, 'fr.json'), 'utf8'));
const t = fr.livreScolaireHome.quickComparatorTitle;
const s = fr.livreScolaireHome.quickComparatorSubtitle;

let n = 0;
for (const name of fs.readdirSync(localesDir)) {
    if (!name.endsWith('.json') || name === 'fr.json' || name === 'en.json') continue;
    const p = path.join(localesDir, name);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data.livreScolaireHome) data.livreScolaireHome = {};
    data.livreScolaireHome.quickComparatorTitle = t;
    data.livreScolaireHome.quickComparatorSubtitle = s;
    fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n', 'utf8');
    n += 1;
}
console.log('[overwrite-quick-comparator] updated', n, 'locales');
