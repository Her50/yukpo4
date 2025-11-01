# 🔧 CORRECTIONS FRONTEND - Gestion Produits React Native

## Date : 2025-11-01

---

## ✅ CORRECTION #1 : Duplication Produit (COMPLÉTÉ)

### Fichier Modifié
`mobile/src/components/ProductManagerMobile.tsx` lignes 1954-1974

**AVANT** :
```typescript
// Dupliquait localement dans le state
const duplicatedProduct = {...duplicateProduct, id: `duplicate_${Date.now()}`};
onProductsChange([...products, duplicatedProduct]);
```

**APRÈS** :
```typescript
// ✅ Navigation vers FormulaireYukpoIntelligent
(navigation as any).navigate('FormulaireYukpoIntelligent', {
    serviceId: serviceId,
    duplicateProduct: duplicateProduct,
    serviceData: serviceData,
    mode: 'add_product', // ✅ Mode spécial
    focusBlock: 'products',
    fromMesProduits: true
});
```

---

## ⏳ CORRECTION #2 : FormulaireYukpoIntelligent mode add_product

### Fichier à Modifier
`mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`

### Détection mode add_product
Après ligne 86 (état isSubmitting) :

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

// ✅ NOUVEAU 2025-11-01: Détecter si on ajoute un produit à un service existant
const isAddingProduct = mode === 'add_product' && serviceId && duplicateProduct;
```

### Pré-remplissage formulaire
Après ligne 900 (setValeursFormulaire) :

```typescript
// ✅ NOUVEAU 2025-11-01: Si mode add_product, préremplir avec duplicateProduct
useEffect(() => {
    if (isAddingProduct && duplicateProduct && serviceData) {
        console.log('[FormulaireYukpoIntelligentScreen] 📋 Mode ajout produit détecté');
        
        // Préremplir le formulaire avec les données du service + produit dupliqué
        setValeursFormulaire({
            ...serviceData, // Données service complètes
            // Surcharger avec les données du produit à dupliquer
            nom_produit: duplicateProduct.nom,
            prix_produit: duplicateProduct.prix,
            description_produit: duplicateProduct.description,
            // ... tous les champs du produit
        });
        
        setActiveStep(2); // Aller directement au formulaire
        setCurrentBlock(blocks.findIndex(b => b.id === 'products')); // Focus produits
    }
}, [isAddingProduct, duplicateProduct, serviceData]);
```

### API Call pour ajouter produit
Dans `soumettreFormulaire()` après ligne 1636 :

```typescript
// ✅ SI MODE ADD_PRODUCT : Appeler route spéciale ajout produit
if (isAddingProduct && serviceId) {
    console.log('[FormulaireYukpoIntelligentScreen] 💾 Ajout produit au service', serviceId);
    
    // Construire les données du nouveau produit uniquement
    const nouveauProduit = {
        nom: valeursFormulaire.nom_produit,
        prix: valeursFormulaire.prix_produit,
        description: valeursFormulaire.description_produit,
        // ... tous les champs modifiés
    };
    
    try {
        setLoading(true);
        
        // ✅ Appel route POST /api/services/{serviceId}/products
        const response = await apiPost(`/api/services/${serviceId}/products`, {
            user_id: parseInt(user?.id || '0', 10),
            product_data: nouveauProduit
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Erreur ajout produit');
        }
        
        const { cost, new_balance } = response.data;
        
        Alert.alert(
            '✅ Produit ajouté',
            `Votre produit a été ajouté avec succès.\n\n💰 Coût: ${cost} FCFA\n💳 Nouveau solde: ${new_balance} FCFA`,
            [
                {
                    text: 'OK',
                    onPress: () => {
                        if (fromMesProduits) {
                            (navigation as any).navigate('MesProduits');
                        } else {
                            navigation.goBack();
                        }
                    }
                }
            ]
        );
        
        return; // ✅ Sortir ici pour éviter le flux de création normal
    } catch (error) {
        console.error('[FormulaireYukpoIntelligentScreen] ❌ Erreur ajout produit:', error);
        Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le produit');
    } finally {
        setLoading(false);
    }
    
    return; // ✅ Sortir
}

// Sinon, continuer avec le flux normal de création...
```

---

## ⏳ CORRECTION #3 : Texte Explicatif (Aucun Produit)

### Fichier à Modifier
`mobile/src/components/ProductManagerMobile.tsx`

### Localisation
Chercher où les produits sont rendus (probablement une FlatList ou .map()).

### Ajouter avant le rendu des produits
```typescript
{products.length === 0 && (
    <View style={styles.emptyStateContainer}>
        {/* Icône */}
        <View style={styles.emptyIconContainer}>
            <SafeIcon name="package" size={64} color={modernColors.textSecondary} />
        </View>
        
        {/* Titre */}
        <Text style={styles.emptyTitle}>
            📦 Créez votre premier produit
        </Text>
        
        {/* Sous-titre */}
        <Text style={styles.emptySubtitle}>
            Pour ajouter un produit à ce service, utilisez le bouton 
            "➕ Ajouter un produit" ci-dessus.
        </Text>
        
        {/* Étapes */}
        <View style={styles.emptyStepsContainer}>
            <View style={styles.emptyStep}>
                <Text style={styles.emptyStepNumber}>1️⃣</Text>
                <Text style={styles.emptyStepText}>
                    Cliquez sur "➕ Ajouter un produit"
                </Text>
            </View>
            
            <View style={styles.emptyStep}>
                <Text style={styles.emptyStepNumber}>2️⃣</Text>
                <Text style={styles.emptyStepText}>
                    Remplissez les informations du produit
                </Text>
            </View>
            
            <View style={styles.emptyStep}>
                <Text style={styles.emptyStepNumber}>3️⃣</Text>
                <Text style={styles.emptyStepText}>
                    Sauvegardez (coût: 3000 FCFA)
                </Text>
            </View>
        </View>
        
        {/* Note */}
        <View style={styles.emptyNoteContainer}>
            <SafeIcon name="info" size={16} color={modernColors.info} />
            <Text style={styles.emptyNoteText}>
                Pour dupliquer un produit existant d'un autre service, 
                allez dans "Mes Produits" et utilisez l'option de duplication.
            </Text>
        </View>
    </View>
)}
```

### Styles à ajouter (avant le `});` final)
```typescript
emptyStateContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: modernColors.surface,
    borderRadius: 12,
    margin: 16,
},
emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
},
emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 8,
    textAlign: 'center',
},
emptySubtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
},
emptyStepsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
},
emptyStep: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    gap: 12,
},
emptyStepNumber: {
    fontSize: 20,
},
emptyStepText: {
    flex: 1,
    fontSize: 14,
    color: modernColors.text,
    fontWeight: '500',
},
emptyNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
},
emptyNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
},
```

---

## ⏳ CORRECTION #4 : Bloquer Suppression Service (>= 2 produits)

### Fichier Backend
`backend/src/controllers/service_controller.rs`

### Dans la fonction `supprimer_service`
Ajouter avant la suppression :

```rust
// ✅ NOUVEAU 2025-11-01: Vérifier nombre de produits
let produits_count = sqlx::query(
    "SELECT jsonb_array_length(COALESCE(data->'produits'->'valeur', '[]'::jsonb)) as count 
     FROM services WHERE id = $1"
)
.bind(service_id)
.fetch_one(&state.pg)
.await?
.try_get::<i64, _>("count")
.unwrap_or(0);

