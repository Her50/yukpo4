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
12. ✅ **Vidéo de preuve de livraison** (enregistrement coursier + affichage client dans timeline)
13. ✅ **Gestion automatique du processus de livraison** (détection GPS, suggestions automatiques, changements de statut intelligents)
14. ✅ **Notifications automatiques** (push notifications, SMS/Email pour changements de statut)
15. ✅ **Auto-remplissage Brief IA** (depuis description produit/service)
16. ✅ **Endpoint Suggestions IA** (génération suggestions depuis brief)
17. ✅ **Commande depuis ProductCard** (bouton "Se faire livrer" avec modal commande)
18. ✅ **Commande depuis ChatModal** (intégration commande dans conversation)
19. ✅ **Amélioration affichage coûts** (produit + livraison séparés, livraison gratuite visible)
20. ✅ **Page publique pour dropoff** (client sans compte peut fournir adresse via lien)
21. ✅ **Sélection livreur personnel** (prestataire peut choisir son propre livreur)
22. ✅ **Notification quand client fournit adresse** (alerte prestataire quand dropoff confirmé)
23. ✅ **Amélioration UX dropoff pending** (meilleure gestion dropoff temporaire/optionnel)
24. ✅ **Chaînage vidéos lors création** (définir vidéos liées pendant création vidéo)
25. ✅ **Plusieurs lieux de stock** (prestataire peut avoir plusieurs points de départ, matching choisit le plus proche)
26. ✅ **Matching géographique GPS** (utilisation coordonnées GPS + formule Haversine pour distances réelles)
27. ✅ **Renommage termes pickup/dropoff** (remplacer par termes plus naturels : "départ" et "destination")

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

### **Phase 6 : Automatisation Intelligente**
16. ✅ Détection automatique proximité GPS (pickup/dropoff)
17. ✅ Suggestions automatiques changement de statut
18. ✅ Notifications push automatiques (changements de statut)
19. ✅ Notifications SMS/Email (clients sans app)
20. ✅ Changements de statut semi-automatiques (avec confirmation)

### **Phase 7 : Améliorations UX Studio Vidéo**
21. ✅ Auto-remplissage Brief IA (depuis description produit/service)
22. ✅ Endpoint Suggestions IA (génération suggestions depuis brief)
23. ✅ Amélioration affichage coûts (produit + livraison séparés)

### **Phase 8 : Points d'Entrée Commande Multiples**
24. ✅ Commande depuis ProductCard (bouton "Se faire livrer")
25. ✅ Commande depuis ChatModal (intégration dans conversation)
26. ✅ Sélection multi-produits (ajouter plusieurs produits lors commande)

### **Phase 9 : Fonctionnalités Avancées**
27. ✅ Page publique dropoff (client sans compte via lien)
28. ✅ Sélection livreur personnel (choix coursier par prestataire)
29. ✅ Notification client fournit adresse (alerte prestataire)
30. ✅ Amélioration UX dropoff pending (gestion dropoff temporaire)
31. ✅ Chaînage vidéos lors création (définir dépendances pendant création)
32. ✅ Plusieurs lieux de stock (points de départ multiples, matching choisit plus proche)
33. ✅ Renommage pickup/dropoff (termes plus naturels : "départ" / "destination")

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
4. Livraison validée → Reversement prestataire (prix produit - commission Yukpo 5%)
5. Client rejette produit :
   - Prix produit → REMBOURSÉ au client
   - Coût livraison :
     * Si client payait : NON REMBOURSÉ (reste débité chez client)
     * Si prestataire avait offert : PRÉLEVÉ chez le client (non remboursable)
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
- Prestataire → NON CRÉDITÉ (produit rejeté)

**Coût livraison selon qui l'a pris en charge** :
- **Si client a payé la livraison** (`billing_mode: 'standard'`) :
  - Coût livraison → NON REMBOURSÉ (reste débité chez le client)
  
- **Si prestataire avait offert la livraison** (`billing_mode: 'merchant_inclusive'`) :
  - Coût livraison → PRÉLEVÉ chez le client (non remboursable)
  - ⚠️ **Logique** : Le prestataire avait offert, donc pas de pénalité pour lui en cas de rejet
  - Le client doit assumer les frais de transport même si le produit est refusé

### ✅ **Reversement prestataire**

**Règle** :
- Reversement seulement après validation livraison par coursier
- Montant = Prix produit - Commission Yukpo
- **Commission Yukpo** : Variable d'environnement `YUKPO_COMMISSION_RATE` (par défaut : 5%)
- **Configuration** : Facilement modifiable via variable d'environnement (pas codé en dur)
- Commission calculée : `prix_produit * commission_rate`
- Montant reversé : `prix_produit - commission_yukpo`

**Configuration** :
- Variable d'environnement : `YUKPO_COMMISSION_RATE=0.05` (5%)
- Valeur par défaut : 5% si variable non définie
- Exemple : `YUKPO_COMMISSION_RATE=0.10` pour 10%

**Exemple** (avec commission par défaut 5%) :
```
Prix produit : 10 000 FCFA
Commission Yukpo (5%) : 500 FCFA
Montant reversé au prestataire : 9 500 FCFA
```

**Implémentation** :
```rust
// backend/src/services/delivery_payment_service.rs
let commission_rate = std::env::var("YUKPO_COMMISSION_RATE")
    .ok()
    .and_then(|v| v.parse::<f64>().ok())
    .unwrap_or(0.05);  // Par défaut 5% si variable non définie
```

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

## 📹 10. VIDÉO DE PREUVE DE LIVRAISON

### ✅ **Observation : Preuve visuelle de livraison**

**Scénario** :
- Coursier confirme livraison mais client n'est pas présent
- Coursier enregistre vidéo de preuve (15-30 secondes)
- Vidéo visible dans flux de suivi client

### ✅ **Workflow** :

```
1. Coursier arrive → Statut "arrival_destination"
2. Coursier clique "Livrer" → Modal choix : "Client présent" ou "Déposer sans présence"
3. Coursier choisit "Déposer sans présence" → Modal vidéo s'ouvre
4. Coursier enregistre vidéo (max 30s) → Aperçu affiché
5. Coursier valide → Upload vidéo → Statut "delivered" avec payload vidéo
6. Client reçoit notification → Ouvre flux de suivi
7. Timeline affiche checkpoint "delivered" avec vidéo visible
```

