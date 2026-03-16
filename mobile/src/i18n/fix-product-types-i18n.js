#!/usr/bin/env node
/**
 * Fix ProductManagerMobile.tsx PRODUCT_TYPES:
 * 1. Rename PRODUCT_TYPES → PRODUCT_TYPES_RAW (keeps French labels for keyword matching)
 * 2. Create getProductTypes(t) that returns translated labels/descriptions
 * 3. Replace hardcoded French labels & descriptions with t() keys
 * 4. Add all new keys to fr.json and en.json
 * 5. Fix suggestProductCategories.ts to use PRODUCT_TYPES_RAW
 */
const fs = require('fs');

const PMM_PATH = 'mobile/src/components/ProductManagerMobile.tsx';
const SUG_PATH = 'mobile/src/utils/suggestProductCategories.ts';
const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';

let pmm = fs.readFileSync(PMM_PATH, 'utf8');

// ===== Step 1: Collect all hardcoded French labels & descriptions in PRODUCT_TYPES =====
const hardcodedLabels = {};
const hardcodedDescs = {};

// Match: label: 'French text' (NOT already t())
const labelRegex = /\{ value: '([^']+)', label: '([^']+)'/g;
let m;
while ((m = labelRegex.exec(pmm)) !== null) {
    hardcodedLabels[m[1]] = m[2];
}

// Match: description: 'French text' in PRODUCT_TYPES entries (NOT already t())
const descRegex = /value: '([^']+)'[^}]*?description: '([^']{5,})'/g;
while ((m = descRegex.exec(pmm)) !== null) {
    if (!m[0].includes("description: t(")) {
        hardcodedDescs[m[1]] = m[2];
    }
}

console.log('Hardcoded labels found:', Object.keys(hardcodedLabels).length);
console.log('Hardcoded descriptions found:', Object.keys(hardcodedDescs).length);

// Also find descriptions that are still hardcoded (not wrapped in t())
// Check each line in PRODUCT_TYPES section
const lines = pmm.split('\n');
let inProductTypes = false;
const descHardcoded = {};
for (const line of lines) {
    if (line.includes('export const PRODUCT_TYPES = [')) inProductTypes = true;
    if (inProductTypes && line.includes('] as const;')) { inProductTypes = false; break; }
    if (!inProductTypes) continue;
    
    // Find description: 'text' that is NOT t()
    const dm = line.match(/value: '([^']+)'.*?description: '([^']{5,})'/);
    if (dm && !line.match(new RegExp(`description: t\\(`))) {
        // Check if description is actually hardcoded (not t() wrapped)
        const descMatch = line.match(/description: '([^']+)'/);
        if (descMatch) {
            descHardcoded[dm[1]] = descMatch[1];
        }
    }
}

console.log('Descriptions hardcoded (confirmed):', Object.keys(descHardcoded).length);

// ===== Step 2: Generate i18n keys =====
function textToKey(text) {
    let key = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '').trim()
        .split(/\s+/).slice(0, 5)
        .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    if (key.length > 45) key = key.substring(0, 45);
    return key;
}