if produits_count >= 2 {
    return Err(AppError::BadRequest(format!(
        "Impossible de supprimer ce service car il contient {} produits. \
        Veuillez d'abord supprimer les produits avant de supprimer le service.",
        produits_count
    )));
}

log::info!("[supprimer_service] ✅ Service {} contient {} produit(s), suppression autorisée", 
    service_id, produits_count);
```

---

## ⏳ CORRECTION #5-8 : Désactivation/Réactivation Produits

### Backend : Nouveau Contrôleur
Créer `backend/src/controllers/product_lifecycle_controller.rs` :

```rust
// ✅ NOUVEAU 2025-11-01: Gestion cycle de vie produits

/// Désactiver un produit
pub async fn deactivate_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, usize)>,
) -> AppResult<Json<Value>> {
    // 1. Récupérer le service
    // 2. Vérifier propriétaire
    // 3. Marquer produit comme désactivé
    // 4. Notification
}

/// Réactiver un produit (coût: 1000 FCFA fixe ou prorata)
pub async fn reactivate_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, usize)>,
) -> AppResult<Json<Value>> {
    // 1. Récupérer le service + produit
    // 2. Calculer coût réactivation:
    //    - Si désactivé manuellement avant 30j: prorata
    //    - Si désactivé auto après 30j: 1000 FCFA fixe
    // 3. Vérifier solde
    // 4. Débiter
    // 5. Réactiver
    // 6. Notification
}
```

### Calcul Coût Réactivation
```rust
fn calculate_reactivation_cost(
    deactivation_date: NaiveDateTime,
    deactivation_type: &str, // "manual" ou "auto"
) -> i64 {
    let now = Utc::now().naive_utc();
    let days_inactive = (now - deactivation_date).num_days();
    
    if deactivation_type == "auto" || days_inactive >= 30 {
        // Coût fixe après 30 jours
        1000
    } else {
        // Prorata si désactivation manuelle avant 30j
        // Formule: (jours_inactifs / 30) * 1000
        ((days_inactive as f64 / 30.0) * 1000.0).ceil() as i64
    }
}
```

---

## 📋 RÉSUMÉ FICHIERS À MODIFIER

| Fichier | Type | Corrections |
|---------|------|-------------|
| `ProductManagerMobile.tsx` | ✅ MODIFIÉ | Duplication (complété) |
| `FormulaireYukpoIntelligentScreen.tsx` | ⏳ À MODIFIER | Mode add_product |
| `ProductManagerMobile.tsx` | ⏳ À MODIFIER | Texte explicatif |
| `service_controller.rs` | ⏳ À MODIFIER | Blocage suppression |
| `product_lifecycle_controller.rs` | ⏳ À CRÉER | Désactivation/Réactivation |

---

**PROCHAINE ÉTAPE** : Implémenter les corrections dans FormulaireYukpoIntelligentScreen.

