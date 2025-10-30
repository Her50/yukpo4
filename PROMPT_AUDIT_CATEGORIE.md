# Prompt d'Audit et Correction Approfondie - Catégorie Produit

## Catégorie à analyser: [NOM_CATEGORIE]

---

## Contexte
Tu es un expert React Native/TypeScript chargé d'auditer et corriger en profondeur le formulaire de création de produit pour la catégorie **[NOM_CATEGORIE]** dans le fichier `mobile/src/components/ProductManagerMobile.tsx`.

## Objectifs de l'audit

### 1. **Masquage des champs généraux (nom, description, prix)**
- ✅ Vérifier que les champs généraux `nom`, `description` générale, et `prix` global sont **masqués** pour cette catégorie
- ✅ Ces champs doivent être remplacés par des champs spécifiques dans le formulaire structuré
- ✅ Le nom du produit doit être **auto-généré** à partir du premier champ pertinent du formulaire
- ✅ La fonction `generateProductName()` doit gérer correctement cette catégorie

**Référence (catégorie agroalimentaire):**
```typescript
// Les champs généraux sont masqués si hasStructuredForm = true
const categoriesWithStructuredForms = [...]; // Doit inclure [NOM_CATEGORIE]

// Champ description visible et obligatoire
{hasStructuredForm && (
    <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Description <Text style={styles.required}>*</Text></Text>
        <NativeInput
            placeholder="Décrivez ce produit ou service..."
            value={newProduct.description || ''}
            onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
            multiline
            style={[styles.fieldInput, styles.textareaInput]}
        />
    </View>
)}

// Champ Prix visible pour catégories sans variantes/exemptées
{hasStructuredForm && (() => {
    const categoriesWithoutSimplePrice = ['pharmacie', 'hopital_clinique', 'prestation_service', 'assurance'];
    const categoriesWithVariants = ['vetement', 'chaussure', 'agroalimentaire', 'hotellerie', 'bijoux'];
    const mustHide = (selectedType && (categoriesWithoutSimplePrice.includes(selectedType) || categoriesWithVariants.includes(selectedType)));
    if (mustHide) return null;
    return (
        <View style={styles.fieldRow}>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Prix <Text style={styles.required}>*</Text></Text>
                <NativeInput
                    placeholder="0"
                    value={typeof newProduct.prix === 'number' ? String(newProduct.prix) : (newProduct.prix || '')}
                    onChangeText={(text) => setNewProduct({ ...newProduct, prix: text })}
                    keyboardType="numeric"
                />
            </View>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Devise</Text>
                <View style={styles.deviseGridContainer}>
                    {devises.map((devise) => (...))}
                </View>
            </View>
        </View>
    );
})()}
```

---

### 2. **Migration des champs listes vers sélecteurs avec ajout intuitif**
- ✅ **Tous** les champs de type liste/dropdown doivent utiliser `SelectModalitySelector`, `MultiSelectModalitySelector`, ou `ProductFieldSelector`
- ✅ Chaque sélecteur doit permettre l'ajout d'une nouvelle modalité via:
  - Bouton "+" visible et accessible
  - Modale d'ajout compatible Android/iOS (pas de `Alert.prompt` qui ne fonctionne pas sur Android)
  - Fallback hors-ligne si backend indisponible
  - **Ajout instantané** après confirmation (pas de rechargement)
- ✅ Identifier **tous** les anciens pickers/dropdowns et les remplacer
- ⚠️ **PROBLÈME CRITIQUE**: Dans de nombreuses catégories, les champs listes ne permettent PAS d'ajouter une modalité qui n'existe pas. Seule la modalité "🆕 Autre" ouvre une modale, ce qui n'est pas intuitif.
- ⚠️ **PROBLÈME CRITIQUE**: Certains champs listes ne permettent même pas de **sélectionner** une modalité existante (le clic ne fonctionne pas ou la valeur ne se met pas à jour).

**Solution obligatoire:**
- Remplacer **TOUS** les anciens sélecteurs par `SelectModalitySelector` ou `MultiSelectModalitySelector`
- Ces composants ont le bouton "+" toujours visible et une modale d'ajout robuste
- Ils gèrent aussi le fallback hors-ligne automatiquement

