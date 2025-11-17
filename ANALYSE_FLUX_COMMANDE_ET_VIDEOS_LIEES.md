# 🎯 Analyse Approfondie : Flux de Commande Client & Navigation Vidéos Liées

## 📋 TES OBSERVATIONS - ANALYSE DÉTAILLÉE

---

## 🔄 1. FLUX DE COMMANDE/LIVRAISON : LE PRESTATAIRE NE DEVRAIT PAS ENVOYER DE LIEN

### ✅ **Ton observation est CORRECTE**

**Problème actuel** :
- Prestataire crée la livraison → doit "Partager le lien" au client
- Client clique sur le lien → fournit son adresse
- **Inconvénients** :
  - ❌ Le prestataire doit gérer manuellement le partage de liens
  - ❌ Le client doit attendre un lien du prestataire
  - ❌ Pas d'expérience fluide et automatique
  - ❌ Le client pourrait ne jamais recevoir le lien

---

## ✅ **NOUVEAU FLUX PROPOSÉ (UX FLUIDE)**

### **Scénario : Client clique sur "Se faire livrer"**

#### **Point d'entrée 1 : Vidéo**
```
Client regarde la vidéo → Clic sur "Se faire livrer"
→ Modal s'ouvre IMMÉDIATEMENT
→ Auto-remplissage avec :
  - Dropoff : Adresse par défaut du client (si utilisateur Yukpo) OU adresse GPS courante (si pas utilisateur)
  - Pickup : Adresse par défaut du prestataire (depuis service.gps_fixe)
→ Client modifie si nécessaire
→ Client valide
→ Livraison créée AUTOMATIQUEMENT
→ Matching déclenché
→ Client reçoit lien de suivi ou est invité à suivre dans l'app
```

#### **Point d'entrée 2 : ProductCard**
```
Client regarde ProductCard → Clic sur "Se faire livrer"
→ Modal s'ouvre IMMÉDIATEMENT
→ Même logique d'auto-remplissage
→ Client valide
→ Livraison créée + Lien de suivi
```

#### **Point d'entrée 3 : ChatModal**
```
Client dans le chat avec prestataire → Clic sur "Commander avec livraison"
→ Modal s'ouvre IMMÉDIATEMENT
→ Contexte conversationnel conservé
→ Livraison créée + Lien de suivi
```

---

### **🎯 AVANTAGES DU NOUVEAU FLUX**

1. ✅ **Expérience fluide** : Pas d'attente de lien, tout est immédiat
2. ✅ **Auto-remplissage intelligent** : Adresses par défaut chargées automatiquement
3. ✅ **Moins de friction** : Le client n'a qu'à valider (ou modifier légèrement)
4. ✅ **Pas de dépendance au prestataire** : Le client initie lui-même la commande
5. ✅ **Création automatique** : La livraison est créée directement, pas besoin que le prestataire la crée d'avance

---

## 🔧 IMPLÉMENTATION TECHNIQUE

### **1. Backend - Nouveau endpoint : Créer livraison depuis commande client**

