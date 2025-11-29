# Analyse : Lenteur Recherche et Problèmes d'Affichage

**Date**: 2025-11-29  
**Objectif**: Identifier les goulots d'étranglement et corriger les problèmes d'affichage

---

## 🔍 1. ANALYSE LENTEUR RECHERCHE

### Problème identifié
La recherche était rapide avant, mais est devenue lente après l'ajout de nouveaux composants. Les produits se chargent bien dans le scroll automatique de HomeScreen, mais pas dans ResultatBesoinScreen.

### Causes probables identifiées

#### A. Enrichissement Google Places (PARALLÉLISÉ mais toujours actif)
**Fichier**: `backend/src/services/native_search_service.rs` lignes 321-349

**Problème** :
- ✅ **DÉJÀ OPTIMISÉ** : L'enrichissement Google Places est parallélisé avec `join_all`
- ⚠️ **MAIS** : Chaque appel à `enrich_service_with_google_places_data` peut prendre 100-500ms
- ⚠️ **IMPACT** : Si 20 résultats → 20 appels parallèles → peut bloquer 1-2 secondes

**Solution recommandée** :
```rust
// Désactiver l'enrichissement Google Places par défaut pour recherche générale
// Ne l'activer que si explicitement demandé ou pour résultats < 10
if fulltext_results.len() <= 10 {
    // Enrichir seulement les 10 premiers résultats
}
```

#### B. Enrichissement des résultats dans `rechercher_besoin.rs`
**Fichier**: `backend/src/services/rechercher_besoin.rs` lignes 566-853

**Problème** :
- Pour **chaque résultat**, le backend fait **3 requêtes SQL séquentielles** :
  1. Récupération user info (lignes 572-584)
  2. Récupération product info (lignes 586-607)
  3. Récupération media (lignes 609-641)
- Si 20 résultats → **60 requêtes SQL** !

**Solution** : Utiliser des requêtes batch avec `IN` ou `ANY` :
```sql
-- Au lieu de N requêtes, 1 seule requête pour tous les services
SELECT s.id, u.id, u.nom_complet, u.avatar_url
FROM services s
INNER JOIN users u ON u.id = s.user_id
WHERE s.id = ANY($1::int[])
```

#### C. Extraction données produits depuis `service.data.produits`
**Fichier**: `backend/src/services/rechercher_besoin.rs` lignes 758-850

**Problème** :
- Extraction complexe avec multiples `get()` imbriqués
- Traitement JSON lourd pour chaque résultat

**Solution** : Optimiser l'extraction ou la déplacer côté frontend

---

## 💰 2. PROBLÈME AFFICHAGE PRIX À 0

### Problème identifié
Les prix s'affichent à 0 dans ProductCard même si le produit a un prix.

### Analyse du code
**Fichier**: `mobile/src/components/ProductCard.tsx` lignes 765-829

**Code actuel** :
```typescript
const displayPrice = hasVariant && variants.length > 0
  ? Math.min(...variants.map((v: any) => v.prix || 0))
  : product.prix || extractedPriceData.prix || 0;
```

**Problèmes possibles** :
1. `product.prix` peut être `null`, `undefined`, ou string `"0"`
2. `extractedPriceData.prix` peut retourner 0 si extraction échoue
3. Le prix peut être dans `product.prix_produit` au lieu de `product.prix`
4. Le prix peut être dans `service.data.produits[0].prix`

**Corrections nécessaires** :
1. ✅ Améliorer `extractPriceFromProductData` pour chercher dans plus d'endroits
2. ✅ Formater le prix en milliers (ex: 150000 → "150 000")
3. ✅ Gérer les cas où prix est string "0" ou null

---

## 📍 3. PROBLÈME AFFICHAGE ADRESSE ET DRAPEAU

### Problème identifié
L'adresse du prestataire et le drapeau du pays ne s'affichent pas correctement dans ProductCard.

### Analyse du code
**Fichier**: `mobile/src/components/ProductCard.tsx` lignes 1413-1493

**Code actuel** :
```typescript
{(chosenLocation || locationVector.length > 0 || pays || product.adresse || ...) && (
  <View style={styles.locationSection}>
    <Text>{chosenLocation || locationVector[0] || product.adresse || ...}</Text>
    {countryFlag && countryFlag !== '🌍' && (
      <Text>{countryFlag}</Text>
    )}
  </View>
)}
```