### ✅ **Composants** :

- **Backend** :
  - Endpoint `POST /api/delivery/{delivery_id}/proof/video` (upload vidéo)
  - Table `delivery_proof_media` (audit médias)
  - Stockage vidéo (S3, R2, ou local)
  - Génération thumbnails automatique

- **Mobile (Coursier)** :
  - Composant `DeliveryProofVideoRecorder` (enregistrement vidéo)
  - Intégration dans `DeliveryShoppingTrackingScreen`
  - Upload vidéo avec GPS et métadonnées

- **Frontend/Mobile (Client)** :
  - Affichage vidéo dans `DeliveryTimeline` / `TimelineStepper`
  - Player vidéo intégré avec thumbnail
  - Métadonnées : GPS, durée, date, emplacement

### **Détails techniques** :

Voir document complet : `ARCHITECTURE_VIDEO_PREUVE_LIVRAISON.md`

**Avantages** :
- ✅ Preuve visuelle incontestable
- ✅ Réduction litiges
- ✅ Transparence pour client
- ✅ Sécurité coursier

---

## 🤖 11. GESTION AUTOMATIQUE DU PROCESSUS DE LIVRAISON

### ✅ **Observation : Automatisation intelligente du processus**

**Problème actuel** :
- ❌ Les changements de statut sont **manuels** (coursier doit cliquer)
- ❌ Pas de détection automatique GPS
- ❌ Pas de suggestions intelligentes

**Objectifs** :
1. ✅ **Détection automatique GPS** : Détecter quand coursier est proche pickup/dropoff
2. ✅ **Suggestions automatiques** : Proposer changement de statut avec confirmation
3. ✅ **Changements semi-automatiques** : Changer statut automatiquement avec confirmation
4. ✅ **Notifications automatiques** : Push, SMS, Email pour tous les changements

---

### ✅ **1. Détection Automatique de Proximité GPS**

**Workflow** :
```
1. Coursier envoie position GPS (tracking_point)
2. Backend calcule distance avec pickup/dropoff
3. Si distance < 50m → Événement "proximity_pickup" ou "proximity_dropoff"
4. WebSocket → Coursier reçoit suggestion : "Vous êtes proche du pickup, confirmer récupération ?"
5. Coursier confirme → Statut change automatiquement
```

**Implémentation** :
- ✅ Fonction `check_proximity_and_suggest_status_update()` (déjà implémentée)
- ✅ Calcul distance Haversine (déjà implémenté)
- ⚠️ **Manque** : Envoi événement WebSocket + Notification push
- ⚠️ **Manque** : UI mobile avec bouton de confirmation

---

### ✅ **2. Notifications Automatiques**

**Notifications Push** (déjà partiellement implémenté) :
- ✅ `send_delivery_status_notifications()` existe
- ⚠️ **À améliorer** : Notifications pour tous les statuts importants
- ⚠️ **À améliorer** : Notifications de proximité GPS

**Notifications SMS/Email** (structure créée) :
- ✅ Service `delivery_notification_service` créé
- ⚠️ **Manque** : Intégration service SMS/Email (Twilio, SendGrid)
- ⚠️ **Manque** : Notifications pour clients sans compte Yukpo

---

### ✅ **3. Changements de Statut Semi-Automatiques**

**Workflow** :
```
1. Détection proximité GPS → Suggestion envoyée
2. Coursier reçoit notification : "Proche du pickup, confirmer récupération ?"
3. Coursier clique "Confirmer" → Statut change automatiquement
4. OU : Après X secondes sans réponse → Changement automatique (optionnel)
```

**Avantages** :
- ✅ Moins d'actions manuelles pour le coursier
- ✅ Statut toujours à jour (plus fiable)
- ✅ Client informé automatiquement

---

### **Détails techniques** :

**Backend** (déjà partiellement implémenté) :
```rust
// backend/src/services/delivery_service.rs
// Fonction check_proximity_and_suggest_status_update() existe
// À améliorer : Envoyer événement WebSocket + Notification push

// Nouveau : Événement WebSocket pour suggestion
DeliveryWsEvent::ProximitySuggestion {
    location_type: "pickup" | "dropoff",
    distance_meters: f64,
    suggested_status: DeliveryStatus,
    auto_confirm_after_seconds: Option<u64>,  // Changement auto après X secondes
}
```

**Mobile** :
```typescript
// mobile/src/screens/delivery/DeliveryShoppingTrackingScreen.tsx
// Écouter événement "proximity_suggestion"
// Afficher modal : "Proche du pickup, confirmer récupération ?"
// Bouton "Confirmer" → Change statut automatiquement
```

---

## 📱 12. AUTO-REMPLISSAGE BRIEF IA + ENDPOINT SUGGESTIONS

### ✅ **Observation : Auto-remplissage Brief IA depuis description produit/service**

**Problème actuel** :
- ❌ Brief IA reste vide par défaut
- ❌ Utilisateur doit tout saisir manuellement
- ❌ Description produit/service déjà disponible mais pas utilisée

**Solution** :
```
Priorité 1 : Si produit spécifique (productIndex défini)
  → Utiliser product.description si disponible
  
Priorité 2 : Si ≤ 2 produits
  → Utiliser service.description
  
Priorité 3 : Si > 2 produits
  → Laisser vide (service avec beaucoup de produits)
```

### ✅ **Endpoint Suggestions IA**

**Problème actuel** :
- ❌ Suggestions IA hardcodées dans le frontend
- ❌ Pas d'appel backend
- ❌ Pas d'utilisation de l'IA réelle

**Solution** :
- ✅ Créer endpoint `POST /api/studio/sessions/{id}/suggestions`
- ✅ Appeler IA avec brief pour générer suggestions personnalisées
- ✅ Remplacer code hardcodé par appel backend

---

### **Détails techniques** :

**Frontend/Mobile - Auto-remplissage** :
```typescript
// frontend/src/pages/video/ImmersiveVideoWizard.tsx
// mobile/src/screens/video/VideoCreationWizardScreen.tsx

const fetchServiceData = useCallback(async () => {
    const response = await fetchServiceDetails(serviceId!);
    const service = response?.data ?? response;
    
    // ✅ NOUVEAU : Auto-remplir le brief
    const products = service?.data?.produits?.valeur || service?.data?.produits || [];
    if (Number.isFinite(productIndex) && products[productIndex!]) {
        const product = products[productIndex!];
        if (product?.description || product?.desc) {
            const productDesc = product.description || product.desc;
            setBrief(prev => prev || productDesc);  // Seulement si vide
        } else if (products.length <= 2 && service?.description) {
            setBrief(prev => prev || service.description);
        }
    } else if (service?.description) {
        setBrief(prev => prev || service.description);
    }
}, [serviceId, productIndex]);
```