```rust
// backend/src/routes/delivery_routes.rs

#[derive(Deserialize)]
struct ClientOrderDeliveryPayload {
    service_id: i32,
    product_index: Option<i32>,  // Optionnel si commande depuis vidéo spécifique
    video_id: Option<String>,     // Optionnel : ID de la vidéo qui a déclenché la commande
    pickup: Option<LocationInput>, // Optionnel : Auto-rempli depuis service.gps_fixe
    dropoff: LocationInput,        // OBLIGATOIRE : Adresse client
    parcel: Option<NewDeliveryParcelInput>, // Optionnel : Infos colis
    metadata: Option<Value>,       // Métadonnées additionnelles
}

async fn create_delivery_from_client_order(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,  // Client connecté
    Json(payload): Json<ClientOrderDeliveryPayload>,
) -> AppResult<Json<Value>> {
    let service = delivery_service(&state)?;
    
    // ✅ 1. Récupérer les infos du service
    let service_data = sqlx::query!(
        "SELECT id, user_id, data FROM services WHERE id = $1",
        payload.service_id
    )
    .fetch_optional(&state.pg)
    .await?;
    
    let service_info = service_data.ok_or_else(|| {
        AppError::NotFound("Service non trouvé".into())
    })?;
    
    // ✅ 2. Auto-remplir pickup depuis service.gps_fixe si non fourni
    let pickup = if let Some(provided_pickup) = payload.pickup {
        provided_pickup
    } else {
        // Récupérer gps_fixe du service
        let gps_fixe = service_data.data
            .get("gps_fixe")
            .and_then(|v| v.get("valeur"))
            .and_then(|v| v.as_str());
        
        if let Some(gps_str) = gps_fixe {
            // Convertir GPS string en LocationInput
            parse_gps_to_location(gps_str).await
                .unwrap_or_else(|| {
                    // Fallback : utiliser GPS du prestataire
                    get_user_default_location(service_info.user_id, &state.pg).await
                })
        } else {
            get_user_default_location(service_info.user_id, &state.pg).await
        }
    }.ok_or_else(|| {
        AppError::BadRequest("Adresse de collecte requise. Veuillez contacter le prestataire.".into())
    })?;
    
    // ✅ 3. Construire le payload de livraison
    let delivery_params = CreateDeliveryParams {
        creator_id: service_info.user_id,  // Prestataire = créateur
        parcel: payload.parcel.unwrap_or_else(|| {
            // Par défaut : colis standard
            NewDeliveryParcelInput {
                type_id: 1,  // Moto express par défaut
                weight_kg: Some(dec(5.0)),
                volume_cm3: None,
                declared_value: None,
                notes: Some("Commande depuis vidéo".into()),
                photos: Vec::new(),
                constraints: Some(json!({
                    "source": "client_order",
                    "video_id": payload.video_id,
                    "product_index": payload.product_index,
                })),
            }
        }),
        pickup,
        dropoff: payload.dropoff,
        recipient: Some(DeliveryRecipientInput {
            user_id: Some(user.id),
            contact_name: Some(user.nom_complet.clone().unwrap_or_default()),
            contact_phone: user.contact_phone.clone(),
            notes: None,
            allow_contact: Some(true),
            allow_tracking: Some(true),
            consent_granted: Some(true),
            country_code: None,
            preferred_language: Some("fr".into()),
        }),
        distance_meters: None,
        estimated_duration_seconds: None,
        metadata: Some(merge_json(
            payload.metadata.unwrap_or_default(),
            json!({
                "source": "client_order",
                "video_id": payload.video_id,
                "product_index": payload.product_index,
                "ordered_by_client_id": user.id,
                "ordered_at": Utc::now().to_rfc3339(),
            })
        )),
        initial_event_payload: Some(json!({
            "source": "client_order",
            "client_id": user.id,
        })),
    };
    
    // ✅ 4. Créer la livraison
    let summary = service.create_delivery_request(delivery_params).await?;
    
    // ✅ 5. Le matching sera déclenché automatiquement dans create_delivery_request
    // car le recipient est déjà assigné
    
    Ok(Json(json!({
        "delivery": summary,
        "tracking_url": format!("/delivery/track/{}", summary.id),
        "tracking_token": generate_tracking_token(&summary.id),
    })))
}
```

### **2. Frontend/Mobile - Modal de commande automatique**

