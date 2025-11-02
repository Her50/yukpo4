# 🔍 ANALYSE - Conflits Sous-Caractéristiques Autocomplete

**Cas Edge** : Même valeur dans différentes sous-caractéristiques

---

## ❓ LE PROBLÈME

### Scénario : L'IA génère des labels différents pour la même information

#### Service #1 - Utilisateur A (Téléphone)

**IA génère** :
```json
"produits": {
  "sous_caracteristiques": {
    "marque": ["Samsung", "Apple"],      // ⚡ Label = "marque"
    "modele": ["Galaxy S21", "iPhone 13"]
  }
}
```

#### Service #2 - Utilisateur B (Téléphone aussi)

**IA génère** :
```json
"produits": {
  "sous_caracteristiques": {
    "fabricant": ["Samsung", "Apple"],   // ⚡ Label = "fabricant" (≠ marque)
    "modele": ["Galaxy A52", "iPhone 12"]
  }
}
```

#### Service #3 - Utilisateur C (Téléphone)

**IA génère** :
```json
"produits": {
  "sous_caracteristiques": {
    "constructeur": ["Samsung", "Xiaomi"], // ⚡ Label = "constructeur" (≠ marque, ≠ fabricant)
    "modele": ["Galaxy M31", "Redmi Note 11"]
  }
}
```

---

## 💾 ÉTAT DE LA TABLE AUTOCOMPLETE

### Après les 3 services créés

```
┌────┬──────────────┬──────────────────────┬──────────┬─────────────┐
│ id │ ident_base   │ sous_caracteristique │ valeur   │ usage_count │
├────┼──────────────┼──────────────────────┼──────────┼─────────────┤
│ 1  │ produits     │ marque               │ Samsung  │ 1           │ ← Service #1
│ 2  │ produits     │ marque               │ Apple    │ 1           │ ← Service #1
│ 3  │ produits     │ fabricant            │ Samsung  │ 1           │ ← Service #2 🔥
│ 4  │ produits     │ fabricant            │ Apple    │ 1           │ ← Service #2
│ 5  │ produits     │ constructeur         │ Samsung  │ 1           │ ← Service #3 🔥
│ 6  │ produits     │ constructeur         │ Xiaomi   │ 1           │ ← Service #3
│ 7  │ produits     │ modele               │ Galaxy S21│ 1          │
│ 8  │ produits     │ modele               │ iPhone 13│ 1           │
│ 9  │ produits     │ modele               │ Galaxy A52│ 1          │
│ 10 │ produits     │ modele               │ iPhone 12│ 1           │
│ 11 │ produits     │ modele               │ Galaxy M31│ 1          │
│ 12 │ produits     │ modele               │ Redmi Note 11│ 1      │
└────┴──────────────┴──────────────────────┴──────────┴─────────────┘
```

**🚨 PROBLÈME** : "Samsung" existe 3 fois avec 3 labels différents !

---

## 🔍 COMPORTEMENT RECHERCHE ACTUEL

### Utilisateur D crée un nouveau téléphone

**L'IA génère pour lui** :
```json
"sous_caracteristiques": {
  "marque": ["Samsung", "Apple"]  // ⚡ Label = "marque"
}
```

**Frontend affiche champ** : "Marque"

```
┌─────────────────────────────────────────┐
│ Marque *                                │
│ ┌─────────────────────────────────────┐ │
│ │ |                                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

### User D tape "Sam"

**Requête Frontend** :
```
GET /api/autocomplete/suggestions?
    identifiant_base=produits&
    sous_caracteristique=marque&  // ⚡ Cherche SEULEMENT dans "marque"
    prefix=Sam&
    limit=5
```

**SQL Backend** :
```sql
SELECT valeur, usage_count
FROM autocomplete_characteristics
WHERE identifiant_base = 'produits'
  AND sous_caracteristique = 'marque'  -- ⚡ FILTRE STRICT
  AND LOWER(valeur) LIKE 'sam%'
