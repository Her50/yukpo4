# 🎯 Système de Modalités Intelligentes - Documentation Complète

## 📋 Vue d'ensemble

Le système de modalités intelligentes permet de gérer des listes de valeurs **extensibles** et **personnalisables** pour les formulaires de produits. Il combine :
- **Modalités statiques** : Définies dans `productModalities.ts`
- **Modalités personnalisées** : Ajoutées par les utilisateurs, sauvegardées en base de données

---

## 🏗️ Architecture

### **1. Composants**

```
ProductFieldSelector (Intelligence)
    ↓
    ├── EnhancedModalitySelector (Single-select)
    │   ├── getFieldOptions() → Modalités statiques
    │   └── modalityService.getModalitiesForField() → Modalités personnalisées
    │
    └── MultiSelectModalitySelector (Multi-select)
        ├── getFieldOptions() → Modalités statiques
        └── modalityService.getModalitiesForField() → Modalités personnalisées
```

### **2. Services**

```typescript
// mobile/src/services/modalityService.ts
modalityService
    ├── loadCustomModalities()        // Charge depuis l'API
    ├── getModalitiesForField()       // Récupère pour un champ
    ├── addCustomModality()           // Ajoute une nouvelle modalité
    ├── incrementUsage()              // Statistiques
    └── getPopularModalities()        // Modalités populaires
```

### **3. Routes API Backend**

```
GET  /api/modalities/custom                          → Liste toutes les modalités
POST /api/modalities/custom                          → Ajoute une modalité
POST /api/modalities/usage                           → Incrémente l'usage
GET  /api/modalities/popular?productType&fieldName   → Modalités populaires
GET  /api/modalities/stats                           → Statistiques
DELETE /api/modalities/custom/{id}                   → Supprime une modalité
```

### **4. Base de données**

```sql
-- backend/migrations/XXXXXX_create_custom_modalities.sql
CREATE TABLE custom_modalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type VARCHAR(100) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    modality TEXT NOT NULL,
    added_by VARCHAR(255),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    UNIQUE(product_type, field_name, modality)
);

CREATE INDEX idx_custom_modalities_lookup 
ON custom_modalities(product_type, field_name);

CREATE INDEX idx_custom_modalities_usage 
ON custom_modalities(usage_count DESC);
```

---

## 📊 État actuel des catégories

### ✅ **30 Catégories AVEC formulaires**

| # | Catégorie | Formulaire | Modalités | ProductFieldSelector |
|---|-----------|------------|-----------|---------------------|
| 1 | immobilier_batiment | ✅ | ✅ | ✅ |
| 2 | immobilier_terrain | ✅ | ✅ | ❓ |
| 3 | automobile | ✅ | ✅ | ✅ |
| 4 | ticket_voyage | ✅ | ✅ | ✅ |
| 5 | hotellerie | ✅ | ✅ | ✅ |
| 6 | covoiturage | ✅ | ✅ | ❓ |
| 7 | vetement | ✅ | ✅ | ✅ |
| 8 | chaussure | ✅ | ✅ | ✅ |
| 9 | electromenager | ✅ | ✅ | ✅ |
| 10 | mobilier | ✅ | ✅ | ✅ |
| 11 | decoration | ✅ | ✅ | ✅ |
| 12 | aliments | ✅ | ✅ | ❓ |
| 13 | quincaillerie | ✅ | ✅ | ❓ |
| 14 | prestation_service | ✅ | ✅ | ❓ |
| 15 | livres_fournitures | ✅ | ✅ | ❓ |
| 16 | pharmacie | ✅ | ✅ | ❓ |
| 17 | hopital_clinique | ✅ | ✅ | ❓ |
| 18 | agroalimentaire | ✅ | ✅ | ❓ |
| 19 | demenagement | ✅ | ✅ | ❓ |
| 20 | cosmetique_parfum | ✅ | ✅ | ❓ |
| 21 | bijoux | ✅ | ✅ | ❓ |
| 22 | coiffure_beaute | ✅ | ✅ | ❓ |
| 23 | assurance | ✅ | ✅ | ❓ |
| 24 | telephone | ✅ | ✅ | ❓ |
| 25 | ordinateur | ✅ | ✅ | ❓ |
| 26 | image_son | ✅ | ✅ | ❓ |
| 27 | pieces_auto | ✅ | ✅ | ❓ |
| 28 | pieces_industrielles | ✅ | ✅ | ❓ |
| 29 | jouets_enfants | ✅ | ✅ | ❓ |
| 30 | ustensiles_cuisine | ✅ | ✅ | ❓ |

