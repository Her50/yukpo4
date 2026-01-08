# Instructions pour Recalcul Manuel des Tableaux

## Problème Identifié

Le fichier HTML a été corrompu lors du recalcul automatique. Il faut restaurer depuis une sauvegarde ou recréer depuis le Markdown.

## Logique de Calcul à Appliquer

**Hypothèse minimale : 1 commerçant = 1 produit actif**

### Tableau 2026 (6 mois) - À Modifier

Objectif : 3,000-4,000 commerçants à la fin de l'année

| Mois | Commerçants | Produits Actifs | Placement (2K/prod) | Livraisons* | Publicité* | Total |
|------|-------------|-----------------|---------------------|-------------|------------|-------|
| Juillet | 500 | 500 | 1M | 2M | 1M | **4M** |
| Août | 1,000 | 1,000 | 2M | 3M | 2M | **7M** |
| Septembre | 1,500 | 1,500 | 3M | 4M | 3M | **10M** |
| Octobre | 2,000 | 2,000 | 4M | 5M | 4M | **13M** |
| Novembre | 2,500 | 2,500 | 5M | 6M | 5M | **16M** |
| Décembre | 3,000 | 3,000 | 6M | 7M | 6M | **19M** |
| **TOTAL** | **10,500** | **10,500** | **21M** | **27M** | **21M** | **69M FCFA** |

**Moyenne mensuelle produits actifs** : 1,750 produits

### Projections 5 Ans - À Modifier

| Année | Commerçants | Produits Actifs (Moy) | Placement (2K/mois) | Livraisons* | Publicité* | Total Revenus |
|-------|-------------|----------------------|---------------------|-------------|------------|---------------|
| 2026 (6m) | 3,000 | 1,750 | 21M | 27M | 21M | **69M** |
| 2027 | 5,000 | 5,000 | 120M | 20M | 15M | **155M** |
| 2028 | 12,000 | 12,000 | 288M | 40M | 30M | **358M** |
| 2029 | 35,000 | 35,000 | 840M | 80M | 60M | **980M** |
| 2030 | 80,000 | 80,000 | 1,920M | 150M | 120M | **2,190M** |

### CSS à Ajouter pour Éviter Coupures

Ajouter dans la section `<style>` :

```css
table.MsoNormalTable {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
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

## Action Requise

1. Restaurer le fichier HTML depuis une sauvegarde ou le recréer depuis le Markdown
2. Appliquer les modifications ci-dessus manuellement
3. Vérifier que tous les calculs sont cohérents avec la logique 1 commerçant = 1 produit