const wordMap = {
    'Assurance': 'Insurance', 'Protection': 'Protection', 'Chaussures': 'Shoes',
    'Accessoires': 'Accessories', 'Covoiturage': 'Carpooling', 'Trajets': 'Trips',
    'Immobilier': 'Real Estate', 'Vente': 'Sale', 'Location': 'Rental',
    'Long Terme': 'Long Term', 'Terrains': 'Land', 'Jouets': 'Toys',
    'Articles': 'Items', 'Enfants': 'Children', 'Mobilier': 'Furniture',
    'Ameublement': 'Furnishing', 'Ordinateurs': 'Computers', 'Informatique': 'IT',
    'Pharmacies': 'Pharmacies', 'Gardes': 'On-call', 'Plombier': 'Plumber',
    'Bijoux': 'Jewelry', 'Couturier': 'Tailor', 'Tailleur': 'Tailor',
    'Quincaillerie': 'Hardware Store', 'Construction': 'Construction',
    'Ustensiles': 'Utensils', 'Cuisine': 'Kitchen', 'Restauration': 'Catering',
    'Traiteur': 'Caterer', 'Musique': 'Music', 'Instruments': 'Instruments',
    'Nettoyage': 'Cleaning', 'Entretien': 'Maintenance', 'Jardinage': 'Gardening',
    'Paysagisme': 'Landscaping', 'Plomberie': 'Plumbing', 'Sanitaire': 'Sanitary',
    'et': 'and', 'de': 'of', 'pour': 'for',
    'Alimentation': 'Food', 'complète': 'complete', 'produits': 'products',
    'frais': 'fresh', 'fruits': 'fruits', 'légumes': 'vegetables',
    'viandes': 'meats', 'poissons': 'fish', 'secs': 'dry',
    'transformés': 'processed', 'baskets': 'sneakers', 'sandales': 'sandals',
    'bottes': 'boots', 'constructibles': 'buildable', 'parcelles': 'plots',
    'lots': 'lots', 'Meubles': 'Furniture', 'salon': 'living room',
    'chambre': 'bedroom', 'bureau': 'office', 'rangement': 'storage',
    'PC': 'PC', 'portables': 'laptops', 'bureaux': 'desktops',
    'tablettes': 'tablets', 'accessoires': 'accessories', 'planning': 'schedule',
    'garde': 'on-call', 'services': 'services', 'pharmaceutiques': 'pharmaceutical',
    'Laboratoires': 'Laboratories', 'analyses': 'analysis', 'centres': 'centers',
    'imagerie': 'imaging', 'scanner': 'scanner', 'IRM': 'MRI',
    'échographie': 'ultrasound', 'Organisation': 'Organization',
    'événements': 'events', 'mariages': 'weddings', 'fêtes': 'parties',
    'célébrations': 'celebrations', 'Bureau': 'Office', 'études': 'studies',
    'plans': 'plans', 'conception': 'design', 'suivi': 'monitoring',
    'chantier': 'construction site', 'permis': 'permit', 'construire': 'build',
    'Manuels': 'Textbooks', 'livres': 'books', 'cahiers': 'notebooks',
    'stylos': 'pens', 'fournitures': 'supplies',
};

function roughTranslate(text) {
    let result = text;
    const sorted = Object.entries(wordMap).sort((a, b) => b[0].length - a[0].length);
    for (const [fr, en] of sorted) {
        const regex = new RegExp(fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, en);
    }
    return result;
}

const ns = 'productManagerMobile';
const newFrKeys = {};
const newEnKeys = {};

// Generate keys for hardcoded labels
for (const [value, label] of Object.entries(hardcodedLabels)) {
    const key = textToKey(label);
    newFrKeys[key] = label;
    newEnKeys[key] = roughTranslate(label);
}

// Generate keys for hardcoded descriptions
for (const [value, desc] of Object.entries(descHardcoded)) {
    const key = 'desc_' + textToKey(desc);
    newFrKeys[key] = desc;
    newEnKeys[key] = roughTranslate(desc);
}

