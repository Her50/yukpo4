# 🎯 Système de Catégories Favorites Utilisateur

**Date**: 31 octobre 2025  
**Service**: `userBehaviorService.ts`  
**Fonctionnalité**: Tracking automatique des préférences utilisateur

---

## 📊 Comment Ça Marche ?

### 1. Tracking Automatique

Le système **observe automatiquement** le comportement de l'utilisateur :

#### A. Recherches Effectuées

Chaque fois qu'un utilisateur **recherche** quelque chose :

```typescript
// Dans HomeScreen.tsx, ligne 251-253
if (input.texte) {
    await userBehaviorService.trackSearch(input.texte);
}
```

**Exemple** :
```
Utilisateur recherche : "iPhone 15"
→ Catégorie détectée : "Informatique" (si spécifiée)
→ Score "Informatique" : +1 point
```

#### B. Vues de Produits

Quand un utilisateur **consulte** un produit :

```typescript
// userBehaviorService.ts, ligne 64-77
async trackProductView(productType: string) {
    behavior.categoryPreferences[productType] = 
        (behavior.categoryPreferences[productType] || 0) + 0.5;
}
```

**Pondération** :
- 🔍 **Recherche** : +1 point (fort intérêt)
- 👁️ **Vue produit** : +0.5 point (intérêt moyen)

---

### 2. Stockage Local (AsyncStorage)

Toutes les données sont **stockées localement** sur le téléphone de l'utilisateur :

```typescript
// Structure des données
{
  "searchHistory": [
    {
      "query": "iPhone 15",
      "category": "Informatique",
      "timestamp": 1698765432000
    },
    {
      "query": "Nike Air Max",
      "category": "Chaussures",
      "timestamp": 1698765400000
    }
  ],
  "categoryPreferences": {
    "Informatique": 5.5,     // 5 recherches + 1 vue (0.5)
    "Chaussures": 3.0,       // 3 recherches
    "Électronique": 2.5,     // 2 recherches + 1 vue (0.5)
    "Automobile": 1.0        // 1 recherche
  },
  "lastUpdated": 1698765432000
}
```

**Clé de stockage** : `user_behavior`

---

### 3. Récupération des Catégories Préférées

Dans `HomeScreen.tsx` :

```typescript
// Ligne 168
const categories = await userBehaviorService.getPreferredCategories(5);
// Retourne : ["Informatique", "Chaussures", "Électronique", "Automobile"]
```

#### Algorithme de Tri

```typescript
// userBehaviorService.ts, ligne 98-113
async getPreferredCategories(limit: number = 5): Promise<string[]> {
    const behavior = await this.getBehavior();
    
    // 1️⃣ Trier par score décroissant
    const sorted = Object.entries(behavior.categoryPreferences)
        .sort(([, a], [, b]) => b - a)  // Score le plus élevé d'abord
        .slice(0, limit)                 // Limiter au nombre demandé
        .map(([category]) => category);  // Extraire juste les noms
    
    return sorted;
}
```

**Exemple de tri** :
```
Entrée :
{
  "Informatique": 5.5,
  "Chaussures": 3.0,
  "Électronique": 2.5,
  "Automobile": 1.0
}

Sortie (limit=5) :
["Informatique", "Chaussures", "Électronique", "Automobile"]
```

---

## 🎨 Gestion de Plusieurs Catégories

### Cas 1 : Utilisateur a PLUSIEURS Catégories

**Scénario** :
```
Utilisateur a recherché :
- "iPhone" → Informatique (3 fois)
- "Nike" → Chaussures (2 fois)
- "PlayStation" → Électronique (4 fois)
- "Toyota" → Automobile (1 fois)
```

**Résultat** :
```typescript
getPreferredCategories(5) 
// Retourne : ["Électronique", "Informatique", "Chaussures", "Automobile"]
```

**Envoyé au backend** :
```
/api/content/mixed?categories=Électronique,Informatique,Chaussures,Automobile
```

**Backend filtre** :
```sql
WHERE s.category IN ('Électronique', 'Informatique', 'Chaussures', 'Automobile')
ORDER BY s.created_at DESC
```

