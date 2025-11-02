# Exemples d'Extraction de Valeurs avec Labels

## 🎯 Problématique Résolue

**Avant (sans labels)** :
```sql
product_vector = ["Nike", "Air Max", "Noir", "42"]
-- ❌ Comment extraire la couleur ? Impossible de savoir que "Noir" = couleur !
```

**Maintenant (avec labels)** :
```sql
product_vector = ["Nike", "Air Max", "Noir", "42"]
product_labels = ["marque", "modele", "couleur", "pointure"]
-- ✅ On peut extraire la couleur facilement !
```

---

## 📊 Structure des deux tables

### Table 1 : `autocomplete_characteristics`

Stocke les **caractéristiques individuelles** avec leurs labels
