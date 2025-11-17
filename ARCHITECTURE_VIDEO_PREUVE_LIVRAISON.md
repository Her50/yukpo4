# 📹 Architecture : Vidéo de Preuve de Livraison (Proof of Delivery Video)

## 📋 BESOIN

### **Scénario** :
Le coursier confirme la livraison, mais le client n'est pas physiquement présent. Le coursier doit pouvoir enregistrer une vidéo comme preuve de livraison, visible dans le flux de suivi du client.

### **Objectifs** :
1. ✅ **Preuve de livraison** : Le client a une preuve visuelle que son colis a été livré
2. ✅ **Réduction des litiges** : Vidéo comme preuve en cas de réclamation
3. ✅ **Transparence** : Le client peut voir où et comment son colis a été déposé
4. ✅ **Sécurité coursier** : Le coursier a une preuve de sa livraison

---

## 🎯 FLUX COMPLET

### **Workflow** :

```
1. Coursier arrive chez le client
   → Statut : "arrival_destination"
   
2. Client n'est pas présent
   → Coursier clique "Livrer" → Modal s'ouvre
   → Options : "Client présent" ou "Déposer sans présence"
   
3. Coursier choisit "Déposer sans présence"
   → Modal demande : "Enregistrer une vidéo de preuve"
   → Bouton "📹 Enregistrer vidéo" s'affiche
   
4. Coursier enregistre vidéo (15-30 secondes)
   → Vidéo enregistrée localement
   → Aperçu de la vidéo affiché
   → Option de réenregistrer ou valider
   
5. Coursier valide
   → Upload vidéo vers backend (async)
   → Statut livraison : "delivered"
   → Payload événement contient : video_proof_url
   
6. Client reçoit notification
   → "Livraison effectuée ! Regarder la preuve vidéo"
   → Client ouvre flux de suivi
   → Vidéo visible dans timeline au moment "delivered"
```

---

## 🔧 IMPLÉMENTATION TECHNIQUE

### **1. Base de Données**

#### **Table : delivery_status_events** (existante, à modifier)

```sql
-- Le champ payload JSONB existe déjà
-- On va stocker la vidéo dans le payload de l'événement "delivered"

-- Structure payload pour événement "delivered" :
-- {
--   "video_proof": {
--     "url": "https://storage.yukpo.com/deliveries/{delivery_id}/proof_{timestamp}.mp4",
--     "thumbnail_url": "https://storage.yukpo.com/deliveries/{delivery_id}/proof_{timestamp}_thumb.jpg",
--     "duration_seconds": 25,
--     "file_size_bytes": 5242880,
--     "recorded_at": "2025-01-15T14:30:00Z",
--     "recorded_by": "courier_user_id",
--     "gps_location": {
--       "latitude": 4.0511,
--       "longitude": 9.7679,
--       "accuracy": 5.0
--     }
--   },
--   "delivery_method": "deposited_while_absent",  // ou "handed_to_client"
--   "dropoff_location": "Porte principale",
--   "instructions": "Colis déposé devant la porte, à l'abri de la pluie"
-- }
```

#### **Table : delivery_proof_media** (nouvelle, optionnelle pour audit)

```sql
CREATE TABLE IF NOT EXISTS delivery_proof_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status_event_id UUID REFERENCES delivery_status_events(id) ON DELETE SET NULL,
    
    -- Type de preuve
    media_type VARCHAR(50) NOT NULL,  -- 'video', 'photo', 'signature'
    
    -- URLs de stockage
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    
    -- Métadonnées
    file_size_bytes BIGINT,
    duration_seconds INTEGER,  -- Pour vidéos
    mime_type VARCHAR(100) DEFAULT 'video/mp4',
    
    -- Informations d'enregistrement
    recorded_by INTEGER NOT NULL REFERENCES users(id),  -- ID coursier
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Localisation GPS au moment de l'enregistrement
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    gps_accuracy DOUBLE PRECISION,
    
    -- Métadonnées additionnelles
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(delivery_id, status_event_id)
);

CREATE INDEX idx_delivery_proof_media_delivery ON delivery_proof_media(delivery_id);
CREATE INDEX idx_delivery_proof_media_recorded_by ON delivery_proof_media(recorded_by);
CREATE INDEX idx_delivery_proof_media_recorded_at ON delivery_proof_media(recorded_at);
```

