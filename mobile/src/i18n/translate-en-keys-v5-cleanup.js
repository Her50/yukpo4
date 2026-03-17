#!/usr/bin/env node
/**
 * translate-en-keys-v5-cleanup.js — Final cleanup for remaining ~285 untranslated EN keys.
 * Direct word-by-word translation for all remaining accented French words.
 */
const fs = require('fs');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

// All remaining words with accents that need translation
const w = {
    // Construction/trades
    "satinée": "satin", "satine": "satin", "satiné": "satin",
    "peintre qualifié": "qualified painter", "rénovation peinture": "paint renovation",
    "plâtrerie": "plastering", "plâtre": "plaster",
    "cloison sèche": "drywall", "placoplâtre": "plasterboard",
    "enduit plâtre": "plaster coating", "ragréage": "floor leveling",
    "modénature": "molding", "voûte": "vault", "staffeur qualifié": "qualified stucco worker",
    "écrou": "nut", "charnière": "hinge", "téflon": "teflon",
    "pâte joint": "joint paste", "faïence": "earthenware",
    "pavé": "paving stone", "grès": "sandstone", "grès cérame": "porcelain stoneware",
    "céramique": "ceramic", "antidérapant": "non-slip",
    "structuré": "textured", "marbré": "marbled", "veiné": "veined",
    "métro": "metro", "résistant": "resistant",
    "ébénisterie": "cabinetmaking", "ébéniste": "cabinetmaker",
    "fenêtre": "window", "rénovation": "renovation",
    "réparateur": "repair technician", "dépannage": "repair",
    "air conditionné": "air conditioning",
    "dépannage TV": "TV repair", "TV cassée": "broken TV",
    "rétro-éclairage": "backlight",
    "matériel": "equipment", "élagage": "pruning",
    "débroussaillage": "brush clearing", "allée": "pathway",
    "tronçonneuse": "chainsaw", "aménagement": "landscaping",
    
    // Kitchen/food
    "râpe": "grater", "cuillère": "spoon", "anti-adhésif": "non-stick",
    "déjeuner": "lunch", "dîner": "dinner", "à emporter": "takeaway",
    "flûte": "flute", "Gâteau": "Cake", "Goûter": "Snack",
    "pincée": "pinch", "épices": "spices",
    
    // Animals/nature
    "élevage": "livestock farming", "récolte": "harvest",
    "pépinière": "nursery", "maraîchage": "market gardening",
    "bétail": "cattle", "vétérinaire": "veterinarian", "véto": "vet",
    "litière": "litter", "pâtée": "pet food",
    
    // Education/events
    "répétiteur": "tutor", "prof à domicile": "home tutor",
    "séminaire": "seminar", "fête": "party", "baptême": "baptism",
    "célébration": "celebration", "cérémonie": "ceremony",
    "conférence": "conference", "étude": "study", "faculté": "faculty",
    "être": "be", "Littéraire": "Literary", "Ingénierie": "Engineering",
    
    // Sports/wellness
    "karaté": "karate", "entraîneur": "trainer",
    "détente": "relaxation", "réflexologie": "reflexology",
    "suédois": "Swedish", "méditation": "meditation",
    
    // Cleaning
    "ménage": "housekeeping", "propreté": "cleanliness",
    "dépoussiérage": "dusting", "serpillière": "mop",
    
    // Medical
    "Hépatique": "Hepatic", "Rénal": "Renal",
    "Cancérologie": "Oncology", "Fièvre persistante": "Persistent fever",
    "Bilan rénal": "Kidney panel", "Hémogramme": "Complete blood count",
    "Contre-indiqué": "Contraindicated", "Délivrance": "Dispensing",
    
    // Clothing
    "écharpe": "scarf",
    
    // Geography
    "égypte": "Egypt",
    
    // UI/Status terms
    "Réactions": "Reactions", "Évolution temporelle": "Time evolution",
    "Options avancées": "Advanced options",
    "Format carré (1080x1080)": "Square format (1080x1080)",
    "Ciné Premium": "Cinema Premium", "Ciné": "Cinema",
    "Português (BR)": "Portuguese (BR)",
    "Montée orchestrale immersive": "Immersive orchestral crescendo",
    "Total à payer": "Total to pay",
    "IA générées": "AI generated", "Analytics Avancés": "Advanced Analytics",
    "Éditer": "Edit", "Preview généré": "Preview generated",
    "Difficulté": "Difficulty", "Popularité": "Popularity",
    "Contenu inapproprié": "Inappropriate content",
    "Arnaque suspectée": "Suspected scam",
    "Harcèlement": "Harassment", "enregistrée": "registered",
    "Spécialisé": "Specialized", "Assisté IA": "AI Assisted",
    "Ligne supprimée": "Line deleted", "Occupé": "Busy",
    "Ponctualité": "Punctuality", "Propreté": "Cleanliness",
    "Fermé": "Closed", "Texte à traduire": "Text to translate",
    "Português": "Portuguese",
    "Ciné": "Cinema", "Énergique": "Energetic", "Détendu": "Relaxed",
    "Créatives": "Creative", "Personnes récemment taguées": "Recently tagged people",
    "Mécanique": "Mechanics", "Prévisualisation…": "Preview...",
    "Prévisualiser 3s": "Preview 3s", "Météo": "Weather",
    "Bientôt": "Coming soon", "Dernière modification": "Last modified",
    "Génial !": "Great!", "Instantané": "Instant",
    "Échec": "Failed", "À constituer": "To be constituted",
    "Mauvaise quantité": "Wrong quantity",
    "Mentions légales": "Legal notices",
    "Services créés": "Services created",
    "Tokens utilisés": "Tokens used",
    "Envoyé !": "Sent!", "Synchronisé": "Synchronized",
    "Couverture étendue": "Extended coverage",
    "Couverture complète": "Complete coverage",
    "Cœur": "Heart", "Trophée": "Trophy", "Météore": "Meteor",
    "remboursé": "refunded", "surchargé": "overloaded",
    "À calculer (GPS)": "To calculate (GPS)",
    "Embarqué": "Boarded", "Privé": "Private",
    "Aligné": "Aligned", "À rénover": "To renovate",
    "Avancé": "Advanced", "Endommagée": "Damaged",
    "Rangée": "Row", "Série": "Series", "Éco": "Eco",
    "CO2 Émis": "CO2 Emitted", "Arbres Équivalents": "Equivalent Trees",
    "lieu(x) trouvé(s)": "location(s) found",
    "Marche libre démarrée !": "Free walk started!",
    "CO2 économisé, arbres équivalents": "CO2 saved, equivalent trees",
    "Prête": "Ready", "prête": "ready",
    "Décroissant": "Descending",
    "Embarqué": "Boarded", "Notifié": "Notified",
    "Récap": "Summary", "avancé": "advanced",
    "Végan": "Vegan", "Américaine": "American",
    "Œufs": "Eggs", "Saturé": "Saturated",
    "Hôtels": "Hotels", "rénové": "renovated",
    "à 5 biens maximum": "up to 5 properties maximum",
    "Zone délimitée": "Delimited zone",
    "Célibataire": "Single", "Marié(e)": "Married",
    "Divorcé(e)": "Divorced",
    "À retirer": "To pick up",
    "Créativité": "Creativity", "Organisé": "Organized",
    "Ndolé": "Ndolé", "Arrivé": "Arrived",
    "Live démarré!": "Live started!",
    "réseau": "network", "Tarifs compétitifs": "Competitive rates",
    "Spécial": "Special",
    "Logs effacés": "Logs cleared",
    "Difficulté signalée": "Difficulty reported",
    "synchronisé": "synchronized", "Supprimé": "Deleted",
    "Notification supprimée": "Notification deleted",
    "Réactivation...": "Reactivation...",
    "Briefs améliorés !": "Briefs improved!",
    "Brief appliqué": "Brief applied",
    "Brief généré": "Brief generated",
    "Plan IA généré": "AI plan generated",
    "énergique": "energetic",
    "prévisualisation": "preview",
    "Idéal Instagram Stories": "Ideal Instagram Stories",
    "Détecter + Traduire": "Detect + Translate",
    "Export Excel généré": "Excel export generated",
    "Jean-Pierre, Yaoundé": "Jean-Pierre, Yaoundé",
    "Route optimisée": "Optimized route",
    "Arrivé à destination": "Arrived at destination",
    "échec d": "failure of",
    "adapte AUTOMATIQUEMENT à N": "automatically adapts to N",
    
    // Interpolation templates
    "Maximum {{maxImages}} photos autorisées": "Maximum {{maxImages}} photos allowed",
    "Consultation Vétérinaire {{typeAnimal}}": "Veterinary Consultation {{typeAnimal}}",
    
    // Cuisine proper nouns (keep as-is, they're proper names)
    "Ndolé, Eru, Poulet DG, Koki...": "Ndolé, Eru, Poulet DG, Koki...",
    "Attiéké, Aloco, Garba, Kedjenou...": "Attiéké, Aloco, Garba, Kedjenou...",
    "Thiéboudienne, Yassa, Mafé...": "Thiéboudienne, Yassa, Mafé...",
    "Tô, Maafé, Fonio...": "Tô, Maafé, Fonio...",
    "Nyembwé, Moambe...": "Nyembwé, Moambe...",
    
    // Corrupted strings → fix to proper emoji
    "ƒÆ¼ Chat": "💬 Chat",
    "ƒæü´©Å Voir": "👁️ View",
    "ƒöÑƒöÑ": "👍👍", "ƒöÑ": "👍",
    "ƒñö": "😖", "ƒîì": "🎌",
    "ƒÄÑ Vid├®o": "🎬 Video",
    "ÔØñ´©Å": "👁️", "ƒæì": "💬",
    "ƒæÄ": "💤", "ƒÿì": "🔌",
    "ƒÿó": "🔓", "ƒÿ«": "🔫",
    "ƒÆ»": "💻", "ƒæÅ": "💥",
    "ƒÆ¬": "💬", "ƒô▒": "📱",
    "├ù": "ù", "ƒÿè": "🔨",
    "ƒÄë": "🎋", "ƒÿò": "🔒",
    "ƒç¿ƒç▓": "🧿🧲", "ƒç½ƒçÀ": "🧽🧀",
    "ƒææ Propri├®taire": "👤 Owner",
    "ƒæñ Invit├®": "👤 Guest",
    "ƒæÑ Participant": "👤 Participant",
    
    // Oréal should stay (brand name)
    "Oréal": "Oréal",
};

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const corrupted = /[ƒ├®©Å¼´ü]/;

