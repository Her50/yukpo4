# 🎯 PROMPT MODÈLE - Améliorations en Profondeur ProductManagerMobile

## 📋 Contexte du Projet

**Backend**: Rust avec Axum, SQLx, PostgreSQL, pgvector  
**Frontend**: React avec TypeScript, TailwindCSS  
**Mobile**: React Native (Expo SDK 52, React Native 0.76.9) avec TypeScript, TailwindCSS  
**Base de données**: PostgreSQL avec extensions pgvector et imgsmlr  

## 📚 Documents de Référence OBLIGATOIRES

Avant de commencer, LIRE EN ENTIER ces documents dans le workspace :

1. **`mobile/AMELIORATIONS_PRODUCT_MANAGER.md`** - Plan d'améliorations initial
2. **`mobile/RESUME_AMELIORATIONS_PRODUCT_MANAGER.md`** - Résumé des améliorations déjà appliquées (partiellement)
3. **`mobile/src/components/ProductManagerMobile.tsx`** - Fichier principal à modifier (18 000+ lignes)
4. **`backend/src/schemas/service_schema.json`** - Schéma de validation backend
5. **`mobile/src/data/productModalities.ts`** - Données des modalités par catégorie

## 🎯 MISSION PRINCIPALE

Appliquer en **profondeur et dans TOUTES les catégories** les améliorations suivantes :

### ✅ Amélioration 1 : Masquer les champs généraux pour catégories organisées

**État actuel** : Seulement `vetement`, `chaussure`, `hotellerie` ont cette amélioration

**À faire** :
- Identifier TOUTES les catégories qui utilisent des systèmes de variabilités organisées (pas seulement les variantes, mais aussi les sections structurées avec multiples champs organisés)
- Masquer les champs `nom`, `description`, `prix` globaux pour ces catégories
- Ajouter un message informatif expliquant que les informations seront dans les sections organisées

**Catégories à vérifier (liste non exhaustive)** :
- `agroalimentaire` (variantes de conditionnement)
- `bijoux` (variantes avec images)
- `immobilier_location_courte` (champs organisés en sections)
- Toute catégorie avec `ProductVariantManager`, `ChaussureVariantManager`, `HotelVariantManager`, ou système de variantes similaire

**Fichier** : `mobile/src/components/ProductManagerMobile.tsx` (lignes ~16764-16873)

---

### ✅ Amélioration 2 : Devise globale pour toutes les sections avec prix variables

**État actuel** : Seulement `vetement`, `chaussure`, `hotellerie` ont cette amélioration

**À faire** :
- Identifier TOUTES les catégories avec sections organisées contenant des champs de prix multiples
- Ajouter un champ "Devise globale" en haut de chaque section avec prix variables
- Modifier les composants de variantes pour utiliser `globalDevise` :
  - `ProductVariantManager.tsx` ✅ (déjà fait)
  - `ChaussureVariantManager.tsx` ✅ (déjà fait)
  - `HotelVariantManager.tsx` ✅ (déjà fait)
  - Tous autres composants similaires

**Catégories à vérifier** :
- `agroalimentaire` : Si utilise `ProductVariantManager`
- `bijoux` : Si utilise `ProductVariantManager` avec prix
- Toute catégorie avec des sections contenant plusieurs champs prix

**Fichiers** :
- `mobile/src/components/ProductManagerMobile.tsx` (sections avec variabilités)
- Composants de variantes individuels

---

### ✅ Amélioration 3 : Améliorer l'affichage des variabilités (FlatList + scroll amélioré)

**État actuel** : Seulement `ProductVariantManager`, `ChaussureVariantManager`, `HotelVariantManager` ont cette amélioration

**À faire** :
- Vérifier TOUS les composants qui affichent des listes de variabilités/variantes
- Remplacer `ScrollView` par `FlatList` pour meilleures performances
- Augmenter `maxHeight` selon le nombre de champs par variabilité
- Activer `showsVerticalScrollIndicator={true}` et `nestedScrollEnabled={true}`

