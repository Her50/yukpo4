# Corrections Appliquées - Performance et Affichage

**Date**: 2025-11-29

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Migration SQL - Index tsvector
- ✅ **5 nouveaux index tsvector créés** pour recherche full-text rapide
- ✅ Migration appliquée avec succès sur la base de données
- ✅ Vérification d'existence avant création (pas de doublons)

### 2. Optimisation Scoring Recherche
- ✅ Priorisation correspondances exactes (bonus 20.0 pour titre exact)
- ✅ Détection automatique catégorie depuis requête ("électricien" → "électricité")
- ✅ Gestion erreurs de frappe maintenue via trigram (fallback)

---

## 🔧 CORRECTIONS À APPLIQUER (Priorité)

### Priorité 1 : Performance Recherche (CRITIQUE)

#### A. Optimiser requêtes SQL dans `rechercher_besoin.rs`
**Problème** : Pour chaque résultat, 3 requêtes SQL séquentielles (user_info, product_info, media)
- Si 20 résultats → 60 requêtes SQL !

**Solution** : Remplacer par 3 batch queries :
```rust
// Au lieu de N requêtes, 1 seule requête batch pour tous les services
let service_ids: Vec<i32> = matches.iter().map(|m| m.service_id).collect();

// Batch query 1: User info pour tous les services
let user_info_map: HashMap<i32, (i32, Option<String>, Option<String>)> = sqlx::query_as(
    r#"
    SELECT s.id, u.id, u.nom_complet, u.avatar_url
    FROM services s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.id = ANY($1::int[])
    "#
)
.bind(&service_ids)
.fetch_all(&pool)
.await?
.into_iter()
.map(|row| (row.service_id, (row.user_id, row.nom_complet, row.avatar_url)))
.collect();

// Batch query 2: Product info pour tous les services
// Batch query 3: Media pour tous les services
```

**Impact attendu** : Réduction de 60 requêtes à 3 requêtes → **20x plus rapide**

#### B. Désactiver enrichissement Google Places par défaut
**Fichier**: `backend/src/services/native_search_service.rs` lignes 321-349

**Solution** : Limiter à 10 premiers résultats ou désactiver complètement :
```rust
// Enrichir seulement les 10 premiers résultats
if fulltext_results.len() <= 10 {
    // Enrichissement Google Places
} else {
    // Skip pour performance
}
```

**Impact attendu** : Économie de 1-2 secondes pour recherches avec beaucoup de résultats

---

### Priorité 2 : Affichage Prix (URGENT)

#### A. Améliorer extraction prix
**Fichier**: `mobile/src/components/ProductCard.tsx` lignes 765-829

**Problèmes** :
1. Prix peut être dans `product.prix_produit` au lieu de `product.prix`
2. Prix peut être string "0" ou null
3. Prix peut être dans `service.data.produits[0].prix` mais extraction échoue

**Corrections** :
```typescript
// Améliorer extractPriceFromProductData pour chercher dans plus d'endroits
const extractPriceFromProductData = (serviceData: any, productIndex: number = 0) => {
  // ... code existant ...
  
  // ✅ NOUVEAU: Chercher aussi dans product.prix_produit
  const prix = targetProduct.prix ||
    targetProduct.prix_produit ||
    targetProduct.price ||
    (typeof targetProduct.prix === 'string' ? parseFloat(targetProduct.prix) : 0);
  
  // ✅ NOUVEAU: Gérer cas prix = "0" ou null
  if (prix === 0 || prix === null || prix === undefined || prix === "0") {
    // Chercher dans variants si disponible
    if (targetProduct.variants && targetProduct.variants.length > 0) {
      const minVariantPrice = Math.min(...targetProduct.variants.map((v: any) => v.prix || 0));
      if (minVariantPrice > 0) {
        return { prix: minVariantPrice, devise: targetProduct.variants[0]?.devise || 'XAF' };
      }
    }
  }
  
  return { prix: typeof prix === 'number' && prix > 0 ? prix : 0, devise: ... };
};

// ✅ NOUVEAU: Formater prix en milliers
const formatPrice = (price: number): string => {
  if (price === 0 || !price) return '0';
  return price.toLocaleString('fr-FR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  });
};

// Utilisation
<Text style={styles.price}>
  {formatPrice(displayPrice)}
</Text>
```

