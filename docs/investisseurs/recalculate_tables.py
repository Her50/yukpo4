#!/usr/bin/env python3
"""
Script pour recalculer tous les tableaux avec la logique :
1 commerçant = 1 produit actif (minimum)
Et améliorer les styles CSS pour éviter les coupures de pages
"""

import re

# Lire le fichier (essayer différents encodages)
encodings = ['utf-16', 'utf-8', 'latin-1', 'cp1252']
content = None
for enc in encodings:
    try:
        with open('DEMANDE_FINANCEMENT_BANQUE.html', 'r', encoding=enc) as f:
            content = f.read()
        print(f"[OK] Fichier lu avec encodage: {enc}")
        break
    except:
        continue

if content is None:
    print("[ERREUR] Impossible de lire le fichier")
    exit(1)

# 1. Améliorer les styles CSS pour éviter les coupures de tableaux
css_addition = """
table.MsoNormalTable {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    mso-table-lspace: 0pt;
    mso-table-rspace: 0pt;
}
table.MsoNormalTable tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
}
table.MsoNormalTable thead {
    display: table-header-group !important;
}
table.MsoNormalTable tbody {
    display: table-row-group !important;
}
"""

# Insérer le CSS après la balise </style> existante ou dans le style
if '</style>' in content:
    content = content.replace('</style>', css_addition + '\n</style>', 1)

# 2. Recalculer le tableau 2026 (6 mois) avec logique 1 commerçant = 1 produit
# Objectif : 3,500 commerçants à la fin de décembre
# Croissance progressive :
# Juillet : 500 commerçants = 500 produits → 500 × 2,000 = 1M
# Août : 1,000 = 1,000 produits → 1,000 × 2,000 = 2M
# Septembre : 1,500 = 1,500 produits → 1,500 × 2,000 = 3M
# Octobre : 2,000 = 2,000 produits → 2,000 × 2,000 = 4M
# Novembre : 2,500 = 2,500 produits → 2,500 × 2,000 = 5M
# Décembre : 3,500 = 3,500 produits → 3,500 × 2,000 = 7M
# Total produits-mois : 11,000
# Revenus placement : 11,000 × 2,000 = 22M
# Moyenne mensuelle : 11,000 / 6 = 1,833 produits

# Remplacer les valeurs dans le tableau mensuel 2026
replacements_2026 = [
    ('>15,000<', '>500<'),  # Juillet
    ('>30M<', '>1M<'),      # Juillet placement
    ('>20,000<', '>1,000<'), # Août
    ('>40M<', '>2M<'),      # Août placement
    ('>25,000<', '>1,500<'), # Septembre
    ('>50M<', '>3M<'),      # Septembre placement
    ('>30,000<', '>2,000<'), # Octobre
    ('>60M<', '>4M<'),      # Octobre placement
    ('>35,000<', '>2,500<'), # Novembre
    ('>70M<', '>5M<'),      # Novembre placement
    ('>40,000<', '>3,500<'), # Décembre
    ('>80M<', '>7M<'),      # Décembre placement
    ('>165,000<', '>11,000<'), # Total produits-mois
    ('>330M<', '>22M<'),    # Total placement
    ('>378M FCFA<', '>50M FCFA<'), # Total revenus (22M + 27M livraisons + 21M pub)
]

for old, new in replacements_2026:
    content = content.replace(old, new)

# 3. Recalculer le tableau 5 ans avec logique 1 commerçant = 1 produit
# 2026 (6m) : Moyenne 1,833 produits → 1,833 × 2,000 × 6 = 22M
# 2027 : Objectif 3,500 commerçants → 3,500 produits (moyenne) → 3,500 × 2,000 × 12 = 84M
# 2028 : Objectif 10,000 commerçants → 10,000 produits (moyenne) → 10,000 × 2,000 × 12 = 240M
# 2029 : Objectif 30,000 commerçants → 30,000 produits (moyenne) → 30,000 × 2,000 × 12 = 720M
# 2030 : Objectif 80,000 commerçants → 80,000 produits (moyenne) → 80,000 × 2,000 × 12 = 1,920M

replacements_5ans = [
    ('>27,500<', '>1,833<'),  # 2026 produits actifs moyenne
    ('>330M<', '>22M<'),      # 2026 placement
    ('>65,000<', '>3,500<'),  # 2027 produits actifs
    ('>1,560M<', '>84M<'),    # 2027 placement
    ('>180,000<', '>10,000<'), # 2028 produits actifs
    ('>4,320M<', '>240M<'),   # 2028 placement
    ('>750,000<', '>30,000<'), # 2029 produits actifs
    ('>18,000M<', '>720M<'),  # 2029 placement
    ('>2,400,000<', '>80,000<'), # 2030 produits actifs
    ('>57,600M<', '>1,920M<'), # 2030 placement
]

for old, new in replacements_5ans:
    content = content.replace(old, new)

# Recalculer les totaux revenus 5 ans
# 2026 : 22M + 27M + 21M = 70M
# 2027 : 84M + 20M + 15M = 119M
# 2028 : 240M + 40M + 30M = 310M
# 2029 : 720M + 80M + 60M = 860M
# 2030 : 1,920M + 150M + 120M = 2,190M

replacements_totaux = [
    ('>378M<', '>70M<'),      # 2026 total
    ('>1,595M<', '>119M<'),   # 2027 total
    ('>4,390M<', '>310M<'),   # 2028 total
    ('>18,140M<', '>860M<'),  # 2029 total
    ('>57,870M<', '>2,190M<'), # 2030 total
]

for old, new in replacements_totaux:
    content = content.replace(old, new)

# Sauvegarder (utiliser le même encodage que la lecture)
with open('DEMANDE_FINANCEMENT_BANQUE.html', 'w', encoding='utf-16' if 'utf-16' in str(enc) else 'utf-8') as f:
    f.write(content)

print("[OK] Tableaux recalculés avec logique 1 commerçant = 1 produit actif")
print("[OK] Styles CSS améliorés pour éviter coupures de pages")

