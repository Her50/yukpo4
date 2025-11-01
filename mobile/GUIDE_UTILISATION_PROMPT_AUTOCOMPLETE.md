# 📘 Guide d'utilisation du Prompt Autocomplete Yukpo

## 🎯 Comment utiliser le prompt

### Étape 1 : Préparer les données d'entrée

Pour la catégorie **automobile** par exemple :

```bash
# 1. Copier les modalités
cat mobile/src/data/productModalities.ts | grep -A 200 "AUTOMOBILES_MODALITIES"

# 2. Copier le formulaire
cat mobile/src/components/ProductManagerMobile.tsx | grep -A 100 "case 'automobile'"
```

### Étape 2 : Remplir le prompt

Ouvrir `PROMPT_GENERATION_AUTOCOMPLETE_YUKPO.md` et remplacer :

```
CATEGORIE: automobile  ← Votre catégorie

MODALITES:
[COLLER ICI]  ← Vos modalités copiées

FORMULAIRE:
[COLLER ICI]  ← Structure formulaire
```

### Étape 3 : Soumettre à l'IA (Claude, GPT-4, etc.)

Copier tout le prompt rempli et soumettre à votre IA favorite.

### Étape 4 : Récupérer le JSON généré

L'IA va générer un fichier JSON comme :

```json
[
  {
    "product_id": "auto_toyota_rav4_2024_hybrid",
    "autocomplete_key": "Toyota RAV4 2024 Hybrid AWD",
    "search_variants": [...],
    "fixed_characteristics": {...},
    "variable_characteristics": [...],
    "variants": [...]
  },
  // ... 2000+ produits
]
```

### Étape 5 : Intégrer dans le code

Sauvegarder dans :
```
mobile/src/data/autocomplete/automobile.json
```

## 📋 Ordre recommandé des catégories

### 🔥 PRIORITÉ 1 (Très utilisées)
1. ✅ **automobile** - Commencer par celle-ci
2. ✅ **telephone** 
3. ✅ **immobilier**
4. ✅ **agriculture**
5. ✅ **emploi**

### ⭐ PRIORITÉ 2 (Populaires)
6. **vetement**
7. **electromenager**
8. **ordinateur**
9. **moto**
10. **formation**

### 📦 PRIORITÉ 3 (Reste)
11-60. Autres catégories...

## 🔧 Exemple pratique : AUTOMOBILE

### Données à fournir au prompt

```markdown
CATEGORIE: automobile

MODALITES EXISTANTES:
```
```typescript
export const AUTOMOBILES_MODALITIES = {
  marques: ["Toyota", "Peugeot", "Mercedes", "BMW", "Honda", "Nissan", ...],
  modeles_toyota: ["Corolla", "Camry", "RAV4", "Hilux", "Land Cruiser", ...],
  modeles_peugeot: ["308", "508", "3008", "Partner", ...],
  carburant: ["Essence", "Diesel", "Hybride", "Électrique"],
  transmission: ["Manuelle", "Automatique"],
  carrosseries: ["Berline", "SUV", "Pick-up", "Break", ...],
  couleurs: ["Blanc", "Noir", "Gris", "Rouge", "Bleu", ...],
  // ...
};
```
```markdown

STRUCTURE FORMULAIRE:
- marqueAutomobile (select)
- modeleAutomobile (select dépendant de marque)
- annee (number)
- kilometrage (number)
- typeCarburant (select)
- transmission (select)
- couleurAutomobile (select)
- etatVehicule (select)
- prix (number - variable)
- ... autres champs

CONTEXTE SPÉCIFIQUE:
- Marché: Afrique Centrale (Cameroun, Gabon, Congo, etc.)
- Monnaie: FCFA
- Prix moyens: 2M - 50M FCFA
- Marques populaires: Toyota (60%), Peugeot (15%), autres (25%)
```

### Résultat attendu

L'IA va générer ~2000 produits comme :

