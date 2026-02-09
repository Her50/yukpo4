const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'screens', 'HomeScreen.tsx');

// Lire le fichier en bytes pour voir l'encodage réel
let content = fs.readFileSync(filePath, 'utf8');

// Supprimer tous les caractères invalides au début avant /**
// Plus agressif : supprimer tout ce qui n'est pas ASCII avant /**
content = content.replace(/^[^\x00-\x7F]*\/\*\*/, '/**');
content = content.replace(/^[^\x20-\x7E]*\/\*\*/, '/**');

// Supprimer les caractères de contrôle invisibles (BOM, zero-width, etc.)
content = content.replace(/[\uFEFF\u200B-\u200D\u2060]/g, '');

// Supprimer les caractères corrompus spécifiques au début
content = content.replace(/^[\uFFFD\u0000-\u001F\u007F-\u009F]+/, '');

// Corriger les caractères corrompus spécifiques
const corrections = {
    '├ë': 'É',
    '├®': 'é',
    '├¿': 'è',
    '├á': 'à',
    '├╗': 'û',
    '├┤': 'ô',
    '├®': 'é',
    '├¿': 'è',
    '├á': 'à',
    '├╗': 'û',
    '├┤': 'ô',
    'Ô£à': '⚠️',
    'D├ëSACTIV├ë': 'DÉSACTIVÉ',
    'cr├®ation': 'création',
    'Probl├¿me': 'Problème',
    'r├®tr├®cissement': 'rétrécissement',
    'ÔÜí': '⚡',
    '­ƒøì´©Å': '🛍️',
    '­ƒô║': '📺',
    '­ƒÄ»': '🎁',
    '­ƒÆ¼': '💬',
    '­ƒöö': '🔔',
    '­ƒöì': '🔍',
    '­ƒöä': '📱',
    'ÔØî': '⚠️',
    'ÔÜá´©Å': '⚡',
};

for (const [corrupted, correct] of Object.entries(corrections)) {
    content = content.replace(new RegExp(corrupted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
}

// Écrire le fichier en UTF-8 sans BOM
fs.writeFileSync(filePath, content, 'utf8');

console.log('File cleaned successfully');

