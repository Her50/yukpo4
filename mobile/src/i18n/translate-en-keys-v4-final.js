#!/usr/bin/env node
/**
 * translate-en-keys-v4-final.js — Final pass for remaining ~380 FR→EN keys.
 * Handles: Ex: patterns, partial fragments, domain-specific terms, corrupted strings.
 */
const fs = require('fs');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

// Direct key→value overrides for known remaining patterns
const exact = {
    // Partial fragments
    "Vérifiez l\\": "Check the",
    "Décrivez l": "Describe the",
    "Dépannage d": "Repair of",
    "À l": "At the",
    "Degré d": "Degree of",
    "Supérieur": "Higher education",
    "Créneau": "Time slot",
    
    // Ex: patterns - translate context words, keep proper nouns
    "Ex: Route goudronnée, Zone inondable saison pluies...": "E.g.: Paved road, Flood zone rainy season...",
    "Ex: Douala, Kribi, Limbe, Yaoundé...": "E.g.: Douala, Kribi, Limbe, Yaoundé...",
    "Ex: Zone résidentielle...": "E.g.: Residential zone...",
    "Ex: Rectangulaire, Carré...": "E.g.: Rectangular, Square...",
    "Ex: Route goudronnée...": "E.g.: Paved road...",
    "Ex: Dégagé, Arbres...": "E.g.: Clear, Trees...",
    "Ex: Vacant, Cultivé...": "E.g.: Vacant, Cultivated...",
    "Ex: Été, Toutes saisons...": "E.g.: Summer, All seasons...",
    "Ex: Uni, Wax, Rayé...": "E.g.: Solid, Wax, Striped...",
    "Ex: Blanc, Doré...": "E.g.: White, Gold...",
    "Ex: Chromé, Zingué": "E.g.: Chrome, Galvanized",
    "Ex: Usage résidentiel": "E.g.: Residential use",
    "Ex: Quincaillerie spécialisée": "E.g.: Specialized hardware store",
    "Ex: Comprend installation + câblage...": "E.g.: Includes installation + wiring...",
    "Ex: Nestlé, Maggi, Uncle Ben": "E.g.: Nestlé, Maggi, Uncle Ben",
    "Ex: Cameroun, France, Thaïlande...": "E.g.: Cameroon, France, Thailand...",
    "Ex: Emballage, Transport, Déballage...": "E.g.: Packaging, Transport, Unpacking...",
    "Ex: Normale, Sèche, Grasse...": "E.g.: Normal, Dry, Oily...",
    "Ex: Mat, Brillant, Satiné...": "E.g.: Matte, Glossy, Satin...",
    "Ex: Machine à broder, Surjeteuse...": "E.g.: Embroidery machine, Overlocker...",
    "Ex: Console, Drone, Caméra...": "E.g.: Console, Drone, Camera...",
    "Ex: Valise OBD, Multimètre, Scanner...": "E.g.: OBD Scanner, Multimeter, Scanner...",
    "Ex: Céramique, Grès cérame, Marbre...": "E.g.: Ceramic, Porcelain stoneware, Marble...",
    "Ex: Joint blanc, Joint époxy...": "E.g.: White grout, Epoxy grout...",
    "Ex: Carreleur qualifié, CAP Carreleur...": "E.g.: Qualified tiler, Tiling certificate...",
    "Ex: Bois massif, Contreplaqué, MDF...": "E.g.: Solid wood, Plywood, MDF...",
    "Ex: Génie civil, Architecture, Géotechnique...": "E.g.: Civil engineering, Architecture, Geotechnics...",
    "Ex: Éclairage, Câblage...": "E.g.: Lighting, Wiring...",
    "Ex: Bio, Équitable, GOTS": "E.g.: Organic, Fair trade, GOTS",
    "Ex: Moteur & Mécanique": "E.g.: Engine & Mechanics",
    "Ex: Mixte, Garçon...": "E.g.: Mixed, Boys...",
    "Ex: Carrelage sol, Faïence murale...": "E.g.: Floor tiles, Wall tiles...",
    "Ex: Grès cérame, Céramique, Marbre...": "E.g.: Porcelain stoneware, Ceramic, Marble...",
    "Ex: Menuiserie intérieure, Ébénisterie, Charpente...": "E.g.: Interior carpentry, Cabinetmaking, Framing...",
    "Ex: Peinture intérieur, Ravalement façade...": "E.g.: Interior painting, Facade renovation...",
    "Ex: Ampoule LED E27, Câble 2.5mm², Prise USB...": "E.g.: LED Bulb E27, 2.5mm² Cable, USB Socket...",
    "Ex: Céréales, Condiments...": "E.g.: Cereals, Condiments...",
    "Ex: Température ambiante, Réfrigéré...": "E.g.: Room temperature, Refrigerated...",
    "Ex: Responsabilité civile...": "E.g.: Civil liability...",
    "Ex: Peluche, Jeu éducatif...": "E.g.: Stuffed toy, Educational game...",
    "Ex: Intérieur, Extérieur...": "E.g.: Indoor, Outdoor...",
    "Ex: Réfrigérateur 2 portes, Lave-linge hublot...": "E.g.: 2-door refrigerator, Front-load washer...",
    "Ex: Gros électroménager - Froid": "E.g.: Large appliances - Cold",
    "Ex: Réfrigérateur": "E.g.: Refrigerator",
    "Ex: Canapé 3 places, Table à manger 6 places...": "E.g.: 3-seat sofa, 6-seat dining table...",
    "Ex: Vase décoratif, Coussin...": "E.g.: Decorative vase, Cushion...",
    "Ex: Décoration murale, Luminaires...": "E.g.: Wall decor, Lighting...",
    "Ex: Bois, Métal...": "E.g.: Wood, Metal...",
    "Ex: Canapé, Table, Armoire": "E.g.: Sofa, Table, Wardrobe",
    "Ex: NFS, Glycémie, Sérologie...": "E.g.: CBC, Blood sugar, Serology...",
    "Ex: Paracétamol, Doliprane, Amoxicilline...": "E.g.: Paracetamol, Doliprane, Amoxicillin...",
    "Ex: Paracétamol, Amoxicilline...": "E.g.: Paracetamol, Amoxicillin...",
    "Ex: 3 étoiles, 4 étoiles...": "E.g.: 3 stars, 4 stars...",
    "Ex: Douala, Yaoundé, Kinshasa, Abidjan...": "E.g.: Douala, Yaoundé, Kinshasa, Abidjan...",
    "Ex: Douala, Yaoundé, Abidjan...": "E.g.: Douala, Yaoundé, Abidjan...",
    "Ex: Douala, Yaoundé, Bafoussam...": "E.g.: Douala, Yaoundé, Bafoussam...",
    "Ex: Yaoundé, Abidjan...": "E.g.: Yaoundé, Abidjan...",
    "Ex: Yaoundé, Brazzaville, Lomé...": "E.g.: Yaoundé, Brazzaville, Lomé...",
    "Ex: Sciences, Littérature, Technique, Commerce...": "E.g.: Science, Literature, Technical, Commerce...",
    "Ex: Baccalauréat, BTS, Licence, Master...": "E.g.: Baccalaureate, BTS, Bachelor, Master...",
    "Ex: Télévision": "E.g.: Television",
    "Ex: École, Marché...": "E.g.: School, Market...",
    
    // Food descriptions (keep proper nouns)
    "Démontable, Extensible, Pliable...": "Detachable, Expandable, Foldable...",
    "Robes mariée, Bazin...": "Wedding dresses, Bazin...",
    "Camerounaise, Ivoirienne, Sénégalaise...": "Cameroonian, Ivorian, Senegalese...",
    "Attiéké, Aloco, Garba, Kedjenou...": "Attiéké, Aloco, Garba, Kedjenou...",
    "Ndolé, Eru, Poulet DG, Koki...": "Ndolé, Eru, Poulet DG, Koki...",
    "Thiéboudienne, Yassa, Mafé...": "Thiéboudienne, Yassa, Mafé...",
    "Tô, Maafé, Fonio...": "Tô, Maafé, Fonio...",
    "Nyembwé, Moambe...": "Nyembwé, Moambe...",
    "Riz gras, Tô...": "Jollof rice, Tô...",
    "Togo, Bénin, Niger, Tchad, Madagascar...": "Togo, Benin, Niger, Chad, Madagascar...",
    "Économique, Moyen, Premium...": "Economy, Medium, Premium...",
    "Mariage, Soirée, Quotidien...": "Wedding, Evening, Daily...",
    "Frigos, fours, machines à laver, micro-ondes": "Fridges, ovens, washing machines, microwaves",
    "Jouets éducatifs, peluches, jeux, puzzles, livres enfants": "Educational toys, stuffed animals, games, puzzles, children's books",
    "Colliers, bagues, bracelets, montres, pierres précieuses": "Necklaces, rings, bracelets, watches, precious stones",
    "Smartphones, accessoires, coques, écouteurs": "Smartphones, accessories, cases, earphones",
    "Appareils électroniques, gadgets, accessoires tech": "Electronic devices, gadgets, tech accessories",
    "Vétérinaires, toilettage, dressage, accessoires animaux": "Veterinary, grooming, training, pet accessories",
    "Câbles, prises, interrupteurs, lampes, disjoncteurs": "Cables, sockets, switches, lamps, circuit breakers",
    "Tableaux, luminaires, tapis, accessoires déco": "Paintings, lighting, rugs, decorative accessories",
    
    // UI terms
    "ID Établissement 1": "Institution ID 1",
    "Filière 1": "Field 1",
    "ID Établissement 2": "Institution ID 2",
    "Filière 2": "Field 2",
    
    // Technical fragments
    "détection fuite": "leak detection",
    "électronique auto": "auto electronics",
    "démarreur": "starter",
    "câblage auto": "auto wiring",
    "boîtier électronique": "electronic control unit",
    "alternateur défaillant": "faulty alternator",
    "peinture extérieur": "exterior paint",
    "ravalement façade": "facade renovation",
    "ponçage": "sanding",
    "glycéro": "glycerol-based paint",
    "Oréal": "Oréal",
    
    // Corrupted encoding strings — mark as-is (these are broken data)
    "ƒÆ¼ Chat": "💬 Chat",
    "ƒæü´©Å Voir": "👁️ View",
    "├Ç r├®fl├®chir": "🤔 Think about it",
    "├Ç proximit├®": "📍 Nearby",
};

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
// Also match corrupted chars
const corrupted = /[ƒ├®©Å¼´ü]/;