---

### **2. Backend : Endpoint Upload Vidéo**

#### **backend/src/routes/delivery_routes.rs**

```rust
// POST /api/delivery/{delivery_id}/proof/video
// Upload vidéo de preuve de livraison

use axum::{
    extract::{Path, Multipart, State},
    Extension,
};
use uuid::Uuid;

pub async fn upload_delivery_proof_video(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(delivery_id): Path<Uuid>,
    mut multipart: Multipart,
) -> AppResult<Json<DeliveryProofUploadResponse>> {
    // 1. Vérifier que l'utilisateur est le coursier assigné
    let delivery_service = delivery_service(&state)?;
    let delivery = delivery_service.get_delivery_summary(delivery_id).await?;
    
    if delivery.courier_id != Some(user.id) {
        return Err(AppError::Forbidden(
            "Seul le coursier assigné peut uploader une preuve de livraison".into()
        ));
    }
    
    // 2. Vérifier que le statut est "arrival_destination" ou "en_route_delivery"
    if delivery.status != DeliveryStatus::ArrivalDestination 
        && delivery.status != DeliveryStatus::EnRouteDelivery {
        return Err(AppError::BadRequest(
            "La vidéo de preuve ne peut être uploadée que lors de la livraison".into()
        ));
    }
    
    // 3. Extraire le fichier vidéo du multipart
    let mut video_data: Option<Vec<u8>> = None;
    let mut metadata: Value = json!({});
    
    while let Some(field) = multipart.next_field().await? {
        let field_name = field.name().unwrap_or("");
        
        match field_name {
            "video" => {
                let bytes = field.bytes().await?;
                if bytes.len() > 50 * 1024 * 1024 {  // 50 MB max
                    return Err(AppError::BadRequest(
                        "La vidéo ne doit pas dépasser 50 MB".into()
                    ));
                }
                video_data = Some(bytes.to_vec());
            }
            "metadata" => {
                let metadata_str = field.text().await?;
                metadata = serde_json::from_str(&metadata_str)
                    .unwrap_or_else(|_| json!({}));
            }
            _ => {}
        }
    }
    
    let video_bytes = video_data.ok_or_else(|| {
        AppError::BadRequest("Fichier vidéo requis".into())
    })?;
    
    // 4. Récupérer GPS si disponible
    let gps_location = metadata.get("gps_location")
        .and_then(|v| {
            Some(GpsLocation {
                latitude: v.get("latitude")?.as_f64()?,
                longitude: v.get("longitude")?.as_f64()?,
                accuracy: v.get("accuracy")?.as_f64(),
            })
        });
    
    // 5. Upload vidéo vers storage (S3, Cloudflare R2, ou local)
    let media_storage = media_storage_service(&state)?;
    let video_filename = format!("delivery_{}/proof_{}.mp4", delivery_id, chrono::Utc::now().timestamp());
    let video_url = media_storage.upload_video(&video_filename, &video_bytes).await?;
    
    // 6. Générer thumbnail (extrait première frame)
    let thumbnail_url = media_storage.generate_video_thumbnail(&video_url).await?;
    
    // 7. Calculer durée vidéo
    let duration_seconds = metadata.get("duration_seconds")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    
    // 8. Enregistrer dans delivery_proof_media
    let proof_media = sqlx::query_as!(
        DeliveryProofMedia,
        r#"
        INSERT INTO delivery_proof_media (
            delivery_id, media_type, media_url, thumbnail_url,
            file_size_bytes, duration_seconds, mime_type,
            recorded_by, gps_latitude, gps_longitude, gps_accuracy,
            metadata
        )
        VALUES ($1, 'video', $2, $3, $4, $5, 'video/mp4', $6, $7, $8, $9, $10)
        RETURNING *
        "#,
        delivery_id,
        video_url,
        thumbnail_url,
        video_bytes.len() as i64,
        duration_seconds as i32,
        user.id,
        gps_location.as_ref().map(|g| g.latitude),
        gps_location.as_ref().map(|g| g.longitude),
        gps_location.and_then(|g| g.accuracy),
        metadata
    )
    .fetch_one(&state.pg)
    .await?;
    
    // 9. Mettre à jour statut livraison → "delivered" avec payload vidéo
    let video_payload = json!({
        "video_proof": {
            "url": proof_media.media_url,
            "thumbnail_url": proof_media.thumbnail_url,
            "duration_seconds": proof_media.duration_seconds,
            "file_size_bytes": proof_media.file_size_bytes,
            "recorded_at": proof_media.recorded_at,
            "recorded_by": proof_media.recorded_by,
            "gps_location": gps_location
        },
        "delivery_method": metadata.get("delivery_method").unwrap_or(&json!("deposited_while_absent")),
        "dropoff_location": metadata.get("dropoff_location"),
        "instructions": metadata.get("instructions")
    });
    
    delivery_service.update_delivery_status(
        delivery_id,
        DeliveryStatus::Delivered,
        None,
        Some(user.id),
        Some(video_payload),
    ).await?;
    
    Ok(Json(DeliveryProofUploadResponse {
        success: true,
        proof_media_id: proof_media.id,
        video_url: proof_media.media_url,
        thumbnail_url: proof_media.thumbnail_url,
        delivery_id,
    }))
}
```