**Composants à vérifier** :
- `ProductVariantManager.tsx` ✅ (déjà fait)
- `ChaussureVariantManager.tsx` ✅ (déjà fait)
- `HotelVariantManager.tsx` ✅ (déjà fait)
- Tous autres composants affichant des listes de variabilités dans `ProductManagerMobile.tsx`

---

### ✅ Amélioration 4 : Interface améliorée pour ajouter des modalités

**État actuel** : Seulement `SelectModalitySelector.tsx` a cette amélioration

**À faire** :
- Vérifier que `SelectModalitySelector` est utilisé partout où nécessaire ✅ (déjà fait)
- Le bouton "+" devrait être visible partout où des modalités peuvent être ajoutées

---

## 🆕 NOUVELLES AMÉLIORATIONS À IMPLÉMENTER

### 🔥 Amélioration 5 : Priorisation géographique des produits dans les listes déroulantes

**Problème** : Un prestataire ivoirien voit des produits camerounais en premier dans les listes, et vice-versa.

**Solution à implémenter** :
1. **Récupérer la zone géographique de l'utilisateur** :
   - Depuis le GPS mobile si disponible
   - Depuis les paramètres utilisateur (pays/ville configurés)
   - Depuis l'API backend (endpoint à créer si nécessaire)

2. **Filtrer et trier les options de modalités** :
   - Les produits/options de la zone de l'utilisateur apparaissent en premier
   - Les produits/options d'autres zones apparaissent après
   - Ajouter un indicateur visuel (badge 🇨🇲 / 🇨🇮 / etc.) pour identifier la zone