**Backend - Endpoint Suggestions** :
```rust
// backend/src/controllers/studio_controller.rs
pub async fn generate_suggestions(
    Path(session_id): Path<String>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<GenerateSuggestionsPayload>,
) -> AppResult<Json<Value>> {
    // Appeler l'IA pour générer des suggestions basées sur le brief
    let suggestions = ia_service::generate_video_suggestions(&payload.brief).await?;
    
    Ok(Json(json!({
        "success": true,
        "data": { "suggestions": suggestions }
    })))
}
```

---

## 🛒 13. COMMANDE DEPUIS PRODUCTCARD ET CHATMODAL

### ✅ **Observation : Commandes depuis ProductCard et ChatModal**

**Problème actuel** :
- ❌ Pas de bouton "Se faire livrer" sur ProductCard
- ❌ Pas de fonctionnalité commande dans ChatModal
- ❌ Client doit passer par vidéo ou lien partagé

**Solution** :
1. ✅ **ProductCard** : Ajouter bouton "Se faire livrer"
2. ✅ **ChatModal** : Intégrer modal de commande dans conversation
3. ✅ **Multi-produits** : Permettre d'ajouter plusieurs produits lors commande
4. ✅ **Affichage coûts** : Séparer prix produit | coût livraison | total

---

### ✅ **1. Commande depuis ProductCard**

**Workflow** :
```
1. Client voit ProductCard → Clic "Se faire livrer"
2. Modal s'ouvre avec :
   - Produit sélectionné (par défaut)
   - Bouton "Ajouter d'autres produits du prestataire"
   - Affichage : Prix produit | Coût livraison (estimé) | Total
   - Formulaire adresse livraison (GPS modal)
3. Client valide → Livraison créée automatiquement
4. Client reçoit lien de suivi
```

**Implémentation** :
- ✅ Créer composant `OrderDeliveryModal` (mobile et web)
- ✅ Intégrer dans `ProductCard`
- ✅ Utiliser endpoint existant `POST /api/delivery/client-order`

---

### ✅ **2. Commande depuis ChatModal**

**Workflow** :
```
1. Client dans chat avec prestataire
2. Actions rapides : "Commander ce produit" (si produit mentionné)
   OU Bouton "Commander avec livraison"
3. Modal s'ouvre (même que ProductCard)
4. Contexte conversationnel conservé
5. Client valide → Livraison créée
```

**Implémentation** :
- ✅ Intégrer `OrderDeliveryModal` dans `ChatModal` / `ChatModalMobile`
- ✅ Détecter produits mentionnés dans conversation
- ✅ Boutons d'actions rapides dans chat

---

### ✅ **3. Sélection Multi-Produits**

**Workflow** :
```
1. Modal commande s'ouvre
2. Produit initial sélectionné
3. Bouton "Ajouter d'autres produits"
4. Liste produits du prestataire affichée
5. Client sélectionne plusieurs produits
6. Affichage : 
   - Produit 1 : 5000 FCFA
   - Produit 2 : 3000 FCFA
   - Livraison : 2000 FCFA
   - TOTAL : 10000 FCFA
7. Client valide → Livraison avec plusieurs produits
```

**Backend** (déjà supporté) :
- ✅ Endpoint `create_shopping_order` supporte plusieurs items
- ⚠️ **Manque** : Utiliser cet endpoint depuis ProductCard/ChatModal

---

### ✅ **4. Amélioration Affichage Coûts**

**Règle** :
- ✅ Toujours séparer : Prix produit(s) | Coût livraison | Total
- ✅ Afficher clairement si livraison gratuite (`billing_mode: merchant_inclusive`)
- ✅ Permettre livraison offerte visible pour client

**Implémentation** :
```typescript
// Composant OrderDeliveryModal

<div className="costs-breakdown">
  <div className="cost-row">
    <span>Produit(s)</span>
    <span>{productTotal} FCFA</span>
  </div>
  <div className="cost-row">
    <span>
      Livraison 
      {isDeliveryFree && <Badge>Gratuite</Badge>}
    </span>
    <span>
      {isDeliveryFree ? '0' : deliveryCost} FCFA
    </span>
  </div>
  <div className="cost-row total">
    <span>Total</span>
    <span>{totalCost} FCFA</span>
  </div>
</div>
```

---

## 🌐 14. PAGE PUBLIQUE POUR DROPOFF (CLIENT SANS COMPTE)

### ✅ **Observation : Client sans compte doit pouvoir fournir adresse**

**Problème actuel** :
- ❌ Client doit avoir un compte Yukpo pour fournir son adresse
- ❌ Pas de page publique accessible via lien partagé
- ❌ Le prestataire doit partager un lien, mais la page n'existe pas

**Solution** :
- ✅ Créer page publique `/delivery/public/:token`
- ✅ Accessible sans compte Yukpo
- ✅ Client peut entrer son adresse, GPS, téléphone, nom
- ✅ Après validation → Dropoff mis à jour + Matching déclenché
- ✅ Notification prestataire quand client fournit adresse

---

### ✅ **Workflow** :

```
1. Prestataire crée livraison SANS dropoff
   → dropoff_pending = true
   → Token généré : abc123xyz

2. Prestataire partage lien : https://yukpo.com/delivery/public/abc123xyz
   → Via WhatsApp, SMS, Email

3. Client clique lien (sans compte Yukpo)
   → Page publique s'ouvre
   → Affiche : "Livraison #XYZ789 - Entrez votre adresse"

4. Client remplit :
   - Nom complet
   - Téléphone
   - Adresse complète
   - GPS (via carte interactive)
   - Instructions de livraison (optionnel)

5. Client valide
   → Backend met à jour dropoff
   → dropoff_pending = false
   → Matching déclenché automatiquement
   → Notification push/SMS au prestataire : "Client a fourni son adresse"

6. Prestataire reçoit notification
   → Voir que livraison peut maintenant être livrée
```

---

### **Détails techniques** :