---

### **3. Mobile : Composant Enregistrement Vidéo**

#### **mobile/src/components/delivery/DeliveryProofVideoRecorder.tsx**

```typescript
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Camera, CameraType, VideoQuality } from 'expo-camera';
import { Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { NativeButton } from '../NativeDesign';
import { modernColors } from '../../theme/modernTheme';
import { deliveryApi } from '../../services/api';

interface DeliveryProofVideoRecorderProps {
    deliveryId: string;
    onVideoRecorded: (videoUrl: string, thumbnailUrl: string) => void;
    onCancel: () => void;
}

export const DeliveryProofVideoRecorder: React.FC<DeliveryProofVideoRecorderProps> = ({
    deliveryId,
    onVideoRecorded,
    onCancel,
}) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const cameraRef = useRef<Camera>(null);
    const [cameraType, setCameraType] = useState<CameraType>(CameraType.back);

    // Demander permission caméra
    React.useEffect(() => {
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
    }, []);

    const startRecording = async () => {
        if (!cameraRef.current) return;
        
        setIsRecording(true);
        try {
            const video = await cameraRef.current.recordAsync({
                quality: VideoQuality['720p'],
                maxDuration: 30,  // Max 30 secondes
            });
            
            setRecordedVideoUri(video.uri);
            setIsRecording(false);
        } catch (error) {
            console.error('Erreur enregistrement vidéo:', error);
            Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo');
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (cameraRef.current) {
            cameraRef.current.stopRecording();
        }
        setIsRecording(false);
    };

    const uploadVideo = async () => {
        if (!recordedVideoUri) return;
        
        setIsUploading(true);
        try {
            // Récupérer GPS actuel
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            
            // Lire le fichier vidéo
            const videoBase64 = await FileSystem.readAsStringAsync(recordedVideoUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            
            // Convertir base64 en blob
            const response = await fetch(recordedVideoUri);
            const blob = await response.blob();
            
            // Créer FormData
            const formData = new FormData();
            formData.append('video', {
                uri: recordedVideoUri,
                type: 'video/mp4',
                name: `proof_${deliveryId}_${Date.now()}.mp4`,
            } as any);
            
            formData.append('metadata', JSON.stringify({
                delivery_method: 'deposited_while_absent',
                dropoff_location: 'Porte principale',
                instructions: 'Colis déposé devant la porte',
                duration_seconds: 25,  // TODO: Calculer durée réelle
                gps_location: {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    accuracy: location.coords.accuracy,
                },
            }));
            
            // Upload vers backend
            const result = await deliveryApi.uploadProofVideo(deliveryId, formData);
            
            if (result.success) {
                onVideoRecorded(result.video_url, result.thumbnail_url);
            } else {
                throw new Error(result.error || 'Erreur upload');
            }
        } catch (error: any) {
            console.error('Erreur upload vidéo:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'uploader la vidéo');
        } finally {
            setIsUploading(false);
        }
    };

    const retakeVideo = () => {
        setRecordedVideoUri(null);
    };

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.text}>Demande de permission caméra...</Text>
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>
                    Permission caméra refusée. Impossible d'enregistrer une vidéo.
                </Text>
                <NativeButton title="Annuler" variant="secondary" onPress={onCancel} />
            </View>
        );
    }

    // Afficher preview de la vidéo enregistrée
    if (recordedVideoUri) {
        return (
            <View style={styles.container}>
                <Video
                    source={{ uri: recordedVideoUri }}
                    style={styles.videoPreview}
                    useNativeControls
                    resizeMode="contain"
                />
                
                <View style={styles.actions}>
                    <NativeButton
                        title="📹 Réenregistrer"
                        variant="secondary"
                        onPress={retakeVideo}
                        disabled={isUploading}
                    />
                    <NativeButton
                        title={isUploading ? "Upload..." : "✅ Valider et livrer"}
                        variant="primary"
                        onPress={uploadVideo}
                        disabled={isUploading}
                    />
                </View>
            </View>
        );
    }

    // Vue caméra
    return (
        <View style={styles.container}>
            <Camera
                ref={cameraRef}
                style={styles.camera}
                type={cameraType}
            >
                <View style={styles.overlay}>
                    <View style={styles.header}>
                        <Text style={styles.instruction}>
                            Enregistrez une vidéo de preuve de livraison
                        </Text>
                        <Text style={styles.subInstruction}>
                            Montrez le colis déposé à son emplacement
                        </Text>
                    </View>
                    
                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={styles.flipButton}
                            onPress={() => setCameraType(
                                cameraType === CameraType.back
                                    ? CameraType.front
                                    : CameraType.back
                            )}
                        >
                            <Text style={styles.flipText}>🔄</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                            onPress={isRecording ? stopRecording : startRecording}
                        >
                            <View style={styles.recordButtonInner} />
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onCancel}
                        >
                            <Text style={styles.cancelText}>❌</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Camera>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'space-between',
        padding: 20,
    },
    header: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 16,
        borderRadius: 12,
        marginTop: 40,
    },
    instruction: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    subInstruction: {
        color: 'white',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
        opacity: 0.9,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        gap: 40,
    },
    recordButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'white',
        borderWidth: 4,
        borderColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordButtonActive: {
        backgroundColor: modernColors.error,
        borderColor: modernColors.error,
    },
    recordButtonInner: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: modernColors.primary,
    },
    flipButton: {
        padding: 12,
    },
    flipText: {
        fontSize: 24,
    },
    cancelButton: {
        padding: 12,
    },
    cancelText: {
        fontSize: 24,
    },
    videoPreview: {
        flex: 1,
        backgroundColor: 'black',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 20,
        gap: 16,
    },
    text: {
        color: modernColors.text,
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
    },
});
```