ORDER BY usage_count DESC
LIMIT 5;
```

**Résultat de la requête** :
```
┌──────────┬─────────────┐
│ valeur   │ usage_count │
├──────────┼─────────────┤
│ Samsung  │ 1           │ ← Uniquement de sous_carac="marque"
│ Apple    │ 1           │
└──────────┴─────────────┘
```

**⚠️ MANQUE** :
- Samsung (fabricant, usage=1) - PAS retourné
- Samsung (constructeur, usage=1) - PAS retourné

**Frontend affiche** :
```
┌─────────────────────────────────────────┐
│ Marque *                                │
│ ┌─────────────────────────────────────┐ │
│ │ Sam|                                │ │
│ └─────────────────────────────────────┘ │
│ 💡 Suggestions :                        │
│ ┌─────────────────────────────────────┐ │
│ │ ✓ Samsung            (1 fois)       │ │ ← usage=1 seulement
│ │ ✓ Apple              (1 fois)       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**❌ PROBLÈME** : L'utilisateur voit usage=1 alors que "Samsung" a été utilisé 3 fois au total !

---

## 🎯 CONSÉQUENCE : SILOS DE DONNÉES

### Visualisation des silos

```
SILO #1 : "marque"           SILO #2 : "fabricant"      SILO #3 : "constructeur"
┌──────────────────┐          ┌──────────────────┐      ┌──────────────────┐
│ Samsung  (1)     │          │ Samsung  (1)     │      │ Samsung  (1)     │
│ Apple    (1)     │          │ Apple    (1)     │      │ Xiaomi   (1)     │
└──────────────────┘          └──────────────────┘      └──────────────────┘
       ▲                             ▲                         ▲
       │                             │                         │
   User A                        User B                    User C
  (Service 1)                  (Service 2)               (Service 3)

⚠️ Les 3 silos ne communiquent PAS entre eux
⚠️ usage_count fragmenté : 1+1+1 au lieu de 3
```

---

## 📊 TABLEAU COMPARATIF

### Recherche ACTUELLE (avec silos)

| User | Champ recherché | Requête SQL | Résultat |
|------|----------------|-------------|----------|
| A | `marque` | `WHERE sous_carac='marque'` | Samsung(1), Apple(1) |
| B | `fabricant` | `WHERE sous_carac='fabricant'` | Samsung(1), Apple(1) |
| C | `constructeur` | `WHERE sous_carac='constructeur'` | Samsung(1), Xiaomi(1) |
| D | `marque` | `WHERE sous_carac='marque'` | Samsung(1), Apple(1) |

**Observation** :
- Chaque utilisateur voit Samsung avec usage=1
- Aucun ne voit que Samsung a été utilisé 3 fois
- Les données sont **isolées par sous-caractéristique**

---

### Recherche IDÉALE (unifiée)

| User | Champ recherché | Requête SQL | Résultat |
|------|----------------|-------------|----------|
| A | `marque` | `WHERE sous_carac IN ('marque','fabricant','constructeur')` | Samsung(3), Apple(2), Xiaomi(1) |
| B | `fabricant` | `WHERE sous_carac IN ('marque','fabricant','constructeur')` | Samsung(3), Apple(2), Xiaomi(1) |
| C | `constructeur` | `WHERE sous_carac IN ('marque','fabricant','constructeur')` | Samsung(3), Apple(2), Xiaomi(1) |
| D | `marque` | `WHERE sous_carac IN ('marque','fabricant','constructeur')` | Samsung(3), Apple(2), Xiaomi(1) |

**Observation** :
- Tous voient Samsung avec usage=3 (vrai total)
- Les synonymes sont **unifiés**

---

## 🔧 SOLUTIONS POSSIBLES

### Solution #1 : Normalisation Labels IA (Recommandé)