```typescript
// mobile/src/components/OrderDeliveryModal.tsx (NOUVEAU COMPOSANT)

interface OrderDeliveryModalProps {
    visible: boolean;
    onClose: () => void;
    serviceId: number;
    productIndex?: number;
    videoId?: string;
    onOrderCreated: (deliveryId: string, trackingUrl: string) => void;
}

const OrderDeliveryModal: React.FC<OrderDeliveryModalProps> = ({
    visible,
    onClose,
    serviceId,
    productIndex,
    videoId,
    onOrderCreated,
}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    
    // ✅ Auto-remplissage des adresses
    const [pickupAddress, setPickupAddress] = useState<string>('');
    const [pickupLat, setPickupLat] = useState<string>('');
    const [pickupLng, setPickupLng] = useState<string>('');
    
    const [dropoffAddress, setDropoffAddress] = useState<string>('');
    const [dropoffLat, setDropoffLat] = useState<string>('');
    const [dropoffLng, setDropoffLng] = useState<string>('');
    
    const [showDropoffGPSModal, setShowDropoffGPSModal] = useState(false);
    
    // ✅ Charger les adresses par défaut au montage
    useEffect(() => {
        if (!visible || !serviceId) return;
        
        const loadDefaultAddresses = async () => {
            try {
                // 1. Récupérer adresse pickup (service)
                const serviceResponse = await apiGet(`/api/services/${serviceId}`);
                const service = serviceResponse.data;
                
                const serviceGPS = service?.data?.gps_fixe?.valeur || service?.gps;
                if (serviceGPS) {
                    const location = await geocodeGPS(serviceGPS);
                    if (location) {
                        setPickupAddress(location.address);
                        setPickupLat(location.lat.toString());
                        setPickupLng(location.lng.toString());
                    }
                }
                
                // 2. Récupérer adresse dropoff (client)
                if (user?.id) {
                    const userResponse = await apiGet(`/api/users/${user.id}`);
                    const userGPS = userResponse.data?.gps;
                    
                    if (userGPS) {
                        const location = await geocodeGPS(userGPS);
                        if (location) {
                            setDropoffAddress(location.address);
                            setDropoffLat(location.lat.toString());
                            setDropoffLng(location.lng.toString());
                        }
                    }
                } else {
                    // Si pas utilisateur, utiliser GPS courant
                    const currentGPS = await getCurrentGPS();
                    if (currentGPS) {
                        const location = await geocodeGPS(currentGPS);
                        if (location) {
                            setDropoffAddress(location.address);
                            setDropoffLat(location.lat.toString());
                            setDropoffLng(location.lng.toString());
                        }
                    }
                }
            } catch (err) {
                console.error('[OrderDeliveryModal] Erreur chargement adresses:', err);
                // Pas bloquant, l'utilisateur peut saisir manuellement
            }
        };
        
        loadDefaultAddresses();
    }, [visible, serviceId, user]);
    
    // ✅ Soumettre la commande
    const handleSubmitOrder = useCallback(async () => {
        if (!dropoffAddress || !dropoffLat || !dropoffLng) {
            Alert.alert('Erreur', 'Veuillez préciser votre adresse de livraison');
            return;
        }
        
        setLoading(true);
        try {
            const response = await apiPost('/api/delivery/client-order', {
                service_id: serviceId,
                product_index: productIndex,
                video_id: videoId,
                pickup: pickupAddress ? {
                    address: pickupAddress,
                    latitude: parseFloat(pickupLat) || 0,
                    longitude: parseFloat(pickupLng) || 0,
                } : undefined,
                dropoff: {
                    address: dropoffAddress,
                    latitude: parseFloat(dropoffLat) || 0,
                    longitude: parseFloat(dropoffLng) || 0,
                },
            });
            
            const { delivery, tracking_url, tracking_token } = response.data;
            
            // ✅ Notifier le callback
            onOrderCreated(delivery.id, tracking_url);
            
            // ✅ Fermer le modal
            onClose();
            
            // ✅ Proposer de suivre la livraison
            Alert.alert(
                'Commande confirmée',
                `Livraison #${delivery.id.slice(0, 8)} créée. Souhaitez-vous suivre votre livraison ?`,
                [
                    { text: 'Plus tard', style: 'cancel' },
                    {
                        text: 'Suivre maintenant',
                        onPress: () => {
                            // Naviguer vers l'écran de suivi
                            navigation.navigate('DeliveryTracking', {
                                deliveryId: delivery.id,
                                trackingToken: tracking_token,
                            });
                        },
                    },
                ]
            );
        } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Impossible de créer la commande');
        } finally {
            setLoading(false);
        }
    }, [serviceId, productIndex, videoId, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, onOrderCreated, onClose]);
    
    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <NativeCard style={styles.modalCard}>
                <View style={styles.header}>
                    <Text style={styles.title}>Commander avec livraison</Text>
                    <TouchableOpacity onPress={onClose}>
                        <SafeIcon name="x" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                </View>
                
                {/* Pickup (lecture seule ou modifiable) */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Point de collecte</Text>
                    <Text style={styles.addressText}>{pickupAddress || 'Adresse du prestataire'}</Text>
                </View>
                
                {/* Dropoff (modifiable) */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionLabel}>Votre adresse de livraison</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowDropoffGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>Modifier</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.addressInput}
                        value={dropoffAddress}
                        onChangeText={setDropoffAddress}
                        placeholder="Votre adresse complète"
                    />
                </View>
                
                {/* Bouton valider */}
                <NativeButton
                    variant="primary"
                    onPress={handleSubmitOrder}
                    disabled={loading || !dropoffAddress}
                >
                    {loading ? 'Création en cours...' : 'Valider la commande'}
                </NativeButton>
                
                {/* Modal GPS */}
                <ModernGPSModal
                    visible={showDropoffGPSModal}
                    onClose={() => setShowDropoffGPSModal(false)}
                    onSelect={(coordinatesString) => {
                        const firstPoint = coordinatesString.split('|')[0].split(',');
                        if (firstPoint.length === 2) {
                            const lat = parseFloat(firstPoint[0]);
                            const lng = parseFloat(firstPoint[1]);
                            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                                setDropoffLat(lat.toString());
                                setDropoffLng(lng.toString());
                                // Geocoder pour obtenir l'adresse textuelle
                                geocodeGPS(coordinatesString).then((location) => {
                                    if (location) {
                                        setDropoffAddress(location.address);
                                    }
                                });
                            }
                        }
                        setShowDropoffGPSModal(false);
                    }}
                    currentLocation={
                        dropoffLat && dropoffLng
                            ? {
                                  lat: parseFloat(dropoffLat) || 0,
                                  lng: parseFloat(dropoffLng) || 0,
                              }
                            : undefined
                    }
                    title="Sélection de votre adresse de livraison"
                    allowZoneSelection={false}
                />
            </NativeCard>
        </Modal>
    );
};
```

### **3. Intégration dans VideoPlayer / ProductCard / ChatModal**

```typescript
// mobile/src/components/VideoPlayer.tsx (exemple)

