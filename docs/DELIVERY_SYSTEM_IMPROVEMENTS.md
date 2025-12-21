# Améliorations du Système de Livraison - Analyse Complète

## 🔍 État Actuel du Système

### 1. ✅ Ce qui est implémenté

- **Configuration de livraison** : Stockage complet (adresse, GPS, type véhicule, temps préparation, plages horaires)
- **Temps de préparation** : Intégré dans le calcul du temps total lors du matching
- **Validation produit** : Fonction `validate_product_for_activation` existe mais **pas forcée**
- **Notification configuration manquante** : Fonction existe mais **TODO** (seulement log warning)
- **✅ Service de disponibilité** : `ProductAvailabilityService` existe et vérifie :
  - Configuration de livraison (retourne erreur si absente)
  - Jours de disponibilité (`availability_days`)
  - Plages horaires (`pickup_availability_schedule`)
  - Retourne message avec jours disponibles si indisponible
- **✅ Vérification dans create_client_order** : Déjà présente (ligne 876-916 `delivery_routes.rs`)
  - Vérifie la disponibilité avant création
  - Retourne produits similaires si indisponible

### 2. ❌ Ce qui manque

#### A. Notifications Utilisateur

**État actuel** :
- ✅ **Backend** : Retourne raison d'indisponibilité et jours disponibles dans `AvailabilityCheckResult`
- ✅ **Backend** : Retourne produits similaires si indisponible
- ⚠️ **Frontend** : Ne vérifie pas la disponibilité AVANT d'ouvrir le modal
- ❌ **Frontend** : N'affiche pas les informations de délai (temps de préparation) de manière visible
- ❌ **Frontend** : Ne montre pas clairement les jours/heures de disponibilité avant commande

**Impact** :
- Le client ouvre le modal même si le produit est indisponible
- Le client ne voit le délai de préparation qu'après création de la commande
- Pas d'affichage préventif des plages horaires disponibles

---

#### B. Comportement sans Configuration

**État actuel** :
- ✅ **Vérification backend existe** : `ProductAvailabilityService.check_availability()` retourne erreur si config absente
- ✅ **Vérification dans create_client_order** : Déjà présente et retourne produits similaires si indisponible
- ⚠️ **Frontend** : `OrderDeliveryModal` ne vérifie pas la configuration AVANT d'afficher le modal
- ❌ Pas de contrainte pour les produits (contrairement aux prestations) : validation pas forcée après création
- ❌ Pas de workflow automatique pour forcer la configuration après création produit

**Code actuel** (`OrderDeliveryModal.tsx` ligne 637) :
```typescript
const handleSubmit = async () => {
    // Vérifie serviceId, dropoffLocation, selectedProducts
    // MAIS ne vérifie PAS si la configuration de livraison existe
    const response = await apiPost('/api/delivery/client-order', payload);
    // ...
}
```

**Ce qui devrait se passer** :
1. Vérifier si `product_delivery_config` existe pour ce produit
2. Si non : afficher un message d'erreur et rediriger vers la configuration
3. Si oui mais incomplète : informer l'utilisateur et suggérer la compléter
4. Si complète : vérifier la disponibilité horaire avant de créer la commande

---

#### C. Workflow de Création de Produit

**Problème actuel** :
- ❌ Après création d'un produit, navigation directe vers "Mes Services"
- ❌ Pas d'écran de configuration de livraison qui s'ouvre automatiquement
- ❌ Pas de contrainte pour configurer la livraison avant d'utiliser le produit

**Code actuel** (`FormulaireYukpoIntelligentScreen.tsx` ligne 423) :
```typescript
// Après création réussie
(navigation as any).navigate('Main', { screen: 'Services' });
// ❌ Devrait être : navigation vers configuration de livraison
```

---

#### D. Réutilisation de Configuration

**Problème actuel** :
- ❌ Pas d'option pour réutiliser la configuration d'un autre produit
- ❌ L'utilisateur doit refaire toute la configuration pour chaque produit
- ❌ Pas de configuration "par défaut" pour un prestataire

**Besoin** :
- Option au début de l'écran de configuration : "Utiliser la même configuration que le produit X"
- Option : "Utiliser la configuration par défaut du prestataire"
- Possibilité de copier/modifier une configuration existante

---

## 📋 Plan d'Action Détaillé

### Priorité 1 : Amélioration Frontend - Vérifications Préventives

#### 1.1 Vérification disponibilité AVANT ouverture du modal

**Frontend** : `OrderDeliveryModal.tsx` (ou composant parent qui ouvre le modal)