**Prompt IA amélioré** :
```markdown
Pour les sous-caractéristiques de produits, TOUJOURS utiliser ces labels standards :

ÉLECTRONIQUE :
- "marque" (PAS "fabricant", "constructeur", "brand")
- "modele" (PAS "model", "version")
- "couleur" (PAS "color", "coloris")
- "etat" (PAS "état", "condition")

VÊTEMENTS :
- "marque" (PAS "brand", "enseigne")
- "taille" (PAS "size", "pointure")
- "couleur" (PAS "coloris")

IMMOBILIER :
- "ville" (PAS "localisation", "city")
- "quartier" (PAS "zone", "secteur")
```

**Avantage** :
- ✅ Uniformité garantie
- ✅ Pas de silos
- ✅ usage_count cumulé correct

**Inconvénient** :
- ⚠️ IA doit respecter strictement
- ⚠️ Pas de flexibilité

---

### Solution #2 : Mapping Synonymes (Backend)

**Table de mapping** :
```sql
CREATE TABLE autocomplete_synonyms (
    id SERIAL PRIMARY KEY,
    canonical_name VARCHAR(255) NOT NULL,  -- "marque"
    synonym VARCHAR(255) NOT NULL,         -- "fabricant", "constructeur"
    UNIQUE(synonym)
);

INSERT INTO autocomplete_synonyms VALUES
    (1, 'marque', 'fabricant'),
    (2, 'marque', 'constructeur'),
    (3, 'marque', 'brand'),
    (4, 'modele', 'model'),
    (5, 'modele', 'version'),
    (6, 'couleur', 'color'),
    (7, 'couleur', 'coloris');
```

**Requête avec synonymes** :
```sql
SELECT ac.valeur, SUM(ac.usage_count) as total_usage
FROM autocomplete_characteristics ac
LEFT JOIN autocomplete_synonyms syn 
    ON syn.synonym = ac.sous_caracteristique
WHERE ac.identifiant_base = 'produits'
  AND (
    ac.sous_caracteristique = 'marque'  -- Recherche directe
    OR syn.canonical_name = 'marque'    -- OU via synonyme
  )
  AND LOWER(ac.valeur) LIKE 'sam%'
GROUP BY ac.valeur  -- ⚡ Groupe par valeur (unifie les silos)
ORDER BY total_usage DESC
LIMIT 5;
```

**Résultat** :
```
┌──────────┬─────────────┐
│ valeur   │ total_usage │
├──────────┼─────────────┤
│ Samsung  │ 3           │ ← 1(marque) + 1(fabricant) + 1(constructeur)
│ Apple    │ 2           │ ← 1(marque) + 1(fabricant)
│ Xiaomi   │ 1           │
└──────────┴─────────────┘
```

**Avantage** :
- ✅ Unifie les silos automatiquement
- ✅ usage_count correct
- ✅ Supporte variabilité IA

**Inconvénient** :
- ⚠️ Table de mapping à maintenir
- ⚠️ Requêtes plus complexes

---

### Solution #3 : Recherche CROSS (tous champs)

**Recherche dans TOUTES les sous-caractéristiques** :
```sql
SELECT 
    sous_caracteristique,
    valeur, 
    usage_count,
    sous_caracteristique as label  -- Afficher le label aussi
FROM autocomplete_characteristics
WHERE identifiant_base = 'produits'
  -- ⚠️ PAS de filtre sur sous_caracteristique
  AND LOWER(valeur) LIKE 'sam%'
ORDER BY usage_count DESC
LIMIT 10;
```

**Résultat** :
```
┌──────────────────────┬──────────┬─────────────┐
│ sous_caracteristique │ valeur   │ usage_count │
├──────────────────────┼──────────┼─────────────┤
│ marque               │ Samsung  │ 1           │
│ fabricant            │ Samsung  │ 1           │
│ constructeur         │ Samsung  │ 1           │
│ ville                │ Samara   │ 5           │ ← Faux positif !
└──────────────────────┴──────────┴─────────────┘
```