const handleOrderDelivery = useCallback(() => {
    setShowOrderModal(true);
}, []);

// Dans le rendu
<TouchableOpacity
    style={styles.orderButton}
    onPress={handleOrderDelivery}
>
    <SafeIcon name="truck" size={20} color="#fff" />
    <Text style={styles.orderButtonText}>Se faire livrer</Text>
</TouchableOpacity>

<OrderDeliveryModal
    visible={showOrderModal}
    onClose={() => setShowOrderModal(false)}
    serviceId={serviceId}
    productIndex={productIndex}
    videoId={videoId}
    onOrderCreated={(deliveryId, trackingUrl) => {
        // Navigation vers suivi ou affichage du lien
    }}
/>
```

---

## 🎬 2. NAVIGATION ENTRE VIDÉOS LIÉES

### ✅ **Ton observation est EXCELLENTE**

**Cas d'usage** :
1. **Vidéo principale** (public) : Présentation du produit
2. **Vidéo secondaire** (privée) : Mode d'emploi, détails techniques, tutoriel
3. **Navigation** : Depuis la vidéo principale → Accès aux vidéos secondaires liées
4. **Contrôle d'accès** : Vidéos privées réservées aux clients ayant commandé

---

## 🔧 ARCHITECTURE PROPOSÉE

### **1. Modèle de données : Relations vidéos**

```sql
-- Migration : Ajouter table video_links

CREATE TABLE IF NOT EXISTS video_links (
    id SERIAL PRIMARY KEY,
    source_video_id VARCHAR(255) NOT NULL,  -- ID de la vidéo source (peut être UUID ou media.id)
    target_video_id VARCHAR(255) NOT NULL,  -- ID de la vidéo cible
    source_type VARCHAR(50) NOT NULL DEFAULT 'media',  -- 'media', 'publicite', 'studio_session'
    target_type VARCHAR(50) NOT NULL DEFAULT 'media',
    link_type VARCHAR(50) NOT NULL DEFAULT 'related',  -- 'related', 'tutorial', 'upgrade', 'cross_sell'
    link_label TEXT,  -- Ex: "Mode d'emploi", "Vidéo détaillée", "Tutoriel complet"
    access_level VARCHAR(50) NOT NULL DEFAULT 'public',  -- 'public', 'authenticated', 'customer_only'
    display_order INTEGER NOT NULL DEFAULT 0,
    service_id INTEGER REFERENCES services(id),
    product_index INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_video_id, target_video_id, link_type)
);

CREATE INDEX idx_video_links_source ON video_links(source_video_id, source_type);
CREATE INDEX idx_video_links_target ON video_links(target_video_id, target_type);
CREATE INDEX idx_video_links_service_product ON video_links(service_id, product_index);
CREATE INDEX idx_video_links_access ON video_links(access_level);
```

### **2. Backend - Endpoints de gestion des liens vidéos**

```rust
// backend/src/routes/video_routes.rs

