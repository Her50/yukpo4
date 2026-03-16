#!/usr/bin/env node
/**
 * Automated i18n script for Yukpo mobile app
 * Phase 1: Replace common hardcoded French patterns with t() calls
 * - Alert button labels (Annuler, Réserver, OK, Fermer, etc.)
 * - Common placeholder patterns
 * - Common JSX text patterns
 * Adds useLanguageSafe import and hook if not present
 */
const fs = require('fs');
const path = require('path');

function walk(dir, results = []) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        if (fs.statSync(p).isDirectory()) walk(p, results);
        else if (p.endsWith('.tsx')) results.push(p);
      } catch(e) {}
    }
  } catch(e) {}
  return results;
}

// Common Alert button labels: { text: 'FrenchText' } or { text: 'FrenchText', ... }
const alertButtonReplacements = {
  "text: 'Annuler'": "text: t('common.cancel')",
  'text: "Annuler"': "text: t('common.cancel')",
  "text: 'Fermer'": "text: t('common.close')",
  'text: "Fermer"': "text: t('common.close')",
  "text: 'Réserver'": "text: t('common.reserve')",
  'text: "Réserver"': "text: t('common.reserve')",
  "text: 'Confirmer'": "text: t('common.confirm')",
  'text: "Confirmer"': "text: t('common.confirm')",
  "text: 'Supprimer'": "text: t('common.delete')",
  'text: "Supprimer"': "text: t('common.delete')",
  "text: 'Modifier'": "text: t('common.edit')",
  'text: "Modifier"': "text: t('common.edit')",
  "text: 'Enregistrer'": "text: t('common.save')",
  'text: "Enregistrer"': "text: t('common.save')",
  "text: 'Valider'": "text: t('common.validate')",
  'text: "Valider"': "text: t('common.validate')",
  "text: 'Oui'": "text: t('common.yes')",
  'text: "Oui"': "text: t('common.yes')",
  "text: 'Non'": "text: t('common.no')",
  'text: "Non"': "text: t('common.no')",
  "text: 'Retour'": "text: t('common.back')",
  'text: "Retour"': "text: t('common.back')",
  "text: 'Suivant'": "text: t('common.next')",
  'text: "Suivant"': "text: t('common.next')",
  "text: 'Créer'": "text: t('common.create')",
  'text: "Créer"': "text: t('common.create')",
  "text: 'Réessayer'": "text: t('common.retry')",
  'text: "Réessayer"': "text: t('common.retry')",
  "text: 'Voir'": "text: t('common.view')",
  'text: "Voir"': "text: t('common.view')",
  "text: 'Envoyer'": "text: t('common.send')",
  'text: "Envoyer"': "text: t('common.send')",
  "text: 'Ajouter'": "text: t('common.add')",
  'text: "Ajouter"': "text: t('common.add')",
  "text: 'Appliquer'": "text: t('common.apply')",
  'text: "Appliquer"': "text: t('common.apply')",
  "text: 'Continuer'": "text: t('common.continue')",
  'text: "Continuer"': "text: t('common.continue')",
  "text: 'Rejeter'": "text: t('common.reject')",
  'text: "Rejeter"': "text: t('common.reject')",
  "text: 'Accepter'": "text: t('common.accept')",
  'text: "Accepter"': "text: t('common.accept')",
  "text: 'Prendre une photo'": "text: t('common.takePhoto')",
  'text: "Prendre une photo"': "text: t('common.takePhoto')",
  "text: 'Choisir depuis la galerie'": "text: t('common.chooseFromGallery')",
  'text: "Choisir depuis la galerie"': "text: t('common.chooseFromGallery')",
  "text: 'Choisir une image'": "text: t('common.chooseImage')",
  'text: "Choisir une image"': "text: t('common.chooseImage')",
  "text: 'Créer un service'": "text: t('common.createService')",
  'text: "Créer un service"': "text: t('common.createService')",
  "text: 'Voir les correspondances'": "text: t('common.viewMatches')",
  'text: "Voir les correspondances"': "text: t('common.viewMatches')",
  "text: 'Se connecter'": "text: t('common.login')",
  'text: "Se connecter"': "text: t('common.login')",
  "text: 'Plus tard'": "text: t('common.later')",
  'text: "Plus tard"': "text: t('common.later')",
  "text: 'Configurer'": "text: t('common.configure')",
  'text: "Configurer"': "text: t('common.configure')",
  "text: 'Partager'": "text: t('common.share')",
  'text: "Partager"': "text: t('common.share')",
  "text: 'Copier'": "text: t('common.copy')",
  'text: "Copier"': "text: t('common.copy')",
  "text: 'Télécharger'": "text: t('common.download')",
  'text: "Télécharger"': "text: t('common.download')",
};