### ❌ **15 Catégories SANS formulaires (à créer)**

| # | Catégorie | Modalités | Formulaire à créer |
|---|-----------|-----------|-------------------|
| 31 | restauration | ✅ | ❌ À CRÉER |
| 32 | electronique | ✅ | ❌ À CRÉER |
| 33 | formation_education | ✅ | ❌ À CRÉER |
| 34 | evenementiel | ✅ | ❌ À CRÉER |
| 35 | agriculture | ✅ | ❌ À CRÉER |
| 36 | sport_fitness | ✅ | ❌ À CRÉER |
| 37 | bien_etre_spa | ✅ | ❌ À CRÉER |
| 38 | animaux_veterinaire | ✅ | ❌ À CRÉER |
| 39 | nettoyage_entretien | ✅ | ❌ À CRÉER |
| 40 | jardinage_paysagisme | ✅ | ❌ À CRÉER |
| 41 | securite_surveillance | ✅ | ❌ À CRÉER |
| 42 | plomberie | ✅ | ❌ À CRÉER |
| 43 | electricite | ✅ | ❌ À CRÉER |
| 44 | menuiserie | ✅ | ❌ À CRÉER |
| 45 | musique_instruments | ✅ | ❌ À CRÉER |

---

## 🔧 Utilisation

### **Dans un formulaire de produit**

```typescript
// Champ simple (single-select)
<ProductFieldSelector
    label="Marque"
    fieldName="marques"
    productType="automobile"
    value={newProduct.marque || ''}
    onSelect={(value) => setNewProduct({ ...newProduct, marque: value })}
    required
/>

// Champ multi-select (détection automatique)
<ProductFieldSelector
    label="Couleurs"
    fieldName="couleurs"
    productType="vetement"
    value={newProduct.couleurs || []}
    onSelect={(values) => setNewProduct({ ...newProduct, couleurs: values })}
/>

// Forcer multi-select
<ProductFieldSelector
    label="Équipements"
    fieldName="equipements"
    productType="hotellerie"
    value={newProduct.equipements || []}
    onSelect={(values) => setNewProduct({ ...newProduct, equipements: values })}
    multiSelect
    maxSelections={15}
/>
```

### **Détection automatique multi-select**

ProductFieldSelector détecte automatiquement si un champ doit être multi-select selon son nom :

```typescript
const MULTI_SELECT_FIELD_PATTERNS = [
  'couleur', 'couleurs', 'color', 'colors',
  'taille', 'tailles', 'size', 'sizes',
  'option', 'options',
  'caracteristique', 'caracteristiques', 'features',
  'service_inclus', 'services_inclus',
  'modalite', 'modalites',
  'langue', 'langues', 'language', 'languages',
  'certification', 'certifications',
  'garantie', 'garanties', 'warranty', 'warranties',
  'style', 'styles',
  'materiau', 'materiaux', 'material', 'materials'
];
```

---

## 📝 Exemple de modalités pour une catégorie

```typescript
// mobile/src/data/productModalities.ts

export const AUTOMOBILE_MODALITIES: ModalityCategory = {
  marques: [
    'Toyota', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen',
    // ... plus de marques
    '🆕 Autre (ajouter)'  // ← Option pour ajouter une nouvelle marque
  ],
  
  transmission: [
    'Manuelle', 'Automatique', 'Semi-automatique', 'CVT', 
    'Hybride', 'Électrique',
    '🆕 Autre (ajouter)'
  ],
  
  carburant: [
    'Essence', 'Diesel', 'Hybride', 'Électrique', 
    'GPL', 'Bioéthanol', 'Hydrogène',
    '🆕 Autre (ajouter)'
  ],
  
  etat: [
    'Neuf', 'Occasion - Excellent état', 'Occasion - Bon état', 
    'Occasion - État moyen', 'À réparer',
    '🆕 Autre (ajouter)'
  ],
  
  couleur: [
    'Blanc', 'Noir', 'Gris', 'Argent', 'Rouge', 'Bleu', 
    'Vert', 'Jaune', 'Orange', 'Marron', 'Beige',
    '🆕 Autre (ajouter)'
  ]
};
```

