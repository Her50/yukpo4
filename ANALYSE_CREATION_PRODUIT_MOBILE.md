# 📦 Analyse Détaillée du Processus de Création de Produit - Mobile

## 🎯 Vue d'ensemble

Le processus de création de produit dans l'application mobile Yukpomnang suit **deux chemins principaux** selon le contexte :

1. **Création complète** : Service + Premier produit (via `FormulaireYukpoIntelligentScreen`)
2. **Ajout simple** : Produit à un service existant (via `AjouterProduitSimpleScreen`)

---

## 🔄 FLUX PRINCIPAL : Depuis HomeScreen

### Point d'entrée : `HomeScreen.tsx`

**Fichier** : `mobile/src/screens/HomeScreen.tsx`

#### 1. Détection du mode de création

```typescript:640:664:mobile/src/screens/HomeScreen.tsx
// Ligne 640-664
if (hasExistingServiceWithProducts && firstServiceId) {
    // ✅ VARIANTE 1 : Service existant avec produits → AjouterProduitSimple
    (navigation as any).navigate('AjouterProduitSimple', {
        serviceId: firstServiceId,
        suggestionIA: result.data,
        mediaData: mediaData,
        gpsData: gpsData
    });
} else {
    // ✅ VARIANTE 2 : Pas de service → FormulaireYukpoIntelligent (création complète)
    (navigation as any).navigate('FormulaireYukpoIntelligent', {
        suggestion: {
            ...result.data,
            intention: 'creation_service',
            data: result.data.suggestions || result.data.data || result.data
        },
        type: 'creation_service',
        mode: 'create',
        mediaData: mediaData,
        gpsData: gpsData
    });
}
```

**Décision** :
- Si un service avec produits existe → `AjouterProduitSimpleScreen`
- Sinon → `FormulaireYukpoIntelligentScreen` (création service + produit)

---

## 📝 VARIANTE 1 : Création Complète (Service + Produit)

### Écran : `FormulaireYukpoIntelligentScreen.tsx`

**Fichier** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`

### Étape 1 : Génération du formulaire par IA

1. **Réception des données** depuis `HomeScreen` :
   - `suggestion.data` : Données structurées par l'IA
   - `mediaData` : Images/vidéos/audios
   - `gpsData` : Coordonnées GPS

2. **Organisation en blocs** :
   ```typescript:596:690:mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx
   // Les champs sont organisés en blocs :
   // - Bloc 0: Informations générales (titre_service, category, description)
   // - Bloc 1: Localisation
   // - Bloc 2: Contact
   // - Bloc 3: Produits (nom_produit, categorie_produit, prix_produit, produits, etc.)
   // - Bloc 4: Médias
   // - Bloc 5: Paiement
   ```

### Étape 2 : Saisie des données produit

Le bloc "Produits" contient :
- `nom_produit` : Nom du produit/prestation
- `categorie_produit` : Catégorie
- `description_produit` : Description
- `prix_produit` : Prix
- `devise_produit` : Devise (XAF, EUR, etc.)
- `produits` : Champ autocomplete (combinaisons IA)
- `variabilite_prix` : Variations de prix (optionnel)

### Étape 3 : Transformation avant envoi

**Transformation critique** : `autocomplete` → `listeproduit`

```typescript:4304:4445:mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx
// Si le champ produits est de type 'autocomplete'
if (finalServiceData.produits && finalServiceData.produits.type_donnee === 'autocomplete') {
    // Extraire les champs individuels
    const nomProduit = finalServiceData.nom_produit?.valeur || valeursFormulaire.nom_produit || '';
    const prixProduit = finalServiceData.prix_produit?.valeur || valeursFormulaire.prix_produit || 0;
    const categorieProduit = finalServiceData.categorie_produit?.valeur || valeursFormulaire.categorie_produit || '';
    const descriptionProduit = finalServiceData.description_produit?.valeur || valeursFormulaire.description_produit || '';
    const deviseProduit = finalServiceData.devise_produit?.valeur || valeursFormulaire.devise_produit || 'XAF';
    
    // Construire l'objet produit
    const produitObj: any = {
        nom: nomProduit,
        prix: prixProduit,
        categorie: categorieProduit,
        description: descriptionProduit,
        devise: deviseProduit,
        combinaison_brute: combinationString,
        characteristic_vector: characteristicVector,
        product_labels: productLabelsFromAutocomplete,
        origine_champs: autocompleteData.origine_champs || 'formulaire'
    };
    
    // Ajouter les médias
    if (compressedMedia?.images?.length) {
        produitObj.images = mergedImages;
        produitObj.base64_image = mergedImages;
    }
    
    // Transformer en listeproduit
    finalServiceData.produits = {
        type_donnee: 'listeproduit',
        valeur: [produitObj],
        origine_champs: autocompleteData.origine_champs || 'formulaire'
    };
}
```

### Étape 4 : Upload préalable des médias

```typescript:4508:4637:mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx
// Upload des médias avant envoi pour éviter payload trop volumineux
const { uploadFiles } = await import('../services/uploadApi');

