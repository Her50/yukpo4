# Analyse des Erreurs - Création de Vidéo

## Date
2025-11-27

## Vue d'ensemble
Analyse des problèmes d'affichage dans la création de vidéo :
1. Affichage JSON brut dans la sélection de produit
2. Étapes de création de vidéo n'affichant aucun contenu

---

## 🔴 PROBLÈME 1 : Affichage JSON brut dans sélection produit

### Description
Dans le modal "Sélectionner un produit", certains produits affichent du JSON brut au lieu du nom formaté :
- `{"valeur": "Hôpital/Clinique", "type_donnee": "string", "origine_champs": "formulaire"}`
- `{"valeur": "Services de photographie professionnelle", "type_donnee": "string", "origine_champs": "ia"}`

### Cause identifiée
**Fichier :** `mobile/src/components/ServiceProductSelector.tsx` (ligne 156)

```typescript
<Text style={styles.productName}>
    {product.productName}  // ❌ PROBLÈME: Affiche directement sans extraction
</Text>
```

**Problème :**
- `product.productName` peut contenir un objet JSON au lieu d'une chaîne
- Aucune extraction depuis format structuré `{valeur: "...", type_donnee: "..."}`
- Aucune protection contre affichage JSON brut

### Solution
Créer une fonction helper pour extraire la valeur string depuis différents formats :

```typescript
// Ajouter au début du fichier
const extractProductName = (productName: any): string => {
    if (!productName) return 'Produit sans nom';
    
    // Si c'est déjà une chaîne valide
    if (typeof productName === 'string') {
        // Éviter d'afficher des objets JSON stringifiés
        if (productName.trim().startsWith('{') || productName.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(productName.trim());
                if (typeof parsed === 'object' && parsed !== null) {
                    // Si c'est un objet structuré, extraire la valeur
                    if ('valeur' in parsed && typeof parsed.valeur === 'string') {
                        return parsed.valeur.trim() || 'Produit sans nom';
                    }
                    // Sinon, ne pas afficher l'objet
                    return 'Produit sans nom';
                }
            } catch {
                // Ce n'est pas du JSON valide, retourner tel quel
            }
        }
        return productName.trim() || 'Produit sans nom';
    }
    
    // Si c'est un objet structuré
    if (typeof productName === 'object' && productName !== null) {
        if ('valeur' in productName && typeof productName.valeur === 'string') {
            return productName.valeur.trim() || 'Produit sans nom';
        }
        // Éviter d'afficher [object Object]
        return 'Produit sans nom';
    }
    
    return String(productName) || 'Produit sans nom';
};

// Utiliser dans l'affichage
<Text style={styles.productName}>
    {extractProductName(product.productName)}
</Text>
```

**Fichier à modifier :** `mobile/src/components/ServiceProductSelector.tsx`

---

## 🔴 PROBLÈME 2 : Étapes de création vidéo sans contenu

### Description
Les étapes de création de vidéo n'affichent aucun contenu, seulement les boutons "Suivant", "Précédent", etc. Seule la page de sélection de produit s'affiche correctement.

### Cause identifiée
**Fichier :** `mobile/src/components/ProductVideoCreationModal.tsx`

**Analyse :**
- Le modal affiche tout dans un `ScrollView` avec des sections conditionnelles
- Les sections s'affichent uniquement si `selectedProduct` est défini (ligne 1432)
- Si `selectedProduct` est null, seule la sélection de produit s'affiche

**Problèmes possibles :**
1. `selectedProduct` n'est pas correctement défini après sélection
2. Les conditions d'affichage des sections sont trop restrictives
3. Les données nécessaires (coachPanel, media, etc.) ne sont pas chargées

### Solution

#### Solution 1 : Vérifier que selectedProduct est défini
```typescript
// Ligne 1228 - Vérifier que le produit est bien sélectionné
onPress={() => {
    console.log('[ProductVideoCreationModal] Produit sélectionné:', product);
    setSelectedProduct(product);
    // ✅ AJOUTER: Vérifier que le produit est bien défini
    if (!product || !product.nom) {
        console.error('[ProductVideoCreationModal] Produit invalide:', product);
        Alert.alert('Erreur', 'Le produit sélectionné est invalide');
        return;
    }
}}
```