```json
{
  "product_id": "auto_toyota_corolla_2022_essence_automatique",
  "autocomplete_key": "Toyota Corolla 2022 Essence Automatique Blanc",
  
  "search_variants": [
    "Toyota Corolla 2022",
    "Corolla Toyota 2022",
    "Tayota Corolla",  // Faute
    "Corola Toyota",    // Faute
    "Corolla Automatique",
    "Toyota Corolla Essence",
    // ... 15 autres variantes
  ],
  
  "fixed_characteristics": {
    "marqueAutomobile": "Toyota",
    "modeleAutomobile": "Corolla",
    "typeVehicule": "Voiture",
    "typeCarrosserie": "Berline",
    "nbPortes": "4 portes",
    "nbPlaces": "5 places",
    "transmission": "Automatique",
    "typeCarburant": "Essence",
    "puissance": "140 CV",
    "cylindree": "1.8L"
  },
  
  "variable_characteristics": [
    {
      "field": "annee",
      "options": ["2018", "2019", "2020", "2021", "2022", "2023", "2024"]
    },
    {
      "field": "couleurAutomobile",
      "options": ["Blanc", "Noir", "Gris", "Argent", "Rouge"]
    },
    {
      "field": "kilometrage",
      "type": "number",
      "placeholder": "Ex: 35000"
    },
    {
      "field": "etatVehicule",
      "options": ["Excellent état", "Très bon état", "Bon état"]
    }
  ],
  
  "variants": [
    {
      "dimensions": { 
        "annee": "2024", 
        "etatVehicule": "Neuf" 
      },
      "price_range": { "min": 18000000, "max": 21000000 }
    },
    {
      "dimensions": { 
        "annee": "2022", 
        "etatVehicule": "Excellent état",
        "kilometrage_range": "20000-40000"
      },
      "price_range": { "min": 14000000, "max": 16000000 }
    }
  ],
  
  "metadata": {
    "popularity_score": 95,
    "brand_tier": "mid-range",
    "target_audience": ["professionals", "families"],
    "tags": ["fiable", "economique", "populaire", "berline"]
  }
}
```

## 🚀 Résultat final pour l'utilisateur

### Interface utilisateur

```
┌─────────────────────────────────────────────────────────┐
│ 🚗 Quel véhicule vendez-vous ?                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Toyota RAV4 2024____________]  🔍                     │
│                                                         │
│  💡 Suggestions:                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ✅ Toyota RAV4 2024 Hybrid AWD                    │ │
│  │    18M - 22M FCFA • Hybride • 5 places           │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ✅ Toyota RAV4 2023 Hybrid AWD                    │ │
│  │    16M - 19M FCFA • Hybride • 5 places           │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ✅ Toyota RAV4 2024 2.5L Essence                  │ │
│  │    17M - 20M FCFA • Essence • 5 places           │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [Sélectionner un véhicule]                            │
└─────────────────────────────────────────────────────────┘
```

### Après sélection

```
✅ Véhicule sélectionné: Toyota RAV4 2024 Hybrid AWD

📋 Caractéristiques pré-remplies:
   ✓ Marque: Toyota
   ✓ Modèle: RAV4
   ✓ Type: SUV
   ✓ Carburant: Hybride
   ✓ Transmission: Automatique
   ✓ Puissance: 218 CV
   ✓ Places: 5
   ✓ Portes: 5

🎨 Choisissez les options:

   Année:     [2024 ▼]
   Couleur:   [Blanc ▼]
   État:      [Excellent état ▼]
   Km:        [_45000_____]

💰 Prix:      [18000000] FCFA
              (Fourchette: 18M - 22M FCFA)

[📸 Ajouter photos] [📍 Localisation] [✅ Publier]
```

## 📊 Structure finale des fichiers

```
mobile/
└── src/
    └── data/
        └── autocomplete/
            ├── automobile.json          (2000-3000 produits)
            ├── telephone.json           (1500-2500 produits)
            ├── immobilier.json          (500-1000 produits)
            ├── agriculture.json         (800-1500 produits)
            ├── emploi.json              (300-600 produits)
            ├── ...
            └── index.ts                 (Export centralisé)
```

## 🎯 Prochaines étapes

1. ✅ Utiliser le prompt pour générer **automobile.json**
2. ✅ Tester l'autocomplete dans le formulaire
3. ✅ Ajuster le prompt si nécessaire
4. ✅ Répéter pour les 59 autres catégories
5. ✅ Créer l'API commercialisable

---

**Le prompt est prêt à être utilisé ! Commençons par AUTOMOBILE ? 🚗**