---

### **4. Mobile : Intégration dans DeliveryShoppingTrackingScreen**

#### **Modification de `DeliveryShoppingTrackingScreen.tsx`**

```typescript
// Ajout après ligne 177 (case 'arrival_destination'):

import { DeliveryProofVideoRecorder } from '../../components/delivery/DeliveryProofVideoRecorder';

const [showVideoRecorder, setShowVideoRecorder] = useState(false);

const handleDeliverWithProof = () => {
    // Afficher modal de choix
    Alert.alert(
        'Confirmer la livraison',
        'Le client est-il présent ?',
        [
            {
                text: 'Client présent',
                onPress: () => handleUpdateStatus('delivered'),
            },
            {
                text: 'Déposer sans présence',
                onPress: () => setShowVideoRecorder(true),
            },
            {
                text: 'Annuler',
                style: 'cancel',
            },
        ]
    );
};

// Modifier getNextStatusOptions() ligne 177:
case 'arrival_destination':
    return [
        { 
            label: 'Livré avec preuve vidéo', 
            status: 'delivered_with_proof', 
            icon: '📹',
            action: handleDeliverWithProof,  // Action personnalisée
        },
    ];

// Ajouter modal vidéo après le ScrollView:
{showVideoRecorder && (
    <Modal
        visible={showVideoRecorder}
        animationType="slide"
        presentationStyle="fullScreen"
    >
        <DeliveryProofVideoRecorder
            deliveryId={deliveryId!}
            onVideoRecorded={(videoUrl, thumbnailUrl) => {
                setShowVideoRecorder(false);
                Alert.alert(
                    'Livraison confirmée',
                    'La vidéo de preuve a été enregistrée avec succès.'
                );
                refresh({ force: true });
            }}
            onCancel={() => setShowVideoRecorder(false)}
        />
    </Modal>
)}
```

