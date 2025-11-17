# 🎯 Plan Complet : Améliorations Système de Livraison Intelligent

## 📋 SYNTHÈSE DE TOUTES LES OBSERVATIONS DE CETTE SESSION

### **Améliorations identifiées** :

1. ✅ **Matching déclenché seulement quand client commande** (pas à la création vidéo)
2. ✅ **Flux de commande client direct** (pas de partage de lien par prestataire)
3. ✅ **Auto-remplissage des adresses** (depuis base de données + GPS courant)
4. ✅ **Modification des adresses à tout moment**
5. ✅ **Systématisation des infos de livraison** (obligatoires pour activation produit)
6. ✅ **Formulaire persistant si infos manquantes** (notification prestataire)
7. ✅ **Plages horaires prestataire/client** + Matching intelligent
8. ✅ **Navigation vidéos liées** (chaînage de vidéos)
9. ✅ **Externalisation du système** (WhatsApp, Facebook)
10. ✅ **Verrouillage confirmation livraison** (vérification solde + rechargement immédiat)
11. ✅ **Gestion financière avancée** (réservation fonds + débit définitif + reversement)

---

## 🔄 1. SYSTÉMATISATION DES INFOS DE LIVRAISON

### ✅ **Observation : Rendre OBLIGATOIRE la configuration livraison**

**Logique proposée** :
```
Produit créé → Statut : "draft"
    ↓
Configuration livraison REQUISE :
  - ✅ Point de pickup (adresse + GPS)
  - ✅ Type de véhicule nécessaire
  - ✅ Plages horaires de récupération
    ↓
Produit → Statut : "active" (seulement après configuration complète)
```

