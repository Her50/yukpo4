#!/usr/bin/env node
/**
 * Audit script: Find all remaining hardcoded French strings in mobile app
 * Categories: text (JSX <Text>), placeholder, alert-button, label, comment, console, ai-prompt
 */
const fs = require('fs');
const path = require('path');

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const frWords = /\b(Veuillez|Connexion|Erreur|Succès|Impossible|Chargement|Enregistrer|Confirmer|Annuler|Rechercher|Sélectionner|Supprimer|Modifier|Ajouter|Valider|Envoyer|Réserver|Entrez|Aucun|Créer|Mettre|Fermer|Retour|Suivant|Précédent|Télécharger|Partager|Copier|Rafraîchir|Actualiser|Disponible|Indisponible|Obligatoire|Optionnel|Gratuit|Payant|Ouvrir|Nouveau|Voir|Détails|Profil|Accueil|Paramètres|Déconnexion|Inscription|Mot de passe|Téléphone|Adresse|Nom|Prénom|Description|Catégorie|Prix|Quantité|Date|Heure|Lieu|Ville|Quartier|Photo|Galerie|Caméra)\b/;

function walk(dir, results = []) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        if (fs.statSync(p).isDirectory()) walk(p, results);
        else if (p.endsWith('.tsx') || p.endsWith('.ts')) results.push(p);
      } catch(e) {}
    }
  } catch(e) {}
  return results;
}

const dirs = ['mobile/src/screens', 'mobile/src/components'];
const files = [];
dirs.forEach(d => walk(d, files));

const stats = {
  textJSX: 0,
  placeholder: 0,
  alertButton: 0,
  buttonLabel: 0,
  sectionTitle: 0,
  comment: 0,
  consolelog: 0,
  aiPrompt: 0,
  otherCode: 0,
};

const fileStats = {};

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  const rel = f.replace(/\\/g, '/').replace(/.*mobile\/src\//, '');
  let fileHits = { textJSX: 0, placeholder: 0, alertButton: 0, buttonLabel: 0, other: 0 };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!frChars.test(line) && !frWords.test(line)) continue;
    
    const trimmed = line.trim();
    
    // Skip imports
    if (trimmed.startsWith('import ')) continue;
    
    // Comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      stats.comment++;
      continue;
    }
    
    // Console
    if (trimmed.match(/console\.(log|warn|error|info)/)) {
      stats.consolelog++;
      continue;
    }
    
    // Already translated (contains t(' or t(")
    if (trimmed.match(/t\s*\(\s*['"`]/)) continue;
    
    // AI prompts (inside callWithFallback, askAI, etc.)
    if (trimmed.match(/(prompt|instruction|system_message|ai_context)/i)) {
      stats.aiPrompt++;
      continue;
    }
    
    // Check for specific patterns
    // Placeholder
    if (trimmed.match(/placeholder\s*=\s*["'`]/)) {
      stats.placeholder++;
      fileHits.placeholder++;
      continue;
    }
    
    // Alert button text: { text: 'French' }
    if (trimmed.match(/text\s*:\s*['"][A-ZÀ-ÿa-zà-ÿ]/)) {
      stats.alertButton++;
      fileHits.alertButton++;
      continue;
    }
    
    // JSX Text content: >French text<
    if (trimmed.match(/>[A-ZÀ-ÿa-zà-ÿ].*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/) || 
        trimmed.match(/{['"`][^}]*[àâçéèêëîïôûùüÿñæœ]/)) {
      if (trimmed.match(/<Text|<NativeButton|label=|title=/i)) {
        stats.textJSX++;
        fileHits.textJSX++;
        continue;
      }
    }
    
    // Button/label props
    if (trimmed.match(/(label|title|headerTitle|tabBarLabel|buttonText)\s*=\s*["'`][A-ZÀ-ÿ]/)) {
      stats.buttonLabel++;
      fileHits.buttonLabel++;
      continue;
    }
    
    // Section titles in JSX
    if (trimmed.match(/>[\s]*[A-ZÀ-ÿ]/) && frChars.test(trimmed)) {
      stats.sectionTitle++;
      fileHits.textJSX++;
      continue;
    }
    
    stats.otherCode++;
    fileHits.other++;
  }
  
  const total = Object.values(fileHits).reduce((a, b) => a + b, 0);
  if (total > 0) {
    fileStats[rel] = { ...fileHits, total };
  }
}

console.log('=== AUDIT i18n - Remaining French strings ===\n');
console.log('Category breakdown:');
console.log('  Text/JSX labels:', stats.textJSX);
console.log('  Placeholders:', stats.placeholder);
console.log('  Alert buttons:', stats.alertButton);
console.log('  Button/label props:', stats.buttonLabel);
console.log('  Section titles:', stats.sectionTitle);
console.log('  ---');
console.log('  Comments (skip):', stats.comment);
console.log('  Console.log (skip):', stats.consolelog);
console.log('  AI prompts (skip):', stats.aiPrompt);
console.log('  Other code:', stats.otherCode);
console.log('');

const userVisible = stats.textJSX + stats.placeholder + stats.alertButton + stats.buttonLabel + stats.sectionTitle;
console.log('USER-VISIBLE total:', userVisible);
console.log('');

// Top files by user-visible hits
const sorted = Object.entries(fileStats)
  .map(([f, s]) => ({ file: f, ...s, userVisible: s.textJSX + s.placeholder + s.alertButton + s.buttonLabel }))
  .filter(s => s.userVisible > 0)
  .sort((a, b) => b.userVisible - a.userVisible);

console.log('Top 40 files by user-visible French strings:');
sorted.slice(0, 40).forEach(s => {
  console.log(`  ${s.userVisible}\t${s.file} (text:${s.textJSX} ph:${s.placeholder} btn:${s.alertButton} lbl:${s.buttonLabel})`);
});
console.log('\nTotal files needing work:', sorted.length);
