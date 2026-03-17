#!/usr/bin/env node
/**
 * translate-en-keys-v3.js — Final comprehensive FR→EN translation pass.
 * Handles remaining 975 accented keys: domain-specific, short words, examples, etc.
 */
const fs = require('fs');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

// Massive word/phrase dictionary
const d = {
    // --- PHRASES ---
    "Gérer stocks": "Manage inventory", "Gérer créneaux": "Manage time slots",
    "Gérer embarquement": "Manage boarding", "Gérer places": "Manage seats",
    "Gérer équipe": "Manage team",
    "Comportement suspect détecté": "Suspicious behavior detected",
    "Notes supplémentaires": "Additional notes",
    "Identité visuelle": "Visual identity", "Identité Visuelle": "Visual Identity",
    "Identité visuelle (lecture seule)": "Visual identity (read-only)",
    "Portée estimée": "Estimated reach", "Salaire estimé": "Estimated salary",
    "Volume estimé": "Estimated volume",
    "Places réservées": "Reserved seats", "Places réservées:": "Reserved seats:",
    "Créneaux disponibles": "Available time slots",
    "Analytics Créateur": "Creator Analytics",
    "Studio créateur Yukpo": "Yukpo Creator Studio",
    "Pickup programmé": "Scheduled pickup",
    "Gros volume / tournée multi-points": "Large volume / multi-point tour",
    "Audiences Personnalisées": "Custom Audiences",
    "Similarité (1-10)": "Similarity (1-10)",
    "Budget Consommé": "Budget Consumed", "Budget utilisé": "Budget used",
    "Logs récents": "Recent logs", "Logs récents:": "Recent logs:",
    "Meubles à transporter": "Furniture to transport",
    "Instructions spéciales...": "Special instructions...",
    "Unité (kg, L, etc.)": "Unit (kg, L, etc.)",
    "Unité (kg, L...)": "Unit (kg, L...)",
    "unité(s)": "unit(s)",
    "Duet (Côte à côte)": "Duet (Side by side)",
    "Supplément premium": "Premium supplement",
    "Modalité existante": "Existing modality",
    "Écoles primaires": "Primary schools",
    "Collèges & Lycées": "Middle & High Schools",
    "Génération Express": "Express Generation",
    "Mode avancé": "Advanced mode",
    "Production cinématographique immersive": "Immersive cinematic production",
    "Storyboard généré": "Storyboard generated",
    "Options spéciales": "Special options",
    "Black Friday fédéré Yukpo": "Yukpo Federated Black Friday",
    "Analyses médicales, imagerie": "Medical analyses, imaging",
    "Reste à payer": "Remaining to pay",
    "Code brut scanné": "Raw scanned code", "Code brut scanné :": "Raw scanned code:",
    "Analyse IA avancée": "Advanced AI analysis",
    "Analyse générale": "General analysis",
    "Paramètre inconnu": "Unknown parameter",
    "Menus générés": "Generated menus",
    "Éditer service": "Edit service",
    "Services récents": "Recent services",
    "Dashboard Établissement": "Institution Dashboard",
    "Score académique": "Academic score",
    "Dosage suggéré": "Suggested dosage", "Dosage suggéré:": "Suggested dosage:",
    "Espace publicitaire latéral": "Side advertising space",
    "Contacts précédents": "Previous contacts",
    "Voir établissement": "View institution",
    "Filière (ex: Scientifique)": "Field (e.g.: Science)",
    "Modifié localement": "Modified locally", "Modifié localement:": "Modified locally:",
    "Trajets créés": "Trips created",
    "Bagages autorisés": "Luggage allowed",
    "Animaux autorisés": "Animals allowed",
    "Fumeur autorisé": "Smoking allowed",
    "Trajets récurrents": "Recurring trips",
    "Trajets réguliers": "Regular trips",
    "Exemples variés": "Various examples",
    "Pré-rempli": "Pre-filled",
    "Preview prête": "Preview ready",
    "Dons acceptés": "Donations accepted",
    "Primes estimées": "Estimated bonuses",
    "Climatisation préférée": "Preferred air conditioning",
    "Légende :": "Legend:", "Légende": "Legend",
    "Bâtiments": "Buildings",
    "Services supplémentaires": "Additional services",
    "Services complémentaires": "Complementary services",
    "Services complémentaires spécialisés": "Specialized complementary services",
    "Langues parlées": "Languages spoken",
    "Langues parlées spécialisées": "Specialized languages spoken",
    "Largeur façade (m)": "Facade width (m)",
    "Réseaux & Services": "Networks & Services",
    "Réseaux disponibles": "Available networks",
    "Constructibilité": "Buildability",
    "Kilométrage (km)": "Mileage (km)",
    "Cylindrée (cm³)": "Engine displacement (cm³)",
    "Cylindrées spécialisées": "Specialized engine sizes",
    "Zone géographique couverte": "Geographic area covered",
    "Chat instantané (WebSocket)": "Instant chat (WebSocket)",
    "Rangées": "Rows", "Sièges/rangée": "Seats/row",
    "Système Pro": "Pro System", "Système Pro:": "Pro System:",
    "Puissance traitée (BTU)": "Power handled (BTU)",
    "Santé batterie (%)": "Battery health (%)",
    "Connectivité & Apparence": "Connectivity & Appearance",
    "Connectivité & Ports": "Connectivity & Ports",
    "Étanchéité": "Waterproofing",
    "Écran original": "Original screen",
    "Écran tactile": "Touch screen",
    "Système d": "System of",
    "Volume à déménager": "Volume to move",
    "Accessibilité": "Accessibility",
    "Épaisseur": "Thickness",
    "(pré-rempli automatiquement)": "(auto-filled)",
    "(pré-remplie automatiquement)": "(auto-filled)",
    "Décoration Intérieure": "Interior Decoration",
    "Électroménager Domestique": "Home Appliances",
    "Laboratoires & Imagerie médicale": "Laboratories & Medical Imaging",
    "Cosmétique & Parfum": "Cosmetics & Perfume",
    "Ingénieur / Architecte": "Engineer / Architect",
    "Électronique & High-Tech": "Electronics & High-Tech",
    "Soutien Scolaire / Répétiteur": "Tutoring / Private Teacher",
    "Agriculture & Élevage": "Agriculture & Livestock",
    "Menuiserie & Ébénisterie": "Carpentry & Cabinetmaking",
    "Frigoriste / Réparateur Frigo": "Refrigeration Technician / Fridge Repair",
    "Réparateur Climatiseur / AC": "AC / Air Conditioner Repair",
    "Réparateur Électronique (TV/Radio)": "Electronics Repair (TV/Radio)",
    "Animaux & Vétérinaire": "Animals & Veterinary",
    "TV/Radio/Électronique": "TV/Radio/Electronics",
    "Climatisation/Réfrigération": "Air Conditioning/Refrigeration",
    "Services plâtrerie/staff": "Plastering/stucco services",
    "Services vétérinaires": "Veterinary services",
    "Matériel Plomberie & Sanitaire": "Plumbing & Sanitary Equipment",
    "Marques spécialisées": "Specialized brands",
    "Déplacement à domicile": "Home visit",
    "Options spécialisées": "Specialized options",
    "Conseil spécialisé": "Specialized advice", "Conseil spécialisé :": "Specialized advice:",
    "Matériaux utilisés": "Materials used",
    "Matériaux travaillés": "Materials worked",
    "Formats posés": "Formats installed",
    "Logiciels utilisés": "Software used",
    "Prestations générales": "General services",
    "Consultations spécialisées": "Specialized consultations",
    "Services Spéciaux": "Special Services",
    "Analyses Proposées": "Proposed Analyses",
    "Établissement & Spécialisation": "Institution & Specialization",
    "Supports pédagogiques fournis": "Teaching materials provided",
    "Préparateur agréé": "Certified preparer",
    "Certifications supplémentaires": "Additional certifications",
    "Client fournit matériel": "Client provides equipment",
    "Langue & Prérequis": "Language & Prerequisites",
    "Capacité & Places": "Capacity & Seats",
    "Capacité (personnes)": "Capacity (people)",
    "Plantes concernées": "Concerned plants",
    "Matériel & Expertise": "Equipment & Expertise",
    "Zone à couvrir": "Area to cover",
    "Modalité déplacement": "Travel modality",
    "Connectivités": "Connectivity",
    "Utilisation prévue": "Intended use",
    "Style décoratif": "Decorative style",
    "Allergènes présents": "Allergens present",
    "Matériau": "Material", "Dimension/Diamètre": "Dimension/Diameter",
    "Diamètre boîtier": "Case diameter",
    "Tissu utilisé": "Fabric used",
    "Pureté": "Purity",
    "Système ultra-spécialisé": "Ultra-specialized system",
    "Système ultra-spécialisé :": "Ultra-specialized system:",
    "Système intelligent": "Intelligent system",
    "Système intelligent :": "Intelligent system:",
    "Développeur, Comptable...": "Developer, Accountant...",
    "Haute couture, Soignée...": "Haute couture, Elegant...",
    "Cépage": "Grape variety", "Millésime": "Vintage",
    "Mensualité": "Monthly payment", "Nouveautés": "New arrivals",
    "Capacité": "Capacity",
    "Alimentation/Énergie": "Power/Energy",
    "Article déco": "Decorative item",
    "Appareil électronique": "Electronic device",
    "Électroménager": "Home appliance",
    "Vêtement": "Clothing",
    "Réalisation": "Achievement",
    "cinématique": "cinematic", "épique": "epic",
    "Spécialisés": "Specialized", "Spéciaux": "Special",
    "Génération...": "Generation...",
    "Génération": "Generation",
    "audio enregistré.": "audio recorded.",
    "Connecté": "Connected", "Déconnecté": "Disconnected",
    "(modifié)": "(modified)",
    "Répondre": "Reply", "Invité": "Guest",
    "Récurrent": "Recurring", "Récurrents": "Recurring",
    "Passé": "Past", "Abonnés": "Subscribers",
    "Créneaux": "Time slots",
    "Réclamé": "Claimed", "Décès": "Death",
    "Température": "Temperature", "Programmé": "Scheduled",
    "Tempéré": "Temperate", "Gâteau": "Cake",
    "Redémarrer": "Restart",
    "Bannière": "Banner", "Complété": "Completed",
    "Économique": "Economy", "1ère rangée": "1st row",
    "Écrans TV": "TV screens", "Flexibilité": "Flexibility",
    "Réservé": "Reserved", "ARRIÈRE": "REAR",
    "Pré-réservée": "Pre-reserved", "Occupée": "Occupied",
    "Expiré": "Expired", "Envoyés": "Sent",
    "Constitué": "Constituted", "Épuisé": "Out of stock",
    "Souhaitée": "Desired", "Éditeur": "Editor",
    "Éditeur :": "Editor:", "Échange": "Exchange",
    "Créateur": "Creator", "Créateur:": "Creator:",
    "Illimité": "Unlimited", "Académique": "Academic",
    "Établissements": "Institutions", "Conférences": "Conferences",
    "Bénéficiaire": "Beneficiary", "Bénéficiaire :": "Beneficiary:",
    "Méthode": "Method", "Méthode :": "Method:",
    "Unité": "Unit", "Opérateur": "Operator",
    "Prérequis": "Prerequisites",
    "Diplômant": "Degree-granting",
    "Canapé": "Sofa", "Bactériologie": "Bacteriology",
    "Génétique": "Genetics", "chevalière": "signet ring",
    "Matériel DJ": "DJ equipment",
    "ukulélé": "ukulele", "synthé": "synth",
    "djembé": "djembe", "piano numérique": "digital piano",
    "télé": "TV",

    // Food items
    "épices": "spices", "nescafé": "instant coffee",
    "thé": "tea", "céréale": "cereal", "blé": "wheat",
    "légume": "vegetable", "fève": "bean",
    "cacahuète": "peanut", "bœuf": "beef",
    "chèvre": "goat", "café": "coffee",

    // Place names
    "mosquée": "mosque", "école": "school",
    "église": "church", "théâtre": "theater",
    "musée": "museum", "boîte": "box",
    "bâtiment": "building", "siège": "headquarters",
    "préfecture": "prefecture", "lycée": "high school",
    "collège": "middle school", "cathédrale": "cathedral",
    "gîte": "cottage", "nuitée": "night stay",
    "étoile": "star",
    "Guinée": "Guinea", "guinée": "guinea",
    "Bénin": "Benin", "bénin": "benin",
    "Sénégal": "Senegal", "sénégal": "senegal",
    "lomé": "Lomé", "côte": "coast",
    "Côte d'Ivoire": "Ivory Coast",
    "Abidjan, Côte d'Ivoire": "Abidjan, Ivory Coast",
    "Dakar, Sénégal": "Dakar, Senegal",

    // Insurance
    "prévoyance": "insurance coverage",
    "responsabilité civile": "civil liability",
    "décès": "death", "bénéficiaire": "beneficiary",
    "résiliation": "termination",

    // Vehicles
    "coupé": "coupe", "kilométrage": "mileage",
    "cylindrée": "engine displacement",
    "synthétique": "synthetic", "économique": "economy",
    "écologique": "ecological",

    // Home/Deco
    "décoration": "decoration", "déco": "decor",
    "câble": "cable", "néon": "neon",
    "détecteur": "detector",
    "réfrigérateur": "refrigerator",
    "congélateur": "freezer",
    "cuisinière": "stove",
    "machine à laver": "washing machine",
    "ménager": "household",
    "gros électroménager": "large appliances",
    "cafetière": "coffee maker",
    "fer à repasser": "iron",
    "sèche-linge": "dryer",
    "étagère": "shelf", "métal": "metal",
    "machine à coudre": "sewing machine",

    // Medical
    "centre médical": "medical center",
    "médecin": "doctor",
    "glycémie": "blood sugar",
    "sérologie": "serology",
    "hépatite": "hepatitis",
    "écho": "ultrasound",
    "paracétamol": "paracetamol",

    // Electronics
    "télévision": "television",
    "téléviseur": "television set",
    "écran": "screen",
    "écouteurs": "earphones",

    // Real estate
    "viabilisé": "serviced",
    "mètre carré": "square meter",

    // Children
    "bébé": "baby", "poupée": "doll",
    "éducatif": "educational", "éveil": "early learning",
    "sac à dos": "backpack",

    // School
    "université": "university",

    // Beauty / Cosmetics
    "cosmétique": "cosmetic",
    "sérum": "serum",
    "rouge à lèvres": "lipstick",
    "déodorant": "deodorant",
    "médaille": "medal",
    "pierre précieuse": "precious stone",
    "plaqué or": "gold plated",
    "mèche": "hair extension",
    "défrisage": "hair straightening",
    "brésilienne": "Brazilian",
    "soirée": "evening",

    // Jobs
    "créateur": "creator",
    "vérin": "jack",
    "vidéaste": "videographer",
    "développeur": "developer",
    "interprète": "interpreter",
    "rédacteur": "writer",
    "secrétaire": "secretary",
    "comédien": "actor",
    "économiste": "economist",
    "représentant": "representative",
    "décorateur": "decorator",
    "ingénieur": "engineer",
    "ingénieur bâtiment": "building engineer",
    "ingénieur génie civil": "civil engineer",
    "géomètre": "surveyor",

    // Construction
    "études": "studies",
    "bureau étude": "design office",
    "déclaration préalable": "preliminary declaration",
    "métrés": "measurements",
    "exécution": "execution",
    "levé topographique": "topographic survey",
    "rénovation énergétique": "energy renovation",
    "audit énergétique": "energy audit",
    "modélisation 3D": "3D modeling",
    "intérieur": "interior",
    "aménagement intérieur": "interior design",
    "décoration architecturale": "architectural decoration",
    "gros œuvre": "structural work",
    "chaînage": "ring beam",
    "crépi": "render",
    "rénovation mur": "wall renovation",
    "dépannage plomberie": "plumbing repair",
    "débouchage": "unclogging",
    "déboucher": "unclog",
    "chaudière": "boiler",
    "WC bouché": "clogged toilet",
    "toilette bouchée": "clogged toilet",
    "évier bouché": "clogged sink",
    "douche bouchée": "clogged shower",
    "évier": "sink",
    "évacuation": "drainage",
    "complément": "supplement",
    "déménager": "move",
    "déménageur": "mover",

    // Common Ex: patterns
    "Ex: Développeur Full Stack": "E.g.: Full Stack Developer",
    "Ex: Douala, Yaoundé": "E.g.: Douala, Yaoundé",
    "Ex: Devenir développeur Full Stack senior": "E.g.: Become a senior Full Stack developer",
    "Ex: Yaoundé": "E.g.: Yaoundé",
    "Ex: Développeur, Comptable...": "E.g.: Developer, Accountant...",
    "Ex: Douala, Yaoundé...": "E.g.: Douala, Yaoundé...",
    "Ex: Coiffure à domicile": "E.g.: Home hairdressing",
    "Ex: Scientifique, Littéraire": "E.g.: Science, Literature",
    "Ex: Génie Logiciel": "E.g.: Software Engineering",
    "Ex: Paracétamol 500mg": "E.g.: Paracetamol 500mg",
    "Ex: NFS complète": "E.g.: Complete CBC",
    "Ex: Yaoundé, Douala...": "E.g.: Yaoundé, Douala...",
    "Ex: Polytechnique Yaoundé, ENS, ENAM...": "E.g.: Polytechnique Yaoundé, ENS, ENAM...",
    "Ex: Luxury VIP, Standard, Économique": "E.g.: Luxury VIP, Standard, Economy",
    "Ex: Tomates fraîches": "E.g.: Fresh tomatoes",

    // Cooking specialties
    "Ndolé": "Ndolé", "Eru": "Eru", "Poulet DG": "Poulet DG", "Koki": "Koki",
    "Attiéké": "Attiéké", "Garba": "Garba", "Kedjenou": "Kedjenou",
    "Thiéboudienne": "Thiéboudienne", "Yassa": "Yassa", "Mafé": "Mafé",
    "Tô": "Tô", "Maafé": "Maafé", "Fonio": "Fonio",
    "Nyembwé": "Nyembwé", "Moambe": "Moambe",

    // Additional patterns
    "marché": "market",
    "kg émis": "kg emitted", "kg éco.": "kg saved",
    "Télétravail": "Remote work",
    "Santé": "Health",
    "Récente": "Recent", "unités": "units",

    // Misc remaining
    "Paracétamol, ophtalmologue, analyse sang...": "Paracetamol, ophthalmologist, blood test...",
};