**Backend - Endpoint page publique** :
```rust
// backend/src/routes/delivery_routes.rs

#[derive(Serialize)]
struct PublicDropoffPageResponse {
    delivery_id: Uuid,
    pickup_address: String,
    service_name: String,
    token_valid: bool,
    dropoff_pending: bool,
}

// GET /api/delivery/public/:token
async fn get_public_dropoff_page(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> AppResult<Json<PublicDropoffPageResponse>> {
    // Vérifier token
    let delivery = delivery_service(&state)?
        .get_delivery_by_public_token(&token)
        .await?;
    
    Ok(Json(PublicDropoffPageResponse {
        delivery_id: delivery.id,
        pickup_address: delivery.pickup.address,
        service_name: delivery.metadata.get("service_name").as_str(),
        token_valid: true,
        dropoff_pending: delivery.dropoff_pending,
    }))
}

// POST /api/delivery/public/:token/dropoff
async fn submit_public_dropoff(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Json(payload): Json<PublicDropoffInput>,
) -> AppResult<Json<Value>> {
    // Vérifier token
    let delivery = delivery_service(&state)?
        .get_delivery_by_public_token(&token)
        .await?;
    
    // Mettre à jour dropoff
    let service = delivery_service(&state)?;
    let recipient = service.assign_delivery_recipient(
        delivery.id,
        DeliveryRecipientInput {
            user_id: None,  // Client sans compte
            contact_name: Some(payload.name),
            contact_phone: Some(payload.phone),
            contact_email: payload.email,
            dropoff_address: payload.address,
            dropoff_latitude: payload.latitude,
            dropoff_longitude: payload.longitude,
            notes: payload.instructions,
            allow_contact: Some(true),
            allow_tracking: Some(true),
            consent_granted: Some(true),
            country_code: None,
            preferred_language: Some("fr".into()),
        }
    ).await?;
    
    // ✅ Notification prestataire
    notification_service::send_notification(
        delivery.creator_id,
        NotificationType::DeliveryDropoffConfirmed,
        format!("Client a fourni son adresse pour la livraison #{}", delivery.id),
    ).await?;
    
    Ok(Json(json!({
        "success": true,
        "delivery_id": delivery.id,
        "tracking_url": format!("/delivery/track/{}", delivery.id),
    })))
}
```

**Frontend/Mobile - Page publique** :
```typescript
// frontend/src/pages/delivery/PublicDropoffPage.tsx
// mobile/src/screens/delivery/PublicDropoffScreen.tsx

const PublicDropoffPage: React.FC<{ token: string }> = ({ token }) => {
    const [delivery, setDelivery] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Charger infos livraison
    useEffect(() => {
        fetchPublicDropoffInfo(token).then(setDelivery);
        setLoading(false);
    }, [token]);
    
    const handleSubmit = async (dropoffData) => {
        await submitPublicDropoff(token, dropoffData);
        // Rediriger vers page de suivi
        navigate(`/delivery/track/${delivery.delivery_id}`);
    };
    
    return (
        <div>
            <h1>Livraison #{delivery?.delivery_id?.slice(-6)}</h1>
            <p>Entrez votre adresse de livraison</p>
            
            <ModernGPSModal
                onSubmit={handleSubmit}
                initialAddress={null}
            />
        </div>
    );
};
```

---

## 👤 15. SÉLECTION LIVREUR PERSONNEL

### ✅ **Observation : Prestataire veut choisir son propre livreur**

**Problème actuel** :
- ❌ Matching automatique seulement
- ❌ Prestataire ne peut pas choisir un coursier spécifique
- ❌ Si prestataire a son propre livreur, il ne peut pas l'assigner

**Solution** :
- ✅ Ajouter champ `courier_id` optionnel dans payload livraison
- ✅ Si `courier_id` fourni → Assignation directe (pas de matching)
- ✅ Si `courier_id` vide → Matching automatique comme actuellement
- ✅ Interface : Liste coursiers disponibles → Sélection optionnelle

---

### ✅ **Workflow** :

```
1. Prestataire crée livraison
   → Options : "Matching automatique" OU "Choisir coursier"

2. Prestataire choisit "Choisir coursier"
   → Liste coursiers disponibles affichée
   → Coursiers filtrés par :
     - Zone géographique
     - Type véhicule requis
     - Disponibilité
     - Note/rating

3. Prestataire sélectionne coursier
   → courier_id = X envoyé dans payload

4. Backend assigne directement
   → Pas de matching
   → Statut : "assigned"
   → Coursier reçoit notification
```

---

### **Détails techniques** :

**Backend - Support courier_id optionnel** :
```rust
// backend/src/services/delivery_service.rs

pub async fn create_delivery_request(
    &self,
    params: CreateDeliveryParams,
) -> AppResult<DeliverySummary> {
    // ...
    
    // ✅ NOUVEAU : Si courier_id fourni, assigner directement
    if let Some(courier_id) = params.courier_id {
        // Vérifier que le coursier existe et est disponible
        let courier = self.repository.find_courier_by_id(courier_id).await?;
        if courier.is_none() {
            return Err(AppError::BadRequest("Coursier non trouvé".into()));
        }
        
        // Assigner directement
        self.assign_courier_to_delivery(summary.id, courier_id).await?;
        
        // Pas de matching nécessaire
        log::info!("[DeliveryService] Coursier {} assigné directement à livraison {}", courier_id, summary.id);
    } else {
        // Matching automatique comme avant
        if should_trigger_matching {
            self.enqueue_delivery_matching(&summary).await?;
        }
    }
    
    Ok(summary)
}
```

