# Résumé : Système de Notifications et Configuration Livraison

## ✅ Ce qui fonctionne DÉJÀ

### Backend

1. **Service de disponibilité** (`ProductAvailabilityService`) :
   - ✅ Vérifie si la configuration existe
   - ✅ Vérifie les jours de disponibilité
   - ✅ Vérifie les plages horaires
   - ✅ Retourne message avec jours disponibles si indisponible

2. **Vérification dans `create_client_order`** :
   - ✅ Vérifie la disponibilité AVANT création
   - ✅ Retourne produits similaires si indisponible
   - ✅ Vérifie que la configuration est complète (`is_configured = true`)
   - ✅ Retourne erreur si configuration incomplète

3. **Temps de préparation** :
   - ✅ Stocké dans la configuration
   - ✅ Utilisé dans le calcul du temps total lors du matching

---

## ❌ Ce qui MANQUE

### Frontend

1. **Vérification AVANT ouverture du modal** :
   - ❌ Le modal `OrderDeliveryModal` s'ouvre sans vérifier la disponibilité
   - ❌ Le client peut commencer à remplir le formulaire même si le produit est indisponible

2. **Affichage des informations de délai** :
   - ❌ Le temps de préparation n'est pas affiché AVANT la création de commande
   - ❌ L'heure estimée de disponibilité n'est pas visible

3. **Gestion des erreurs d'indisponibilité** :
   - ❌ Pas d'affichage préventif avec produits similaires
   - ❌ Le message d'erreur n'apparaît qu'APRÈS tentative de création

4. **Workflow après création produit** :
   - ❌ Après création, navigation directe vers "Mes Services"
   - ❌ Pas d'écran de configuration de livraison automatique
   - ❌ Pas de contrainte pour configurer avant utilisation

5. **Réutilisation de configuration** :
   - ❌ Pas d'option pour copier la configuration d'un autre produit
   - ❌ L'utilisateur doit tout reconfigurer pour chaque produit

---

## 🔧 Solutions à Implémenter

### 1. Route API manquante (Backend)

**Nouvelle route** : `GET /api/delivery/product-availability/{service_id}/{product_index}`

```rust
async fn get_product_availability(
    State(state): State<Arc<AppState>>,
    Path((service_id, product_index)): Path<(i32, i32)>,
) -> AppResult<Json<Value>> {
    let service = ProductAvailabilityService::new(state.pg.clone());
    let availability = service.check_availability(service_id, product_index, None).await?;
    Ok(Json(json!({
        "success": true,
        "availability": availability
    })))
}
```

**Ajouter dans `delivery_routes.rs`** :
```rust
.route(
    "/api/delivery/product-availability/{service_id}/{product_index}",
    get(get_product_availability),
)
```

### 2. Vérification avant ouverture du modal (Frontend)

**Dans le composant qui ouvre `OrderDeliveryModal`** (ex: `ProductCard.tsx`) :

```typescript
const handleDeliveryPress = async () => {
    // Vérifier disponibilité AVANT d'ouvrir le modal
    try {
        const response = await apiGet(`/api/delivery/product-availability/${serviceId}/${productIndex}`);
        if (response.success && response.data?.availability) {
            const availability = response.data.availability as AvailabilityCheckResult;
            
            if (!availability.is_available) {
                // Afficher message avec produits similaires
                Alert.alert(
                    'Produit indisponible',
                    availability.reason || 'Ce produit n\'est pas disponible actuellement.',
                    [
                        {
                            text: 'Voir d\'autres prestataires',
                            onPress: () => {
                                // Navigation vers recherche produits similaires
                            }
                        },
                        { text: 'OK', style: 'cancel' }
                    ]
                );
                return; // Ne pas ouvrir le modal
            }
        }
    } catch (error) {
        console.error('Erreur vérification disponibilité:', error);
    }
    
    // Si disponible, ouvrir le modal
    setShowDeliveryModal(true);
};
```

### 3. Affichage des infos de délai dans le modal

**Dans `OrderDeliveryModal.tsx`** :

```typescript
useEffect(() => {
    if (visible && serviceId && productIndex !== undefined) {
        loadAvailabilityInfo();
    }
}, [visible, serviceId, productIndex]);

const loadAvailabilityInfo = async () => {
    try {
        const response = await apiGet(`/api/delivery/product-availability/${serviceId}/${productIndex}`);
        if (response.success && response.data?.availability) {
            const info = response.data.availability as AvailabilityCheckResult;
            if (info.preparation_time_minutes && info.preparation_time_minutes > 0) {
                const readyAt = new Date();
                readyAt.setMinutes(readyAt.getMinutes() + info.preparation_time_minutes);
                setEstimatedReadyTime(readyAt);
                setPreparationTime(info.preparation_time_minutes);
            }
        }
    } catch (error) {
        console.error('Erreur chargement disponibilité:', error);
    }
};

// Afficher dans le JSX
{preparationTime && preparationTime > 0 && (
    <View style={styles.preparationBanner}>
        <SafeIcon name="clock" size={16} color={modernColors.primary} />
        <Text style={styles.preparationText}>
            ⏱️ Temps de préparation : {preparationTime} minutes
        </Text>
        {estimatedReadyTime && (
            <Text style={styles.readyTimeText}>
                Disponible vers {estimatedReadyTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
        )}
    </View>
)}
```