3. **Catégories concernées** (toutes celles avec listes déroulantes) :
   - Tous les `SelectModalitySelector`
   - Tous les `ProductFieldSelector`
   - Toutes les listes de produits nommés (ex: noms d'articles, noms de produits)

**Fichiers à modifier** :
- `mobile/src/components/SelectModalitySelector.tsx`
- `mobile/src/components/ProductFieldSelector.tsx` (si existe)
- `mobile/src/services/modalityService.ts` (ajouter filtrage géographique)
- Backend : Créer/modifier endpoints pour récupérer zone utilisateur

**Structure de données à prévoir** :
```typescript
interface ModalityOption {
    value: string;
    label: string;
    zone?: string; // 'CM', 'CI', 'SN', etc.
    usageCount?: number;
    priority?: number; // Calculé selon zone utilisateur
}
```

---

### 🔥 Amélioration 6 : Remplacer GPS textuel par composant GPS dans location courte durée

**Problème** : Dans `immobilier_location_courte`, le champ GPS est textuel alors qu'un composant GPS moderne existe.

**État actuel** :
- Ligne ~4460-4466 : Champ texte simple pour `gpsImmobilier`
- Le composant `ModernGPSModal` existe et fonctionne (utilisé dans `immobilier_batiment`)

**Solution à implémenter** :
1. **Remplacer le champ texte** par le composant `ModernGPSModal`
2. **Utiliser la même logique** que dans `immobilier_batiment` (lignes ~3926-3943)
3. **S'assurer que le GPS est bien sauvegardé** dans `newProduct.gpsImmobilier`

**Code de référence** (immobilier_batiment) :
```typescript
// Lignes ~3926-3943 dans ProductManagerMobile.tsx
<View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>📍 Localisation GPS</Text>
    <TouchableOpacity
        style={styles.gpsButton}
        onPress={() => setShowGPSModal(true)}
    >
        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
        <Text style={styles.gpsButtonText}>
            {newProduct.gpsImmobilier ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
        </Text>
    </TouchableOpacity>
    {newProduct.gpsImmobilier && (
        <View style={styles.gpsInfoBox}>
            <Text style={styles.gpsInfoText}>
                Position enregistrée : {newProduct.gpsImmobilier}
            </Text>
        </View>
    )}
</View>
```

**Fichier à modifier** :
- `mobile/src/components/ProductManagerMobile.tsx` (case `immobilier_location_courte`, lignes ~4460-4466)

---

### 🔥 Amélioration 7 : Charger des données logiques pour les champs listes vides

**Problème** : Certaines catégories ont des champs listes vides (pas de données de base).

**Solution à implémenter** :
1. **Identifier toutes les catégories avec listes vides** :
   - Examiner chaque case dans `renderSpecificFields()`
   - Vérifier les appels à `SelectModalitySelector` et `ProductFieldSelector`
   - Vérifier `productModalities.ts` pour voir quelles catégories/fields sont vides

2. **Remplir avec des données logiques** :
   - Créer des listes de base réalistes pour chaque catégorie
   - Utiliser des données locales (Cameroun, Côte d'Ivoire, Sénégal, etc.)
   - Ajouter dans `mobile/src/data/productModalities.ts`

3. **Exemples de catégories à vérifier** :
   - Toutes les catégories existantes dans `PRODUCT_TYPES`
   - Vérifier chaque `fieldName` utilisé dans les sélecteurs

**Fichiers à modifier** :
- `mobile/src/data/productModalities.ts` - Ajouter données manquantes
- `mobile/src/components/ProductManagerMobile.tsx` - Vérifier que tous les champs ont des options

**Structure attendue** :
```typescript
// Dans productModalities.ts
export function getFieldOptions(productType: string, fieldName: string): string[] {
    const options = modalitiesData[productType]?.[fieldName] || [];
    // Si vide, retourner liste de base logique
    if (options.length === 0) {
        return getDefaultOptionsForField(productType, fieldName);
    }
    return options;
}
```

---

## 📝 Instructions Techniques

### Ordre d'exécution recommandé

1. **Phase 1** : Appliquer améliorations 1-4 à toutes les catégories concernées
2. **Phase 2** : Implémenter amélioration 5 (priorisation géographique)
3. **Phase 3** : Implémenter amélioration 6 (GPS modal pour location courte durée)
4. **Phase 4** : Implémenter amélioration 7 (remplir listes vides)

### Méthodologie

1. **Lister toutes les catégories** dans `PRODUCT_TYPES` (ligne ~1368)
2. **Pour chaque catégorie** :
   - Examiner le case dans `renderSpecificFields()`
   - Identifier si elle a des variabilités organisées
   - Identifier si elle a des sections avec prix variables
   - Identifier si elle a des listes vides
3. **Appliquer les améliorations** de manière systématique
4. **Tester chaque catégorie** modifiée

### Vérifications obligatoires

- ✅ Aucune erreur de linting après modifications
- ✅ Tous les imports sont corrects
- ✅ Les types TypeScript sont cohérents
- ✅ Les composants existants ne sont pas cassés
- ✅ Le schéma backend est respecté

### Structure du code à respecter

- Utiliser les mêmes patterns que dans les améliorations déjà faites
- Suivre les règles de développement du projet (voir règles repo)
- Commenter les changements avec `// ✅ NOUVEAU:` ou `// ✅ AMÉLIORATION:`

---

## 🔍 Références de Code

### Code de référence pour amélioration 1 (masquer champs généraux)
```typescript
// Lignes 16721-16873 dans ProductManagerMobile.tsx
{currentStep === 'form' && selectedType && (() => {
    const categoriesWithOrganizedVariants = ['vetement', 'chaussure', 'hotellerie'];
    const hasOrganizedVariants = categoriesWithOrganizedVariants.includes(selectedType);
    
    return (
        <View style={styles.stepContainer}>
            {!hasOrganizedVariants && (
                // Champs nom, description, prix
            )}
            {hasOrganizedVariants && (
                // Message informatif
            )}
        </View>
    );
})()}
```

### Code de référence pour amélioration 2 (devise globale)
```typescript
// Voir lignes 6701-6724 (vetement), 7486-7509 (chaussure), 6309-6332 (hotellerie)
<View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>💱 Devise globale <Text style={styles.required}>*</Text></Text>
    <Text style={styles.fieldHint}>Cette devise s'appliquera à tous les prix des variantes ci-dessous</Text>
    <View style={styles.deviseGridContainer}>
        {devises.map((devise) => (
            // Boutons devise
        ))}
    </View>
</View>
```

### Code de référence pour amélioration 3 (FlatList)
```typescript
// Voir ProductVariantManager.tsx lignes 185-321
<View style={styles.variantsContainer}>
    <FlatList
        data={variants}
        keyExtractor={(item) => item.id}
        renderItem={({ item: variant, index }) => (
            // Rendu variante
        )}
        style={styles.variantsList}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        contentContainerStyle={{ paddingBottom: 20 }}
    />
</View>
```

### Code de référence pour amélioration 4 (bouton modalité)
```typescript
// Voir SelectModalitySelector.tsx lignes 172-255
<View style={styles.selectorRow}>
    <TouchableOpacity style={styles.selector} onPress={() => setShowModal(true)}>
        {/* Sélecteur */}
    </TouchableOpacity>
    <TouchableOpacity style={styles.addModalityButton} onPress={...}>
        <SafeIcon name="plus-circle" size={20} color={modernColors.primary} />
    </TouchableOpacity>
</View>
```

### Code de référence pour amélioration 5 (priorisation géographique)
```typescript
// À implémenter dans modalityService.ts ou SelectModalitySelector.tsx
const getUserZone = async () => {
    // Récupérer zone depuis GPS, settings, ou API
    // Retourner 'CM', 'CI', 'SN', etc.
};

const sortOptionsByZone = (options: string[], userZone: string) => {
    // Trier options pour mettre celles de userZone en premier
    // Ajouter badges visuels 🇨🇲 🇨🇮 🇸🇳
};
```

### Code de référence pour amélioration 6 (GPS modal)
```typescript
// Voir lignes ~3926-3943 (immobilier_batiment)
<View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>📍 Localisation GPS</Text>
    <TouchableOpacity
        style={styles.gpsButton}
        onPress={() => setShowGPSModal(true)}
    >
        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
        <Text style={styles.gpsButtonText}>
            {newProduct.gpsImmobilier ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
        </Text>
    </TouchableOpacity>
    {newProduct.gpsImmobilier && (
        <View style={styles.gpsInfoBox}>
            <Text style={styles.gpsInfoText}>
                Position enregistrée : {newProduct.gpsImmobilier}
            </Text>
        </View>
    )}
</View>

// Et en bas du composant :
<ModernGPSModal
    visible={showGPSModal}
    onClose={() => setShowGPSModal(false)}
    onSelect={(coordinatesString) => {
        setNewProduct({ ...newProduct, gpsImmobilier: coordinatesString });
        setShowGPSModal(false);
    }}
    currentLocation={selectedGPSLocation}
/>
```

---

## ⚠️ Points d'Attention

1. **Ne pas casser l'existant** : Tester chaque catégorie après modification
2. **Respecter le schéma backend** : Vérifier `service_schema.json` avant validation
3. **Cohérence avec frontend** : S'assurer que les structures de données correspondent
4. **Performance** : Utiliser `FlatList` pour longues listes, pas `ScrollView` avec `map()`
5. **Accessibilité** : Les champs obligatoires doivent être clairement identifiés

---

## 📋 Checklist Finale

Avant de considérer la tâche terminée :

- [ ] Toutes les catégories avec variabilités organisées ont les champs généraux masqués
- [ ] Toutes les sections avec prix variables ont une devise globale
- [ ] Tous les composants de variantes utilisent `FlatList` avec scroll amélioré
- [ ] Le bouton "+" pour ajouter modalités est visible partout
- [ ] La priorisation géographique fonctionne dans toutes les listes
- [ ] Le GPS modal remplace tous les champs GPS textuels
- [ ] Toutes les listes vides ont été remplies avec des données logiques
- [ ] Aucune erreur de linting
- [ ] Tests manuels effectués sur au moins 5 catégories différentes

---

## 🚀 Commencer par

1. Lire `mobile/AMELIORATIONS_PRODUCT_MANAGER.md`
2. Lire `mobile/RESUME_AMELIORATIONS_PRODUCT_MANAGER.md`
3. Examiner `mobile/src/components/ProductManagerMobile.tsx` pour comprendre la structure
4. Lister toutes les catégories dans `PRODUCT_TYPES`
5. Pour chaque catégorie, vérifier si elle nécessite les améliorations
6. Appliquer les améliorations de manière systématique

---

**IMPORTANT** : Ce prompt doit être utilisé dans un NOUVEAU CHAT pour appliquer ces améliorations en profondeur dans toutes les catégories du système.