// Collecter tous les médias
const filesToUpload = [...];

// Uploader
const uploadedFiles = await uploadFiles(filesToUpload);

// Remplacer base64 par URLs
prod.imageUrls = imageUrls;
prod.videoUrls = videoUrls;
```

### Étape 5 : Envoi au backend

**Endpoint** : `POST /api/services/create`

**Payload** :
```json
{
  "user_id": 123,
  "data": {
    "titre_service": { "type_donnee": "string", "valeur": "...", "origine_champs": "formulaire" },
    "category": { ... },
    "description": { ... },
    "produits": {
      "type_donnee": "listeproduit",
      "valeur": [
        {
          "nom": "...",
          "prix": 5000,
          "devise": "XAF",
          "categorie": "...",
          "description": "...",
          "images": [...],
          "videos": [...],
          "combinaison_brute": "Marque,Modèle,Couleur",
          "characteristic_vector": ["Marque", "Modèle", "Couleur"],
          "product_labels": ["Marque", "Modèle", "Couleur"],
          "origine_champs": "ia" | "formulaire"
        }
      ],
      "origine_champs": "ia" | "formulaire"
    }
  }
}
```

---

## ➕ VARIANTE 2 : Ajout Simple (Produit à Service Existant)

### Écran : `AjouterProduitSimpleScreen.tsx`

**Fichier** : `mobile/src/screens/AjouterProduitSimpleScreen.tsx`

### Cas d'utilisation

1. **Création** : Ajouter un nouveau produit (`mode: 'create'`)
2. **Édition** : Modifier un produit existant (`mode: 'edit'`)
3. **Duplication** : Dupliquer un produit (`mode: 'duplicate'`)

### Étape 1 : Initialisation

```typescript:33:51:mobile/src/screens/AjouterProduitSimpleScreen.tsx
const params = (route.params as any) || {};
const { serviceId, suggestionIA } = params;
const mode = params.mode || 'create';
const isEditing = mode === 'edit';
const isDuplicate = mode === 'duplicate';
const productId = params.productId;
const productIndex = params.productIndex;
const prefill = params.prefill || {}; // Données préremplies (pour édition/duplication)
```

### Étape 2 : Construction de l'objet produit

```typescript:700:810:mobile/src/screens/AjouterProduitSimpleScreen.tsx
// Construire l'objet produit complet
const nouveauProduit: any = {
    nom: nomProduit || '',
    prix: prixProduit || 0,
    categorie: categorieProduit || '',
    description: descriptionProduit || '',
    devise: deviseProduit || 'XAF',
    type: typeProduit || 'autre',
    // ... tous les champs spécifiques selon le type
};

// Ajouter les médias
if (productImages.length > 0) {
    nouveauProduit.images = productImages;
}
if (productVideos.length > 0) {
    nouveauProduit.videos = productVideos;
}