**UI** :
```
┌─────────────────────────────────────────┐
│ Marque *                                │
│ ┌─────────────────────────────────────┐ │
│ │ Sam|                                │ │
│ └─────────────────────────────────────┘ │
│ 💡 Suggestions :                        │
│ ┌─────────────────────────────────────┐ │
│ │ ✓ Samara (ville) 🏙️      (5 fois) │ │ ← Faux positif
│ │ ✓ Samsung (marque) 📱    (1 fois)  │ │
│ │ ✓ Samsung (fabricant) 📱 (1 fois)  │ │ ← Duplicate
│ │ ✓ Samsung (constructeur)📱(1 fois) │ │ ← Duplicate
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Avantage** :
- ✅ Trouve tout

**Inconvénient** :
- ❌ Faux positifs (ville "Samara")
- ❌ Duplicates visuels
- ❌ Confusion utilisateur

---

## 🎯 COMPORTEMENT ACTUEL DU SYSTÈME

### La recherche est FOCALISÉE sur sous_caracteristique

```
┌──────────────────────────────────────────────────────────────────┐
│                    RECHERCHE STRICTE                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Requête Frontend :                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ sous_caracteristique = "marque"                            │  │
│  │ prefix = "Sam"                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                    │
│  Backend SQL :                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ WHERE sous_caracteristique = 'marque'  ⚡ FILTRE STRICT    │  │
│  │   AND valeur LIKE 'Sam%'                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                             ↓                                    │
│  Résultat :                                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Samsung (marque) - usage=1        ✅ Retourné              │  │
│  │ Samsung (fabricant) - usage=1     ❌ IGNORÉ                │  │
│  │ Samsung (constructeur) - usage=1  ❌ IGNORÉ                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**✅ AVANTAGE** : Pas de faux positifs  
**❌ INCONVÉNIENT** : Silos de données

---

## 📊 VISUALISATION DES SILOS

### État de la table après 20 services

```
SILO "marque" (8 utilisateurs)
┌──────────┬─────────────┐
│ Samsung  │ 5           │ ████
│ Apple    │ 2           │ █
│ Xiaomi   │ 1           │ ▌
└──────────┴─────────────┘

SILO "fabricant" (7 utilisateurs)  
┌──────────┬─────────────┐
│ Samsung  │ 4           │ ███
│ Apple    │ 2           │ █
│ Huawei   │ 1           │ ▌
└──────────┴─────────────┘

SILO "constructeur" (5 utilisateurs)
┌──────────┬─────────────┐
│ Samsung  │ 3           │ ██
│ Xiaomi   │ 1           │ ▌
│ Sony     │ 1           │ ▌
└──────────┴─────────────┘

════════════════════════════════════════

TOTAL SAMSUNG = 5 + 4 + 3 = 12 utilisations
MAIS chaque silo voit seulement SA portion !
```

---

## 🔍 CAS CONCRETS

### Cas 1 : User cherche dans "marque"

**Input** : "Sam"  
**Champ IA** : `"marque"`

**SQL** :
```sql
WHERE sous_caracteristique = 'marque'
  AND valeur LIKE 'Sam%'
```

**Résultat** :
```
Samsung (5)  ← Voit SEULEMENT le silo "marque"
```

**✅ Correct** pour ce champ  
**❌ Incomplet** globalement (12 total)

---

### Cas 2 : User cherche dans "fabricant"

**Input** : "Sam"  
**Champ IA** : `"fabricant"`

**SQL** :
```sql
WHERE sous_caracteristique = 'fabricant'
  AND valeur LIKE 'Sam%'
```

**Résultat** :
```
Samsung (4)  ← Voit SEULEMENT le silo "fabricant"
```

**✅ Correct** pour ce champ  
**❌ Incomplet** globalement (12 total)

---

### Cas 3 : IA change de label entre 2 créations