**Modification** :
```typescript
// Avant d'ouvrir le modal, vérifier la disponibilité
const checkAvailabilityBeforeOpen = async () => {
    try {
        const response = await apiGet(`/api/delivery/product-availability/${serviceId}/${productIndex}`);
        if (response.success && response.data) {
            const availability = response.data as AvailabilityCheckResult;
            
            if (!availability.is_available) {
                // Afficher message d'indisponibilité
                Alert.alert(
                    'Produit indisponible',
                    availability.reason || 'Ce produit n\'est pas disponible actuellement.',
                    [
                        {
                            text: 'Voir d\'autres prestataires',
                            onPress: () => {
                                // Rechercher produits similaires
                                // Navigation vers recherche
                            }
                        },
                        {
                            text: 'OK',
                            style: 'cancel'
                        }
                    ]
                );
                return false; // Ne pas ouvrir le modal
            }
            
            // Afficher info de préparation si présent
            if (availability.preparation_time_minutes && availability.preparation_time_minutes > 0) {
                // Afficher info-bulle : "Temps de préparation : X minutes"
            }
        }
        return true; // Ouvrir le modal
    } catch (error) {
        console.error('Erreur vérification disponibilité:', error);
        return true; // Ouvrir quand même en cas d'erreur
    }
};
```

#### 1.2 Affichage des informations de disponibilité dans le modal

**Frontend** : `OrderDeliveryModal.tsx`

**Ajouter en haut du modal** :
```typescript
// Charger les infos de disponibilité au montage
useEffect(() => {
    if (visible && serviceId && productIndex !== undefined) {
        loadAvailabilityInfo();
    }
}, [visible, serviceId, productIndex]);

const loadAvailabilityInfo = async () => {
    try {
        const response = await apiGet(`/api/delivery/product-availability/${serviceId}/${productIndex}`);
        if (response.success && response.data) {
            const info = response.data as ProductAvailabilityInfo;
            setAvailabilityInfo(info);
            
            // Calculer l'heure estimée de disponibilité
            if (info.preparation_time_minutes) {
                const readyAt = new Date();
                readyAt.setMinutes(readyAt.getMinutes() + info.preparation_time_minutes);
                setEstimatedReadyTime(readyAt);
            }
        }
    } catch (error) {
        console.error('Erreur chargement disponibilité:', error);
    }
};

// Afficher dans le modal
{availabilityInfo && availabilityInfo.preparation_time_minutes && availabilityInfo.preparation_time_minutes > 0 && (
    <View style={styles.preparationInfo}>
        <SafeIcon name="clock" size={16} color={modernColors.primary} />
        <Text style={styles.preparationText}>
            Temps de préparation : {availabilityInfo.preparation_time_minutes} minutes
        </Text>
        {estimatedReadyTime && (
            <Text style={styles.readyTimeText}>
                Disponible vers {estimatedReadyTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
        )}
    </View>
)}
```

**Note** : Le backend retourne déjà ces informations dans `create_client_order`, mais il faut les afficher AVANT la création.

---

### Priorité 2 : Contrainte Configuration Livraison

#### 2.1 Vérification avant création de commande

**Backend** : Modifier `/api/delivery/client-order`
```rust
// 1. Charger la configuration
let config = get_product_delivery_config(service_id, product_index).await?;

// 2. Vérifier si complète
if !config.is_configured {
    return Err(AppError::BadRequest(
        "Configuration de livraison incomplète pour ce produit"
    ));
}

// 3. Vérifier disponibilité horaire
let availability = check_product_availability(
    &config.pickup_availability_schedule,
    Utc::now(),
    config.preparation_time_minutes.unwrap_or(0),
)?;

if !availability.is_available_now {
    return Err(AppError::BadRequest(format!(
        "Produit non disponible maintenant. Disponible : {}",
        availability.next_available_times
    )));
}
```

**Frontend** : `OrderDeliveryModal.tsx`
- Charger la configuration avant d'afficher le modal
- Si non configurée : afficher message + bouton "Configurer maintenant"
- Si indisponible : afficher message avec alternatives

#### 2.2 Workflow automatique après création produit

**Frontend** : `FormulaireYukpoIntelligentScreen.tsx`

**Modification** :
```typescript
// Après création réussie du produit
if (response.success && serviceId && productIndex !== undefined) {
    // Vérifier si c'est un produit (pas une prestation)
    const isProduct = typeOffre !== 'prestation' && typeOffre !== 'service';
    
    if (isProduct) {
        // Ouvrir le modal de configuration de livraison
        navigation.navigate('ProductDeliveryConfig', {
            serviceId: Number(serviceId),
            productIndex: productIndex,
            productName: productName,
            // Option : forcer la configuration (pas de "skip")
            required: true,
        });
    } else {
        // Pour prestations, aller directement à Mes Services
        navigation.navigate('Main', { screen: 'Services' });
    }
}
```

**Nouveau composant** : `ProductDeliveryConfigScreen.tsx`
- Écran dédié (pas juste un modal) pour la configuration
- Option en haut : "Utiliser la configuration d'un autre produit"
- Liste déroulante avec les produits du même prestataire
- Bouton "Créer nouvelle configuration"
- Validation avant de quitter (si `required: true`)