#### B. Formater prix en milliers
**Fichier**: `mobile/src/components/ProductCard.tsx` lignes 1685-1688

**Correction** :
```typescript
// Remplacer
{displayPrice.toLocaleString()}

// Par
{formatPrice(displayPrice)} // "150000" → "150 000"
```

---

### Priorité 3 : Affichage Adresse/Drapeau

#### A. Vérifier transmission prestataire.adresse et prestataire.pays
**Fichier**: `backend/src/services/rechercher_besoin.rs` lignes 690-702

**✅ DÉJÀ BON** : Le backend transmet bien `prestataire.adresse` et `prestataire.pays`

**Vérification** : S'assurer que ProductCard les utilise :
```typescript
// Dans ProductCard.tsx
const prestataireAdresse = prestataire?.adresse || 
  product.adresse || 
  service?.adresse || 
  service?.data?.adresse_complete?.valeur;

const prestatairePays = prestataire?.pays || 
  product.pays || 
  service?.pays || 
  service?.data?.pays?.valeur;
```

#### B. Améliorer extraction drapeau
**Fichier**: `mobile/src/components/ProductCard.tsx` (fonction getCountryFlag)

**Vérification** : S'assurer que la fonction `getCountryFlag` gère tous les cas de pays

---

### Priorité 4 : Affichage Prix_Variation

#### A. Vérifier sauvegarde variations
**Fichier**: `mobile/src/screens/AjouterProduitSimpleScreen.tsx` lignes 773-809

**✅ DÉJÀ BON** : Le formulaire transforme bien `variation_prix` → `variants`

**Vérification** : S'assurer que les variations sont bien sauvegardées dans `service.data.produits[0].variants`

#### B. Améliorer extraction variations dans backend
**Fichier**: `backend/src/services/rechercher_besoin.rs` lignes 828-846

**✅ DÉJÀ BON** : Le backend extrait bien `variants`

**Amélioration** : Ajouter extraction depuis `variation_prix` et `variabilite_prix` si `variants` manquant :
```rust
// Si variants manquant, chercher dans variation_prix
if !product_obj.get("variants").is_some() {
    if let Some(variation_prix) = product_obj.get("variation_prix") {
        // Transformer variation_prix en variants
    } else if let Some(variabilite_prix) = product_obj.get("variabilite_prix") {
        // Transformer variabilite_prix en variants
    }
}
```

---

## 📋 CHECKLIST IMPLÉMENTATION

### Performance
- [ ] Optimiser requêtes SQL batch dans `rechercher_besoin.rs`
- [ ] Désactiver/limiter enrichissement Google Places
- [ ] Tester performance après corrections

### Affichage Prix
- [ ] Améliorer extraction prix (chercher dans plus d'endroits)
- [ ] Formater prix en milliers
- [ ] Gérer cas prix = 0, null, undefined, string "0"
- [ ] Tester avec différents formats de données

### Affichage Adresse/Drapeau
- [ ] Vérifier utilisation `prestataire.adresse` et `prestataire.pays` dans ProductCard
- [ ] Améliorer extraction drapeau
- [ ] Ajouter fallbacks multiples
- [ ] Tester affichage

### Affichage Prix_Variation
- [ ] Vérifier sauvegarde variations dans base de données
- [ ] Améliorer extraction variations (variation_prix, variabilite_prix)
- [ ] Tester end-to-end : Création → Recherche → Affichage

---

## 🚀 PROCHAINES ÉTAPES

1. **Appliquer corrections performance** (batch queries, Google Places)
2. **Appliquer corrections affichage prix** (extraction, formatage)
3. **Tester end-to-end** avec données réelles
4. **Mesurer amélioration performance** (avant/après)