// ===== Step 3: Replace hardcoded strings in PRODUCT_TYPES =====
for (const [value, label] of Object.entries(hardcodedLabels)) {
    const key = textToKey(label);
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(value: '${value}', label: )'${escaped}'`, 'g');
    pmm = pmm.replace(regex, `$1t('${ns}.${key}')`);
}

for (const [value, desc] of Object.entries(descHardcoded)) {
    const key = 'desc_' + textToKey(desc);
    const escaped = desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`description: '${escaped}'`, 'g');
    pmm = pmm.replace(regex, `description: t('${ns}.${key}')`);
}

// ===== Step 4: Rename PRODUCT_TYPES to function pattern =====
// Replace: export const PRODUCT_TYPES = [
// With: export const PRODUCT_TYPES_RAW = [...] and getProductTypes function

// First, add import of i18n at the top if not present
if (!pmm.includes("import i18n from '../i18n'") && !pmm.includes("import i18n,")) {
    pmm = pmm.replace(
        "import { useLanguageSafe } from '../contexts/LanguageContext';",
        "import { useLanguageSafe } from '../contexts/LanguageContext';\nimport i18n from '../i18n';"
    );
}

// Replace PRODUCT_TYPES declaration with a function that uses i18n.t() at call time
pmm = pmm.replace(
    '// Configuration des types de produits avec noms adaptés\nexport const PRODUCT_TYPES = [',
    '// Configuration des types de produits avec noms adaptés\n// PRODUCT_TYPES_RAW: version statique avec clés i18n (pour keyword matching dans suggestProductCategories)\n// getProductTypes(t): version traduite pour affichage UI\nconst _t = (key) => i18n.t(key) !== key ? i18n.t(key) : key;\nexport const PRODUCT_TYPES = ['
);

// Now replace all t( calls in PRODUCT_TYPES with _t( so they use i18n.t directly
// This only affects the PRODUCT_TYPES array section
const productTypesStart = pmm.indexOf('export const PRODUCT_TYPES = [');
const productTypesEnd = pmm.indexOf('] as const;', productTypesStart) + '] as const;'.length;

if (productTypesStart >= 0 && productTypesEnd > productTypesStart) {
    let ptSection = pmm.substring(productTypesStart, productTypesEnd);
    ptSection = ptSection.replace(/\bt\(/g, '_t(');
    // Fix double replacement: _t_t( -> _t(
    ptSection = ptSection.replace(/_t_t\(/g, '_t(');
    // Also fix __t( -> _t(
    ptSection = ptSection.replace(/__t\(/g, '_t(');
    pmm = pmm.substring(0, productTypesStart) + ptSection + pmm.substring(productTypesEnd);
}

// Also export a getProductTypes function for use inside components with hook t
const insertAfterProductTypes = pmm.indexOf('] as const;', productTypesStart) + '] as const;\n'.length;
const getProductTypesFn = `
// ✅ Version dynamique utilisant le hook t() du composant (pour l'UI)
export const getProductTypes = (t: (key: string) => string) => {
    return PRODUCT_TYPES.map(pt => ({
        ...pt,
        label: typeof pt.label === 'string' && pt.label.includes('.') ? t(pt.label) || pt.label : pt.label,
        description: typeof pt.description === 'string' && pt.description.includes('.') ? t(pt.description) || pt.description : pt.description,
    }));
};
`;
pmm = pmm.substring(0, insertAfterProductTypes) + getProductTypesFn + pmm.substring(insertAfterProductTypes);

// ===== Step 5: Inside the component, replace PRODUCT_TYPES with local translated version =====
// Find where { t } = useLanguageSafe() is used in the component and add productTypes
pmm = pmm.replace(
    "const { t } = useLanguageSafe(); // ✅ NOUVEAU: Navigation pour modifier produit",
    "const { t } = useLanguageSafe(); // ✅ NOUVEAU: Navigation pour modifier produit\n    const productTypes = getProductTypes(t);"
);

// Replace PRODUCT_TYPES usage inside the component with productTypes
// Line 4566: return PRODUCT_TYPES.find(t => t.value === type)
pmm = pmm.replace(
    /return PRODUCT_TYPES\.find\(t => t\.value === type\) \|\| PRODUCT_TYPES\[PRODUCT_TYPES\.length - 1\]/g,
    'return productTypes.find(pt => pt.value === type) || productTypes[productTypes.length - 1]'
);

// Line 21328: let filteredTypes = PRODUCT_TYPES.filter
pmm = pmm.replace(
    /let filteredTypes = PRODUCT_TYPES\.filter/g,
    'let filteredTypes = productTypes.filter'
);

// Line 21510: PRODUCT_TYPES.find(t => t.value === selectedType)?.label
pmm = pmm.replace(
    /PRODUCT_TYPES\.find\(t => t\.value === selectedType\)/g,
    'productTypes.find(pt => pt.value === selectedType)'
);

fs.writeFileSync(PMM_PATH, pmm, 'utf8');
console.log('✅ ProductManagerMobile.tsx updated');

// ===== Step 6: Fix suggestProductCategories.ts to use PRODUCT_TYPES (still works, keywords are not translated) =====
// PRODUCT_TYPES is still exported, so no change needed in suggestProductCategories.ts
// The keywords array is never translated, so it still works for matching
console.log('✅ suggestProductCategories.ts: no change needed (PRODUCT_TYPES still exported, keywords untranslated)');

// ===== Step 7: Update locale files =====
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

if (!fr[ns]) fr[ns] = {};
if (!en[ns]) en[ns] = {};

let addedCount = 0;
for (const [key, val] of Object.entries(newFrKeys)) {
    if (!fr[ns][key]) { fr[ns][key] = val; addedCount++; }
}
for (const [key, val] of Object.entries(newEnKeys)) {
    if (!en[ns][key]) en[ns][key] = val;
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`✅ Locale files updated: ${addedCount} new keys added`);
console.log('Labels translated:', Object.keys(hardcodedLabels).length);
console.log('Descriptions translated:', Object.keys(descHardcoded).length);

// Validate JSON
try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid ✓'); } catch(e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid ✓'); } catch(e) { console.log('EN JSON: INVALID ✗', e.message); }