// Gérer les variations de prix
if (priceVariant) {
    nouveauProduit.has_variant = true;
    nouveauProduit.variants = variants;
    nouveauProduit.variant_dimension = priceVariant.variable;
}
```

### Étape 3 : Upload préalable des médias

```typescript:813:883:mobile/src/screens/AjouterProduitSimpleScreen.tsx
// Upload des médias avant envoi
const { uploadFiles } = await import('../services/uploadApi');
const filesToUpload = [...];
const uploadedFiles = await uploadFiles(filesToUpload);

// Remplacer base64 par URLs
nouveauProduit.imageUrls = imageUrls;
nouveauProduit.videoUrls = videoUrls;
```

### Étape 4 : Vérification du solde

```typescript:919:948:mobile/src/screens/AjouterProduitSimpleScreen.tsx
const COUT_AJOUT_PRODUIT = 2000; // FCFA

// Vérifier le solde
const balanceResponse = await apiGet('/api/users/balance');
const soldeActuel = balanceResponse.data.tokens_balance || 0;

if (soldeActuel < COUT_AJOUT_PRODUIT) {
    Alert.alert('💸 Solde insuffisant', ...);
    return;
}
```

### Étape 5 : Confirmation utilisateur

```typescript:950:1055:mobile/src/screens/AjouterProduitSimpleScreen.tsx
Alert.alert(
    '💰 Ajout de produit',
    `Coût : ${COUT_AJOUT_PRODUIT.toLocaleString()} FCFA\n` +
    `Votre solde : ${soldeActuel.toLocaleString()} FCFA\n` +
    `Solde après ajout : ${(soldeActuel - COUT_AJOUT_PRODUIT).toLocaleString()} FCFA`,
    [
        { text: 'Annuler', style: 'cancel' },
        {
            text: 'Confirmer',
            onPress: async () => {
                // Appel API
            }
        }
    ]
);
```

### Étape 6 : Envoi au backend

**Mode création** :
- **Endpoint** : `POST /api/services/{serviceId}/products`
- **Payload** :
```json
{
  "user_id": 123,
  "product_data": {
    "nom": "...",
    "prix": 5000,
    "devise": "XAF",
    "categorie": "...",
    "description": "...",
    "images": [...],
    "videos": [...],
    "imageUrls": [...],
    "videoUrls": [...],
    "has_variant": false,
    "variants": [...],
    // ... tous les champs spécifiques
  }
}
```

**Mode édition** :
- **Endpoint** : `PATCH /api/products/{productId}/update`
- **Payload** :
```json
{
  "service_id": "123",
  "product_index": 0,
  "updated_product": {
    // Même structure que product_data
  }
}
```

---

## 🔀 VARIANTES SELON LE CONTEXTE

### Variante A : Création depuis HomeScreen (IA)

**Flux** :
1. `HomeScreen` → `handleCreateService()`
2. Appel IA : `genererSuggestionsService()`
3. Navigation vers `FormulaireYukpoIntelligent` ou `AjouterProduitSimple`
4. Formulaire prérempli avec données IA
5. Soumission → Création service + produit OU ajout produit

**Caractéristiques** :
- Données préremplies par IA
- `origine_champs: 'ia'`
- Combinaisons suggérées disponibles

### Variante B : Ajout manuel depuis MesServices

**Flux** :
1. `MesServicesScreen` → Bouton "Ajouter produit"
2. Navigation vers `AjouterProduitSimple`
3. Formulaire vide (ou prérempli depuis service)
4. Saisie manuelle
5. Soumission → Ajout produit

**Caractéristiques** :
- Saisie manuelle complète
- `origine_champs: 'formulaire'`
- Pas de suggestions IA

### Variante C : Édition de produit existant

**Flux** :
1. `ProductManagerMobile` → `handleEditProduct()`
2. Navigation vers `AjouterProduitSimple` avec `mode: 'edit'`
3. Formulaire prérempli avec données existantes
4. Modification
5. Soumission → `PATCH /api/products/{productId}/update`

**Caractéristiques** :
- Données préremplies depuis produit existant
- Mode édition activé
- Endpoint différent (PATCH au lieu de POST)

### Variante D : Duplication de produit

**Flux** :
1. `ProductManagerMobile` → `handleDuplicateProduct()`
2. Navigation vers `AjouterProduitSimple` avec `mode: 'duplicate'`
3. Formulaire prérempli avec données du produit à dupliquer
4. Modification optionnelle
5. Soumission → `POST /api/services/{serviceId}/products`

**Caractéristiques** :
- Données préremplies depuis produit source
- Mode duplication
- Création d'un nouveau produit (POST)

---

## 📊 STRUCTURE DES DONNÉES PRODUIT

### Format standard (listeproduit)

```typescript
{
  type_donnee: 'listeproduit',
  valeur: [
    {
      // Champs de base
      nom: string,
      prix: number,
      devise: string,
      categorie: string,
      description: string,
      type: ProductType, // 'automobile', 'vetement', etc.
      
      // Médias
      images?: string[],
      videos?: string[],
      imageUrls?: string[],
      videoUrls?: string[],
      base64_image?: string[],
      video_base64?: string[],
      
      // Métadonnées IA
      combinaison_brute?: string, // "Marque,Modèle,Couleur"
      characteristic_vector?: string[], // ["Marque", "Modèle", "Couleur"]
      product_labels?: string[], // ["Marque", "Modèle", "Couleur"]
      origine_champs?: 'ia' | 'formulaire',
      
      // Variations de prix
      has_variant?: boolean,
      variants?: Array<{
        label: string,
        prix: number,
        devise: string,
        // ...
      }>,
      variant_dimension?: string,
      
      // Champs spécifiques selon type (100+ champs possibles)
      // Exemples :
      marqueAutomobile?: string,
      modeleAutomobile?: string,
      typeVetement?: string,
      taille?: string,
      couleurVetement?: string,
      // ... etc (voir interface Product dans ProductManagerMobile.tsx)
    }
  ],
  origine_champs: 'ia' | 'formulaire'
}
```

### Format autocomplete (avant transformation)

```typescript
{
  type_donnee: 'autocomplete',
  valeur: string | string[], // Combinaisons séparées par virgule
  separateur: string, // ',' par défaut
  sous_caracteristiques: {
    "Marque": ["Toyota", "Honda", ...],
    "Modèle": ["Corolla", "Civic", ...],
    // ...
  },
  product_vector?: string[][], // Tableaux de combinaisons
  product_labels?: string[][], // Labels correspondants
  ai_preferred_index?: number, // Index de la combinaison préférée par l'IA
  origine_champs: 'ia' | 'formulaire'
}
```

---

## 🔧 TRANSFORMATIONS CRITIQUES

### 1. Autocomplete → Listeproduit

**Où** : `FormulaireYukpoIntelligentScreen.tsx` ligne 4304-4445

**Pourquoi** : Le backend attend `listeproduit`, pas `autocomplete`

**Processus** :
1. Extraire les champs individuels (`nom_produit`, `prix_produit`, etc.)
2. Construire `produitObj` avec toutes les données
3. Ajouter les médias
4. Transformer en `{ type_donnee: 'listeproduit', valeur: [produitObj] }`
5. Supprimer les champs individuels (déjà dans `listeproduit`)

### 2. Base64 → URLs

**Où** : Avant chaque envoi API

**Pourquoi** : Éviter payload trop volumineux

**Processus** :
1. Détecter les médias en base64 (`data:image/...` ou `file://`)
2. Upload via `uploadFiles()` de `uploadApi.ts`
3. Remplacer `base64_image` par `imageUrls`
4. Remplacer `video_base64` par `videoUrls`
5. Fallback : garder base64 si upload échoue