let totalFilesModified = 0;
let totalReplacements = 0;
let filesNeedingHook = [];

const dirs = ['mobile/src/screens', 'mobile/src/components'];
const allFiles = [];
dirs.forEach(d => walk(d, allFiles));

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let replacements = 0;
  
  // Apply alert button replacements
  for (const [oldStr, newStr] of Object.entries(alertButtonReplacements)) {
    const count = content.split(oldStr).length - 1;
    if (count > 0) {
      content = content.split(oldStr).join(newStr);
      replacements += count;
    }
  }
  
  if (replacements > 0) {
    // Check if useLanguageSafe is already imported
    const hasImport = content.includes('useLanguageSafe');
    const hasHook = content.match(/const\s*\{[^}]*t[^}]*\}\s*=\s*useLanguageSafe/);
    
    if (!hasImport) {
      // Find the right place to add import - after the last import from a local file
      const importLines = content.split('\n');
      let lastImportLine = -1;
      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].match(/^import /)) {
          lastImportLine = i;
        }
      }
      if (lastImportLine >= 0) {
        // Determine relative path based on file depth
        const rel = filePath.replace(/\\/g, '/');
        let prefix = '../';
        if (rel.includes('/screens/specialized/') || rel.includes('/screens/delivery/') || 
            rel.includes('/screens/auth/') || rel.includes('/screens/orientation/') ||
            rel.includes('/screens/service/') || rel.includes('/screens/offres-emploi/') ||
            rel.includes('/screens/promo/') || rel.includes('/screens/video/') ||
            rel.includes('/components/delivery/')) {
          prefix = '../../';
        } else if (rel.includes('/screens/') || rel.includes('/components/')) {
          prefix = '../';
        }
        importLines.splice(lastImportLine + 1, 0, `import { useLanguageSafe } from '${prefix}contexts/LanguageContext';`);
        content = importLines.join('\n');
      }
    }
    
    if (!hasHook && !content.match(/const\s*\{[^}]*t\b/)) {
      // Add const { t } = useLanguageSafe(); after the component function declaration
      // Find pattern like: const ComponentName = ... => { or function ComponentName(
      const hookLine = '    const { t } = useLanguageSafe();';
      
      // Try to find existing hook pattern to insert after
      const patterns = [
        /const toaster = useToaster\(\);/,
        /const \{ location \} = useLocation\(\);/,
        /const navigation = useNavigation\(\)[^;]*;/,
        /const \[.*useState.*\n/,
      ];
      
      let inserted = false;
      for (const pat of patterns) {
        const match = content.match(pat);
        if (match) {
          content = content.replace(match[0], match[0] + '\n' + hookLine);
          inserted = true;
          break;
        }
      }
      
      if (!inserted) {
        filesNeedingHook.push(filePath.replace(/\\/g, '/').replace(/.*mobile\/src\//, ''));
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    totalFilesModified++;
    totalReplacements += replacements;
  }
}

console.log(`\n=== Auto-i18n Phase 1 Complete ===`);
console.log(`Files modified: ${totalFilesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
if (filesNeedingHook.length > 0) {
  console.log(`\nFiles needing manual hook insertion (${filesNeedingHook.length}):`);
  filesNeedingHook.forEach(f => console.log(`  ${f}`));
}
