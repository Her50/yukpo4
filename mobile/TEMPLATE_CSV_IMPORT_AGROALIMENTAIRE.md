# 📋 Template CSV Import - Alimentation & Produits Alimentaires

## 📊 Structure des Colonnes (20 colonnes)

| N° | Colonne | Type | Obligatoire | Exemple | Notes |
|----|---------|------|-------------|---------|-------|
| 0 | `name` | Texte | ✅ Oui | Riz Uncle Ben's | Nom du produit |
| 1 | `prix` | Nombre | ✅ Oui | 2000 | Prix (si variantes, mettre prix min) |
| 2 | `devise` | Texte | ✅ Oui | XAF | Devise (XAF, EUR, USD) |
| 3 | `description` | Texte | ✅ Oui | Riz parfumé de qualité premium | Description produit |
| 4 | `categorieAliment` | Texte | ✅ Oui | Céréales et dérivés | Catégorie alimentaire |
| 5 | `typeAliment` | Texte | ❌ Non | Riz et céréales | Type de produit |
| 6 | `marqueAliment` | Texte | ❌ Non | Uncle Ben's | ✅ NOUVEAU : Marque |
| 7 | `origine` | Texte | ❌ Non | Thaïlande | Pays d'origine |
| 8 | `bio` | oui/non | ❌ Non | oui | Agriculture biologique |
| 9 | `dateProduction` | Date | ❌ Non | 01/01/2025 | Format JJ/MM/AAAA |
| 10 | `dateExpiration` | Date | ❌ Non | 01/01/2026 | Format JJ/MM/AAAA |
| 11 | `conservation` | Texte | ❌ Non | Température ambiante | Mode de conservation |
| 12 | `poids` | Nombre | ❌ Non | 1 | Quantité (si variantes, laisser vide) |
| 13 | `uniteMesure` | Texte | ❌ Non | kg | Unité (kg, L, g, pièce) |
| 14 | `conditionnement` | Texte | ❌ Non | Sachet | Type conditionnement |
| 15 | `labelQualite` | Texte | ❌ Non | Bio\|Label Rouge | Séparés par `\|` |
| 16 | `certifications` | Texte | ❌ Non | Halal\|Vegan | Séparés par `\|` |
| 17 | `allergenes` | Texte | ❌ Non | Gluten\|Lait | Séparés par `\|` |
| 18 | `stockDisponible` | Nombre | ❌ Non | 100 | Stock disponible |
| 19 | `variants` | JSON | ❌ Non | Voir ci-dessous | ✅ NOUVEAU : Variantes JSON |

---

## 🔧 Format des Variantes (Colonne 19)

### Format JSON
```json
[
  {
    "quantite": "1",
    "unite": "kg",
    "conditionnement": "Sachet",
    "prix": "2000",
    "stockDisponible": 100,
    "reference": "RIZ-1KG"
  },
  {
    "quantite": "5",
    "unite": "kg",
    "conditionnement": "Sac",
    "prix": "9000",
    "stockDisponible": 50,
    "reference": "RIZ-5KG"
  },
  {
    "quantite": "25",
    "unite": "kg",
    "conditionnement": "Sac",
    "prix": "40000",
    "stockDisponible": 20,
    "reference": "RIZ-25KG"
  }
]
```

### ⚠️ Important
- **Echapper les guillemets** dans le CSV : `"[{""quantite"":""1""...}]"`
- **Minifier le JSON** : Supprimer espaces et retours à la ligne
- **Optionnel** : Si pas de variantes, laisser la cellule vide

---

## 📝 Exemples Complets

### Exemple 1 : Produit avec Variantes (Riz)

```csv
Riz Uncle Ben's,2000,XAF,"Riz parfumé de qualité premium",Céréales et dérivés,Riz et céréales,Uncle Ben's,Thaïlande,non,01/01/2025,01/01/2026,Température ambiante,,,,"Bio|Label Rouge",Halal,Gluten,,"[{""quantite"":""1"",""unite"":""kg"",""conditionnement"":""Sachet"",""prix"":""2000"",""stockDisponible"":100},{""quantite"":""5"",""unite"":""kg"",""conditionnement"":""Sac"",""prix"":""9000"",""stockDisponible"":50},{""quantite"":""25"",""unite"":""kg"",""conditionnement"":""Sac"",""prix"":""40000"",""stockDisponible"":20}]"
```

**Notes** :
- `poids` (col 12) : Vide car géré par variantes
- `uniteMesure` (col 13) : Vide car géré par variantes
- `conditionnement` (col 14) : Vide car géré par variantes
- `stockDisponible` (col 18) : Vide car géré par variantes
- `variants` (col 19) : JSON avec 3 variantes

### Exemple 2 : Produit Simple (Tomate)