### 4. Workflow après création produit

**Dans `FormulaireYukpoIntelligentScreen.tsx`** :

```typescript
// Après création réussie
if (response.success && serviceId && productIndex !== undefined) {
    // Vérifier si c'est un produit (pas une prestation)
    const isProduct = typeOffre !== 'prestation' && typeOffre !== 'service';
    
    if (isProduct) {
        // Ouvrir le modal de configuration de livraison
        navigation.navigate('ProductDeliveryConfig', {
            serviceId: Number(serviceId),
            productIndex: productIndex,
            productName: productName,
            required: true, // Forcer la configuration
        });
    } else {
        // Pour prestations, aller directement à Mes Services
        navigation.navigate('Main', { screen: 'Services' });
    }
}
```

### 5. Option de réutilisation dans le modal de configuration

**Dans `ProductDeliveryConfigModal.tsx`** :

Ajouter en haut du modal :

```typescript
const [useExistingConfig, setUseExistingConfig] = useState(false);
const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
const [availableProducts, setAvailableProducts] = useState<Array<{index: number, name: string}>>([]);

// Charger les produits du même service
useEffect(() => {
    if (visible && serviceId && !isTransversalMode) {
        loadAvailableProducts(serviceId);
    }
}, [visible, serviceId]);

const loadAvailableProducts = async (serviceId: number) => {
    try {
        const response = await apiGet(`/api/delivery/product-config/list/${serviceId}`);
        if (response.success && response.data?.products) {
            setAvailableProducts(response.data.products);
        }
    } catch (error) {
        console.error('Erreur chargement produits:', error);
    }
};

const loadConfigFromProduct = async (serviceId: number, productIndex: number) => {
    try {
        const response = await apiGet(`/api/delivery/product-config/${serviceId}/${productIndex}`);
        if (response.success && response.data?.config) {
            // Pré-remplir le formulaire avec cette configuration
            const c = response.data.config;
            setConfig({
                pickup_address: c.pickup_address || '',
                pickup_latitude: c.pickup_latitude || 0,
                pickup_longitude: c.pickup_longitude || 0,
                required_vehicle_type_id: c.required_vehicle_type_id || 0,
                preparation_time_minutes: c.preparation_time_minutes ? String(c.preparation_time_minutes) : '0',
                // ... autres champs
            });
        }
    } catch (error) {
        console.error('Erreur chargement config:', error);
    }
};

// Afficher dans le JSX
{!isTransversalMode && availableProducts.length > 0 && (
    <View style={styles.reuseSection}>
        <Text style={styles.label}>Utiliser la configuration d'un autre produit ?</Text>
        <Switch
            value={useExistingConfig}
            onValueChange={setUseExistingConfig}
        />
        {useExistingConfig && (
            <Picker
                selectedValue={selectedProductIndex}
                onValueChange={(idx) => {
                    setSelectedProductIndex(idx);
                    loadConfigFromProduct(serviceId, idx);
                }}
            >
                <Picker.Item label="Sélectionner un produit..." value={null} />
                {availableProducts.map(p => (
                    <Picker.Item key={p.index} label={p.name} value={p.index} />
                ))}
            </Picker>
        )}
    </View>
)}
```

---

## 📝 Résumé des Actions

### Backend (1 action)
- [ ] Créer route `GET /api/delivery/product-availability/{service_id}/{product_index}`
- [ ] Créer route `GET /api/delivery/product-config/list/{service_id}` (pour réutilisation)

### Frontend (4 actions)
- [ ] Vérifier disponibilité AVANT d'ouvrir `OrderDeliveryModal`
- [ ] Afficher infos de délai dans `OrderDeliveryModal`
- [ ] Modifier workflow après création produit → ouvrir configuration
- [ ] Ajouter option réutilisation configuration dans `ProductDeliveryConfigModal`

---

## 🎯 Priorités

1. **URGENT** : Route API disponibilité + vérification avant ouverture modal
2. **IMPORTANT** : Workflow automatique après création produit
3. **UTILE** : Affichage délais dans modal + réutilisation configuration


