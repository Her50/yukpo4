# Exemples de Génération Multi-Combinaisons avec AI Preferred

## 🎯 Objectif

Quand l'utilisateur fournit du TEXTE VAGUE sans image précise, l'IA doit générer PLUSIEURS combinaisons possibles et **TOUJOURS** marquer une comme préférée via `ai_preferred_index`.

---

## ✅ EXEMPLE 1 : Texte très vague

**Input utilisateur** : `"Je vends des chaussures"`

**Caractéristiques explicites** : AUCUNE (juste catégorie "chaussures")

**Comportement IA attendu** :
- Générer 8-10 combinaisons couvrant marques populaires
- Marquer la combinaison la plus populaire/logique comme préférée
- `ai_preferred_index: 0` ✅ OBLIGATOIRE

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Nike,Air Max,Noir,42,",           // ⬅️ Position 0 - PRÉFÉRÉE (marque + modèle populaires)
      "Nike,Air Max,Blanc,42,",
      "Adidas,Superstar,Noir,42,",
      "Adidas,Superstar,Blanc,42,",
      "Puma,Suede,Noir,42,",
      "Nike,Air Force,Noir,42,",
      "Converse,Chuck Taylor,Noir,42,",
      "Vans,Old Skool,Noir,42,"
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "marque": ["Nike", "Adidas", "Puma", "Converse", "Vans", "Reebok"],
      "modele": ["Air Max", "Air Force", "Superstar", "Suede", "Chuck Taylor", "Old Skool"],
      "couleur": ["Noir", "Blanc", "Rouge", "Bleu", "Gris"],
      "pointure": ["38", "39", "40", "41", "42", "43", "44", "45"],
      "lieu": [""]
    },
    "filtrable": true,
    "identifiant_base": "produits",
    "origine_champs": "ia",
    "ai_preferred_index": 0  // ⬅️ OBLIGATOIRE - Pointe vers "Nike,Air Max,Noir,42"
  }
}
```

**Frontend affichera** :
- **Placeholder** : `Nike,Air Max,Noir,42` (choix AI recommandé)
- **Dropdown** : Les 8 combinaisons avec badge "⭐ Recommandé" sur la première
- **Utilisateur** : Peut cliquer sur la recommandée ou choisir une autre

---

## ✅ EXEMPLE 2 : Texte partiellement précis

**Input utilisateur** : `"Je vends des chaussures Nike"`

**Caractéristiques explicites** : `marque=Nike` (seulement)

**Comportement IA attendu** :
- Générer combinaisons avec marque Nike en priorité
- Marquer le modèle Nike le plus populaire comme préféré
- `ai_preferred_index: 0` ✅ OBLIGATOIRE

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Nike,Air Max,Noir,42,",           // ⬅️ Position 0 - PRÉFÉRÉE (Nike explicite + modèle populaire)
      "Nike,Air Max,Blanc,42,",
      "Nike,Air Force,Noir,42,",
      "Nike,Cortez,Blanc,42,",
      "Adidas,Superstar,Noir,42,",       // Autres marques en fin
      "Puma,Suede,Noir,42,"
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "marque": ["Nike", "Adidas", "Puma"],
      "modele": ["Air Max", "Air Force", "Cortez", "Superstar", "Suede"],
      "couleur": ["Noir", "Blanc", "Rouge", "Bleu"],
      "pointure": ["38", "39", "40", "41", "42", "43", "44"],
      "lieu": [""]
    },
    "filtrable": true,
    "identifiant_base": "produits",
    "origine_champs": "ia",
    "ai_preferred_index": 0  // ⬅️ OBLIGATOIRE - Respecte "Nike" explicite
  }
}
```

**Frontend affichera** :
- **Placeholder** : `Nike,Air Max,Noir,42` (respecte la marque Nike mentionnée)

---

## ✅ EXEMPLE 3 : Texte précis avec caractéristiques multiples

**Input utilisateur** : `"Je vends Adidas Superstar blanches pointure 38"`

**Caractéristiques explicites** : `marque=Adidas`, `modele=Superstar`, `couleur=Blanc`, `pointure=38`

**Comportement IA attendu** :
- La combinaison exacte doit être en position 0
- Générer variantes (autres couleurs, pointures, modèles Adidas)
- `ai_preferred_index: 0` ✅ OBLIGATOIRE

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Adidas,Superstar,Blanc,38,",      // ⬅️ Position 0 - PRÉFÉRÉE (correspond EXACTEMENT)
      "Adidas,Superstar,Blanc,39,",      // Autres pointures
      "Adidas,Superstar,Blanc,40,",
      "Adidas,Superstar,Noir,38,",       // Autres couleurs
      "Adidas,Stan Smith,Blanc,38,",     // Autres modèles Adidas
      "Nike,Air Max,Blanc,38,"           // Autres marques en fin
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "marque": ["Adidas", "Nike", "Puma"],
      "modele": ["Superstar", "Stan Smith", "Air Max"],
      "couleur": ["Blanc", "Noir", "Bleu"],
      "pointure": ["36", "37", "38", "39", "40", "41", "42"],
      "lieu": [""]
    },
    "filtrable": true,
    "identifiant_base": "produits",
    "origine_champs": "ia",
    "ai_preferred_index": 0  // ⬅️ OBLIGATOIRE - Match exact avec le texte
  }
}
```

**Frontend affichera** :
- **Placeholder** : `Adidas,Superstar,Blanc,38` (correspond EXACTEMENT au texte)

---

## ✅ EXEMPLE 4 : Texte vague pour véhicules

**Input utilisateur** : `"Je vends une voiture"`

**Caractéristiques explicites** : AUCUNE

**Comportement IA attendu** :
- Choisir marque populaire en Afrique (Toyota)
- Modèle populaire (RAV4 ou Corolla)
- `ai_preferred_index: 0` ✅ OBLIGATOIRE

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Toyota,RAV4,2020,Essence,Automatique,Occasion,",    // ⬅️ PRÉFÉRÉE (populaire)
      "Toyota,Corolla,2019,Essence,Automatique,Occasion,",
      "Honda,Civic,2020,Essence,Automatique,Occasion,",
      "Hyundai,Elantra,2019,Essence,Automatique,Occasion,",
      "Peugeot,308,2018,Diesel,Manuelle,Occasion,",
      "Renault,Clio,2019,Essence,Manuelle,Occasion,"
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "marque": ["Toyota", "Honda", "Hyundai", "Peugeot", "Renault"],
      "modele": ["RAV4", "Corolla", "Civic", "Elantra", "308", "Clio"],
      "annee": ["2018", "2019", "2020", "2021", "2022"],
      "carburant": ["Essence", "Diesel", "Hybride"],
      "transmission": ["Manuelle", "Automatique"],
      "etat": ["Neuf", "Occasion"],
      "lieu": [""]
    },
    "filtrable": true,
    "identifiant_base": "produits",
    "origine_champs": "ia",
    "ai_preferred_index": 0  // ⬅️ OBLIGATOIRE - Toyota RAV4 (populaire en Afrique)
  }
}
```