### **Avantages** :
- ✅ Tous les produits actifs ont des infos de livraison complètes
- ✅ Plus besoin de les saisir lors de la création de vidéo
- ✅ Auto-remplissage lors de création vidéo depuis produit
- ✅ Client peut toujours commander (pas d'infos manquantes)

---

## 🔧 IMPLÉMENTATION

### **1. Nouveau modèle : Configuration livraison produit**

```sql
-- Migration : Table product_delivery_config

CREATE TABLE IF NOT EXISTS product_delivery_config (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    
    -- Pickup (obligatoire)
    pickup_address TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    
    -- Type véhicule (obligatoire)
    required_vehicle_type_id INTEGER NOT NULL REFERENCES delivery_parcel_types(id),
    weight_kg DOUBLE PRECISION,
    volume_cm3 DOUBLE PRECISION,
    requires_isothermal BOOLEAN DEFAULT FALSE,
    requires_fragile_handling BOOLEAN DEFAULT FALSE,
    
    -- Plages horaires de récupération (obligatoire)
    pickup_availability_schedule JSONB NOT NULL,  -- Format structuré ci-dessous
    
    -- Informations additionnelles
    pickup_instructions TEXT,
    billing_mode VARCHAR(50) DEFAULT 'standard',  -- 'standard' ou 'merchant_inclusive'
    billing_partner_label TEXT,  -- Si livraison incluse dans le prix
    
    -- Statut
    is_configured BOOLEAN DEFAULT FALSE,  -- TRUE quand tous les champs requis sont remplis
    configured_at TIMESTAMPTZ,
    configured_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id, product_index)
);

CREATE INDEX idx_product_delivery_config_service ON product_delivery_config(service_id, product_index);
CREATE INDEX idx_product_delivery_config_active ON product_delivery_config(is_configured) WHERE is_configured = TRUE;

-- Format pickup_availability_schedule JSONB :
-- {
--   "monday": [{"start": "08:00", "end": "18:00"}],
--   "tuesday": [{"start": "08:00", "end": "18:00"}],
--   "wednesday": [{"start": "08:00", "end": "18:00"}],
--   "thursday": [{"start": "08:00", "end": "18:00"}],
--   "friday": [{"start": "08:00", "end": "18:00"}],
--   "saturday": [{"start": "09:00", "end": "14:00"}],
--   "sunday": null  -- ou [] si fermé
-- }
```

### **2. Validation produit avant activation**

```rust
// backend/src/services/product_validation_service.rs (NOUVEAU)

pub async fn validate_product_for_activation(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<ProductValidationResult> {
    // 1. Vérifier existence produit
    let service = sqlx::query!(
        "SELECT data FROM services WHERE id = $1",
        service_id
    )
    .fetch_optional(pool)
    .await?;
    
    let service_data = service.ok_or_else(|| {
        AppError::NotFound("Service non trouvé".into())
    })?;
    
    let products = service_data.data
        .get("produits")
        .and_then(|p| p.get("valeur"))
        .and_then(|v| v.as_array());
    
    let product = products
        .and_then(|arr| arr.get(product_index as usize))
        .ok_or_else(|| {
            AppError::BadRequest("Produit non trouvé".into())
        })?;
    
    // 2. Vérifier configuration livraison
    let delivery_config = sqlx::query!(
        "SELECT is_configured FROM product_delivery_config 
         WHERE service_id = $1 AND product_index = $2",
        service_id,
        product_index
    )
    .fetch_optional(pool)
    .await?;
    
    let is_delivery_configured = delivery_config
        .map(|c| c.is_configured)
        .unwrap_or(false);
    
    // 3. Vérifier autres champs obligatoires
    let has_name = product.get("nom")
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    
    let has_price = product.get("prix")
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    
    let errors = vec![
        (!has_name, "Nom du produit requis".into()),
        (!has_price, "Prix du produit requis".into()),
        (!is_delivery_configured, "Configuration livraison requise".into()),
    ]
    .into_iter()
    .filter(|(condition, _)| *condition)
    .map(|(_, msg)| msg)
    .collect();
    
    let is_valid = errors.is_empty();
    
    Ok(ProductValidationResult {
        is_valid,
        errors,
        missing_fields: vec![
            (!has_name, "nom".into()),
            (!has_price, "prix".into()),
            (!is_delivery_configured, "delivery_config".into()),
        ]
        .into_iter()
        .filter(|(condition, _)| *condition)
        .map(|(_, field)| field)
        .collect(),
    })
}

pub async fn activate_product_if_valid(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
) -> AppResult<bool> {
    let validation = validate_product_for_activation(pool, service_id, product_index).await?;
    
    if !validation.is_valid {
        return Ok(false);  // Produit non validé, ne pas activer
    }
    
    // Marquer le produit comme actif dans products_lifecycle
    sqlx::query!(
        r#"
        UPDATE products_lifecycle
        SET is_active = TRUE,
            updated_at = NOW()
        WHERE service_id = $1 AND product_index = $2
        "#,
        service_id,
        product_index
    )
    .execute(pool)
    .await?;
    
    Ok(true)
}
```

### **3. Interface création produit : Étape livraison obligatoire**

```typescript
// mobile/src/components/ProductManagerMobile.tsx

// ✅ Ajouter étape "Configuration livraison" OBLIGATOIRE

const [activeStep, setActiveStep] = useState<'info' | 'media' | 'delivery' | 'review'>('info');
const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig | null>(null);
const [canActivate, setCanActivate] = useState(false);

useEffect(() => {
    const checkCanActivate = async () => {
        if (!serviceId || !productIndex) return;
        
        // Vérifier si configuration livraison complète
        const config = await fetchDeliveryConfig(serviceId, productIndex);
        if (config?.is_configured) {
            setCanActivate(true);
            setDeliveryConfig(config);
        } else {
            setCanActivate(false);
        }
    };
    
    checkCanActivate();
}, [serviceId, productIndex]);

// ✅ Étape livraison obligatoire
<View style={styles.stepContainer}>
    <Text style={styles.stepTitle}>Configuration livraison</Text>
    <Text style={styles.stepSubtitle}>
        Configurez les modalités de livraison pour activer ce produit
    </Text>
    
    {/* Pickup */}
    <View style={styles.section}>
        <Text style={styles.sectionLabel}>Point de collecte *</Text>
        <TouchableOpacity
            style={styles.gpsButton}
            onPress={() => setShowPickupGPSModal(true)}
        >
            <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
            <Text style={styles.gpsButtonText}>Sélectionner sur la carte</Text>
        </TouchableOpacity>
        {pickupAddress && (
            <Text style={styles.addressText}>{pickupAddress}</Text>
        )}
    </View>
    
    {/* Type véhicule */}
    <View style={styles.section}>
        <Text style={styles.sectionLabel}>Type de véhicule nécessaire *</Text>
        <Select
            value={vehicleTypeId}
            onChange={setVehicleTypeId}
            options={VEHICLE_OPTIONS}
        />
    </View>
    
    {/* Plages horaires récupération */}
    <View style={styles.section}>
        <Text style={styles.sectionLabel}>Jours et heures de récupération *</Text>
        <AvailabilitySchedulePicker
            value={pickupSchedule}
            onChange={setPickupSchedule}
        />
    </View>
    
    {/* Bouton sauvegarder */}
    <NativeButton
        variant="primary"
        onPress={handleSaveDeliveryConfig}
        disabled={!pickupAddress || !vehicleTypeId || !pickupSchedule}
    >
        Enregistrer configuration livraison
    </NativeButton>
</View>

// ✅ Blocage activation si pas configuré
{!canActivate && (
    <View style={styles.warningBanner}>
        <SafeIcon name="alert-circle" size={20} color="#f59e0b" />
        <Text style={styles.warningText}>
            Configurez la livraison pour activer ce produit
        </Text>
    </View>
)}
```

---

## 📅 2. PLAGES HORAIRES : PRESTATAIRE + CLIENT + MATCHING INTELLIGENT

### ✅ **Observation : Système de planification avancé**

**Fonctionnalités requises** :
1. **Prestataire** : Définit jours/heures possibles de récupération
2. **Client** : Planifie jour/heure souhaités de livraison
3. **Matching intelligent** : Prend en compte les contraintes des deux

---

### **Architecture proposée**

#### **1. Table : Plages horaires prestataire (déjà dans product_delivery_config)**

```sql
-- pickup_availability_schedule (JSONB) dans product_delivery_config
-- Format :
{
  "monday": [{"start": "08:00", "end": "18:00"}],
  "tuesday": [{"start": "08:00", "end": "18:00"}],
  "wednesday": [{"start": "08:00", "end": "18:00"}],
  "thursday": [{"start": "08:00", "end": "18:00"}],
  "friday": [{"start": "08:00", "end": "18:00"}],
  "saturday": [{"start": "09:00", "end": "14:00"}],
  "sunday": null  -- Fermé
}
```

#### **2. Table : Préférences livraison client**

```sql
-- Migration : Table client_delivery_preferences

CREATE TABLE IF NOT EXISTS client_delivery_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES delivery_requests(id) ON DELETE SET NULL,
    
    -- Préférences de livraison
    preferred_delivery_date DATE,
    preferred_delivery_time_start TIME,  -- Ex: 14:00
    preferred_delivery_time_end TIME,    -- Ex: 18:00
    preferred_delivery_window_hours INTEGER DEFAULT 2,  -- Fenêtre de 2h par défaut
    
    -- Contraintes
    avoid_days INTEGER[],  -- Jours à éviter (1=Lundi, 7=Dimanche)
    urgency_level VARCHAR(50) DEFAULT 'standard',  -- 'standard', 'urgent', 'scheduled'
    
    -- Flexibilité
    is_flexible BOOLEAN DEFAULT TRUE,  -- Accepte d'autres créneaux si indisponible
    flexibility_window_days INTEGER DEFAULT 3,  -- Flexibilité sur 3 jours
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, delivery_id)
);

CREATE INDEX idx_client_delivery_preferences_user ON client_delivery_preferences(user_id);
CREATE INDEX idx_client_delivery_preferences_date ON client_delivery_preferences(preferred_delivery_date);
```

#### **3. Matching intelligent avec contraintes horaires**

```rust
// backend/src/services/delivery_matching_service.rs

pub async fn intelligent_matching_with_schedule(
    &self,
    delivery_summary: &DeliverySummary,
    client_preferences: Option<ClientDeliveryPreferences>,
) -> AppResult<Vec<MatchingCourier>> {
    let service_id = delivery_summary.metadata
        .get("service_id")
        .and_then(|v| v.as_i64())
        .map(|i| i as i32);
    
    let product_index = delivery_summary.metadata
        .get("product_index")
        .and_then(|v| v.as_i64())
        .map(|i| i as i32);
    
    // ✅ 1. Récupérer configuration livraison produit
    let product_config = if let (Some(sid), Some(pidx)) = (service_id, product_index) {
        sqlx::query!(
            "SELECT pickup_availability_schedule, required_vehicle_type_id 
             FROM product_delivery_config 
             WHERE service_id = $1 AND product_index = $2 AND is_configured = TRUE",
            sid,
            pidx
        )
        .fetch_optional(&self.pool)
        .await?
    } else {
        None
    };
    
    // ✅ 2. Calculer créneau de pickup acceptable
    let pickup_time_slot = calculate_pickup_time_slot(
        &product_config,
        &client_preferences,
    ).await?;
    
    // ✅ 3. Rechercher coursiers disponibles pour ce créneau
    let available_couriers = find_couriers_for_time_slot(
        &self.pool,
        &delivery_summary,
        &pickup_time_slot,
        product_config.as_ref().map(|c| c.required_vehicle_type_id),
    ).await?;
    
    // ✅ 4. Calculer créneau de livraison (pickup + temps transport)
    let delivery_time_slot = calculate_delivery_time_slot(
        &pickup_time_slot,
        &delivery_summary,
        &client_preferences,
    ).await?;
    
    // ✅ 5. Filtrer coursiers selon disponibilité
    let matched_couriers: Vec<MatchingCourier> = available_couriers
        .into_iter()
        .filter_map(|courier| {
            // Vérifier si coursier disponible dans le créneau
            if is_courier_available_for_slot(&courier, &pickup_time_slot, &delivery_time_slot) {
                Some(MatchingCourier {
                    courier_id: courier.id,
                    score: calculate_matching_score(&courier, &delivery_summary, &delivery_time_slot),
                    estimated_pickup_time: pickup_time_slot.start,
                    estimated_delivery_time: delivery_time_slot.end,
                    availability_window: pickup_time_slot.clone(),
                })
            } else {
                None
            }
        })
        .collect();
    
    // ✅ 6. Trier par score (meilleur match en premier)
    let mut sorted = matched_couriers;
    sorted.sort_by(|a, b| b.score.cmp(&a.score));
    
    Ok(sorted)
}

async fn calculate_pickup_time_slot(
    product_config: &Option<ProductDeliveryConfig>,
    client_preferences: &Option<ClientDeliveryPreferences>,
) -> AppResult<TimeSlot> {
    let now = Utc::now();
    
    // Si client a spécifié une préférence de livraison
    if let Some(prefs) = client_preferences {
        if let Some(delivery_date) = prefs.preferred_delivery_date {
            // Calculer quand récupérer pour livrer à cette date/heure
            let delivery_datetime = chrono::NaiveDateTime::new(
                delivery_date,
                prefs.preferred_delivery_time_start.unwrap_or_else(|| chrono::NaiveTime::from_hms(14, 0, 0)),
            );
            
            // Estimer temps de transport (ex: 2h)
            let estimated_transit_hours = 2;
            let pickup_datetime = delivery_datetime - chrono::Duration::hours(estimated_transit_hours);
            
            // Vérifier si pickup_datetime est dans les plages horaires du prestataire
            if let Some(config) = product_config {
                if is_datetime_in_availability_window(&pickup_datetime, &config.pickup_availability_schedule) {
                    return Ok(TimeSlot {
                        start: pickup_datetime,
                        end: pickup_datetime + chrono::Duration::hours(1),  // Fenêtre de 1h
                    });
                }
            }
            
            // Si pas compatible, chercher le prochain créneau disponible
            return find_next_available_slot(
                &pickup_datetime,
                product_config,
                prefs.flexibility_window_days,
            ).await;
        }
    }
    
    // Pas de préférence client : utiliser prochaine disponibilité prestataire
    if let Some(config) = product_config {
        return find_next_available_slot(&now, Some(config), 7).await;
    }
    
    // Pas de config : pickup immédiat
    Ok(TimeSlot {
        start: now,
        end: now + chrono::Duration::hours(1),
    })
}
```

---

## 🔔 3. FORMULAIRE PERSISTANT SI INFOS MANQUANTES

### ✅ **Observation : Notification prestataire si infos manquantes**

**Scénario** :
```
Client clique "Se faire livrer" pour un produit
    ↓
Backend vérifie : product_delivery_config existe et is_configured = TRUE ?
    ↓
❌ NON → Créer livraison avec statut "pending_delivery_config"
    ↓
📧 Notification prestataire : "Configuration livraison requise"
    ↓
📋 Formulaire persistant dans app prestataire
    ↓
Prestataire complète les infos
    ↓
✅ Configuration sauvegardée + Produit activé
    ↓
🔍 Matching déclenché automatiquement
```

### **Implémentation**

```rust
// backend/src/routes/delivery_routes.rs

async fn create_delivery_from_client_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<ClientOrderDeliveryPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    
    // ✅ 1. Vérifier si configuration livraison existe
    let delivery_config = if let Some(pidx) = payload.product_index {
        sqlx::query!(
            "SELECT is_configured, pickup_address, pickup_latitude, pickup_longitude,
                    required_vehicle_type_id, pickup_availability_schedule
             FROM product_delivery_config 
             WHERE service_id = $1 AND product_index = $2",
            payload.service_id,
            pidx
        )
        .fetch_optional(&state.pg)
        .await?
    } else {
        None
    };
    
    // ✅ 2. Si config manquante ou incomplète
    if delivery_config.as_ref().map(|c| !c.is_configured).unwrap_or(true) {
        // Créer livraison avec statut spécial
        let summary = create_delivery_with_missing_config(
            &state,
            payload,
            user.id,
        ).await?;
        
        // ✅ 3. Notifier le prestataire
        notify_provider_missing_config(
            &state,
            payload.service_id,
            payload.product_index,
            summary.id,
        ).await?;
        
        return Ok(Json(json!({
            "delivery": summary,
            "status": "pending_delivery_config",
            "message": "Configuration livraison requise. Le prestataire a été notifié.",
            "provider_notified": true,
        })));
    }
    
    // ✅ 4. Si config complète, créer livraison normalement
    // (code existant...)
}
```

### **Interface prestataire : Notification persistante**

```typescript
// mobile/src/components/DeliveryConfigNotification.tsx (NOUVEAU)

const DeliveryConfigNotification: React.FC = ({ serviceId, productIndex }) => {
    const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
    
    useEffect(() => {
        const loadPendingDeliveries = async () => {
            const response = await apiGet(
                `/api/delivery/pending-config?service_id=${serviceId}&product_index=${productIndex}`
            );
            setPendingDeliveries(response.data.deliveries || []);
        };
        
        loadPendingDeliveries();
        
        // Écouter nouvelles livraisons en attente
        const ws = subscribeToDeliveryUpdates(serviceId, (delivery) => {
            if (delivery.status === 'pending_delivery_config') {
                setPendingDeliveries(prev => [...prev, delivery]);
            }
        });
        
        return () => ws.close();
    }, [serviceId, productIndex]);
    
    if (pendingDeliveries.length === 0) {
        return null;
    }
    
    return (
        <View style={styles.notificationBanner}>
            <SafeIcon name="alert-circle" size={20} color="#ef4444" />
            <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>
                    Configuration livraison requise
                </Text>
                <Text style={styles.notificationText}>
                    {pendingDeliveries.length} commande(s) en attente
                </Text>
            </View>
            <TouchableOpacity
                style={styles.configureButton}
                onPress={() => {
                    navigation.navigate('ConfigureDelivery', {
                        serviceId,
                        productIndex,
                        pendingDeliveries: pendingDeliveries.length,
                    });
                }}
            >
                <Text style={styles.configureButtonText}>Configurer</Text>
            </TouchableOpacity>
        </View>
    );
};
```

---

## 🌐 4. EXTERNALISATION : LIVRAISON POUR PRESTATAIRES WHATSAPP/FACEBOOK

### ✅ **Observation : API publique pour prestataires externes**

**Cas d'usage** :
- Prestataire sur WhatsApp qui veut utiliser Yukpo pour livraison
- Prestataire sur Facebook Marketplace
- Prestataire sur site web externe
- Intégration avec systèmes e-commerce

### **Architecture proposée**

#### **1. API publique avec authentification API Key**

```rust
// backend/src/routes/delivery_external_routes.rs (NOUVEAU)

#[derive(Deserialize)]
struct ExternalDeliveryRequest {
    api_key: String,  // API Key du prestataire
    service_name: String,  // Nom du service (pour affichage)
    pickup: LocationInput,
    dropoff: LocationInput,
    parcel: ExternalParcelInput,
    client_info: ExternalClientInfo,
    preferences: Option<ExternalDeliveryPreferences>,
    metadata: Option<Value>,
}

#[derive(Deserialize)]
struct ExternalParcelInput {
    vehicle_type: String,  // "moto", "tricycle", "fourgonnette", etc.
    weight_kg: Option<f64>,
    description: Option<String>,
}

#[derive(Deserialize)]
struct ExternalClientInfo {
    name: String,
    phone: String,
    email: Option<String>,
    address: String,  // Adresse textuelle
}

#[derive(Deserialize)]
struct ExternalDeliveryPreferences {
    preferred_delivery_date: Option<String>,  // ISO date
    preferred_delivery_time_start: Option<String>,  // "14:00"
    preferred_delivery_time_end: Option<String>,  // "18:00"
    urgency: Option<String>,  // "standard", "urgent"
}

// ✅ Endpoint public
async fn create_external_delivery(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExternalDeliveryRequest>,
) -> AppResult<Json<Value>> {
    // ✅ 1. Valider API Key
    let provider = validate_api_key(&state, &payload.api_key).await?;
    
    // ✅ 2. Convertir en format interne
    let internal_payload = convert_external_to_internal(payload)?;
    
    // ✅ 3. Créer livraison (utiliser service delivery_service)
    let delivery_service = delivery_service(&state)?;
    let summary = delivery_service.create_delivery_request(internal_payload).await?;
    
    // ✅ 4. Générer token de suivi public
    let tracking_token = generate_public_tracking_token(&summary.id);
    
    // ✅ 5. Webhook optionnel (si configuré)
    if let Some(webhook_url) = provider.webhook_url {
        trigger_webhook(&webhook_url, &summary, &tracking_token).await?;
    }
    
    Ok(Json(json!({
        "success": true,
        "delivery_id": summary.id,
        "tracking_url": format!("https://yukpo.com/track/{}", tracking_token),
        "tracking_token": tracking_token,
        "estimated_pickup_time": summary.metadata.get("estimated_pickup_time"),
        "estimated_delivery_time": summary.metadata.get("estimated_delivery_time"),
    })))
}
```

#### **2. Table : API Keys prestataires externes**

```sql
-- Migration : Table external_delivery_providers

CREATE TABLE IF NOT EXISTS external_delivery_providers (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    api_secret VARCHAR(255) NOT NULL,  -- Pour validation
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    webhook_url TEXT,  -- URL pour notifications webhook
    allowed_ips INET[],  -- IPs autorisées (optionnel)
    rate_limit_per_hour INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    total_deliveries INTEGER DEFAULT 0,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_external_providers_api_key ON external_delivery_providers(api_key);
CREATE INDEX idx_external_providers_active ON external_delivery_providers(is_active) WHERE is_active = TRUE;
```

#### **3. Endpoint webhook pour suivi**

```rust
// ✅ Webhook pour notifier prestataire externe des changements de statut

async fn delivery_status_webhook(
    State(state): State<Arc<AppState>>,
    Path(tracking_token): Path<String>,
) -> AppResult<Json<Value>> {
    // Récupérer livraison depuis token public
    let delivery = get_delivery_by_public_token(&state, &tracking_token).await?;
    
    // Retourner infos publiques (pas de données sensibles)
    Ok(Json(json!({
        "delivery_id": delivery.id,
        "status": delivery.status,
        "estimated_pickup_time": delivery.metadata.get("estimated_pickup_time"),
        "estimated_delivery_time": delivery.metadata.get("estimated_delivery_time"),
        "courier_assigned": delivery.courier_id.is_some(),
        "last_update": delivery.updated_at,
    })))
}
```

#### **4. Intégration WhatsApp/Facebook**

```python
# Exemple : Script d'intégration WhatsApp (à fournir aux prestataires)

import requests
import json

YUKPO_API_KEY = "your_api_key_here"
YUKPO_API_URL = "https://api.yukpo.com/external/delivery"

def create_delivery_via_yukpo(
    pickup_address: str,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_address: str,
    dropoff_lat: float,
    dropoff_lng: float,
    client_name: str,
    client_phone: str,
    vehicle_type: str = "moto"
):
    """
    Créer une livraison via l'API Yukpo depuis WhatsApp/Facebook
    """
    payload = {
        "api_key": YUKPO_API_KEY,
        "service_name": "Ma boutique WhatsApp",
        "pickup": {
            "address": pickup_address,
            "latitude": pickup_lat,
            "longitude": pickup_lng,
        },
        "dropoff": {
            "address": dropoff_address,
            "latitude": dropoff_lat,
            "longitude": dropoff_lng,
        },
        "parcel": {
            "vehicle_type": vehicle_type,
            "weight_kg": 5.0,
        },
        "client_info": {
            "name": client_name,
            "phone": client_phone,
            "address": dropoff_address,
        },
    }
    
    response = requests.post(YUKPO_API_URL, json=payload)
    result = response.json()
    
    if result.get("success"):
        tracking_url = result["tracking_url"]
        # Envoyer le lien de suivi au client via WhatsApp
        send_whatsapp_message(
            client_phone,
            f"Votre commande est en cours de livraison ! Suivez votre colis : {tracking_url}"
        )
        return result["delivery_id"]
    
    return None
```

---

## 📊 TABLEAU RÉCAPITULATIF : TOUTES LES AMÉLIORATIONS

| # | Amélioration | Priorité | Complexité | Impact |
|---|-------------|----------|------------|--------|
| 1 | Matching seulement quand client commande | 🔴 Haute | ⭐ Faible | 🔥🔥🔥 Élevé |
| 2 | Flux commande client direct (modal auto) | 🔴 Haute | ⭐⭐ Moyenne | 🔥🔥🔥 Élevé |
| 3 | Auto-remplissage adresses | 🟡 Moyenne | ⭐ Faible | 🔥🔥 Moyen |
| 4 | Modification adresses à tout moment | 🟡 Moyenne | ⭐ Faible | 🔥 Moyen |
| 5 | **Systématisation infos livraison** | 🔴 Haute | ⭐⭐ Moyenne | 🔥🔥🔥 Élevé |
| 6 | **Formulaire persistant si manquant** | 🟡 Moyenne | ⭐⭐ Moyenne | 🔥🔥 Moyen |
| 7 | **Plages horaires + Matching intelligent** | 🔴 Haute | ⭐⭐⭐ Élevée | 🔥🔥🔥 Élevé |
| 8 | Navigation vidéos liées | 🟢 Basse | ⭐⭐ Moyenne | 🔥🔥 Moyen |
| 9 | **Externalisation API publique** | 🟡 Moyenne | ⭐⭐⭐ Élevée | 🔥🔥 Moyen |

**Légende** :
- Priorité : 🔴 Haute | 🟡 Moyenne | 🟢 Basse
- Complexité : ⭐ Faible | ⭐⭐ Moyenne | ⭐⭐⭐ Élevée
- Impact : 🔥 Moyen | 🔥🔥 Moyen | 🔥🔥🔥 Élevé

---

## 🎯 PLAN D'IMPLÉMENTATION PROPOSÉ

### **Phase 1 : Fondations (Critique)**
1. ✅ Systématisation infos livraison (obligatoire pour activation)
2. ✅ Matching seulement quand client commande
3. ✅ Flux commande client direct (modal automatique)

### **Phase 2 : UX Améliorée**
4. ✅ Auto-remplissage adresses
5. ✅ Modification adresses à tout moment
6. ✅ Formulaire persistant si manquant

### **Phase 3 : Intelligence Avancée**
7. ✅ Plages horaires + Matching intelligent

### **Phase 4 : Extensions**
8. ✅ Navigation vidéos liées
9. ✅ Externalisation API publique

### **Phase 5 : Gestion Financière Avancée**
10. ✅ Verrouillage confirmation livraison (vérification solde)
11. ✅ Réservation fonds + Débit définitif
12. ✅ Mécanisme rechargement immédiat
13. ✅ Gestion rejet produit (coût livraison non remboursable)
14. ✅ Reversement prestataire (après validation coursier)
15. ✅ Livraison offerte (débit compte prestataire)

---

## 💰 9. GESTION FINANCIÈRE ET VERROUILLAGE LIVRAISON

### ✅ **Observation : Verrouillage confirmation livraison**

**Règle** :
- Vérification solde AVANT matching coursier
- Coût = Prix produit + Coût livraison (si pas offerte)
- Si livraison offerte : Coût livraison débité sur compte prestataire
- Si solde insuffisant : Mécanisme rechargement immédiat

### ✅ **Architecture : Réservation + Débit Définitif**

**Flux proposé** :
```
1. Client commande → Vérification solde → Réservation fonds (avant matching)
2. Matching coursier → Coursier accepte → Débit définitif
3. Coursier refuse → Libération réservation (remboursement)
4. Livraison validée → Reversement prestataire (prix produit - commission)
5. Client rejette produit → Remboursement prix produit + Coût livraison NON remboursé
```

### ✅ **Moment du débit**

**Option recommandée** : Réservation au moment commande + Débit définitif quand coursier accepte

**Avantages** :
- ✅ Sécurisé : fonds garantis avant matching
- ✅ Débit définitif seulement si coursier accepte
- ✅ Libération automatique si coursier refuse

### ✅ **Gestion rejet produit**

**Règle** :
- Prix produit → REMBOURSÉ au client
- Coût livraison → NON REMBOURSÉ (reste débité)
- Prestataire → NON CRÉDITÉ (produit rejeté)
- Si livraison offerte : Coût livraison reste débité sur compte prestataire

### ✅ **Reversement prestataire**

**Règle** :
- Reversement seulement après validation livraison par coursier
- Montant = Prix produit - Commission Yukpo
- Commission = 5% (configurable)

### ✅ **Mécanisme rechargement immédiat**

**Si solde insuffisant** :
- Modal de rechargement affichée automatiquement
- Montant à recharger affiché clairement
- Méthodes paiement : Orange Money, MTN Mobile Money, Visa
- Deep links vers apps mobile money
- Après rechargement → Retry création livraison

### **Détails techniques** :

Voir document complet : `ARCHITECTURE_GESTION_FINANCIERE_LIVRAISON.md`

**Composants** :
- Table `delivery_payment_reservations` (réservation fonds)
- Service `DeliveryPaymentService` (gestion réservations/débits)
- Composants frontend : `DeliveryPaymentModal`, `DeliveryPaymentScreen`
- Intégration dans `DeliveryService.create_delivery_request`

---

## ✅ CONCLUSION

**Toutes tes observations sont excellentes** et ont été intégrées dans ce plan complet :

1. ✅ **Systématisation** : Configuration livraison obligatoire → Produits toujours prêts
2. ✅ **Notification** : Prestataire notifié si infos manquantes
3. ✅ **Plages horaires** : Prestataire + Client + Matching intelligent
4. ✅ **Externalisation** : API publique pour WhatsApp/Facebook
5. ✅ **Gestion financière** : Verrouillage solde + Réservation fonds + Reversement automatique

**Souhaites-tu que je commence l'implémentation par la Phase 1 ?**