### 3. Variations de prix → Variants

**Où** : `AjouterProduitSimpleScreen.tsx` ligne 800-810

**Pourquoi** : Format backend standardisé

**Processus** :
1. Extraire `variabilite_prix` ou `price_variant`
2. Transformer `modalites` en `variants[]`
3. Ajouter `has_variant: true`
4. Ajouter `variant_dimension` si disponible

---

## 🎯 POINTS D'ENTRÉE PRINCIPAUX

### 1. HomeScreen → Création avec IA

```typescript
HomeScreen.handleCreateService()
  → genererSuggestionsService()
  → Navigation vers FormulaireYukpoIntelligent OU AjouterProduitSimple
```

### 2. MesServicesScreen → Ajout manuel

```typescript
MesServicesScreen.handleAddProduct()
  → Navigation vers AjouterProduitSimple (mode: 'create')
```

### 3. ProductManagerMobile → Édition/Duplication

```typescript
ProductManagerMobile.handleEditProduct()
  → Navigation vers AjouterProduitSimple (mode: 'edit')

ProductManagerMobile.handleDuplicateProduct()
  → Navigation vers AjouterProduitSimple (mode: 'duplicate')
```

---

## 📝 RÉSUMÉ DES VARIANTES

| Variante | Écran | Mode | Endpoint | Origine données |
|----------|-------|------|----------|-----------------|
| Création complète (IA) | FormulaireYukpoIntelligent | create | POST /api/services/create | IA + Formulaire |
| Ajout simple (IA) | AjouterProduitSimple | create | POST /api/services/{id}/products | IA + Formulaire |
| Ajout manuel | AjouterProduitSimple | create | POST /api/services/{id}/products | Formulaire uniquement |
| Édition | AjouterProduitSimple | edit | PATCH /api/products/{id}/update | Produit existant |
| Duplication | AjouterProduitSimple | duplicate | POST /api/services/{id}/products | Produit source |