---

### Priorité 3 : Réutilisation de Configuration

#### 3.1 Option de réutilisation dans le modal

**Modifier** : `ProductDeliveryConfigModal.tsx`

**Ajout en haut du modal** :
```typescript
const [useExistingConfig, setUseExistingConfig] = useState(false);
const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
const [availableProducts, setAvailableProducts] = useState<Array<{index: number, name: string}>>([]);

// Charger les produits du même service
useEffect(() => {
    if (visible && serviceId) {
        loadAvailableProducts(serviceId);
    }
}, [visible, serviceId]);

// Afficher les options
{!isTransversalMode && (
    <View style={styles.reuseSection}>
        <Text style={styles.label}>Utiliser une configuration existante ?</Text>
        <Switch
            value={useExistingConfig}
            onValueChange={setUseExistingConfig}
        />
        {useExistingConfig && (
            <Picker
                selectedValue={selectedProductIndex}
                onValueChange={(idx) => {
                    setSelectedProductIndex(idx);
                    // Charger la configuration du produit sélectionné
                    loadConfigFromProduct(serviceId, idx);
                }}
            >
                {availableProducts.map(p => (
                    <Picker.Item key={p.index} label={p.name} value={p.index} />
                ))}
            </Picker>
        )}
    </View>
)}
```

#### 3.2 API pour récupérer les configurations existantes

**Backend** : Nouvelle route `/api/delivery/product-config/list/{service_id}`
```rust
async fn list_product_configs(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(service_id): Path<i32>,
) -> AppResult<Json<Value>> {
    // Retourner la liste des configurations pour ce service
    // avec product_index et product_name
}
```

---

## 🧪 Tests à Effectuer

### Test 1 : Notification délais
- Créer commande avec `preparation_time_minutes = 30`
- Vérifier que le message "Prêt dans 30 minutes" s'affiche
- Vérifier que l'heure estimée est correcte

### Test 2 : Notification indisponibilité
- Configurer produit avec plages horaires (Lundi-Vendredi 8h-18h)
- Tenter commande le dimanche → doit afficher message d'indisponibilité
- Tenter commande lundi 7h → doit afficher "Disponible à partir de 8h"

### Test 3 : Contrainte configuration
- Créer produit sans configuration de livraison
- Tenter de commander → doit afficher erreur + bouton configuration
- Configurer → doit permettre de commander

### Test 4 : Workflow création produit
- Créer nouveau produit
- Vérifier que l'écran de configuration s'ouvre automatiquement
- Vérifier que "skip" n'est pas disponible si `required: true`
- Après configuration, vérifier navigation vers "Mes Services"

### Test 5 : Réutilisation configuration
- Configurer produit A avec tous les paramètres
- Créer produit B
- Choisir "Utiliser configuration de A"
- Vérifier que tous les champs sont pré-remplis
- Modifier et sauvegarder → doit créer nouvelle config pour B

---

## 📝 Fichiers à Modifier/Créer

### Backend
- [ ] `backend/src/routes/delivery_routes.rs` : **NOUVELLE ROUTE** `GET /api/delivery/product-availability/{service_id}/{product_index}` pour vérifier disponibilité
- [ ] `backend/src/routes/delivery_routes.rs` : Nouvelle route `GET /api/delivery/product-config/list/{service_id}` pour liste configurations
- [ ] `backend/src/services/notification_service.rs` : Implémenter `notify_missing_delivery_config()` (push notification)
- [ ] `backend/src/routes/delivery_routes.rs` : Améliorer réponse `create_client_order` pour inclure `preparation_info` avec `ready_at`

### Frontend
- [ ] `mobile/src/components/delivery/OrderDeliveryModal.tsx` : 
  - Charger disponibilité au montage et afficher informations
  - Afficher temps de préparation et heure estimée
  - Gérer cas indisponibilité avec produits similaires
- [ ] `mobile/src/components/ProductCard.tsx` ou composant qui ouvre OrderDeliveryModal : Vérifier disponibilité AVANT d'ouvrir le modal
- [ ] `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` : Modifier workflow après création produit → ouvrir configuration livraison
- [ ] `mobile/src/components/delivery/ProductDeliveryConfigModal.tsx` : Ajouter option réutilisation configuration
- [ ] `mobile/src/screens/delivery/ProductDeliveryConfigScreen.tsx` : **NOUVEAU** - Écran dédié configuration (optionnel, peut rester modal)

---

## 🎯 Ordre d'Implémentation Recommandé

1. **Phase 1** : Vérification configuration avant commande (backend + frontend)
2. **Phase 2** : Workflow automatique après création produit
3. **Phase 3** : Notifications utilisateur (délais + indisponibilité)
4. **Phase 4** : Réutilisation de configuration