function translateValue(frText) {
    if (!frText || typeof frText !== 'string') return frText;
    
    let result = frText;
    
    // Strip emoji prefix, translate text, restore
    const emojiMatch = result.match(/^((?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{2702}-\u{27B0}\u{E000}-\u{F8FF}✅❌⚠️🔒🛡️🔄🌐📝🫀🎯🎚️👁️🏆✏️📍📋🌱🏥💬💰📱🚗🛠️👥🟢🔴]+\s*)+)/u);
    let emojiPrefix = '';
    if (emojiMatch) {
        emojiPrefix = emojiMatch[1];
        result = result.substring(emojiPrefix.length);
    }
    
    // Sort by length desc
    const entries = Object.entries(d).sort((a, b) => b[0].length - a[0].length);
    
    // Exact match
    for (const [f, e] of entries) {
        if (result === f) return emojiPrefix + e;
        if (result.toLowerCase() === f.toLowerCase()) {
            return emojiPrefix + (result[0] === result[0].toUpperCase() 
                ? e.charAt(0).toUpperCase() + e.slice(1) : e);
        }
    }
    
    // Phrase replacement
    for (const [f, e] of entries) {
        if (f.length < 2) continue;
        const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            const regex = new RegExp(escaped, 'gi');
            result = result.replace(regex, (match) => {
                if (match[0] === match[0].toUpperCase() && e[0] === e[0].toLowerCase()) {
                    return e.charAt(0).toUpperCase() + e.slice(1);
                }
                if (match === match.toLowerCase()) return e.toLowerCase();
                return e;
            });
        } catch(err) {}
    }
    
    // Common patterns
    result = result.replace(/\bl'/gi, 'the ');
    result = result.replace(/\bd'/gi, 'of ');
    result = result.replace(/\bn'/gi, 'not ');
    result = result.replace(/\bs'/gi, '');
    result = result.replace(/\bqu'/gi, 'that ');
    result = result.replace(/\bà\b/g, 'to');
    result = result.replace(/\bÀ\b/g, 'To');
    result = result.replace(/\best\b/gi, 'is');
    result = result.replace(/\bsont\b/gi, 'are');
    result = result.replace(/\ble\b/gi, 'the');
    result = result.replace(/\bla\b/gi, 'the');
    result = result.replace(/\bles\b/gi, 'the');
    result = result.replace(/\bun\b/gi, 'a');
    result = result.replace(/\bune\b/gi, 'a');
    result = result.replace(/\bdes\b/gi, 'some');
    result = result.replace(/\bdu\b/gi, 'of the');
    result = result.replace(/\bde\b/gi, 'of');
    result = result.replace(/\bet\b/gi, 'and');
    result = result.replace(/\bou\b/gi, 'or');
    result = result.replace(/\ben\b/gi, 'in');
    result = result.replace(/\bau\b/gi, 'at the');
    result = result.replace(/\baux\b/gi, 'at the');
    result = result.replace(/\bsur\b/gi, 'on');
    result = result.replace(/\bdans\b/gi, 'in');
    result = result.replace(/\bpar\b/gi, 'by');
    result = result.replace(/\bpour\b/gi, 'for');
    result = result.replace(/\bavec\b/gi, 'with');
    result = result.replace(/\bsans\b/gi, 'without');
    result = result.replace(/\bvotre\b/gi, 'your');
    result = result.replace(/\bvos\b/gi, 'your');
    result = result.replace(/\bnotre\b/gi, 'our');
    result = result.replace(/\bnos\b/gi, 'our');
    result = result.replace(/\bmon\b/gi, 'my');
    result = result.replace(/\bma\b/gi, 'my');
    result = result.replace(/\bmes\b/gi, 'my');
    result = result.replace(/\bce\b/gi, 'this');
    result = result.replace(/\bcette\b/gi, 'this');
    result = result.replace(/\bces\b/gi, 'these');
    
    result = result.replace(/\s+/g, ' ').trim();
    return emojiPrefix + result;
}

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
let translated = 0;

for (const ns of Object.keys(fr)) {
    if (!en[ns]) en[ns] = {};
    for (const key of Object.keys(fr[ns])) {
        const frVal = fr[ns][key];
        const enVal = en[ns]?.[key];
        if (enVal === undefined) { en[ns][key] = translateValue(frVal); translated++; continue; }
        if (enVal !== frVal) continue;
        if (!frChars.test(frVal)) continue;
        const newEn = translateValue(frVal);
        if (newEn !== frVal) { en[ns][key] = newEn; translated++; }
    }
}

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

let copies = 0;
for (const ns of Object.keys(fr)) {
    for (const key of Object.keys(fr[ns])) {
        if (en[ns]?.[key] === fr[ns][key] && frChars.test(fr[ns][key])) copies++;
    }
}

console.log('\n=== EN Translation V3 Results ===');
console.log('Keys translated:', translated);
console.log('Remaining FR copies in EN:', copies);
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID', e.message); }