**Utilisateur crée Service 1** :
```json
"sous_caracteristiques": {
  "marque": ["Samsung"]  // ⚡ IA génère "marque"
}
```
→ Sauvegarde dans `sous_carac="marque"`, Samsung usage=1

**Utilisateur crée Service 2** (même produit !) :
```json
"sous_caracteristiques": {
  "fabricant": ["Samsung"]  // ⚡ IA génère "fabricant" cette fois
}
```
→ Sauvegarde dans `sous_carac="fabricant"`, Samsung usage=1

**Résultat** :
- Samsung a 2 entrées séparées
- Aucune n'indique usage=2
- Les stats sont **fragmentées**

---

## 💡 SOLUTIONS DÉTAILLÉES

### Solution #1 : Normalisation IA (SIMPLE)

**Modifier le prompt IA** :

```markdown
LABELS STANDARDISÉS OBLIGATOIRES :

Pour TOUS les produits électroniques, TOUJOURS utiliser :
- "marque" (jamais "fabricant", "constructeur", "brand")
- "modele" (jamais "model", "version", "référence")
- "couleur" (jamais "color", "coloris", "teinte")
- "etat" (jamais "condition", "état")
- "annee" (jamais "année", "year", "millésime")

Pour TOUS les vêtements/chaussures :
- "marque" (jamais "brand", "enseigne")
- "taille" (jamais "size", "pointure")
- "couleur" (jamais "coloris")
- "matiere" (jamais "matériau", "fabric", "tissu")

Pour TOUS les services :
- "ville" (jamais "localisation", "city", "commune")
- "quartier" (jamais "zone", "secteur", "district")
```

**Implémentation** :
```
backend/ia_prompts/creation_service_prompt.md (ligne ~50)
→ Ajouter section "LABELS STANDARDISÉS"
```

**Résultat** :
```
100% des services auront "marque" (pas fabricant, constructeur)
→ 1 seul silo
→ usage_count cumulé correct
```

---

### Solution #2 : Table de Synonymes (ROBUSTE)

#### Création table

```sql
CREATE TABLE autocomplete_label_synonyms (
    id SERIAL PRIMARY KEY,
    identifiant_base VARCHAR(255) NOT NULL,
    canonical_label VARCHAR(255) NOT NULL,  -- Label officiel
    synonym_label VARCHAR(255) NOT NULL,    -- Synonyme
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(identifiant_base, synonym_label)
);

-- Mapping produits
INSERT INTO autocomplete_label_synonyms VALUES
    (1, 'produits', 'marque', 'fabricant'),
    (2, 'produits', 'marque', 'constructeur'),
    (3, 'produits', 'marque', 'brand'),
    (4, 'produits', 'modele', 'model'),
    (5, 'produits', 'modele', 'version'),
    (6, 'produits', 'modele', 'référence'),
    (7, 'produits', 'couleur', 'color'),
    (8, 'produits', 'couleur', 'coloris'),
    (9, 'produits', 'etat', 'condition'),
    (10, 'produits', 'etat', 'état');
```

#### Fonction normalisation (Backend)

```rust
fn normalize_sous_caracteristique(
    identifiant_base: &str,
    sous_carac: &str
) -> String {
    // Chercher si c'est un synonyme
    let canonical = sqlx::query_scalar!(
        "SELECT canonical_label 
         FROM autocomplete_label_synonyms 
         WHERE identifiant_base = $1 
           AND synonym_label = $2",
        identifiant_base,
        sous_carac
    ).fetch_optional(&pool).await?;
    
    // Si synonyme trouvé, utiliser le canonical
    canonical.unwrap_or(sous_carac.to_string())
}
```

#### Utilisation

```rust
// Avant INSERT dans autocomplete_characteristics
let normalized = normalize_sous_caracteristique("produits", "fabricant");
// → retourne "marque"

INSERT INTO autocomplete_characteristics 
    (identifiant_base, sous_caracteristique, valeur)
VALUES 
    ('produits', 'marque', 'Samsung');  // ✅ Toujours "marque"
```