✅ **L'utilisateur voit des produits de TOUTES ses catégories préférées !**

---

### Cas 2 : Utilisateur a UNE SEULE Catégorie

**Scénario** :
```
Utilisateur cherche uniquement "iPhone" (10 fois)
```

**Résultat** :
```typescript
getPreferredCategories(5) 
// Retourne : ["Informatique"]
```

**Envoyé au backend** :
```
/api/content/mixed?categories=Informatique
```

---

### Cas 3 : Utilisateur NOUVEAU (Aucune Catégorie)

**Scénario** :
```
Premier lancement de l'app, aucune recherche
```

**Résultat** :
```typescript
getPreferredCategories(5) 
// Retourne : []
```

**Envoyé au backend** :
```
/api/content/mixed?categories=
```

**Backend** :
```sql
-- Aucun filtre de catégorie, retourne tous les produits récents
WHERE TRUE
ORDER BY s.created_at DESC
```

✅ **L'utilisateur voit du contenu générique populaire**

---

## 📈 Limite du Nombre de Catégories

### Paramètre `limit`

```typescript
// HomeScreen.tsx, ligne 168
const categories = await userBehaviorService.getPreferredCategories(5);
//                                                                     ↑
//                                                        Max 5 catégories
```

**Pourquoi limiter à 5 ?**
- ✅ **Performance** : Éviter requêtes SQL trop larges
- ✅ **Pertinence** : Focus sur les vrais intérêts
- ✅ **UX** : Contenu plus ciblé

**Configurable** :
```typescript
// Pour avoir plus ou moins de catégories
getPreferredCategories(3)  // Top 3
getPreferredCategories(10) // Top 10
```

---

## 🔄 Mise à Jour en Temps Réel

### Chaque Recherche Met à Jour

```
1. Utilisateur recherche "iPhone"
   ↓
2. trackSearch("iPhone", "Informatique")
   ↓
3. categoryPreferences["Informatique"] += 1
   ↓
4. Sauvegarde dans AsyncStorage
   ↓
5. Prochaine ouverture HomeScreen → nouvelles catégories
```

### Limite Historique

```typescript
const MAX_HISTORY = 100; // Maximum 100 recherches gardées
```

**Gestion automatique** :
```typescript
// Si plus de 100 recherches, supprime les plus anciennes
if (behavior.searchHistory.length > MAX_HISTORY) {
    behavior.searchHistory = behavior.searchHistory.slice(0, MAX_HISTORY);
}
```

---

## 🎯 Exemple Complet de Flux

### Scénario Réel

**Historique utilisateur** :
```
Jour 1: Recherche "iPhone 15" (Informatique) → Score: 1
Jour 2: Recherche "Samsung Galaxy" (Informatique) → Score: 2
Jour 2: Vue produit "MacBook" (Informatique) → Score: 2.5
Jour 3: Recherche "Nike Air Max" (Chaussures) → Score: 1
Jour 4: Recherche "Adidas" (Chaussures) → Score: 2
Jour 5: Recherche "PlayStation 5" (Électronique) → Score: 1
```

**Scores Finaux** :
```javascript
{
  "Informatique": 2.5,
  "Chaussures": 2.0,
  "Électronique": 1.0
}
```

**Catégories retournées** :
```javascript
["Informatique", "Chaussures", "Électronique"]
```

**API Call** :
```
GET /api/content/mixed?categories=Informatique,Chaussures,Électronique&user_id=123
```

**Backend retourne** :
```
- 3 publicités payantes (toutes catégories)
- 5 produits "Informatique" récents
- 3 produits "Chaussures" récents
- 2 produits "Électronique" récents
Total: 13 éléments mélangés intelligemment
```

---

## 🛠️ Fonctionnalités Additionnelles

### Statistiques Utilisateur