#### Solution 2 : Améliorer l'affichage conditionnel
```typescript
// Ligne 1432 - Améliorer la condition
{selectedProduct && (
    <>
        {/* ✅ AJOUTER: Debug pour vérifier que selectedProduct est défini */}
        {console.log('[ProductVideoCreationModal] selectedProduct:', selectedProduct)}
        
        {/* ✅ AJOUTER: Message si produit invalide */}
        {!selectedProduct.nom && !selectedProduct.nom_produit && (
            <NativeCard style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>⚠️ Produit invalide</Text>
                <Text style={styles.sectionSubtitle}>
                    Le produit sélectionné n'a pas de nom. Veuillez sélectionner un autre produit.
                </Text>
            </NativeCard>
        )}
        
        {/* Sections normales */}
        <NativeCard style={styles.sectionCard}>
            {/* ... */}
        </NativeCard>
    </>
)}
```

#### Solution 3 : Vérifier que coachPanel est défini
```typescript
// Ligne 1430 - Vérifier coachPanel
{coachPanel && coachPanel}  // ✅ S'assurer que coachPanel est défini
```

#### Solution 4 : Ajouter logs de debug
```typescript
// Ajouter au début du render
useEffect(() => {
    console.log('[ProductVideoCreationModal] État actuel:', {
        visible,
        selectedProduct: selectedProduct ? {
            id: selectedProduct.id,
            nom: selectedProduct.nom,
            nom_produit: selectedProduct.nom_produit,
            serviceId: selectedProduct.serviceId
        } : null,
        productsCount: products.length,
        coachPanelExists: !!coachPanel,
        mediaCount: productMedia.length + serviceMedia.length
    });
}, [visible, selectedProduct, products, coachPanel, productMedia, serviceMedia]);
```

**Fichier à modifier :** `mobile/src/components/ProductVideoCreationModal.tsx`

---

## 📋 CHECKLIST DES CORRECTIONS

### Corrections Critiques
- [ ] **1.1** Créer fonction `extractProductName` dans ServiceProductSelector
- [ ] **1.2** Appliquer `extractProductName` dans l'affichage productName
- [ ] **1.3** Tester avec différents formats de données
- [ ] **2.1** Vérifier que selectedProduct est correctement défini
- [ ] **2.2** Ajouter logs de debug pour diagnostiquer
- [ ] **2.3** Améliorer conditions d'affichage des sections
- [ ] **2.4** Vérifier que coachPanel est défini et s'affiche
- [ ] **2.5** Vérifier que les médias sont chargés

---

## 🔧 CODE DE CORRECTION DÉTAILLÉ

### Correction 1 : ServiceProductSelector - Extraction nom produit

```typescript
// AVANT (ligne 156)
<Text style={styles.productName}>
    {product.productName}
</Text>

// APRÈS
// Ajouter fonction helper au début du fichier (après les imports)
const extractProductName = (productName: any): string => {
    if (!productName) return 'Produit sans nom';
    
    // Si c'est déjà une chaîne valide
    if (typeof productName === 'string') {
        const trimmed = productName.trim();
        
        // Éviter d'afficher des objets JSON stringifiés
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'object' && parsed !== null) {
                    // Si c'est un objet structuré, extraire la valeur
                    if ('valeur' in parsed && typeof parsed.valeur === 'string') {
                        return parsed.valeur.trim() || 'Produit sans nom';
                    }
                    // Sinon, ne pas afficher l'objet
                    return 'Produit sans nom';
                }
            } catch {
                // Ce n'est pas du JSON valide, retourner tel quel
            }
        }
        return trimmed || 'Produit sans nom';
    }
    
    // Si c'est un objet structuré
    if (typeof productName === 'object' && productName !== null) {
        if ('valeur' in productName && typeof productName.valeur === 'string') {
            return productName.valeur.trim() || 'Produit sans nom';
        }
        // Éviter d'afficher [object Object]
        return 'Produit sans nom';
    }
    
    return String(productName) || 'Produit sans nom';
};

// Utiliser dans l'affichage (ligne 156)
<Text style={styles.productName}>
    {extractProductName(product.productName)}
</Text>
```