**Résultat** :
```
Peu importe si IA génère "fabricant", "constructeur", ou "marque"
→ Tout est sauvegardé sous "marque"
→ 1 seul silo
→ usage_count unifié
```

---

### Solution #3 : Recherche Multi-Labels (FALLBACK)

**Recherche étendue si aucun résultat** :

```rust
// 1. Recherche stricte (actuelle)
let results = search_autocomplete("marque", "Sam");

// 2. Si 0 résultats, recherche étendue
if results.is_empty() {
    let similar_labels = vec!["fabricant", "constructeur", "brand"];
    
    for label in similar_labels {
        let extended = search_autocomplete(label, "Sam");
        results.extend(extended);
    }
}

// 3. Dédupliquer par valeur
results = deduplicate_by_value(results);
```

**Résultat** :
```
Recherche dans "marque" → 0 résultat
→ Cherche aussi dans "fabricant" → trouve Samsung(4)
→ Cherche aussi dans "constructeur" → trouve Samsung(3)
→ Combine : Samsung(7 total)
```

**Avantage** :
- ✅ Trouve même si label différent
- ✅ Pas de modification BDD

**Inconvénient** :
- ⚠️ Plusieurs requêtes SQL
- ⚠️ Plus lent

---

## 🎨 VISUALISATION CAS RÉEL

### 3 utilisateurs créent "Samsung Galaxy"

```
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE #1 - User A                                             │
├─────────────────────────────────────────────────────────────────┤
│ IA génère :                                                     │
│   "marque": ["Samsung", "Apple"]                                │
│   "modele": ["Galaxy S21", "iPhone 13"]                         │
│                                                                 │
│ Table autocomplete :                                            │
│   produits | marque  | Samsung  | 1                             │
│   produits | modele  | Galaxy S21 | 1                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SERVICE #2 - User B (30 min après)                              │
├─────────────────────────────────────────────────────────────────┤
│ IA génère :                                                     │
│   "fabricant": ["Samsung", "Huawei"]  ⚠️ Label différent        │
│   "modele": ["Galaxy A52", "P40"]                               │
│                                                                 │
│ Table autocomplete :                                            │
│   produits | marque     | Samsung    | 1  (inchangé)            │
│   produits | fabricant  | Samsung    | 1  ⚡ Nouvelle ligne     │
│   produits | modele     | Galaxy S21 | 1  (inchangé)            │
│   produits | modele     | Galaxy A52 | 1  ⚡ Ajouté             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SERVICE #3 - User C (1h après)                                  │
├─────────────────────────────────────────────────────────────────┤
│ IA génère :                                                     │
│   "marque": ["Samsung", "Xiaomi"]  ✅ Même label que User A     │
│   "modele": ["Galaxy S20", "Redmi Note"]                        │
│                                                                 │
│ User C cherche "Sam" dans champ "marque"                        │
│                                                                 │
│ SQL :                                                           │
│   WHERE sous_caracteristique = 'marque'                         │
│     AND valeur LIKE 'Sam%'                                      │
│                                                                 │
│ Résultat :                                                      │
│   Samsung (usage=1)  ← SEULEMENT du silo "marque"              │
│                      ← Ne voit PAS Samsung(fabricant)=1        │
│                                                                 │
│ UI affiche :                                                    │
│   ✓ Samsung (1 fois)  ⚠️ Sous-estime la popularité             │
│                                                                 │
│ User C sélectionne "Samsung"                                    │
│                                                                 │
│ Table après UPDATE :                                            │
│   produits | marque     | Samsung | 2  ✅ Incrémenté           │
│   produits | fabricant  | Samsung | 1  (inchangé)              │
└─────────────────────────────────────────────────────────────────┘
```

**État final de la table** :
```
┌──────────────────────┬──────────┬─────────────┐
│ sous_caracteristique │ valeur   │ usage_count │
├──────────────────────┼──────────┼─────────────┤
│ marque               │ Samsung  │ 2           │ ← User A + User C
│ fabricant            │ Samsung  │ 1           │ ← User B (isolé)
└──────────────────────┴──────────┴─────────────┘
```