**Frontend affichera** :
- **Placeholder** : `Toyota,RAV4,2020,Essence,Automatique,Occasion` (choix logique pour Afrique)

---

## ✅ EXEMPLE 5 : Texte avec marque ET couleur

**Input utilisateur** : `"Je vends Puma noires"`

**Caractéristiques explicites** : `marque=Puma`, `couleur=Noir`

**Comportement IA attendu** :
- Respecter marque=Puma ET couleur=Noir dans position 0
- Choisir modèle Puma populaire
- `ai_preferred_index: 0` ✅ OBLIGATOIRE

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Puma,Suede,Noir,42,",             // ⬅️ PRÉFÉRÉE (Puma + Noir explicites)
      "Puma,Suede,Blanc,42,",            // Autres couleurs Puma
      "Puma,Cali,Noir,42,",              // Autres modèles Puma noirs
      "Puma,RS-X,Noir,42,",
      "Nike,Air Max,Noir,42,",           // Autres marques noires
      "Adidas,Superstar,Noir,42,"
    ],
    "separateur": ",",
    "sous_caracteristiques": {
      "marque": ["Puma", "Nike", "Adidas"],
      "modele": ["Suede", "Cali", "RS-X", "Air Max", "Superstar"],
      "couleur": ["Noir", "Blanc", "Gris", "Rouge"],
      "pointure": ["38", "39", "40", "41", "42", "43", "44"],
      "lieu": [""]
    },
    "filtrable": true,
    "identifiant_base": "produits",
    "origine_champs": "ia",
    "ai_preferred_index": 0  // ⬅️ OBLIGATOIRE - Respecte Puma + Noir
  }
}
```

---

## ❌ CONTRE-EXEMPLE : Ce qu'il NE FAUT PAS faire

**Input utilisateur** : `"Je vends des chaussures"`

### ❌ ERREUR 1 : Aucune préférence marquée

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Nike,Air Max,Noir,42,",
      "Adidas,Superstar,Blanc,38,",
      "Puma,Suede,Rouge,40,"
    ],
    "separateur": ",",
    "sous_caracteristiques": {...},
    // ❌ MANQUE ai_preferred_index - ERREUR FATALE !
  }
}
```

**Problème** : Le frontend ne sait pas quelle combinaison afficher comme exemple.

### ❌ ERREUR 2 : Préférence arbitraire

**Input utilisateur** : `"Je vends des chaussures Adidas"`

```json
{
  "produits": {
    "type_donnee": "autocomplete",
    "valeur": [
      "Puma,Suede,Rouge,40,",            // ⬅️ Position 0 mais ignore "Adidas" !
      "Nike,Air Max,Noir,42,",
      "Adidas,Superstar,Blanc,42,"       // ⬅️ Devrait être en position 0 !
    ],
    "ai_preferred_index": 0  // ⬅️ Pointe vers Puma alors que texte dit "Adidas" - ERREUR !
  }
}
```

**Problème** : La préférence ignore la marque "Adidas" explicitement mentionnée.

---

## 🔑 CHECKLIST FINALE AVANT GÉNÉRATION

Avant de générer ta réponse JSON, vérifie :

1. ✅ Ai-je généré **plusieurs combinaisons** (si texte vague) ?
2. ✅ Ai-je inclus `"ai_preferred_index": 0` ?
3. ✅ La combinaison en position 0 contient-elle **TOUTES** les caractéristiques **explicites** du texte ?
4. ✅ Si aucune caractéristique explicite, ai-je choisi la combinaison la plus **populaire/logique** ?
5. ✅ Les autres combinaisons offrent-elles une **variété utile** de choix ?

---

## 🎯 RÉSUMÉ CRITIQUE

**RÈGLE D'OR** : Pour chaque génération de multi-combinaisons :
- 🚨 `ai_preferred_index` est **OBLIGATOIRE** (jamais optionnel)
- 🚨 Position 0 = **Meilleur match** avec caractéristiques explicites
- 🚨 Si aucune caractéristique explicite = **Choix le plus populaire/logique**
- 🚨 Le frontend utilise ce choix pour le **placeholder dynamique** qui oriente l'utilisateur

**POURQUOI C'EST SI IMPORTANT** :
- L'utilisateur voit immédiatement **l'exemple recommandé** dans le champ
- Cela l'aide à comprendre **le format attendu**
- Cela lui donne un **point de départ** pour sa saisie
- C'est une **aide à la décision** basée sur l'analyse IA de sa demande