**Frontend/Mobile - Sélection coursier** :
```typescript
// mobile/src/components/CreatorStudioCard.tsx
// frontend/src/components/video/CreatorStudioPreviewCard.tsx

const [matchingMode, setMatchingMode] = useState<'auto' | 'manual'>('auto');
const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
const [availableCouriers, setAvailableCouriers] = useState([]);

const loadAvailableCouriers = async () => {
    const response = await deliveryApi.getAvailableCouriers({
        zone_id: pickupZoneId,
        vehicle_type: requiredVehicleType,
    });
    setAvailableCouriers(response.couriers);
};

const buildCourierPayload = (): CreateDeliveryRequestPayload => {
    return {
        // ...
        courier_id: matchingMode === 'manual' ? selectedCourierId : undefined,
        // ...
    };
};

// UI
<View>
    <Text>Mode d'assignation</Text>
    <RadioButton.Group
        value={matchingMode}
        onValueChange={setMatchingMode}
    >
        <RadioButton.Item label="Matching automatique" value="auto" />
        <RadioButton.Item label="Choisir coursier" value="manual" />
    </RadioButton.Group>
    
    {matchingMode === 'manual' && (
        <View>
            <Button title="Charger coursiers disponibles" onPress={loadAvailableCouriers} />
            <FlatList
                data={availableCouriers}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setSelectedCourierId(item.id)}>
                        <Text>{item.name}</Text>
                        <Text>{item.phone}</Text>
                        <Text>Note: {item.rating}</Text>
                        <Text>Véhicule: {item.vehicle_type}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    )}
</View>
```

---

## 📢 16. NOTIFICATION QUAND CLIENT FOURNIT ADRESSE

### ✅ **Observation : Prestataire doit être notifié quand client fournit son adresse**

**Problème actuel** :
- ❌ Pas de notification quand client fournit adresse via lien public
- ❌ Prestataire doit vérifier manuellement si dropoff confirmé
- ❌ Matching peut démarrer sans que prestataire le sache

**Solution** :
- ✅ Notification push automatique quand dropoff confirmé
- ✅ Notification SMS optionnelle
- ✅ Mise à jour en temps réel via WebSocket
- ✅ Badge notification dans app

---

### ✅ **Workflow** :

```
1. Client fournit adresse via page publique
   → POST /api/delivery/public/:token/dropoff

2. Backend met à jour dropoff
   → dropoff_pending = false

3. Backend envoie notification
   → Notification push au prestataire
   → SMS optionnel (si configuré)
   → WebSocket event : "dropoff_confirmed"

4. Prestataire reçoit notification
   → "Client a fourni son adresse pour la livraison #XYZ789"
   → "Matching coursier démarré"

5. Prestataire ouvre app
   → Voir livraison avec dropoff confirmé
   → Suivi matching en temps réel
```

---

### **Détails techniques** :

**Backend - Notification automatique** :
```rust
// backend/src/services/delivery_service.rs

pub async fn assign_delivery_recipient(
    &self,
    delivery_id: Uuid,
    recipient: DeliveryRecipientInput,
) -> AppResult<DeliveryRecipient> {
    // ... assignation ...
    
    // ✅ NOUVEAU : Notification prestataire si dropoff était pending
    let summary = self.get_delivery_summary(delivery_id).await?;
    if summary.dropoff_pending {
        // Envoyer notification
        self.notification_service.send_notification(
            summary.creator_id,
            NotificationType::DeliveryDropoffConfirmed,
            format!(
                "✅ Client a fourni son adresse pour la livraison #{}\n\nAdresse : {}\nMatching coursier démarré.",
                delivery_id.to_string()[..8].to_uppercase(),
                recipient.dropoff_address.as_ref().unwrap_or(&"Non spécifié".to_string())
            ),
        ).await?;
        
        // WebSocket event
        self.tracking_manager.broadcast_event(
            delivery_id,
            DeliveryWsEvent::DropoffConfirmed {
                address: recipient.dropoff_address.clone(),
                latitude: recipient.dropoff_latitude,
                longitude: recipient.dropoff_longitude,
            }
        ).await;
    }
    
    Ok(updated_recipient)
}
```

---

## 🔄 17. AMÉLIORATION UX DROPOFF PENDING

### ✅ **Observation : Meilleure gestion du dropoff temporaire/optionnel**

**Problème actuel** :
- ⚠️ Code actuel exige adresse dropoff pour créer livraison
- ⚠️ Pas de gestion claire du statut "dropoff_pending"
- ⚠️ UX confuse pour prestataire (ne sait pas si doit attendre client)

**Solution** :
- ✅ Permettre création livraison SANS dropoff
- ✅ Statut clair : "En attente adresse client"
- ✅ Bouton "Partager lien" visible et fonctionnel
- ✅ Indicateur visuel : "Adresse client requise"
- ✅ Auto-détection quand client fournit adresse

---

### ✅ **Workflow amélioré** :

```
1. Prestataire crée livraison
   → Dropoff optionnel (peut être vide)
   → Si vide : dropoff_pending = true

2. UI affiche clairement
   → Badge : "En attente adresse client"
   → Bouton : "Partager lien avec client"
   → Message : "Le client doit fournir son adresse pour démarrer la livraison"

3. Prestataire partage lien
   → Lien généré automatiquement
   → Copie facile (bouton "Copier lien")

4. Client fournit adresse
   → dropoff_pending = false
   → Badge change : "Adresse confirmée"
   → Matching démarre automatiquement
   → Notification prestataire
```

---

### **Détails techniques** :

**Frontend/Mobile - Gestion dropoff pending** :
```typescript
// mobile/src/components/CreatorStudioCard.tsx

const [dropoffPending, setDropoffPending] = useState(false);
const [dropoffShareLink, setDropoffShareLink] = useState<string | null>(null);

// Création livraison avec dropoff optionnel
const buildCourierPayload = (): CreateDeliveryRequestPayload => {
    const dropoff = dropoffAddressInput?.trim() && dropoffLatitudeInput && dropoffLongitudeInput
        ? {
            latitude: parseFloat(dropoffLatitudeInput),
            longitude: parseFloat(dropoffLongitudeInput),
            address: dropoffAddressInput,
        }
        : null;  // ✅ Permettre null
    
    return {
        // ...
        dropoff: dropoff || undefined,  // Optionnel
        // ...
    };
};

// UI : Affichage statut dropoff
{delivery?.dropoff_pending && (
    <View style={styles.pendingBadge}>
        <Badge variant="warning">⏳ En attente adresse client</Badge>
        <Button
            title="📤 Partager lien avec client"
            onPress={handleShareDropoffLink}
        />
        {dropoffShareLink && (
            <View style={styles.linkContainer}>
                <Text style={styles.linkText}>{dropoffShareLink}</Text>
                <Button
                    title="📋 Copier"
                    onPress={() => Clipboard.setString(dropoffShareLink)}
                />
            </View>
        )}
    </View>
)}

{!delivery?.dropoff_pending && delivery?.dropoff?.address && (
    <View style={styles.confirmedBadge}>
        <Badge variant="success">✅ Adresse confirmée</Badge>
        <Text>{delivery.dropoff.address}</Text>
    </View>
)}
```