**🚨 PROBLÈME** : Usage total = 3, mais fragmenté en 2+1

---

## 🎯 IMPACT SUR L'UTILISATEUR

### User D cherche "Samsung"

**L'IA lui génère** : `"marque": ["Samsung"]`

**Il tape "Sam"** :

```
┌─────────────────────────────────────────┐
│ Marque *                                │
│ ┌─────────────────────────────────────┐ │
│ │ Sam|                                │ │
│ └─────────────────────────────────────┘ │
│ 💡 Suggestions :                        │
│ ┌─────────────────────────────────────┐ │
│ │ ✓ Samsung            (2 fois)       │ │ ← Devrait être (3 fois)
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**User D pense** : "Seulement 2 personnes ont utilisé Samsung"  
**Réalité** : 3 personnes (mais 1 dans silo "fabricant")

---

## 💡 SOLUTION RECOMMANDÉE : Normalisation Multi-Niveaux

### Niveau 1 : Prompt IA (Prévention)

```markdown
RÈGLES STRICTES DE LABELLISATION :

Pour produits physiques, TOUJOURS :
- "marque" (unique label autorisé)
- "modele" 
- "couleur"
- "etat"

JAMAIS : fabricant, constructeur, brand, manufacturer
```

### Niveau 2 : Backend Normalization (Sécurité)

```rust
// Avant sauvegarde, normaliser
fn normalize_label(label: &str) -> &str {
    match label.to_lowercase().as_str() {
        "fabricant" | "constructeur" | "brand" | "manufacturer" => "marque",
        "model" | "version" | "référence" => "modele",
        "color" | "coloris" | "teinte" => "couleur",
        "condition" | "état" => "etat",
        _ => label
    }
}

// Utilisation
for (key, values) in sous_caracteristiques {
    let normalized_key = normalize_label(&key);  // ✅ Unifie
    
    for value in values {
        insert_autocomplete(normalized_key, value);
    }
}
```

**Résultat** :
```
IA génère "fabricant" → Backend sauvegarde sous "marque" ✅
IA génère "constructeur" → Backend sauvegarde sous "marque" ✅
IA génère "marque" → Backend sauvegarde sous "marque" ✅

→ Tout va dans le même silo
→ usage_count unifié
```

---

### Niveau 3 : Frontend Fallback (Dernière ligne)

```typescript
// Si recherche dans "fabricant" ne trouve rien
if (results.length === 0 && field === 'fabricant') {
  // Chercher aussi dans "marque"
  const fallback = await fetch(
    `/autocomplete/suggestions?sous_carac=marque&prefix=${prefix}`
  );
  results = fallback;
}
```

---

## 📊 COMPARAISON AVANT/APRÈS NORMALISATION

### AVANT (Silos)

```
Table après 20 services
┌──────────────────────┬──────────┬─────────────┬────────────┐
│ sous_caracteristique │ valeur   │ usage_count │ Utilisateurs│
├──────────────────────┼──────────┼─────────────┼────────────┤
│ marque               │ Samsung  │ 8           │ A,C,D,F... │
│ fabricant            │ Samsung  │ 7           │ B,E,G,H... │
│ constructeur         │ Samsung  │ 5           │ I,J,K,L... │
├──────────────────────┼──────────┼─────────────┼────────────┤
│ TOTAL fragmenté      │          │ 8+7+5 = 20  │ 20 users   │
└──────────────────────┴──────────┴─────────────┴────────────┘
```

**Recherche User 21** :
- Champ : "marque"
- Voit : Samsung (8) ← 40% des usages seulement

---

### APRÈS (Unifié)

```
Table après 20 services (avec normalisation)
┌──────────────────────┬──────────┬─────────────┬────────────┐
│ sous_caracteristique │ valeur   │ usage_count │ Utilisateurs│
├──────────────────────┼──────────┼─────────────┼────────────┤
│ marque               │ Samsung  │ 20          │ A-T (tous) │
├──────────────────────┼──────────┼─────────────┼────────────┤
│ TOTAL unifié         │          │ 20          │ 20 users   │
└──────────────────────┴──────────┴─────────────┴────────────┘
```

**Recherche User 21** :
- Champ : "marque"
- Voit : Samsung (20) ← 100% des usages ✅

---

## 🎯 RÉPONSE À VOS QUESTIONS

### Q1 : La recherche est-elle focalisée sur la valeur ou le label ?

**Réponse** : **Focalisée sur LABEL + VALEUR** (les deux)

```sql
WHERE sous_caracteristique = 'marque'  -- ⚡ Filtre sur LABEL
  AND valeur LIKE 'Sam%'               -- ⚡ Filtre sur VALEUR