let translated = 0;

for (const ns of Object.keys(fr)) {
    if (!en[ns]) en[ns] = {};
    for (const key of Object.keys(fr[ns])) {
        const frVal = fr[ns][key];
        const enVal = en[ns]?.[key];
        if (enVal === undefined || enVal !== frVal) continue;
        if (!frChars.test(frVal) && !corrupted.test(frVal)) continue;
        
        // Try exact match
        if (w[frVal] !== undefined) {
            en[ns][key] = w[frVal];
            translated++;
            continue;
        }
        
        // Try stripping emoji prefix
        const stripped = frVal.replace(/^[^\w\s(]*\s*/, '').trim();
        if (w[stripped] !== undefined) {
            const prefix = frVal.substring(0, frVal.length - stripped.length);
            en[ns][key] = prefix + w[stripped];
            translated++;
            continue;
        }
        
        // Try word-by-word replacement
        let result = frVal;
        const sorted = Object.entries(w).sort((a, b) => b[0].length - a[0].length);
        for (const [f, e] of sorted) {
            if (f.length < 2) continue;
            const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            try {
                result = result.replace(new RegExp(escaped, 'g'), e);
            } catch(err) {}
        }
        
        if (result !== frVal) {
            en[ns][key] = result;
            translated++;
        }
    }
}

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

let copies = 0;
for (const ns of Object.keys(fr)) {
    for (const key of Object.keys(fr[ns])) {
        if (en[ns]?.[key] === fr[ns][key] && (frChars.test(fr[ns][key]) || corrupted.test(fr[ns][key]))) copies++;
    }
}

console.log('\n=== EN Translation V5 Cleanup Results ===');
console.log('Keys translated:', translated);
console.log('Remaining FR copies in EN:', copies);
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID', e.message); }