**Référence (catégorie agroalimentaire):**
```typescript
// Single-select
<SelectModalitySelector
    label="Catégorie"
    value={newProduct.categorieAliment || ''}
    productType="agroalimentaire"
    fieldName="categories"
    onSelect={(value) => setNewProduct({ ...newProduct, categorieAliment: value })}
    required
/>

// Multi-select
<MultiSelectModalitySelector
    label="Allergènes présents"
    values={newProduct.allergenesArray || []}
    productType="agroalimentaire"
    fieldName="allergenes"
    onSelect={(values) => setNewProduct({ ...newProduct, allergenesArray: values })}
    maxSelections={10}
/>
```

---

### 3. **Conversion forcée des champs prix en type numérique**
- ✅ **Tous** les champs de prix doivent être convertis en `number` avant sauvegarde
- ✅ Identifier tous les champs de prix de cette catégorie (ex: `prix`, `prixParNuit`, `prixHoraire`, etc.)
- ✅ Ajouter la conversion dans `handleAddProduct()` pour éviter les erreurs backend
- ⚠️ **PROBLÈME CRITIQUE BACKEND**: Le backend rejette systématiquement les services si un champ prix est envoyé en `string` au lieu de `number`
- ⚠️ **ERREUR OBSERVÉE**: `"345000" is not valid under any of the schemas listed in the 'oneOf' keyword` à `/produits/valeur/0/prix`
- ⚠️ **CONSÉQUENCE**: Erreur 500 "Données non conformes au schéma" lors de la création de service

**Champs prix à identifier pour [NOM_CATEGORIE]:**
- Liste exhaustive à compléter selon la catégorie
- **Conversion OBLIGATOIRE pour TOUS les champs prix**

**Code de conversion à appliquer:**
```typescript
const product: Product = {
    id: editingProductId || Date.now().toString(),
    type: newProduct.type || 'autre',
    nom: productName,
    // ✅ Conversion forcée en number
    prix: typeof newProduct.prix === 'string' ? parseFloat(newProduct.prix) || 0 : newProduct.prix,
    devise: newProduct.devise || 'XAF',
    description: newProduct.description,
    images: newProduct.images || [],
    videos: newProduct.videos || [],
    ...newProduct,
    // ✅ Conversion de tous les autres champs prix
    prixParNuit: newProduct.prixParNuit ? (typeof newProduct.prixParNuit === 'string' ? parseFloat(newProduct.prixParNuit) || undefined : newProduct.prixParNuit) : undefined,
    prixHoraire: newProduct.prixHoraire ? (typeof newProduct.prixHoraire === 'string' ? parseFloat(newProduct.prixHoraire) || undefined : newProduct.prixHoraire) : undefined,
    // ... ajouter tous les champs prix de la catégorie
} as Product;
```

---

### 4. **Affichage des 3 catégories suggérées intelligentes**
- ✅ Vérifier que les 3 catégories suggérées s'affichent **avant** la liste complète lors de l'ajout du premier produit
- ✅ Les suggestions doivent être triées par pertinence (confiance décroissante)
- ✅ Badge de pertinence visible (ex: "85% pertinent")

**Code de référence:**
```typescript
// Dans la section de sélection du type de produit
{suggestedTypes.length > 0 && searchQuery.length === 0 && (
    <>
        <View style={styles.suggestionsHeader}>
            <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
            <Text style={styles.suggestionsHeaderText}>
                Catégories suggérées intelligemment ({suggestedTypes.length})
            </Text>
        </View>
        {suggestedTypes.map((type) => renderTypeItem(type, true))}

        {otherTypes.length > 0 && (
            <View style={styles.suggestionsHeader}>
                <SafeIcon name="list" size={16} color={modernColors.textSecondary} />
                <Text style={[styles.suggestionsHeaderText, { color: modernColors.textSecondary }]}>
                    Toutes les catégories ({otherTypes.length})
                </Text>
            </View>
        )}
        {otherTypes.map((type) => renderTypeItem(type, false))}
    </>
)}
```

---

### 5. **Gestion des variantes et devise globale**
- ✅ Si la catégorie utilise des variantes (ex: tailles, couleurs, conditionnements), vérifier:
  - Devise globale affichée **avant** le gestionnaire de variantes
  - Devise globale appliquée automatiquement à toutes les variantes
  - Conversion de tous les prix de variantes en `number`