**Problèmes identifiés** :
1. ✅ L'adresse est extraite dans `rechercher_besoin.rs` (lignes 643-671) mais peut ne pas être transmise correctement
2. ✅ Le drapeau est calculé depuis `pays` mais peut être manquant
3. ✅ L'adresse peut être dans `prestataire.adresse` mais n'est pas vérifiée

**Corrections nécessaires** :
1. Vérifier que `prestataire.adresse` et `prestataire.pays` sont bien transmis depuis le backend
2. Améliorer l'extraction du drapeau depuis le pays
3. Ajouter fallback sur `service.adresse` si `prestataire.adresse` manquant

---

## 🏷️ 4. PROBLÈME AFFICHAGE PRIX_VARIATION

### Problème identifié
Les prix_variation ne s'affichent pas dans ProductCard, même si elles sont créées dans les formulaires.

### Analyse des formulaires

#### A. FormulaireYukpoIntelligentScreen
**Fichier**: `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`

**✅ BON** : Le formulaire gère bien `price_variant` et `variabilite_prix` :
- Lignes 76-78 : Champs reconnus
- Lignes 920-922 : Détection si variation_prix existe
- Lignes 1501-1518 : Traitement spécial pour price_variant

#### B. AjouterProduitSimpleScreen
**Fichier**: `mobile/src/screens/AjouterProduitSimpleScreen.tsx`

**✅ BON** : Le formulaire transforme bien les variations :
- Lignes 773-809 : Transformation `variation_prix` → `variants` pour ProductCard
- Lignes 779-801 : Conversion modalités → variants avec prix, devise, stock

### Problème dans le backend

**Fichier**: `backend/src/services/rechercher_besoin.rs` lignes 828-846

**✅ BON** : Le backend extrait bien les variations :
```rust
if let Some(variants) = product_obj.get("variants") {
    enriched_result["has_variant"] = json!(true);
    enriched_result["variants"] = variants.clone();
}
```

**⚠️ PROBLÈME POTENTIEL** : 
- Les variations peuvent être dans `variation_prix` ou `variabilite_prix` mais le backend cherche seulement `variants`
- Le format peut être différent entre ce qui est sauvegardé et ce qui est recherché

**Corrections nécessaires** :
1. Vérifier que les variations sont bien sauvegardées dans `service.data.produits[0].variants`
2. Ajouter extraction depuis `variation_prix` et `variabilite_prix` si `variants` manquant
3. Vérifier le format des modalités lors de la sauvegarde

---

## 📊 RÉSUMÉ DES CORRECTIONS À APPLIQUER

### Priorité 1 : Performance Recherche
1. ✅ Désactiver enrichissement Google Places par défaut (ou limiter à 10 résultats)
2. ✅ Optimiser requêtes SQL dans `rechercher_besoin.rs` avec batch queries
3. ✅ Déplacer extraction données produits côté frontend si possible

### Priorité 2 : Affichage Prix
1. ✅ Améliorer extraction prix depuis multiple sources
2. ✅ Formater prix en milliers (150000 → "150 000")
3. ✅ Gérer cas prix = 0, null, undefined, string "0"

### Priorité 3 : Affichage Adresse/Drapeau
1. ✅ Vérifier transmission `prestataire.adresse` et `prestataire.pays`
2. ✅ Améliorer extraction drapeau depuis pays
3. ✅ Ajouter fallbacks multiples

### Priorité 4 : Affichage Prix_Variation
1. ✅ Vérifier sauvegarde variations dans `service.data.produits[0].variants`
2. ✅ Ajouter extraction depuis `variation_prix` et `variabilite_prix`
3. ✅ Vérifier format modalités lors sauvegarde

---

## 🚀 PROCHAINES ÉTAPES

1. **Analyser les logs backend** pour mesurer temps réel de chaque étape
2. **Appliquer corrections performance** (batch queries, désactiver Google Places)
3. **Tester affichage prix** avec différents formats de données
4. **Vérifier sauvegarde variations** dans base de données
5. **Tester end-to-end** : Création produit avec variations → Recherche → Affichage