---

## 🔍 DÉTAILS TECHNIQUES

### Validation

- **Champs obligatoires** : `nom`, `prix`, `devise` (minimum)
- **Validation prix** : Doit être un nombre positif
- **Validation médias** : Max 10 images, formats supportés

### Gestion d'erreurs

- **Solde insuffisant** : Alert avec montant requis
- **Upload échoué** : Fallback vers base64
- **Erreur API** : Log détaillé + Alert utilisateur

### Coûts

- **Création service + produit** : Variable (selon complexité IA)
- **Ajout produit simple** : 2000 FCFA fixe
- **Édition produit** : Gratuit
- **Duplication produit** : 2000 FCFA fixe

---

## 📌 FICHIERS CLÉS

1. **HomeScreen.tsx** : Point d'entrée, décision de navigation
2. **FormulaireYukpoIntelligentScreen.tsx** : Création complète service + produit
3. **AjouterProduitSimpleScreen.tsx** : Ajout/édition/duplication produit
4. **ProductManagerMobile.tsx** : Gestion affichage produits, navigation édition
5. **yukpoclient.ts** : Appels API IA
6. **api.ts** : Appels API backend (apiPost, apiPatch, apiGet)
7. **uploadApi.ts** : Upload médias

---

## ✅ CHECKLIST DE CRÉATION

### Pour FormulaireYukpoIntelligent :
- [ ] Données IA reçues et parsées
- [ ] Formulaire généré avec blocs organisés
- [ ] Bloc Produits contient tous les champs nécessaires
- [ ] Transformation autocomplete → listeproduit effectuée
- [ ] Médias uploadés (ou base64 en fallback)
- [ ] Payload validé avant envoi
- [ ] Endpoint `/api/services/create` appelé

### Pour AjouterProduitSimple :
- [ ] Mode détecté (create/edit/duplicate)
- [ ] Données préremplies si édition/duplication
- [ ] Formulaire rempli par utilisateur
- [ ] Médias uploadés (ou base64 en fallback)
- [ ] Solde vérifié (si création/duplication)
- [ ] Confirmation utilisateur obtenue
- [ ] Endpoint correct appelé selon mode

---

*Analyse générée le ${new Date().toISOString()}*