**Référence:**
```typescript
// Devise globale pour les variantes
<View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>💱 Devise globale <Text style={styles.required}>*</Text></Text>
    <Text style={styles.fieldHint}>Cette devise s'appliquera à tous les prix des variantes ci-dessous</Text>
    <View style={styles.deviseGridContainer}>
        {devises.map((devise) => (...))}
    </View>
</View>

<ProductVariantManager
    variants={newProduct.variants || []}
    onChange={(variants) => {
        const variantsWithGlobalDevise = variants.map(v => ({
            ...v,
            devise: newProduct.devise || 'XAF'
        }));
        setNewProduct({ ...newProduct, variants: variantsWithGlobalDevise });
    }}
    globalDevise={newProduct.devise || 'XAF'}
    productType="[NOM_CATEGORIE]"
/>
```

---

### 6. **Amélioration UX et mise en forme**
- ✅ Sections visuellement séparées avec en-têtes clairs (icône + titre)
- ✅ Champs regroupés logiquement par `fieldRow` (2 champs côte à côte)
- ✅ Labels clairs avec astérisque rouge pour champs obligatoires
- ✅ Hints/conseils visibles dans des boîtes `hintBox`
- ✅ Toggles/switches pour champs booléens
- ✅ Dates avec `NativeDatePicker`, heures avec `NativeTimePicker`

**Structure UX de référence:**
```typescript
{/* Section 1: Titre clair */}
<View style={styles.sectionHeader}>
    <SafeIcon name="package" size={20} color={modernColors.primary} />
    <Text style={styles.sectionTitle}>Informations Produit</Text>
</View>

{/* Champs en ligne (2 par ligne) */}
<View style={styles.fieldRow}>
    <View style={[styles.fieldContainer, { flex: 1 }]}>
        <SelectModalitySelector label="Type" ... />
    </View>
    <View style={[styles.fieldContainer, { flex: 1 }]}>
        <SelectModalitySelector label="Catégorie" ... />
    </View>
</View>

{/* Hint box */}
<View style={styles.hintBox}>
    <SafeIcon name="info" size={14} color={modernColors.primary} />
    <Text style={styles.hintText}>
        💡 <Text style={styles.hintBold}>Conseil :</Text> Ajoutez des photos de qualité
    </Text>
</View>

{/* Toggle pour booléen */}
<View style={styles.togglesContainer}>
    <TouchableOpacity
        style={[styles.toggleOption, newProduct.bio && styles.toggleOptionActive]}
        onPress={() => setNewProduct({ ...newProduct, bio: !newProduct.bio })}
    >
        <SafeIcon name="leaf" size={20} color={newProduct.bio ? modernColors.primary : '#9CA3AF'} />
        <Text style={[styles.toggleLabel, newProduct.bio && styles.toggleLabelActive]}>
            Agriculture biologique
        </Text>
    </TouchableOpacity>
</View>
```

---

## Checklist d'audit pour [NOM_CATEGORIE]

### ✅ Masquage champs généraux
- [ ] Catégorie incluse dans `categoriesWithStructuredForms`
- [ ] Champs `nom`, `prix` global masqués
- [ ] Champ `description` visible et obligatoire
- [ ] Fonction `generateProductName()` gère cette catégorie
- [ ] Champ `prix` affiché si pas de variantes et pas exempté

### ✅ Sélecteurs avec ajout de modalité
- [ ] Tous les champs listes identifiés (EXHAUSTIF - ne pas en oublier)
- [ ] Remplacés par `SelectModalitySelector` ou `MultiSelectModalitySelector`
- [ ] `productType` et `fieldName` corrects pour chaque sélecteur
- [ ] Anciens pickers/dropdowns supprimés (vérifier qu'il n'en reste AUCUN)
- [ ] **Test ajout modalité**: Bouton "+" visible et fonctionnel
- [ ] **Test sélection modalité**: Cliquer sur une modalité met bien à jour la valeur
- [ ] **Test modale**: S'ouvre correctement sur Android ET iOS
- [ ] **Test fallback**: Ajout fonctionne même si backend indisponible

### ✅ Conversion prix en number
- [ ] Tous les champs prix identifiés
- [ ] Conversion ajoutée dans `handleAddProduct()`
- [ ] Conversion dans variantes si applicable
- [ ] Test: backend accepte sans erreur "oneOf"

