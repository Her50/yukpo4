import fs from 'fs';

const fixes = [
  // CreatorStudioCard.tsx:32 - apostrophe in single-quoted string
  {
    file: 'src/components/CreatorStudioCard.tsx',
    old: `        description: 'Jusqu'à 1 m³ · idéal colis "pas très importants"',`,
    new: `        description: "Jusqu'à 1 m³ · idéal colis \"pas très importants\"",`,
  },
  // ProductManagerMobile.tsx:615 - stray ,' at end + backtick issue
  {
    file: 'src/components/ProductManagerMobile.tsx',
    old: `Bouillon cube poulet 100g,500,XAF,Cubes bouillon saveur poulet cuisine africaine,Condiments,Maggi,100g,Afrique de l'Ouest,Halal,Température ambiante\`,\'`,
    new: `Bouillon cube poulet 100g,500,XAF,Cubes bouillon saveur poulet cuisine africaine,Condiments,Maggi,100g,Afrique de l'Ouest,Halal,Température ambiante\`,`,
  },
  // useNavigationPayment.ts:244 - apostrophe in single-quoted string + stray '
  {
    file: 'src/hooks/useNavigationPayment.ts',
    old: `            const freeMsg = (t('navPayment.freeUntilDate') || 'Services navigation gratuits jusqu'au {{date}}.')'`,
    new: `            const freeMsg = (t('navPayment.freeUntilDate') || "Services navigation gratuits jusqu'au {{date}}.")`,
  },
  // useScreenContext.ts:1146 - apostrophe in single-quoted string
  {
    file: 'src/hooks/useScreenContext.ts',
    old: `      { id: 'tab-magasins', type: 'tab', label: 'Magasins (seul onglet visible tant qu'aucun magasin n'est sélectionné)', actionable: true },`,
    new: `      { id: 'tab-magasins', type: 'tab', label: "Magasins (seul onglet visible tant qu'aucun magasin n'est sélectionné)", actionable: true },`,
  },
  // NavigationScreen.tsx:2194 - stray ' after comment
  {
    file: 'src/screens/NavigationScreen.tsx',
    old: `                                        () => { /* suspendu — le hook affiche déjà l'alerte */ }'`,
    new: `                                        () => { /* suspendu — le hook affiche déjà l'alerte */ }`,
  },
  // AgenceVoyageFormScreen.tsx:993 - apostrophe in single-quoted string + stray '
  {
    file: 'src/screens/specialized/AgenceVoyageFormScreen.tsx',
    old: `                            <Text style={s.recurrenceHint}>{t('agenceVoyageForm.exploitationHint', 'Associé aux notes jusqu'à extension API — utile pour votre équipe et pour préparer les fiches horaires.')}</Text>'`,
    new: `                            <Text style={s.recurrenceHint}>{t('agenceVoyageForm.exploitationHint', "Associé aux notes jusqu'à extension API — utile pour votre équipe et pour préparer les fiches horaires.")}</Text>`,
  },
  // LaboratoireSearchScreen.tsx:523 - broken string
  {
    file: 'src/screens/specialized/LaboratoireSearchScreen.tsx',
    old: `                        • La prise de rendez-vous en ligne permet d"éviter les files d'attente{"\\n'}`,
    new: `                        • La prise de rendez-vous en ligne permet d'éviter les files d'attente{'\\n'}`,
  },
  // LivreScolaireSearchScreen.tsx:463 - broken string
  {
    file: 'src/screens/specialized/LivreScolaireSearchScreen.tsx',
    old: `                        • Vérifiez l"état du livre avant de finaliser l'échange{"\\n'}`,
    new: `                        • Vérifiez l'état du livre avant de finaliser l'échange{'\\n'}`,
  },
  // OrientationPartnerDashboardScreen.tsx:553 - stray ' after closing tag
  {
    file: 'src/screens/specialized/OrientationPartnerDashboardScreen.tsx',
    old: `                            <Text style={{ color: '#6B7280', fontSize: 14 }}>Aucune statistique publiée pour l'instant.</Text>'`,
    new: `                            <Text style={{ color: '#6B7280', fontSize: 14 }}>Aucune statistique publiée pour l'instant.</Text>`,
  },
  // intelligentChatService.ts:171 - regex with apostrophe in single-quoted string
  {
    file: 'src/services/intelligentChatService.ts',
    old: `    if (/(erreur\\s*500|internal server error|api openai|erreur de l'?api|api error)/i.test(text)) {`,
    new: `    if (/(erreur\\s*500|internal server error|api openai|erreur de l['']?api|api error)/i.test(text)) {`,
  },
];

let fixed = 0;
for (const fix of fixes) {
  try {
    let content = fs.readFileSync(fix.file, 'utf-8');
    if (content.includes(fix.old)) {
      content = content.replace(fix.old, fix.new);
      fs.writeFileSync(fix.file, content, 'utf-8');
      process.stdout.write(`OK: ${fix.file}\n`);
      fixed++;
    } else {
      process.stdout.write(`NOT FOUND: ${fix.file}\n`);
    }
  } catch (e) {
    process.stdout.write(`ERR: ${fix.file}: ${e.message}\n`);
  }
}
process.stdout.write(`Fixed: ${fixed}/${fixes.length}\n`);