```csv
Tomate,500,XAF,"Tomates fraîches du marché local",Légumes,Légumes frais,,Locale,oui,20/10/2025,25/10/2025,Frais (2-8°C),1,kg,En vrac,"Bio|Local",Bio,,50,
```

**Notes** :
- `marqueAliment` (col 6) : Vide (pas de marque pour produit frais local)
- `poids` (col 12) : 1 (produit simple)
- `uniteMesure` (col 13) : kg
- `conditionnement` (col 14) : En vrac
- `stockDisponible` (col 18) : 50
- `variants` (col 19) : Vide (pas de variantes)

### Exemple 3 : Huile d'Arachide

```csv
Huile d'Arachide,1500,XAF,"Huile d'arachide pure",Huiles et matières grasses,Huile alimentaire,Dinor,Locale,non,15/10/2025,15/10/2026,Température ambiante,,,,"Label Rouge",,"Arachides",,"[{""quantite"":""1"",""unite"":""L"",""conditionnement"":""Bouteille"",""prix"":""1500"",""stockDisponible"":200},{""quantite"":""5"",""unite"":""L"",""conditionnement"":""Bidon"",""prix"":""7000"",""stockDisponible"":80},{""quantite"":""20"",""unite"":""L"",""conditionnement"":""Bidon"",""prix"":""25000"",""stockDisponible"":30}]"
```

---

## 📤 Header CSV Complet

```csv
name,prix,devise,description,categorieAliment,typeAliment,marqueAliment,origine,bio,dateProduction,dateExpiration,conservation,poids,uniteMesure,conditionnement,labelQualite,certifications,allergenes,stockDisponible,variants
```

---

## ⚠️ Règles d'Import

### Champs Obligatoires
- ✅ `name` : Nom du produit
- ✅ `prix` : Prix (ou prix min si variantes)
- ✅ `devise` : Devise
- ✅ `description` : Description
- ✅ `categorieAliment` : Catégorie

### Champs Multiples (Séparateur |)
- `labelQualite` : Ex: `Bio|Label Rouge|AOC`
- `certifications` : Ex: `Halal|Vegan|Sans gluten`
- `allergenes` : Ex: `Gluten|Lait|Arachides`

### Dates (Format JJ/MM/AAAA)
- `dateProduction` : Ex: `01/01/2025`
- `dateExpiration` : Ex: `31/12/2025`

### Booléens (oui/non)
- `bio` : `oui` ou `non` (case insensitive)

### Variantes (Format JSON)
- ✅ **Avec variantes** : Fournir JSON complet
- ✅ **Sans variantes** : Remplir `poids`, `uniteMesure`, `conditionnement`, `stockDisponible`
- ⚠️ **Ne jamais remplir les deux** : Soit variantes, soit champs simples

---

## 📊 Mapping Colonnes

### Ancien Format (17 colonnes) → Nouveau Format (20 colonnes)

| Ancien | Nouveau | Changement |
|--------|---------|------------|
| 0-5 | 0-5 | ✅ Identiques |
| 6 | 7 | ⚠️ Décalé : `origine` |
| 7 | 8 | ⚠️ Décalé : `bio` |
| 8 | 9 | ⚠️ Décalé : `dateProduction` |
| 9 | 10 | ⚠️ Décalé : `dateExpiration` |
| 10 | 11 | ⚠️ Décalé : `conservation` |
| 11-17 | 12-18 | ⚠️ Décalés |
| - | 6 | ✅ NOUVEAU : `marqueAliment` |
| - | 19 | ✅ NOUVEAU : `variants` (optionnel) |

---

## 🎯 Recommandation

### Pour Fichiers Existants
Si vous avez des CSV existants avec l'ancien format (17 colonnes) :
1. Ajouter colonne vide en position 6 pour `marqueAliment`
2. Ajouter colonne vide en position 19 pour `variants`
3. Ou utiliser un script de migration (fourni ci-dessous)

### Script Python de Migration
```python
import pandas as pd

# Charger ancien CSV
df = pd.read_csv('ancien_produits.csv')

# Insérer colonne marqueAliment après typeAliment
df.insert(6, 'marqueAliment', '')

# Ajouter colonne variants à la fin
df['variants'] = ''

# Sauvegarder nouveau CSV
df.to_csv('nouveau_produits.csv', index=False)
```

---

## ✅ Résumé

**Import CSV mis à jour** :
- ✅ 20 colonnes au lieu de 17
- ✅ Nouveau champ `marqueAliment` (position 6)
- ✅ Nouveau champ `variants` (position 19)
- ✅ Support produits simples ET variantes
- ✅ Rétrocompatible (variants optionnel)

**Prêt pour l'import en masse !** 🚀