### ✅ Suggestions intelligentes
- [ ] Suggestions affichées en premier
- [ ] Badge de pertinence visible
- [ ] Tri par confiance décroissante

### ✅ Variantes (si applicable)
- [ ] Devise globale affichée avant variantes
- [ ] Devise appliquée automatiquement
- [ ] Prix variantes convertis en number

### ✅ UX et mise en forme
- [ ] Sections avec en-têtes clairs
- [ ] Champs regroupés logiquement
- [ ] Labels clairs avec astérisques
- [ ] Hints/conseils visibles
- [ ] Composants natifs (dates, heures)
- [ ] Toggles pour booléens

---

## Instructions d'exécution

1. **Localiser** le formulaire de la catégorie `[NOM_CATEGORIE]` dans `ProductManagerMobile.tsx` (chercher `case '[NOM_CATEGORIE]':`)
2. **Auditer** point par point selon la checklist ci-dessus
3. **Appliquer** toutes les corrections nécessaires en suivant les références fournies
4. **Vérifier** les lints avec `read_lints` sur le fichier modifié
5. **Tester** mentalement:
   - Masquage champs généraux ✓
   - Ajout modalité dans champs listes ✓
   - Conversion prix en number ✓
   - Affichage suggestions ✓
   - UX et mise en forme ✓

6. **Résumer** les modifications apportées dans un document markdown

---

## Notes importantes

- **Ne pas supprimer** de champs existants, seulement remplacer les anciens pickers
- **Conserver** la logique métier spécifique à la catégorie
- **Ajouter** les conversions de prix sans casser les données existantes
- **Tester** que le formulaire compile sans erreur TypeScript
- **Documenter** les champs prix spécifiques à cette catégorie

## Problèmes critiques récurrents à corriger ABSOLUMENT

### 🚨 Problème #1: Champs listes sans ajout de modalité
**Symptôme**: L'utilisateur ne peut pas ajouter une nouvelle modalité qui n'existe pas dans la liste.
**Cause**: Utilisation d'anciens composants Picker ou View+TouchableOpacity sans intégration du bouton "+".
**Solution**: Remplacer par `SelectModalitySelector` qui a le bouton "+" intégré.

### 🚨 Problème #2: Impossibilité de sélectionner une modalité
**Symptôme**: L'utilisateur clique sur une modalité mais elle ne se sélectionne pas.
**Cause**: Handler `onPress` mal configuré ou `value`/`onSelect` non synchronisés.
**Solution**: Utiliser `SelectModalitySelector` avec `value` et `onSelect` correctement liés au state.

### 🚨 Problème #3: Erreur 500 "Données non conformes au schéma"
**Symptôme**: Le backend rejette le service avec l'erreur `"345000" is not valid under any of the schemas listed in the 'oneOf' keyword`.
**Cause**: Les champs prix sont envoyés en `string` au lieu de `number`.
**Solution**: Conversion forcée de TOUS les champs prix en `number` dans `handleAddProduct()` et dans les variantes.

**Code de détection des anciens sélecteurs à remplacer:**
```typescript
// ❌ MAUVAIS - À remplacer
<Picker
    selectedValue={newProduct.typeX}
    onValueChange={(value) => setNewProduct({ ...newProduct, typeX: value })}
>
    <Picker.Item label="Option 1" value="opt1" />
</Picker>

// ❌ MAUVAIS - À remplacer
<TouchableOpacity onPress={() => { /* ouvre une modale custom */ }}>
    <Text>{newProduct.typeX || 'Sélectionner...'}</Text>
</TouchableOpacity>

// ✅ BON - Utiliser ceci
<SelectModalitySelector
    label="Type"
    value={newProduct.typeX || ''}
    productType="[NOM_CATEGORIE]"
    fieldName="types"
    onSelect={(value) => setNewProduct({ ...newProduct, typeX: value })}
    required
/>
```

---

## Fichiers à modifier

- `mobile/src/components/ProductManagerMobile.tsx` (principal)
- Potentiellement: `mobile/src/data/productModalities.ts` (si nouvelles modalités à ajouter)

---

**Catégorie en cours: [NOM_CATEGORIE]**
**Date d'audit: [DATE]**
**Auditeur: Assistant IA**

