import fs from 'fs';

function fixFile(file, oldStr, newStr) {
  let c = fs.readFileSync(file, 'utf-8');
  if (c.includes(oldStr)) {
    c = c.replace(oldStr, newStr);
    fs.writeFileSync(file, c, 'utf-8');
    process.stdout.write('OK: ' + file + '\n');
    return true;
  }
  process.stdout.write('NOT FOUND: ' + file + '\n  old: ' + oldStr.substring(0, 80) + '\n');
  return false;
}

// Fix by line number for tricky cases
function fixLine(file, lineNo, newLine) {
  const c = fs.readFileSync(file, 'utf-8');
  const lines = c.split('\n');
  const idx = lineNo - 1;
  const old = lines[idx];
  lines[idx] = newLine;
  fs.writeFileSync(file, lines.join('\n'), 'utf-8');
  process.stdout.write('OK line ' + lineNo + ': ' + file + '\n');
}

// ProductManagerMobile.tsx:657 - stray ,' at end of template literal line
fixLine(
  'src/components/ProductManagerMobile.tsx',
  657,
  "Rouge à Lèvres MAC,18000,XAF,Rouge à lèvres mat longue tenue,Maquillage,MAC,3g,Mat,Femme,16+,Cire d'abeille,Canada`,"
);

// useNavigationPayment.ts:371 - apostrophe + stray )'
fixLine(
  'src/hooks/useNavigationPayment.ts',
  371,
  "                'Catégories :\\n{{categories}}\\n\\nTarif indicatif après le {{date}} (TTC) : {{total}}\\n\\nAucun prélèvement pendant la période offerte (jusqu\\'au {{date}}).')"
);

// useScreenContext.ts:1153 - mixed quotes issue
fixLine(
  'src/hooks/useScreenContext.ts',
  1153,
  "    guide: \"SupermarketHomeScreen : flux Magasins → (optionnel) Produits / Comparer / Promos. Onglets Produits-Comparer-Promos n'apparaissent qu'après choix d'un supermarché. Chargement magasins = GPS obligatoire, listSupermarkets → /api/services/nearby. Produits = /api/supermarkets/:id/products + categories. Comparaison = nom produit, compareProductPrices (POST compare-prices), pas de trigram/code-barre côté UI. Promos = magasin sélectionné ou nearby. Pas de navigation in-screen vers MenuPlanningHub / liste courses / livraison — autres modules Yukpo.\","
);

// NavigationScreen.tsx:3726 - apostrophe in single-quoted string + stray '
fixLine(
  'src/screens/NavigationScreen.tsx',
  3726,
  "                                                    {tr('navigation.poiFreeBadge', \"Offert jusqu'au {{date}}\").replace('{{date}}', navigationFreeUntilLabel)}"
);

// intelligentChatService.ts:171 - our previous fix introduced a new issue
// The [''] replacement broke the regex - restore to use escaped apostrophe
fixLine(
  'src/services/intelligentChatService.ts',
  171,
  "    if (/(erreur\\s*500|internal server error|api openai|erreur de l\\'?api|api error)/i.test(text)) {"
);