#[derive(Deserialize)]
struct CreateVideoLinkPayload {
    source_video_id: String,
    target_video_id: String,
    source_type: Option<String>,
    target_type: Option<String>,
    link_type: Option<String>,  // 'related', 'tutorial', 'upgrade', 'cross_sell'
    link_label: Option<String>,
    access_level: Option<String>,  // 'public', 'authenticated', 'customer_only'
    display_order: Option<i32>,
    service_id: Option<i32>,
    product_index: Option<i32>,
    metadata: Option<Value>,
}

// ✅ Créer un lien entre deux vidéos
async fn create_video_link(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateVideoLinkPayload>,
) -> AppResult<Json<Value>> {
    // Vérifier que l'utilisateur possède le service (si service_id fourni)
    if let Some(sid) = payload.service_id {
        let service = sqlx::query!(
            "SELECT user_id FROM services WHERE id = $1",
            sid
        )
        .fetch_optional(&state.pg)
        .await?;
        
        if let Some(s) = service {
            if s.user_id != user.id && user.role != "admin" {
                return Err(AppError::Forbidden);
            }
        }
    }
    
    let link = sqlx::query!(
        r#"
        INSERT INTO video_links (
            source_video_id, target_video_id,
            source_type, target_type,
            link_type, link_label,
            access_level, display_order,
            service_id, product_index, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, created_at
        "#,
        payload.source_video_id,
        payload.target_video_id,
        payload.source_type.unwrap_or_else(|| "media".into()),
        payload.target_type.unwrap_or_else(|| "media".into()),
        payload.link_type.unwrap_or_else(|| "related".into()),
        payload.link_label,
        payload.access_level.unwrap_or_else(|| "public".into()),
        payload.display_order.unwrap_or(0),
        payload.service_id,
        payload.product_index,
        payload.metadata
    )
    .fetch_one(&state.pg)
    .await?;
    
    Ok(Json(json!({
        "id": link.id,
        "created_at": link.created_at
    })))
}

// ✅ Récupérer les vidéos liées à une vidéo source
async fn get_video_links(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<Option<AuthenticatedUser>>,
    Path(video_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<Json<Value>> {
    let source_type = params.get("source_type").cloned().unwrap_or_else(|| "media".into());
    let access_level_filter = if user.is_some() {
        // Si utilisateur connecté, montrer public + authenticated
        vec!["public", "authenticated"]
    } else {
        vec!["public"]
    };
    
    // Vérifier si l'utilisateur est client du service (pour customer_only)
    let user_id = user.as_ref().map(|u| u.id);
    
    let mut query = sqlx::query_as!(
        VideoLinkRow,
        r#"
        SELECT 
            vl.id,
            vl.source_video_id,
            vl.target_video_id,
            vl.source_type,
            vl.target_type,
            vl.link_type,
            vl.link_label,
            vl.access_level,
            vl.display_order,
            vl.service_id,
            vl.product_index,
            vl.metadata,
            vl.created_at,
            vl.updated_at
        FROM video_links vl
        WHERE vl.source_video_id = $1 
            AND vl.source_type = $2
            AND vl.access_level = ANY($3)
        ORDER BY vl.display_order ASC, vl.created_at ASC
        "#,
        video_id,
        source_type,
        &access_level_filter[..]
    );
    
    let links = query.fetch_all(&state.pg).await?;
    
    // Filtrer customer_only si nécessaire
    let filtered_links = if user_id.is_some() {
        // Vérifier pour chaque lien customer_only si l'utilisateur a commandé
        let mut result = Vec::new();
        for link in links {
            if link.access_level == "customer_only" {
                // Vérifier si l'utilisateur a une livraison/commande pour ce service
                if let Some(sid) = link.service_id {
                    let has_order = sqlx::query!(
                        r#"
                        SELECT COUNT(*) as count
                        FROM delivery_requests dr
                        JOIN delivery_recipients rec ON dr.id = rec.delivery_id
                        WHERE dr.service_id = $1
                            AND rec.user_id = $2
                            AND dr.status NOT IN ('cancelled', 'failed')
                        "#,
                        sid,
                        user_id
                    )
                    .fetch_one(&state.pg)
                    .await?;
                    
                    if has_order.count > 0 {
                        result.push(link);
                    }
                } else {
                    // Pas de vérification possible, on n'inclut pas
                }
            } else {
                result.push(link);
            }
        }
        result
    } else {
        links.into_iter().filter(|l| l.access_level != "customer_only").collect()
    };
    
    Ok(Json(json!({ "links": filtered_links })))
}
```

### **3. Frontend/Mobile - Composant de navigation vidéos liées**

```typescript
// mobile/src/components/VideoLinksPanel.tsx (NOUVEAU)

interface VideoLinksPanelProps {
    sourceVideoId: string;
    sourceType?: 'media' | 'publicite' | 'studio_session';
    serviceId?: number;
    productIndex?: number;
    onVideoSelect: (videoId: string, videoType: string) => void;
}

const VideoLinksPanel: React.FC<VideoLinksPanelProps> = ({
    sourceVideoId,
    sourceType = 'media',
    serviceId,
    productIndex,
    onVideoSelect,
}) => {
    const { user } = useAuth();
    const [links, setLinks] = useState<VideoLink[]>([]);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        const loadLinks = async () => {
            setLoading(true);
            try {
                const response = await apiGet(
                    `/api/videos/${sourceVideoId}/links?source_type=${sourceType}`
                );
                setLinks(response.data.links || []);
            } catch (err) {
                console.error('[VideoLinksPanel] Erreur chargement liens:', err);
            } finally {
                setLoading(false);
            }
        };
        
        loadLinks();
    }, [sourceVideoId, sourceType]);
    
    if (links.length === 0) {
        return null;
    }
    
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Vidéos associées</Text>
            {links.map((link) => (
                <TouchableOpacity
                    key={link.id}
                    style={styles.linkCard}
                    onPress={() => onVideoSelect(link.target_video_id, link.target_type)}
                >
                    <SafeIcon 
                        name={link.link_type === 'tutorial' ? 'book-open' : 'play-circle'} 
                        size={20} 
                        color={modernColors.primary} 
                    />
                    <View style={styles.linkContent}>
                        <Text style={styles.linkLabel}>
                            {link.link_label || 'Vidéo associée'}
                        </Text>
                        {link.access_level === 'customer_only' && (
                            <View style={styles.badge}>
                                <SafeIcon name="lock" size={12} color="#f59e0b" />
                                <Text style={styles.badgeText}>Clients uniquement</Text>
                            </View>
                        )}
                    </View>
                    <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
                </TouchableOpacity>
            ))}
        </View>
    );
};
```

### **4. Intégration dans le lecteur vidéo**

```typescript
// mobile/src/components/VideoPlayer.tsx