---

### **5. Frontend Web : Affichage Vidéo dans Timeline**

#### **frontend/src/components/delivery/DeliveryTimeline.tsx**

```typescript
import React from 'react';
import { CheckCircle, Clock, Package, Truck } from 'lucide-react';
import { Video } from 'lucide-react';

interface TimelineCheckpoint {
    id: string;
    status: string;
    label: string;
    timestamp: Date;
    payload?: any;
}

interface DeliveryTimelineProps {
    checkpoints: TimelineCheckpoint[];
}

export const DeliveryTimeline: React.FC<DeliveryTimelineProps> = ({ checkpoints }) => {
    const renderVideoProof = (payload: any) => {
        const videoProof = payload?.video_proof;
        if (!videoProof) return null;
        
        return (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Video className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-slate-900">
                        Preuve vidéo de livraison
                    </span>
                </div>
                
                <video
                    controls
                    className="w-full rounded-lg mb-2"
                    poster={videoProof.thumbnail_url}
                >
                    <source src={videoProof.url} type="video/mp4" />
                    Votre navigateur ne supporte pas la vidéo HTML5.
                </video>
                
                <div className="text-xs text-slate-600 space-y-1">
                    {videoProof.gps_location && (
                        <p>
                            📍 Localisation : {videoProof.gps_location.latitude.toFixed(6)}, {videoProof.gps_location.longitude.toFixed(6)}
                        </p>
                    )}
                    {payload.dropoff_location && (
                        <p>📍 Emplacement : {payload.dropoff_location}</p>
                    )}
                    {payload.instructions && (
                        <p>📝 Instructions : {payload.instructions}</p>
                    )}
                    <p>
                        ⏱️ Durée : {videoProof.duration_seconds}s
                        {' • '}
                        📅 {new Date(videoProof.recorded_at).toLocaleString('fr-FR')}
                    </p>
                </div>
            </div>
        );
    };
    
    return (
        <div className="space-y-4">
            {checkpoints.map((checkpoint, index) => (
                <div key={checkpoint.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                        <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center
                            ${checkpoint.status === 'delivered' 
                                ? 'bg-green-500 text-white' 
                                : index < checkpoints.length - 1 
                                    ? 'bg-primary text-white' 
                                    : 'bg-slate-300 text-slate-600'}
                        `}>
                            {checkpoint.status === 'delivered' ? (
                                <CheckCircle className="h-5 w-5" />
                            ) : checkpoint.status === 'picked_up' ? (
                                <Package className="h-5 w-5" />
                            ) : (
                                <Truck className="h-5 w-5" />
                            )}
                        </div>
                        {index < checkpoints.length - 1 && (
                            <div className="w-0.5 h-full bg-slate-200 mt-2" />
                        )}
                    </div>
                    
                    <div className="flex-1 pb-4">
                        <div className="font-semibold text-slate-900">
                            {checkpoint.label}
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                            {checkpoint.timestamp.toLocaleString('fr-FR')}
                        </div>
                        
                        {/* Afficher vidéo si présente */}
                        {checkpoint.status === 'delivered' && checkpoint.payload && (
                            renderVideoProof(checkpoint.payload)
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
```

---

### **6. Mobile : Affichage Vidéo dans Timeline**

#### **mobile/src/components/delivery/TimelineStepper.tsx**

```typescript
// Ajouter dans le rendu du checkpoint "delivered":

import { Video } from 'expo-av';

{checkpoint.status === 'delivered' && checkpoint.payload?.video_proof && (
    <View style={styles.videoProofContainer}>
        <View style={styles.videoProofHeader}>
            <Text style={styles.videoProofIcon}>📹</Text>
            <Text style={styles.videoProofTitle}>Preuve vidéo de livraison</Text>
        </View>
        
        <Video
            source={{ uri: checkpoint.payload.video_proof.url }}
            style={styles.videoPlayer}
            useNativeControls
            resizeMode="contain"
            posterSource={{ uri: checkpoint.payload.video_proof.thumbnail_url }}
        />
        
        <View style={styles.videoProofMetadata}>
            {checkpoint.payload.video_proof.gps_location && (
                <Text style={styles.metadataText}>
                    📍 {checkpoint.payload.video_proof.gps_location.latitude.toFixed(6)}, {checkpoint.payload.video_proof.gps_location.longitude.toFixed(6)}
                </Text>
            )}
            {checkpoint.payload.dropoff_location && (
                <Text style={styles.metadataText}>
                    📍 {checkpoint.payload.dropoff_location}
                </Text>
            )}
            <Text style={styles.metadataText}>
                ⏱️ {checkpoint.payload.video_proof.duration_seconds}s
            </Text>
        </View>
    </View>
)}

const styles = StyleSheet.create({
    // ... styles existants
    videoProofContainer: {
        marginTop: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        padding: 12,
    },
    videoProofHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    videoProofIcon: {
        fontSize: 16,
    },
    videoProofTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    videoPlayer: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        backgroundColor: 'black',
        marginBottom: 8,
    },
    videoProofMetadata: {
        gap: 4,
    },
    metadataText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
});
```

---

## 📊 FLUX RÉSUMÉ

```
COURSIER (Mobile)
  ↓
1. Arrive chez client → Statut "arrival_destination"
  ↓
2. Clique "Livrer" → Modal choix
  ↓
3. Choisit "Déposer sans présence"
  ↓
4. Modal vidéo s'ouvre → Enregistre vidéo (max 30s)
  ↓
5. Aperçu vidéo → Valide ou réenregistre
  ↓
6. Upload vidéo → Backend
  ↓
7. Backend → Stocke vidéo + Met statut "delivered"
  ↓
8. Notification push → Client
  ↓
CLIENT (Mobile/Web)
  ↓
9. Ouvre flux de suivi
  ↓
10. Timeline → Checkpoint "delivered" avec vidéo visible
  ↓
11. Client clique → Lecture vidéo de preuve
```

---

## ✅ AVANTAGES

1. ✅ **Preuve visuelle** : Client voit exactement où son colis a été déposé
2. ✅ **Réduction litiges** : Vidéo comme preuve en cas de réclamation
3. ✅ **Transparence** : Le client sait que son colis a été livré correctement
4. ✅ **Sécurité coursier** : Le coursier a une preuve de sa livraison
5. ✅ **UX fluide** : Intégré naturellement dans le flux existant

---

## 🎯 PROCHAINES ÉTAPES

1. ✅ **Backend** : Implémenter endpoint upload vidéo
2. ✅ **Mobile** : Composant enregistrement vidéo
3. ✅ **Frontend** : Affichage vidéo dans timeline
4. ✅ **Storage** : Configuration stockage vidéos (S3, R2, etc.)
5. ✅ **Thumbnails** : Génération miniatures vidéos
6. ✅ **Notifications** : Notification client avec lien vidéo

**Cette fonctionnalité transforme le système de livraison en ajoutant une preuve visuelle incontestable de la livraison !** 📹✅

Souhaites-tu que je commence l'implémentation ?