### Correction 2 : ProductVideoCreationModal - Debug et amélioration affichage

```typescript
// AVANT (ligne 1228)
onPress={() => {
    console.log('[ProductVideoCreationModal] Produit sélectionné:', product);
    setSelectedProduct(product);
}}

// APRÈS
onPress={() => {
    console.log('[ProductVideoCreationModal] Produit sélectionné:', product);
    
    // ✅ CORRIGÉ: Vérifier que le produit est valide
    if (!product) {
        console.error('[ProductVideoCreationModal] Produit null/undefined');
        Alert.alert('Erreur', 'Le produit sélectionné est invalide');
        return;
    }
    
    // ✅ CORRIGÉ: Normaliser le produit si nécessaire
    const normalizedProduct = {
        ...product,
        nom: product.nom || product.nom_produit || 'Produit sans nom',
        nom_produit: product.nom_produit || product.nom || 'Produit sans nom'
    };
    
    setSelectedProduct(normalizedProduct);
    console.log('[ProductVideoCreationModal] Produit normalisé:', normalizedProduct);
}}
```

```typescript
// AVANT (ligne 1432)
{selectedProduct && (
    <>
        <NativeCard style={styles.sectionCard}>
            {/* ... */}
        </NativeCard>
    </>
)}

// APRÈS
{selectedProduct && (
    <>
        {/* ✅ AJOUTER: Debug */}
        {__DEV__ && console.log('[ProductVideoCreationModal] Rendering avec selectedProduct:', {
            id: selectedProduct.id,
            nom: selectedProduct.nom,
            nom_produit: selectedProduct.nom_produit,
            serviceId: selectedProduct.serviceId
        })}
        
        {/* ✅ AJOUTER: Message si produit invalide */}
        {!selectedProduct.nom && !selectedProduct.nom_produit && (
            <NativeCard style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>⚠️ Produit invalide</Text>
                <Text style={styles.sectionSubtitle}>
                    Le produit sélectionné n'a pas de nom. Veuillez sélectionner un autre produit.
                </Text>
            </NativeCard>
        )}
        
        {/* Sections normales */}
        <NativeCard style={styles.sectionCard}>
            {/* ... */}
        </NativeCard>
    </>
)}
```

---

## 🧪 TESTS À EFFECTUER

1. **Test sélection produit avec JSON brut**
   - Créer un produit avec nom dans format `{valeur: "...", type_donnee: "string"}`
   - Vérifier que le nom s'affiche correctement dans le modal

2. **Test sélection produit avec nom string**
   - Créer un produit avec nom string normal
   - Vérifier que le nom s'affiche correctement

3. **Test étapes création vidéo**
   - Sélectionner un produit
   - Vérifier que toutes les sections s'affichent
   - Vérifier que coachPanel s'affiche
   - Vérifier que les médias s'affichent

4. **Test avec produit invalide**
   - Sélectionner un produit sans nom
   - Vérifier que le message d'erreur s'affiche

---

## 📝 NOTES

- Les corrections préservent la compatibilité avec les anciens formats
- Les fonctions helper peuvent être réutilisées ailleurs
- Les corrections sont défensives (gèrent tous les cas)
- Les logs de debug sont utiles pour diagnostiquer les problèmes

---

## 🔍 FICHIERS À MODIFIER

1. `mobile/src/components/ServiceProductSelector.tsx`
   - Ajouter fonction `extractProductName`
   - Appliquer dans l'affichage

2. `mobile/src/components/ProductVideoCreationModal.tsx`
   - Améliorer sélection produit
   - Ajouter logs de debug
   - Améliorer conditions d'affichage