---

## 🎬 18. CHAÎNAGE VIDÉOS LORS DE LA CRÉATION

### ✅ **Observation : Définir dépendances vidéos pendant la création**

**Problème actuel** :
- ❌ Chaînage vidéos mentionné mais pas intégré dans le studio de création
- ❌ Prestataire ne peut pas définir les vidéos liées directement pendant la création
- ❌ Doit créer les vidéos puis les lier après

**Solution** :
- ✅ Intégrer panneau "Vidéos liées" dans le studio de création
- ✅ Permettre sélection de vidéos existantes pendant la création
- ✅ Définir types de liens : tutorial, mode d'emploi, vidéo détaillée, etc.
- ✅ Définir niveau d'accès : public, authentifié, clients uniquement

---

### ✅ **Workflow** :

```
1. Prestataire crée vidéo dans VideoCreationWizard
   → Studio affiche panneau "Vidéos associées"

2. Prestataire peut :
   - Sélectionner vidéos existantes à lier
   - OU Créer nouvelle vidéo liée (workflow imbriqué)
   - Définir type de lien : "Mode d'emploi", "Tutoriel", "Vidéo détaillée"
   - Définir accès : Public / Authentifié / Clients uniquement

3. Lors de la sauvegarde/génération vidéo
   → Création automatique des liens via table video_links
   → Vidéos liées visibles dans VideoLinksPanel

4. Client regarde vidéo principale
   → Voit section "Vidéos associées" en bas
   → Peut naviguer vers vidéos liées (selon accès)
```

---

### **Détails techniques** :

**Frontend/Mobile - Intégration studio** :
```typescript
// mobile/src/screens/video/VideoCreationWizardScreen.tsx
// frontend/src/pages/video/ImmersiveVideoWizard.tsx

const [linkedVideos, setLinkedVideos] = useState<VideoLink[]>([]);

// Composant intégré dans le studio
<VideoLinksManager
    serviceId={serviceId}
    productIndex={productIndex}
    currentVideoId={sessionId}
    linkedVideos={linkedVideos}
    onLinkedVideosChange={setLinkedVideos}
/>

// Lors de la génération/sauvegarde
const handleGenerateVideo = async () => {
    // ... génération vidéo ...
    
    // Créer les liens vidéos
    for (const link of linkedVideos) {
        await apiPost(`/api/videos/links`, {
            source_video_id: generatedVideoId,
            target_video_id: link.target_video_id,
            link_type: link.link_type,
            link_label: link.label,
            access_level: link.access_level,
            service_id: serviceId,
            product_index: productIndex,
        });
    }
};
```

---

## 📦 19. PLUSIEURS LIEUX DE STOCK POUR PRESTATAIRE

### ✅ **Observation : Prestataire peut avoir plusieurs points de stock**

**Problème actuel** :
- ❌ Un seul point de pickup par produit/service
- ❌ Prestataire avec plusieurs magasins/entrepôts ne peut pas les gérer
- ❌ Matching ne peut pas choisir le point de stock le plus proche

**Solution** :
- ✅ Table `prestataire_stock_locations` pour plusieurs lieux de stock
- ✅ Lors de la création livraison, matching calcule distance depuis TOUS les points de stock
- ✅ Choix automatique du point le plus proche du client ET du coursier
- ✅ Interface pour gérer plusieurs lieux de stock

---

### ✅ **Workflow** :

```
1. Prestataire configure plusieurs lieux de stock
   → Entrepôt 1 : Douala, PK8
   → Entrepôt 2 : Douala, Bonanjo
   → Boutique 1 : Yaoundé, Centre-ville

2. Client commande produit
   → Backend récupère TOUS les lieux de stock où le produit est disponible
   → Calcule distance depuis chaque point vers :
     - Destination client (dropoff)
     - Position coursier disponible

3. Matching choisit automatiquement :
   - Lieu de stock le plus proche de la destination
   - OU Lieu le plus proche d'un coursier disponible
   - En fonction du score de matching global

4. Livraison créée avec point de départ optimal
   → Coursier va au bon lieu de stock
   → Distance minimisée
```

---

### **Détails techniques** :

**Backend - Table lieux de stock** :
```sql
CREATE TABLE prestataire_stock_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER REFERENCES services(id),  -- Optionnel : spécifique au service
    product_index INTEGER,  -- Optionnel : spécifique au produit
    
    -- Identifiant du lieu
    location_name VARCHAR(255) NOT NULL,  -- Ex: "Entrepôt principal", "Boutique Yaoundé"
    location_code VARCHAR(50),  -- Ex: "STOCK-001"
    
    -- Coordonnées GPS
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL,
    
    -- Disponibilité
    is_active BOOLEAN DEFAULT TRUE,
    availability_schedule JSONB,  -- Même format que pickup_availability_schedule
    capacity_limits JSONB,  -- Limites de stock par produit (optionnel)
    
    -- Métadonnées
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, location_code)
);

CREATE INDEX idx_stock_locations_user ON prestataire_stock_locations(user_id);
CREATE INDEX idx_stock_locations_service ON prestataire_stock_locations(service_id, product_index);
CREATE INDEX idx_stock_locations_gps ON prestataire_stock_locations USING GIST (
    ll_to_earth(latitude, longitude)
);
```