```typescript
const stats = await userBehaviorService.getStats();

// Retourne :
{
  "totalSearches": 15,
  "topCategories": [
    { "category": "Informatique", "count": 3 },
    { "category": "Chaussures", "count": 2 },
    { "category": "Électronique", "count": 1 }
  ],
  "recentSearches": [
    { "query": "PlayStation 5", "category": "Électronique", "timestamp": 1698765432000 },
    // ... 9 autres
  ]
}
```

### Réinitialisation

```typescript
// Effacer tout l'historique utilisateur
await userBehaviorService.resetBehavior();
```

---

## 🎨 Avantages du Système

### Pour l'Utilisateur
- ✅ **Personnalisation automatique** : Pas de configuration manuelle
- ✅ **Contenu pertinent** : Voir ce qui l'intéresse vraiment
- ✅ **Découverte intelligente** : Mix entre préférences et nouveautés

### Pour la Plateforme
- ✅ **Engagement accru** : Contenu adapté = plus de clics
- ✅ **Rétention** : Utilisateurs reviennent pour du contenu pertinent
- ✅ **Data précieuse** : Comprendre les tendances utilisateurs

### Pour les Vendeurs
- ✅ **Meilleure visibilité** : Produits affichés aux bonnes personnes
- ✅ **Conversions** : Audience qualifiée
- ✅ **ROI publicité** : Publicités ciblées sur bonnes catégories

---

## 📊 Logs de Debug

### Dans la Console

```
[UserBehavior] Recherche enregistrée: { query: 'iPhone', category: 'Informatique' }
[UserBehavior] Catégories préférées: ["Informatique", "Chaussures", "Électronique"]
[HomeScreen] Catégories préférées chargées: ["Informatique", "Chaussures", "Électronique"]
[MixedContentCarousel] Catégories comportement: ["Informatique", "Chaussures", "Électronique"]
[MixedContentCarousel] 🔗 Appel API: /api/content/mixed?categories=Informatique,Chaussures,Électronique
```

---

## 🔧 Configuration Possible

### Ajuster la Limite

```typescript
// Dans HomeScreen.tsx, ligne 168
// AVANT :
const categories = await userBehaviorService.getPreferredCategories(5);

// APRÈS (pour avoir top 3 seulement) :
const categories = await userBehaviorService.getPreferredCategories(3);

// APRÈS (pour avoir top 10) :
const categories = await userBehaviorService.getPreferredCategories(10);
```

### Ajuster les Pondérations

```typescript
// Dans userBehaviorService.ts

// AVANT :
trackSearch → +1 point
trackProductView → +0.5 point

// APRÈS (pour donner plus d'importance aux vues) :
trackSearch → +1 point
trackProductView → +1 point  // Même poids
```

---

## 📝 Structure de Données Complète

```typescript
interface SearchHistory {
    query: string;          // Ex: "iPhone 15"
    category?: string;      // Ex: "Informatique"
    timestamp: number;      // Ex: 1698765432000
}

interface UserBehavior {
    searchHistory: SearchHistory[];           // Max 100 items
    categoryPreferences: Record<string, number>;  // { "Informatique": 5.5 }
    lastUpdated: number;                      // Timestamp dernière MAJ
}
```

---

## ✅ Résumé Rapide

| Question | Réponse |
|----------|---------|
| **Comment sont identifiées ?** | Tracking automatique des recherches + vues produits |
| **Plusieurs catégories ?** | ✅ Oui, triées par score, limite configurable (défaut: 5) |
| **Stockage ?** | Local (AsyncStorage), clé `user_behavior` |
| **Backend ?** | Filtre SQL `WHERE category IN (...)` |
| **Nouveau user ?** | Pas de filtre → contenu générique populaire |
| **Mise à jour ?** | Temps réel à chaque recherche/vue |
| **Limite historique ?** | 100 recherches max (FIFO) |

---

**Fichiers Clés** :
- `mobile/src/services/userBehaviorService.ts` (Core)
- `mobile/src/screens/HomeScreen.tsx` (Usage ligne 168)
- `mobile/src/components/MixedContentCarousel.tsx` (Transmission au backend)
- `backend/src/controllers/mixed_content_controller.rs` (Filtrage SQL)