let translated = 0;

for (const ns of Object.keys(fr)) {
    if (!en[ns]) en[ns] = {};
    for (const key of Object.keys(fr[ns])) {
        const frVal = fr[ns][key];
        const enVal = en[ns]?.[key];
        if (enVal === undefined) continue; // already synced
        if (enVal !== frVal) continue; // already translated
        if (!frChars.test(frVal) && !corrupted.test(frVal)) continue;
        
        // Try exact match from our dictionary
        let found = false;
        for (const [f, e] of Object.entries(exact)) {
            if (frVal === f || frVal.trim() === f) {
                en[ns][key] = e;
                translated++;
                found = true;
                break;
            }
        }
        if (found) continue;
        
        // Try partial/contains match for "Ex:" patterns
        if (frVal.startsWith('Ex:') || frVal.startsWith('Ex :')) {
            // Generic: replace "Ex:" with "E.g.:" and translate common words
            let result = frVal.replace(/^Ex\s*:\s*/, 'E.g.: ');
            const wordMap = {
                'Canapé': 'Sofa', 'Réfrigérateur': 'Refrigerator', 'Céramique': 'Ceramic',
                'Électroménager': 'Appliance', 'Éclairage': 'Lighting', 'Câblage': 'Wiring',
                'Développeur': 'Developer', 'Comptable': 'Accountant', 'Éducatif': 'Educational',
                'Température': 'Temperature', 'Réfrigéré': 'Refrigerated', 'Équitable': 'Fair trade',
                'Télévision': 'Television', 'Électronique': 'Electronics', 'Mécanique': 'Mechanics',
                'Résidentiel': 'Residential', 'Spécialisée': 'Specialized', 'Spécialisé': 'Specialized',
                'Céréales': 'Cereals', 'Décoration': 'Decoration', 'Intérieur': 'Interior',
                'Extérieur': 'Exterior', 'Étoiles': 'Stars', 'étoiles': 'stars', 'étoile': 'star',
                'Garçon': 'Boys', 'Mixte': 'Mixed', 'Sèche': 'Dry', 'Grasse': 'Oily',
                'Normale': 'Normal', 'Brillant': 'Glossy', 'Satiné': 'Satin',
                'Responsabilité': 'Liability', 'civile': 'civil',
                'Emballage': 'Packaging', 'Déballage': 'Unpacking',
                'École': 'School', 'Marché': 'Market',
                'Génie': 'Engineering', 'Bâtiment': 'Building',
                'Peinture': 'Paint', 'Ravalement': 'Renovation', 'façade': 'facade',
                'Menuiserie': 'Carpentry', 'Ébénisterie': 'Cabinetmaking', 'Charpente': 'Framing',
                'Peluche': 'Stuffed toy', 'Carrelage': 'Tiling', 'Faïence': 'Wall tiles',
                'Grès cérame': 'Porcelain stoneware', 'Ampoule': 'Bulb',
                'Câble': 'Cable', 'Prise': 'Socket',
            };
            for (const [f, e] of Object.entries(wordMap).sort((a,b) => b[0].length - a[0].length)) {
                result = result.split(f).join(e);
            }
            if (result !== frVal) {
                en[ns][key] = result;
                translated++;
                continue;
            }
        }
        
        // Generic word-level translation for remaining
        let result = frVal;
        const genericWords = {
            'Créneau': 'Time slot', 'créneaux': 'time slots',
            'Établissement': 'Institution', 'établissement': 'institution',
            'Filière': 'Field', 'filière': 'field',
            'Réparateur': 'Repair technician',
            'Climatiseur': 'Air conditioner',
            'Consultation': 'Consultation',
            'Vétérinaire': 'Veterinary',
            'Diplômant': 'Degree-granting',
            'Bactériologie': 'Bacteriology',
            'Génétique': 'Genetics',
            'précieuse': 'precious', 'précieuses': 'precious',
            'électronique': 'electronic', 'électroniques': 'electronic',
            'éducatif': 'educational', 'éducatifs': 'educational',
            'médical': 'medical', 'médicale': 'medical',
            'spécialisé': 'specialized', 'spécialisée': 'specialized',
            'spécialisés': 'specialized', 'spécialisées': 'specialized',
            'supplémentaires': 'additional', 'supplémentaire': 'additional',
            'complémentaires': 'complementary', 'complémentaire': 'complementary',
            'résidentiel': 'residential', 'résidentielle': 'residential',
            'intérieur': 'interior', 'intérieure': 'interior',
            'extérieur': 'exterior', 'extérieure': 'exterior',
            'numérique': 'digital', 'électrique': 'electric',
            'énergétique': 'energy', 'automatique': 'automatic',
            'pédagogiques': 'educational', 'pédagogique': 'educational',
            'générale': 'general', 'général': 'general',
            'générales': 'general',
            'détaillé': 'detailed', 'détaillée': 'detailed',
            'estimé': 'estimated', 'estimée': 'estimated',
            'récent': 'recent', 'récente': 'recent',
            'récents': 'recent', 'récentes': 'recent',
            'suggéré': 'suggested', 'suggérée': 'suggested',
            'suggérés': 'suggested', 'suggérées': 'suggested',
            'préféré': 'preferred', 'préférée': 'preferred',
            'sélectionné': 'selected', 'sélectionnée': 'selected',
            'réservé': 'reserved', 'réservée': 'reserved',
            'réservés': 'reserved', 'réservées': 'reserved',
            'accepté': 'accepted', 'acceptée': 'accepted',
            'acceptés': 'accepted', 'acceptées': 'accepted',
            'complété': 'completed', 'complétée': 'completed',
            'complétés': 'completed', 'complétées': 'completed',
            'programmé': 'scheduled', 'programmée': 'scheduled',
            'vérifié': 'verified', 'vérifiée': 'verified',
            'déclaré': 'declared', 'déclarée': 'declared',
            'approuvé': 'approved', 'approuvée': 'approved',
            'annulé': 'cancelled', 'annulée': 'cancelled',
            'terminé': 'completed', 'terminée': 'completed',
            'confirmé': 'confirmed', 'confirmée': 'confirmed',
            'expiré': 'expired', 'expirée': 'expired',
            'expiré ': 'expired ', 'expirées': 'expired',
            'épuisé': 'out of stock', 'épuisée': 'out of stock',
            'constitué': 'constituted', 'constituée': 'constituted',
            'envoyé': 'sent', 'envoyée': 'sent',
            'envoyés': 'sent', 'envoyées': 'sent',
            'modifié': 'modified', 'modifiée': 'modified',
            'réclamé': 'claimed', 'réclamée': 'claimed',
            'connecté': 'connected', 'connectée': 'connected',
            'déconnecté': 'disconnected', 'déconnectée': 'disconnected',
            'sponsorisé': 'sponsored', 'sponsorisée': 'sponsored',
            'pré-rempli': 'pre-filled', 'pré-remplie': 'pre-filled',
            'pré-réservée': 'pre-reserved', 'pré-réservé': 'pre-reserved',
            'occupée': 'occupied', 'occupé': 'occupied',
            'embarqués': 'boarded', 'embarquées': 'boarded',
            'illimité': 'unlimited', 'illimitée': 'unlimited',
            'académique': 'academic',
            'négociable': 'negotiable',
            'récurrent': 'recurring', 'récurrente': 'recurring',
            'récurrents': 'recurring', 'récurrentes': 'recurring',
            'réguliers': 'regular', 'régulier': 'regular',
            'régulières': 'regular', 'régulière': 'regular',
            'variés': 'varied', 'varié': 'varied',
            'variées': 'varied', 'variée': 'varied',
        };
        for (const [f, e] of Object.entries(genericWords).sort((a,b) => b[0].length - a[0].length)) {
            const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            try { result = result.replace(new RegExp(escaped, 'g'), e); } catch(err) {}
        }
        // Also handle l', d', etc.
        result = result.replace(/\bl'/gi, 'the ');
        result = result.replace(/\bd'/gi, 'of ');
        result = result.replace(/\bà\b/g, 'to');
        result = result.replace(/\bÀ\b/g, 'To');
        result = result.replace(/\s+/g, ' ').trim();
        
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

console.log('\n=== EN Translation V4 Final Results ===');
console.log('Keys translated:', translated);
console.log('Remaining FR copies in EN:', copies);
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID', e.message); }