```

**Conséquence** :
- ✅ Évite faux positifs (ville "Samara" ignorée si champ="marque")
- ❌ Crée silos si labels différents

---

### Q2 : Si même valeur dans sous-caractéristiques différentes ?

**Réponse** : **Chaque sous-caractéristique est ISOLÉE**

**Exemple** :
```
Recherche "Sam" dans champ "marque"
→ Trouve : Samsung (marque) = 8
→ Ignore : Samsung (fabricant) = 7
→ Ignore : Samsung (constructeur) = 5
```

**Impact** : usage_count fragmenté

---

### Q3 : IA donne labels différents pour 2 users ?

**Réponse** : **OUI, ça arrive !** Et c'est un problème.

**Exemple réel de vos logs** :
```
User A : IA génère "produits" avec sous_carac "type, forme, couleur..."
User B : IA pourrait générer "produits" avec "category, shape, color..."
→ 2 silos séparés même si même produit
```

**Solution obligatoire** : Normalisation (Solution #1 ou #2)

---

## 🚀 RECOMMANDATION FINALE

### Approche Hybride (Meilleure)

1. **Prompt IA standardisé** (prévention)
2. **Backend normalise** (sécurité)
3. **Frontend affiche label normalisé** (cohérence)

**Code Backend** :
```rust
// mappings.rs
const LABEL_MAPPINGS: &[(&str, &[&str])] = &[
    ("marque", &["fabricant", "constructeur", "brand", "manufacturer"]),
    ("modele", &["model", "version", "référence", "ref"]),
    ("couleur", &["color", "coloris", "teinte"]),
    ("etat", &["condition", "état", "state"]),
];

fn normalize(label: &str) -> String {
    for (canonical, synonyms) in LABEL_MAPPINGS {
        if synonyms.contains(&label.to_lowercase().as_str()) {
            return canonical.to_string();
        }
    }
    label.to_string()
}
```

**Résultat** :
```
IA génère n'importe quoi → Backend unifie → 1 silo → usage_count correct ✅
```

---

## 📊 TABLEAU RÉCAPITULATIF

| Aspect | Comportement Actuel | Impact | Solution |
|--------|-------------------|--------|----------|
| **Recherche** | Filtrée par `sous_caracteristique` | Pas de faux positifs ✅ | Garder |
| **Silos** | Créés si labels différents | usage_count fragmenté ❌ | Normalisation |
| **IA variabilité** | Labels peuvent changer | Silos multiples ❌ | Prompt strict |
| **Recherche valeur** | LIKE 'prefix%' | Fonctionne ✅ | Garder |
| **Tri** | Par usage_count DESC | Bon ordre ✅ | Garder |

---

**Document complet sauvegardé dans `ANALYSE_CONFLITS_SOUS_CARACTERISTIQUES.md` ! 📄**

La recherche est **focalisée sur le LABEL (sous-caractéristique)**, donc si l'IA change de label, ça crée des silos isolés ! La normalisation backend est ESSENTIELLE.

