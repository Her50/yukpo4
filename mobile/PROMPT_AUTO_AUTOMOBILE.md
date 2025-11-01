# 🚗 PROMPT PRÊT : Génération Autocomplete AUTOMOBILE

## 📚 LIRE D'ABORD
- `PROMPT_GENERATION_AUTOCOMPLETE_YUKPO.md` (Instructions complètes)
- `ARCHITECTURE_FINALE_YUKPO_AUTOCOMPLETE.md` (Architecture)

## 📊 CATÉGORIE

```
CATEGORIE: automobile
CODE_CATEGORIE: AUTO
```

## 📝 MODALITÉS EXISTANTES

```typescript
export const AUTOMOBILE_MODALITIES = {
  types: [
    "Voiture", "SUV", "Pick-up", "Camionnette", "Minibus",
    "Camion", "4x4", "Utilitaire"
  ],
  
  carrosseries: [
    "Berline", "SUV", "4x4", "Break", "Coupé", "Cabriolet",
    "Monospace", "Pick-up", "Utilitaire", "Crossover", "Citadine"
  ],
  
  marques: [
    // Japonaises (très populaires Afrique)
    "Toyota", "Nissan", "Honda", "Mazda", "Mitsubishi", "Suzuki", "Isuzu",
    // Européennes  
    "Peugeot", "Renault", "Citroën", "Mercedes-Benz", "BMW", "Audi",
    "Volkswagen", "Ford", "Hyundai", "Kia",
    // Autres
    "Chevrolet", "Jeep", "Land Rover", "Volvo", "Fiat", "Opel",
    // Premium/Électrique
    "Tesla", "Ferrari", "Lamborghini", "Bentley", "Porsche"
  ],
  
  couleurs: [
    "Blanc", "Noir", "Gris", "Argent", "Bleu", "Rouge", "Vert",
    "Beige", "Marron", "Orange", "Jaune", "Violet", "Or",
    "Gris métallisé", "Bleu métallisé", "Bi-ton"
  ],
  
  carburant: [
    "Essence", "Diesel", "Hybride", "Hybride rechargeable",
    "Électrique", "GPL", "Bioéthanol"
  ],
  
  transmission: [
    "Manuelle", "Automatique", "Semi-automatique", "CVT"
  ],
  
  etat: [
    "Neuf", "Excellent état", "Très bon état", "Bon état",
    "État moyen", "À réparer"
  ],
  
  portes: ["2 portes", "3 portes", "4 portes", "5 portes"],
  places: ["2 places", "4 places", "5 places", "7 places", "9 places"],
  
  equipements: [
    "Climatisation", "GPS", "Bluetooth", "Caméra recul",
    "Radar recul", "Toit ouvrant", "Sièges cuir", "Régulateur vitesse",
    "ABS", "ESP", "Airbags", "Jantes alliage", "Écran tactile",
    "Apple CarPlay", "Android Auto"
  ],
  
  papiers: [
    "En règle", "Dédouanée", "Non dédouanée",
    "Carte grise disponible", "À immatriculer"
  ]
};
```

## 🎯 EXPANSION INTELLIGENTE

### Modèles par marque (à générer avec IA)

**Pour TOYOTA** (500 clés) :
- Corolla (2010-2025) : Essence, Diesel, Hybride
- Camry (2010-2025) : Essence, Hybride
- RAV4 (2010-2025) : Essence, Diesel, Hybride, Hybride rechargeable
- Land Cruiser (2010-2024) : Diesel, Essence
- Prado (2010-2024) : Diesel
- Hilux (2010-2025) : Diesel, Essence
- Fortuner (2015-2024) : Diesel
- Yaris (2010-2024) : Essence, Hybride
- ... (génère TOUS les modèles Toyota populaires)

**Pour PEUGEOT** (200 clés) :
- 208, 308, 508, 2008, 3008, 5008, Partner, Expert, etc.

**Pour MERCEDES** (250 clés) :
- Classe A, C, E, S, GLA, GLC, GLE, GLS, Sprinter, etc.

**... Pour toutes les 40+ marques**

## ⚠️ RÈGLES CRITIQUES (Ne pas oublier !)

### 1. Prix : TYPE NUMBER

```json
{
  "currency": "FCFA",  // ← UNE SEULE FOIS
  "variable_characteristics": [
    {
      "field": "prix",
      "type": "number",  // ← TYPE NUMBER !
      "required": true
    }
  ],
  "variants": [
    {
      "price_range": {
        "min": 28000000,  // ← NUMBER pur
        "max": 32000000   // ← PAS de "32M FCFA"
      }
    }
  ]
}
```

### 2. Nom produit + Mots-clés

```json
{
  "product_name": "Toyota RAV4",  // ← Pour champ masqué
  "primary_keywords": ["Toyota", "RAV4"],
  "autocomplete_hint": "Tapez marque + modèle (ex: Toyota RAV4)"
}
```

### 3. Variantes orthographiques riches

```json
"search_variants": [
  "Toyota RAV4",
  "Tayota RAV4",  // Faute courante
  "Toyata RAV4",
  "RAV4 Toyota",
  "RAV 4 Toyota",
  "Toyota RAV-4",
  "Toyota Rav4",  // minuscule
  // ... 15+ variantes
]
```

## 💰 FOURCHETTES PRIX (Marché FCFA - Cameroun)

### Budget (< 3M)
- Toyota Corolla 2010-2015 : 1,500,000 - 2,800,000
- Peugeot 308 2012-2016 : 1,800,000 - 2,500,000

### Moyen (3M - 10M)
- Toyota RAV4 2015-2019 : 8,000,000 - 12,000,000
- Peugeot 3008 2017-2020 : 6,000,000 - 9,000,000

### Haut (10M - 30M)
- Toyota Land Cruiser 2018-2022 : 25,000,000 - 45,000,000
- Mercedes GLE 2018-2022 : 28,000,000 - 40,000,000

### Premium (> 30M)
- Tesla Model 3 2023-2024 : 32,000,000 - 38,000,000
- Mercedes Classe S 2022-2024 : 45,000,000 - 65,000,000

## 🚀 GÉNÈRE MAINTENANT !

Génère **2000-3000 clés autocomplete** pour AUTOMOBILE avec :

✅ Toutes les marques × modèles populaires
✅ Années 2010-2025 (focus 2018-2024)
✅ Variations carburant pertinentes
✅ Prix réalistes marché africain
✅ Variantes orthographiques (fautes frappe)
✅ `product_name`, `primary_keywords`, `autocomplete_hint` pour CHAQUE clé
✅ Type NUMBER pour tous les prix
✅ Devise "FCFA" une seule fois par clé

**Format sortie** : JSON array dans `AUTO.json`