---

## 🚀 Flux d'ajout d'une modalité

```
1. Utilisateur clique sur "🆕 Autre (ajouter)"
        ↓
2. Alert.prompt() affiche un dialogue de saisie
        ↓
3. Utilisateur entre "Tesla" (nouvelle marque)
        ↓
4. Vérification : "Tesla" existe déjà ?
        ↓ Non
5. modalityService.addCustomModality("automobile", "marques", "Tesla")
        ↓
6. POST /api/modalities/custom
        ↓
7. Insertion dans table custom_modalities
        ↓
8. Réponse success
        ↓
9. Rechargement des options (static + custom)
        ↓
10. "Tesla" apparaît dans la liste
        ↓
11. Sélection automatique de "Tesla"
```

---

## 🔍 Debugging

### **Vérifier les modalités chargées**

```typescript
// Dans EnhancedModalitySelector
console.log('[EnhancedModalitySelector] Options:', allOptions);
```

### **Vérifier les appels API**

```typescript
// Dans modalityService
console.log('[ModalityService] Chargement modalités...');
console.log('[ModalityService] Ajout modalité:', { productType, fieldName, modality });
```

### **Logs console attendus**

```
[productModalities] Options pour automobile > marques: 28
[ProductFieldSelector] Champ "marques": isMulti=false, value= 
[EnhancedModalitySelector] Chargement options...
[ModalityService] Chargement des modalités personnalisées...
[ModalityService] ✅ Modalités chargées: 15 catégories
```

---

## ⚠️ Problèmes connus

### **1. Backend ne répond pas**

**Symptôme** : Les modalités personnalisées ne se chargent pas

**Solution** :
- Vérifier que le backend est démarré
- Vérifier les routes dans `backend/src/modalities/routes.rs`
- Vérifier les logs backend pour les erreurs

### **2. Table custom_modalities n'existe pas**

**Symptôme** : Erreur SQL "relation does not exist"

**Solution** :
```bash
cd backend
sqlx migrate run
```

### **3. Modalités ne s'ajoutent pas**

**Symptôme** : L'ajout ne fonctionne pas, pas de message d'erreur

**Solution** :
- Vérifier les logs réseau (Network tab)
- Vérifier que l'endpoint POST fonctionne
- Tester manuellement avec curl :

```bash
curl -X POST http://localhost:8080/api/modalities/custom \
  -H "Content-Type: application/json" \
  -d '{"productType":"automobile","fieldName":"marques","modality":"Tesla"}'
```

---

## 🎯 Prochaines étapes

### **Phase 1 : Créer les formulaires manquants** (15 catégories)
- [ ] restauration
- [ ] electronique
- [ ] formation_education
- [ ] evenementiel
- [ ] agriculture
- [ ] sport_fitness
- [ ] bien_etre_spa
- [ ] animaux_veterinaire
- [ ] nettoyage_entretien
- [ ] jardinage_paysagisme
- [ ] securite_surveillance
- [ ] plomberie
- [ ] electricite
- [ ] menuiserie
- [ ] musique_instruments

### **Phase 2 : Migrer les formulaires existants**
- [ ] Remplacer tous les `pickerButtons` restants
- [ ] Remplacer tous les `EnhancedModalitySelector` par `ProductFieldSelector`
- [ ] Vérifier le productType pour chaque catégorie
- [ ] Ajouter multi-select où nécessaire

### **Phase 3 : Optimiser l'UX**
- [ ] Améliorer les champs par catégorie
- [ ] Ajouter des validations intelligentes
- [ ] Améliorer le feedback utilisateur
- [ ] Ajouter des tooltips/hints

---

## 📚 Références

- **Fichiers clés** :
  - `mobile/src/components/ProductFieldSelector.tsx`
  - `mobile/src/components/EnhancedModalitySelector.tsx`
  - `mobile/src/components/MultiSelectModalitySelector.tsx`
  - `mobile/src/data/productModalities.ts`
  - `mobile/src/services/modalityService.ts`
  - `backend/src/modalities/routes.rs`
  - `backend/src/modalities/models.rs`

- **Migration backend** :
  - `backend/migrations/*_create_custom_modalities.sql`