**Backend - Matching avec plusieurs points** :
```rust
// backend/src/services/delivery_service.rs

pub async fn find_optimal_stock_location(
    &self,
    service_id: i32,
    product_index: Option<i32>,
    dropoff_lat: f64,
    dropoff_lng: f64,
    courier_lat: Option<f64>,
    courier_lng: Option<f64>,
) -> AppResult<Option<StockLocation>> {
    // Récupérer tous les lieux de stock disponibles
    let stock_locations = sqlx::query_as!(
        StockLocationRow,
        r#"
        SELECT 
            id, user_id, service_id, product_index,
            location_name, location_code,
            latitude, longitude, address,
            is_active, availability_schedule, capacity_limits,
            metadata
        FROM prestataire_stock_locations
        WHERE user_id = (
            SELECT user_id FROM services WHERE id = $1
        )
        AND (service_id IS NULL OR service_id = $1)
        AND (product_index IS NULL OR product_index = $2)
        AND is_active = TRUE
        "#,
        service_id,
        product_index
    )
    .fetch_all(&self.pool)
    .await?;
    
    if stock_locations.is_empty() {
        // Fallback : GPS fixe du service
        return self.get_service_default_location(service_id).await;
    }
    
    // Calculer score pour chaque lieu de stock
    let mut scored_locations: Vec<(StockLocation, f64)> = stock_locations
        .into_iter()
        .map(|loc| {
            let stock_pos = (loc.latitude, loc.longitude);
            let dropoff_pos = (dropoff_lat, dropoff_lng);
            
            // Distance stock → dropoff (priorité principale)
            let distance_to_dropoff = haversine_distance(stock_pos, dropoff_pos);
            
            // Score : plus proche = meilleur (distance en km, inverse)
            let mut score = 1000.0 / (1.0 + distance_to_dropoff / 1000.0);
            
            // Bonus si coursier est proche du stock aussi
            if let (Some(clat), Some(clng)) = (courier_lat, courier_lng) {
                let courier_pos = (clat, clng);
                let distance_stock_courier = haversine_distance(stock_pos, courier_pos);
                score += 500.0 / (1.0 + distance_stock_courier / 1000.0);
            }
            
            (loc, score)
        })
        .collect();
    
    // Trier par score décroissant
    scored_locations.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(Ordering::Equal));
    
    // Retourner le meilleur
    scored_locations.into_iter().next().map(|(loc, _)| loc.into())
}
```

**Frontend/Mobile - Gestion lieux de stock** :
```typescript
// mobile/src/screens/stock/StockLocationsScreen.tsx

const StockLocationsScreen: React.FC = () => {
    const [locations, setLocations] = useState<StockLocation[]>([]);
    
    return (
        <View>
            <Text>Mes lieux de stock</Text>
            <Button
                title="+ Ajouter un lieu de stock"
                onPress={() => navigation.navigate('AddStockLocation')}
            />
            <FlatList
                data={locations}
                renderItem={({ item }) => (
                    <View>
                        <Text>{item.location_name}</Text>
                        <Text>{item.address}</Text>
                        <Text>📍 {item.latitude}, {item.longitude}</Text>
                        <Button
                            title="Modifier"
                            onPress={() => editLocation(item.id)}
                        />
                    </View>
                )}
            />
        </View>
    );
};
```

---

## 📍 20. MATCHING GÉOGRAPHIQUE GPS (DÉTAILS TECHNIQUES)

### ✅ **Observation : Comment fonctionne le matching géographique ?**

**Réponse** : Le matching utilise les **coordonnées GPS** et la **formule de Haversine** pour calculer les distances réelles.

---

### ✅ **Fonctionnement détaillé** :

**1. Formule de Haversine** :
```rust
// backend/src/services/delivery_service.rs:38-52

fn haversine_distance(pos1: (f64, f64), pos2: (f64, f64)) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;  // Rayon de la Terre en km
    let (lat1, lon1) = (pos1.0.to_radians(), pos1.1.to_radians());
    let (lat2, lon2) = (pos2.0.to_radians(), pos2.1.to_radians());

    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;

    let a = (dlat / 2.0).sin().powi(2)
        + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();

    EARTH_RADIUS_KM * c * 1000.0  // Retourne en mètres
}
```

**2. Calcul distances dans le matching** :
```rust
// Exemple : Matching coursier

// Position dropoff (destination client)
let dropoff_pos = (summary.dropoff.latitude, summary.dropoff.longitude);

// Position de chaque coursier disponible
for courier in available_couriers {
    let courier_pos = (courier.current_latitude, courier.current_longitude);
    
    // Distance coursier → dropoff (en mètres)
    let distance_meters = haversine_distance(courier_pos, dropoff_pos);
    
    // Score de matching (plus proche = meilleur)
    let score = 1000.0 / (1.0 + distance_meters / 1000.0);
    
    // Ajouter autres critères (note, disponibilité, etc.)
    total_score = score + courier.rating_score + courier.availability_bonus;
}
```

**3. Avec plusieurs lieux de stock** :
```rust
// Pour chaque lieu de stock disponible
for stock_location in stock_locations {
    let stock_pos = (stock_location.latitude, stock_location.longitude);
    
    // Distance stock → dropoff
    let distance_stock_dropoff = haversine_distance(stock_pos, dropoff_pos);
    
    // Distance coursier → stock (si coursier disponible)
    let distance_courier_stock = if let Some(courier_pos) = courier_current_position {
        haversine_distance(courier_pos, stock_pos)
    } else {
        0.0
    };
    
    // Distance totale estimée
    let total_distance = distance_courier_stock + distance_stock_dropoff;
    
    // Score : minimiser la distance totale
    let score = 1000.0 / (1.0 + total_distance / 1000.0);
    
    // Choisir le lieu de stock qui minimise la distance totale
}
```

**4. Optimisation avec index géospatial PostgreSQL** :
```sql
-- Index GIST pour recherches géospatiales rapides
CREATE INDEX idx_stock_locations_gps ON prestataire_stock_locations 
USING GIST (ll_to_earth(latitude, longitude));

-- Fonction PostgreSQL pour recherche dans un rayon
SELECT *,
    earth_distance(
        ll_to_earth(latitude, longitude),
        ll_to_earth($1, $2)  -- Position de référence
    ) / 1000.0 AS distance_km
FROM prestataire_stock_locations
WHERE earth_distance(
    ll_to_earth(latitude, longitude),
    ll_to_earth($1, $2)
) < $3 * 1000  -- Rayon en mètres
ORDER BY distance_km ASC;
```

---

### ✅ **Avantages de la formule Haversine** :

1. ✅ **Précision** : Calcule la distance réelle sur la surface courbe de la Terre
2. ✅ **Efficacité** : Calcul rapide, pas besoin de routes réelles
3. ✅ **Fiabilité** : Formule mathématique standard pour distances géographiques
4. ✅ **Cohérence** : Même calcul partout dans l'application

**Limitation** :
- ⚠️ Distance "à vol d'oiseau" (ne tient pas compte des routes réelles)
- ✅ **Solution** : Ajuster avec coefficient multiplicateur (ex: 1.3x) pour routes réelles
- ✅ **Alternative future** : Intégrer API de routing (OSRM, Google Maps) pour distances réelles

---

## 🏷️ 21. RENOMMAGE PICKUP/DROPOFF (TERMES PLUS NATURELS)

