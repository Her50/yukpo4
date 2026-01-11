# Restauration et Recalcul du Document HTML

## Problème

Le fichier `DEMANDE_FINANCEMENT_BANQUE.html` a été corrompu lors du recalcul automatique (encodage UTF-16).

## Solution

Il faut restaurer le fichier HTML depuis le Markdown ou une sauvegarde, puis appliquer manuellement les modifications suivantes :

### 1. Améliorer CSS pour Éviter Coupures de Tableaux

Ajouter dans la section `<style>` :

```css
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
```

### 2. Recalculer Tableau 2026 (6 mois)

**Logique : 1 commerçant = 1 produit actif (minimum)**

Objectif : 3,000 commerçants à la fin de décembre

| Mois | Commerçants | Produits Actifs | Placement (2K/prod) | Livraisons* | Publicité* | Total |
|------|-------------|-----------------|---------------------|-------------|------------|-------|
| Juillet | 500 | 500 | 1M | 2M | 1M | **4M** |
| Août | 1,000 | 1,000 | 2M | 3M | 2M | **7M** |
| Septembre | 1,500 | 1,500 | 3M | 4M | 3M | **10M** |
| Octobre | 2,000 | 2,000 | 4M | 5M | 4M | **13M** |
| Novembre | 2,500 | 2,500 | 5M | 6M | 5M | **16M** |
| Décembre | 3,000 | 3,000 | 6M | 7M | 6M | **19M** |
| **TOTAL** | **10,500** | **10,500** | **21M** | **27M** | **21M** | **69M FCFA** |

**Moyenne mensuelle** : 1,750 produits actifs

### 3. Recalculer Projections 5 Ans

| Année | Commerçants | Produits Actifs (Moy) | Placement (2K/mois) | Livraisons* | Publicité* | Total Revenus |
|-------|-------------|----------------------|---------------------|-------------|------------|---------------|
| 2026 (6m) | 3,000 | 1,750 | 21M | 27M | 21M | **69M** |
| 2027 | 5,000 | 5,000 | 120M | 20M | 15M | **155M** |
| 2028 | 12,000 | 12,000 | 288M | 40M | 30M | **358M** |
| 2029 | 35,000 | 35,000 | 840M | 80M | 60M | **980M** |
| 2030 | 80,000 | 80,000 | 1,920M | 150M | 120M | **2,190M** |

### 4. Recalculer Rentabilité (Ajuster Charges si Nécessaire)

Les charges doivent être ajustées en fonction des nouveaux revenus réalistes.

## Action Immédiate

**Option 1** : Restaurer depuis une sauvegarde Word si disponible

**Option 2** : Recréer le HTML depuis le Markdown avec les nouveaux calculs

**Option 3** : Ouvrir le HTML dans Word, corriger manuellement les tableaux avec les valeurs ci-dessus, puis sauvegarder