const [showLinksPanel, setShowLinksPanel] = useState(false);

// Dans le rendu, après la vidéo
<VideoLinksPanel
    sourceVideoId={videoId}
    sourceType="media"
    serviceId={serviceId}
    productIndex={productIndex}
    onVideoSelect={(targetVideoId, targetType) => {
        // Naviguer vers la nouvelle vidéo
        navigation.navigate('Video', {
            videoId: targetVideoId,
            videoType: targetType,
            serviceId,
            productIndex,
        });
    }}
/>
```

---

## 📊 RÉSUMÉ DES AMÉLIORATIONS

### ✅ **1. Flux de commande client amélioré**
- ❌ **Retirer** : Système de partage de lien par prestataire
- ✅ **Ajouter** : Modal automatique au clic sur "Se faire livrer"
- ✅ **Auto-remplissage** : Adresses par défaut chargées automatiquement
- ✅ **Création directe** : Livraison créée directement par le client
- ✅ **Matching automatique** : Déclenché après création (recipient déjà assigné)

### ✅ **2. Navigation vidéos liées**
- ✅ **Nouvelle table** : `video_links` pour gérer les relations
- ✅ **Types de liens** : related, tutorial, upgrade, cross_sell
- ✅ **Niveaux d'accès** : public, authenticated, customer_only
- ✅ **Composant UI** : `VideoLinksPanel` pour afficher les vidéos liées
- ✅ **Contrôle d'accès** : Vérification automatique pour vidéos privées

---

## 🎯 PROCHAINES ÉTAPES

1. **Valider l'analyse** : Cette approche répond-elle à tes attentes ?
2. **Prioriser** : Commencer par le flux de commande ou les vidéos liées ?
3. **Implémenter** : Je peux commencer l'implémentation une fois validé

Qu'en penses-tu ?