### ✅ **Observation : Termes pickup/dropoff pas très compréhensibles**

**Problème actuel** :
- ❌ "Pickup" et "dropoff" sont des termes techniques anglo-saxons
- ❌ Pas intuitifs pour utilisateurs francophones
- ❌ Besoin de termes plus naturels et compréhensibles

**Solution proposée** :
- ✅ **Pickup** → **"Départ"** ou **"Point de départ"** ou **"Lieu de départ"**
- ✅ **Dropoff** → **"Destination"** ou **"Point de livraison"** ou **"Adresse de livraison"**

**Variantes selon contexte** :
- Dans formulaire : "Lieu de départ" / "Adresse de livraison"
- Dans liste/affichage : "Départ" / "Destination"
- Dans notifications : "Point de départ" / "Point de livraison"

---

### ✅ **Plan de migration** :

**1. Ajout de labels traduits dans le frontend** :
```typescript
// frontend/src/i18n/locales/fr.ts
// mobile/src/i18n/locales/fr.ts

export const deliveryTerms = {
    pickup: {
        label: "Départ",
        fullLabel: "Point de départ",
        description: "Lieu où le colis sera récupéré",
        placeholder: "Adresse de départ",
    },
    dropoff: {
        label: "Destination",
        fullLabel: "Point de livraison",
        description: "Adresse où le colis sera livré",
        placeholder: "Adresse de livraison",
    },
    // Variantes selon contexte
    pickupLocation: "Lieu de départ",
    dropoffLocation: "Adresse de livraison",
    departurePoint: "Point de départ",
    deliveryPoint: "Point de livraison",
};
```

**2. Utilisation dans les composants** :
```typescript
// mobile/src/components/CreatorStudioCard.tsx

// AVANT
<Text>Point de pickup</Text>
<Text>Point de dropoff</Text>

// APRÈS
<Text>{deliveryTerms.pickup.fullLabel}</Text>
<Text>{deliveryTerms.dropoff.fullLabel}</Text>

// Ou plus simple selon contexte
<Text>{deliveryTerms.pickup.label}</Text>  // "Départ"
<Text>{deliveryTerms.dropoff.label}</Text>  // "Destination"
```

**3. Backend : Garder noms techniques internes** :
```rust
// backend/src/services/delivery_service.rs

// ✅ GARDER les noms techniques en backend
pub struct LocationInput {
    pub latitude: f64,
    pub longitude: f64,
    pub address: String,
}

pub struct CreateDeliveryParams {
    pub pickup: LocationInput,  // ✅ Garder "pickup" en interne
    pub dropoff: LocationInput,  // ✅ Garder "dropoff" en interne
}

// ✅ Mais renommer dans les réponses API pour le frontend
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendDeliveryLocation {
    #[serde(rename = "departure")]  // ✅ Renommer en "departure" dans JSON
    pub pickup: LocationInput,
    
    #[serde(rename = "destination")]  // ✅ Renommer en "destination" dans JSON
    pub dropoff: LocationInput,
}
```

**4. Migration progressive** :
- ✅ Phase 1 : Ajouter labels traduits dans frontend/mobile (pas de changement backend)
- ✅ Phase 2 : Mettre à jour toutes les interfaces utilisateur
- ✅ Phase 3 : Renommer dans les réponses API (optionnel, pour cohérence)
- ✅ Phase 4 : Mettre à jour documentation et messages d'aide

---

### **Exemples d'utilisation** :

**Formulaire** :
```
┌─────────────────────────────────────┐
│ Livraison                           │
├─────────────────────────────────────┤
│ Point de départ                     │
│ [📍 Sélectionner sur la carte]      │
│ Adresse : 123 Rue...                │
│                                     │
│ Adresse de livraison                 │
│ [📍 Sélectionner sur la carte]      │
│ Adresse : 456 Avenue...             │
└─────────────────────────────────────┘
```

**Notifications** :
```
✅ Livraison créée
Départ : Pharmacie Centrale, Douala
Destination : Quartier Makepe, Douala
```

**Timeline** :
```
1. ✅ Départ confirmé
   📍 Pharmacie Centrale, Douala

2. 🚚 En route vers la destination
   ETA : 15 minutes

3. 📍 Arrivé à destination
   Quartier Makepe, Douala
```

---

## ✅ CONCLUSION

**Toutes tes observations sont excellentes** et ont été intégrées dans ce plan complet :

1. ✅ **Systématisation** : Configuration livraison obligatoire → Produits toujours prêts
2. ✅ **Notification** : Prestataire notifié si infos manquantes
3. ✅ **Plages horaires** : Prestataire + Client + Matching intelligent
4. ✅ **Externalisation** : API publique pour WhatsApp/Facebook
5. ✅ **Gestion financière** : Verrouillage solde + Réservation fonds + Reversement automatique
6. ✅ **Vidéo de preuve** : Enregistrement coursier + Affichage client dans timeline
7. ✅ **Automatisation** : Détection GPS + Suggestions automatiques + Changements de statut intelligents
8. ✅ **Notifications** : Push + SMS/Email automatiques pour tous les changements de statut
9. ✅ **Brief IA** : Auto-remplissage depuis description produit/service + Endpoint suggestions IA
10. ✅ **Points d'entrée multiples** : Commande depuis ProductCard, ChatModal, avec multi-produits
11. ✅ **Affichage coûts** : Prix produit + Livraison séparés + Livraison gratuite visible
12. ✅ **Page publique dropoff** : Client sans compte peut fournir adresse via lien partagé
13. ✅ **Sélection livreur personnel** : Prestataire peut choisir son propre coursier
14. ✅ **Notification client fournit adresse** : Alerte automatique au prestataire
15. ✅ **UX dropoff pending** : Gestion claire du dropoff temporaire/optionnel avec badges et indicateurs visuels
16. ✅ **Chaînage vidéos lors création** : Définir dépendances vidéos directement dans le studio
17. ✅ **Plusieurs lieux de stock** : Prestataire gère plusieurs points de départ, matching choisit le plus proche
18. ✅ **Matching géographique GPS** : Utilisation coordonnées GPS + formule Haversine pour distances réelles précises
19. ✅ **Renommage pickup/dropoff** : Termes plus naturels "Départ" / "Destination" pour meilleure compréhension

**Souhaites-tu que je commence l'implémentation par la Phase 1 ?**

