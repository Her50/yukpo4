import AppLayout from '@/components/layout/AppLayout';
import AdvancedGPSModal from '@/components/ui/AdvancedGPSModal';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDeliveryRequest, type CreateDeliveryRequestPayload } from '@/services/deliveryApi';
import { compressImageFile, formatFileSize, type CompressionResult } from '@/utils/imageCompression';
import { AlertCircle, Camera, Clock, MapPin, Package, Truck, Upload, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// Options de transport disponibles
const VEHICLE_TRANSPORT_OPTIONS = [
    { value: 'bike', label: 'Vélo cargo', icon: '🚲' },
    { value: 'motorcycle', label: 'Moto', icon: '🏍️' },
    { value: 'tricycle', label: 'Tricycle', icon: '🛺' },
    { value: 'car', label: 'Voiture', icon: '🚗' },
    { value: 'pickup', label: 'Pick-up', icon: '🛻' },
    { value: 'van', label: 'Fourgonnette', icon: '🚐' },
    { value: 'truck', label: 'Camion', icon: '🚚' },
    { value: 'walking', label: 'À pied', icon: '🚶' },
];

interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}

const DeliveryParcelFlowPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);

    // État informations colis
    const [parcelType, setParcelType] = useState<'document' | 'package' | 'moving' | 'cake'>('package');
    const [weight, setWeight] = useState<string>('');
    const [volume, setVolume] = useState<string>('');
    const [declaredValue, setDeclaredValue] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    
    // États pour formulaire adaptatif
    const [numberOfPages, setNumberOfPages] = useState<string>(''); // Document
    const [cakeSize, setCakeSize] = useState<string>(''); // Gâteau
    const [cakeLayers, setCakeLayers] = useState<string>(''); // Gâteau
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [photoCompression, setPhotoCompression] = useState<Record<number, CompressionResult>>({});
    const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
    const photoInputRef = useRef<HTMLInputElement>(null);

    // État locations
    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
    const [showPickupGPS, setShowPickupGPS] = useState(false);
    const [showDropoffGPS, setShowDropoffGPS] = useState(false);

    // ✅ États pour aller-retour
    const [isRoundTrip, setIsRoundTrip] = useState<boolean>(false);
    const [returnPickupLocation, setReturnPickupLocation] = useState<LocationData | null>(null);
    const [returnDropoffLocation, setReturnDropoffLocation] = useState<LocationData | null>(null);
    const [showReturnPickupGPS, setShowReturnPickupGPS] = useState(false);
    const [showReturnDropoffGPS, setShowReturnDropoffGPS] = useState(false);
    const [returnDistance, setReturnDistance] = useState<number | null>(null);

    // État transport (vide par défaut, backend utilisera "motorcycle")
    const [transportMode, setTransportMode] = useState<string>('');
    
    // État déménagement
    const [isMoving, setIsMoving] = useState(false);
    const [movingBoxes, setMovingBoxes] = useState<string>('');
    const [movingFurniture, setMovingFurniture] = useState<string>('');
    const [movingAccess, setMovingAccess] = useState<string>('');

    // Préférences de livraison
    const [preferredDeliveryDate, setPreferredDeliveryDate] = useState<string>('');
    const [preferredDeliveryTimeStart, setPreferredDeliveryTimeStart] = useState<string>('');
    const [preferredDeliveryTimeEnd, setPreferredDeliveryTimeEnd] = useState<string>('');
    const [isFlexible, setIsFlexible] = useState<boolean>(true);
    const [flexibilityWindowDays, setFlexibilityWindowDays] = useState<number>(3);
    const [urgencyLevel, setUrgencyLevel] = useState<'standard' | 'urgent' | 'scheduled'>('standard');
    // ✅ Planification
    const [isScheduled, setIsScheduled] = useState<boolean>(false);
    const [scheduledDate, setScheduledDate] = useState<string>('');
    const [scheduledTime, setScheduledTime] = useState<string>('');
    // ✅ Par défaut : matching instantané si planification sélectionnée
    const [matchingMode, setMatchingMode] = useState<'immediate' | 'scheduled'>('immediate');

    // État destinataire
    const [recipientName, setRecipientName] = useState<string>('');
    const [recipientPhone, setRecipientPhone] = useState<string>('');
    const [recipientCountryCode, setRecipientCountryCode] = useState<string>('+237');
    const [recipientConsentGranted, setRecipientConsentGranted] = useState<boolean>(false);
    const [recipientInstructions, setRecipientInstructions] = useState<string>('');
    const [recipientAllowTracking, setRecipientAllowTracking] = useState<boolean>(false);

    // Calculer la distance entre pickup et dropoff
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Calculer la distance quand les deux points sont disponibles
    useEffect(() => {
        if (pickupLocation && dropoffLocation) {
            const distance = calculateDistance(
                pickupLocation.latitude,
                pickupLocation.longitude,
                dropoffLocation.latitude,
                dropoffLocation.longitude
            );
            setEstimatedDistance(distance);
        } else {
            setEstimatedDistance(null);
        }
    }, [pickupLocation, dropoffLocation]);

    // ✅ Calculer distance retour
    useEffect(() => {
        if (isRoundTrip && returnPickupLocation && returnDropoffLocation) {
            const distance = calculateDistance(
                returnPickupLocation.latitude,
                returnPickupLocation.longitude,
                returnDropoffLocation.latitude,
                returnDropoffLocation.longitude
            );
            setReturnDistance(distance);
        } else {
            setReturnDistance(null);
        }
    }, [isRoundTrip, returnPickupLocation, returnDropoffLocation]);

    // ✅ Auto-remplir les points de retour depuis les points aller si activé
    useEffect(() => {
        if (isRoundTrip && pickupLocation && dropoffLocation) {
            // Point de collecte retour = point de livraison aller
            if (!returnPickupLocation) {
                setReturnPickupLocation({
                    latitude: dropoffLocation.latitude,
                    longitude: dropoffLocation.longitude,
                    address: dropoffLocation.address,
                });
            }
            // Point de livraison retour = point de collecte aller
            if (!returnDropoffLocation) {
                setReturnDropoffLocation({
                    latitude: pickupLocation.latitude,
                    longitude: pickupLocation.longitude,
                    address: pickupLocation.address,
                });
            }
        }
    }, [isRoundTrip, pickupLocation, dropoffLocation]);

    // Mettre à jour isMoving quand le type change
    useEffect(() => {
        setIsMoving(parcelType === 'moving');
    }, [parcelType]);
    
    // Supprimer transportMode si le type change vers un type incompatible
    useEffect(() => {
        if (parcelType === 'moving' && transportMode === 'walking') {
            setTransportMode('');
        }
    }, [parcelType, transportMode]);

    // Gérer l'upload de photos avec compression
    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        // Limiter à 5 photos maximum
        const maxPhotos = 5;
        const remainingSlots = maxPhotos - photos.length;
        if (remainingSlots <= 0) {
            toast.error(`Maximum ${maxPhotos} photos autorisées`);
            return;
        }

        const validFiles = files.slice(0, remainingSlots).filter(file => {
            if (!file.type.startsWith('image/')) {
                toast.error(`${file.name} n'est pas une image valide`);
                return false;
            }
            return true;
        });

        // Compresser chaque image avec progression
        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const photoIndex = photos.length + i;

            try {
                // Simuler progression
                setUploadProgress(prev => ({ ...prev, [photoIndex]: 10 }));

                // Compresser l'image
                setUploadProgress(prev => ({ ...prev, [photoIndex]: 50 }));
                const compressionResult = await compressImageFile(file);

                setUploadProgress(prev => ({ ...prev, [photoIndex]: 90 }));

                // Ajouter la photo compressée
                setPhotos(prev => [...prev, compressionResult.compressedBase64]);
                setPhotoFiles(prev => [...prev, file]);
                setPhotoCompression(prev => ({ ...prev, [photoIndex]: compressionResult }));

                // Afficher les stats de compression
                if (compressionResult.compressionRatio > 10) {
                    console.log(`[Photo ${photoIndex + 1}] Compression: ${formatFileSize(compressionResult.originalSize)} → ${formatFileSize(compressionResult.compressedSize)} (${compressionResult.compressionRatio.toFixed(1)}% réduit)`);
                }

                setUploadProgress(prev => ({ ...prev, [photoIndex]: 100 }));
            } catch (error) {
                console.error(`Erreur compression photo ${file.name}:`, error);
                toast.error(`Erreur lors de la compression de ${file.name}`);
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[photoIndex];
                    return newProgress;
                });
            }
        }

        // Réinitialiser l'input
        if (photoInputRef.current) {
            photoInputRef.current.value = '';
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
        setPhotoFiles(prev => prev.filter((_, i) => i !== index));
        setPhotoCompression(prev => {
            const newCompression = { ...prev };
            delete newCompression[index];
            // Réindexer les compressions
            const reindexed: Record<number, CompressionResult> = {};
            Object.keys(newCompression).forEach(key => {
                const oldIndex = parseInt(key);
                if (oldIndex > index) {
                    reindexed[oldIndex - 1] = newCompression[oldIndex];
                } else if (oldIndex < index) {
                    reindexed[oldIndex] = newCompression[oldIndex];
                }
            });
            return reindexed;
        });
        setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[index];
            // Réindexer les progressions
            const reindexed: Record<number, number> = {};
            Object.keys(newProgress).forEach(key => {
                const oldIndex = parseInt(key);
                if (oldIndex > index) {
                    reindexed[oldIndex - 1] = newProgress[oldIndex];
                } else if (oldIndex < index) {
                    reindexed[oldIndex] = newProgress[oldIndex];
                }
            });
            return reindexed;
        });
    };

    const handleCapturePhoto = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            // Créer un canvas pour capturer l'image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            video.addEventListener('loadedmetadata', async () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx?.drawImage(video, 0, 0);

                // Convertir en blob puis en base64
                canvas.toBlob(async (blob) => {
                    if (blob && photos.length < 5) {
                        const photoIndex = photos.length;
                        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });

                        try {
                            setUploadProgress(prev => ({ ...prev, [photoIndex]: 50 }));

                            // Compresser la photo capturée
                            const compressionResult = await compressImageFile(file);

                            setPhotos(prev => [...prev, compressionResult.compressedBase64]);
                            setPhotoFiles(prev => [...prev, file]);
                            setPhotoCompression(prev => ({ ...prev, [photoIndex]: compressionResult }));
                            setUploadProgress(prev => ({ ...prev, [photoIndex]: 100 }));
                        } catch (error) {
                            console.error('Erreur compression photo capturée:', error);
                            toast.error('Erreur lors de la compression de la photo');
                        }
                    } else if (photos.length >= 5) {
                        toast.error('Maximum 5 photos autorisées');
                    }

                    // Arrêter le stream
                    stream.getTracks().forEach(track => track.stop());
                }, 'image/jpeg', 0.8);
            });
        } catch (error) {
            console.error('Erreur capture photo:', error);
            toast.error('Impossible d\'accéder à la caméra');
        }
    };

    // Validation en temps réel
    const validateField = (field: string, value: any): string => {
        switch (field) {
            case 'weight':
                if (value && parseFloat(value) <= 0) {
                    return 'Le poids doit être supérieur à 0';
                }
                if (value && parseFloat(value) > 1000) {
                    return 'Le poids ne peut pas dépasser 1000 kg';
                }
                return '';
            case 'volume':
                if (value && parseFloat(value) <= 0) {
                    return 'Le volume doit être supérieur à 0';
                }
                return '';
            case 'declaredValue':
                if (value && parseFloat(value) < 0) {
                    return 'La valeur déclarée ne peut pas être négative';
                }
                return '';
            case 'preferredDeliveryDate':
                if (value) {
                    const date = new Date(value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date < today) {
                        return 'La date ne peut pas être dans le passé';
                    }
                }
                return '';
            case 'preferredDeliveryTimeStart':
                if (value && preferredDeliveryTimeEnd) {
                    const [startH, startM] = value.split(':').map(Number);
                    const [endH, endM] = preferredDeliveryTimeEnd.split(':').map(Number);
                    if (startH > endH || (startH === endH && startM >= endM)) {
                        return 'L\'heure de début doit être avant l\'heure de fin';
                    }
                }
                return '';
            default:
                return '';
        }
    };

    const handleGPSSelect = (
        path: { lat: number; lng: number }[],
        previewUrl: string,
        metadata: any,
        type: 'pickup' | 'dropoff'
    ) => {
        if (!path || path.length === 0) return;

        const firstPoint = path[0];
        const coords: LocationData = {
            latitude: firstPoint.lat,
            longitude: firstPoint.lng,
            address: metadata?.address || metadata?.formatted_address || undefined,
        };

        if (type === 'pickup') {
            setPickupLocation(coords);
            setErrors(prev => ({ ...prev, pickup: '' }));
            setShowPickupGPS(false);
        } else {
            setDropoffLocation(coords);
            setErrors(prev => ({ ...prev, dropoff: '' }));
            setShowDropoffGPS(false);
        }
    };

    const handleSubmit = async () => {
        // Validation complète
        const newErrors: Record<string, string> = {};

        if (!pickupLocation) {
            newErrors.pickup = 'Le point de collecte est requis';
        }
        if (!dropoffLocation) {
            newErrors.dropoff = 'Le point de livraison est requis';
        }

        // Validation destinataire
        if (!recipientName) {
            newErrors.recipientName = 'Le nom du destinataire est requis';
        }
        if (!recipientPhone) {
            newErrors.recipientPhone = 'Le téléphone du destinataire est requis';
        }
        if (!recipientConsentGranted) {
            newErrors.recipientConsentGranted = 'Le consentement du destinataire est requis';
        }

        // Validation des champs numériques
        if (weight) {
            const weightError = validateField('weight', weight);
            if (weightError) newErrors.weight = weightError;
        }
        if (volume) {
            const volumeError = validateField('volume', volume);
            if (volumeError) newErrors.volume = volumeError;
        }
        if (declaredValue) {
            const valueError = validateField('declaredValue', declaredValue);
            if (valueError) newErrors.declaredValue = valueError;
        }

        // Validation des dates/heures
        if (preferredDeliveryDate) {
            const dateError = validateField('preferredDeliveryDate', preferredDeliveryDate);
            if (dateError) newErrors.preferredDeliveryDate = dateError;
        }
        if (preferredDeliveryTimeStart && preferredDeliveryTimeEnd) {
            const timeError = validateField('preferredDeliveryTimeStart', preferredDeliveryTimeStart);
            if (timeError) newErrors.preferredDeliveryTimeStart = timeError;
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            toast.error('Veuillez corriger les erreurs avant de continuer.');
            return;
        }

        // ✅ Validation aller-retour
        if (isRoundTrip && (!returnPickupLocation || !returnDropoffLocation)) {
            toast.error('Veuillez sélectionner les points de collecte et de livraison pour le retour');
            return;
        }

        setLoading(true);
        try {
            // Construire le payload
            const payload: CreateDeliveryRequestPayload = {
                // ✅ Par défaut: "motorcycle" si aucun type spécifié
                preferred_vehicle_type: transportMode || undefined, // Sera remplacé par "motorcycle" dans le backend si vide
                is_round_trip: isRoundTrip || undefined,
                // ✅ Planification
                scheduled_delivery_at: isScheduled && scheduledDate && scheduledTime
                    ? `${scheduledDate}T${scheduledTime}:00Z`
                    : undefined,
                matching_mode: isScheduled ? matchingMode : undefined,
                ...(isRoundTrip && returnPickupLocation && returnDropoffLocation && {
                    return_pickup: {
                        latitude: returnPickupLocation.latitude,
                        longitude: returnPickupLocation.longitude,
                        address: returnPickupLocation.address,
                    },
                    return_dropoff: {
                        latitude: returnDropoffLocation.latitude,
                        longitude: returnDropoffLocation.longitude,
                        address: returnDropoffLocation.address,
                    },
                    round_trip_discount_percent: 10, // 10% de réduction par défaut pour aller-retour
                }),
                parcel: {
                    type_id: parcelType === 'document' ? 1 : parcelType === 'package' ? 2 : parcelType === 'moving' ? 3 : 4,
                    weight_kg: weight ? parseFloat(weight) : undefined,
                    volume_cm3: volume ? parseFloat(volume) : undefined,
                    declared_value: declaredValue ? parseFloat(declaredValue) : undefined,
                    notes: notes || undefined,
                    // ✅ CORRIGÉ : Toujours envoyer un tableau (même vide) pour photos
                    photos: photos.length > 0 ? photos : [],
                    // ✅ CORRIGÉ : Toujours envoyer un objet (même vide) pour constraints
                    constraints: {
                        ...(parcelType === 'document' && {
                            number_of_pages: numberOfPages ? parseInt(numberOfPages) : undefined,
                        }),
                        ...(parcelType === 'moving' && {
                            is_moving: true,
                            boxes: movingBoxes || undefined,
                            furniture: movingFurniture || undefined,
                            access: movingAccess || undefined,
                        }),
                        ...(parcelType === 'cake' && {
                            cake_size: cakeSize || undefined,
                            cake_layers: cakeLayers ? parseInt(cakeLayers) : undefined,
                        }),
                    },
                },
                pickup: {
                    latitude: pickupLocation!.latitude,
                    longitude: pickupLocation!.longitude,
                    address: pickupLocation!.address,
                },
                dropoff: {
                    latitude: dropoffLocation!.latitude,
                    longitude: dropoffLocation!.longitude,
                    address: dropoffLocation!.address,
                },
                recipient: {
                    contact_name: recipientName,
                    contact_phone: recipientPhone,
                    country_code: recipientCountryCode || undefined,
                    consent_granted: recipientConsentGranted,
                    notes: recipientInstructions || undefined,
                    allow_tracking: recipientAllowTracking || undefined,
                },
                metadata: {
                    kind: 'parcel',
                    is_moving: isMoving,
                    preferred_delivery_date: preferredDeliveryDate || undefined,
                    preferred_delivery_time_start: preferredDeliveryTimeStart || undefined,
                    preferred_delivery_time_end: preferredDeliveryTimeEnd || undefined,
                    is_flexible: isFlexible,
                    flexibility_window_days: flexibilityWindowDays,
                    urgency_level: urgencyLevel,
                },
                // ✅ CORRIGÉ : Ajouter initial_event_payload par défaut
                initial_event_payload: {},
            };

            const result = await createDeliveryRequest(payload);

            if (result.id) {
                toast.success('Livraison créée avec succès !');
                navigate(`/delivery/${result.id}/tracking`);
            } else {
                toast.error('Impossible de créer la livraison');
            }
        } catch (error: any) {
            console.error('Erreur création livraison:', error);
            toast.error(error.message || 'Une erreur est survenue lors de la création de la livraison');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Livraison de colis</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Expédiez un colis ou un document avec suivi en temps réel
                    </p>
                </div>

                {/* Type de colis */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-slate-900">Type de colis *</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {([
                            { id: 'document', label: 'Document', icon: 'file-text' },
                            { id: 'package', label: 'Colis', icon: 'package' },
                            { id: 'moving', label: 'Déménagement', icon: 'truck' },
                            { id: 'cake', label: 'Gâteau', icon: 'cake' },
                        ] as const).map((type) => (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => setParcelType(type.id)}
                                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 transition-all min-h-[70px] ${parcelType === type.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                {type.id === 'document' ? (
                                    <AlertCircle className="h-4 w-4 text-primary" />
                                ) : type.id === 'package' ? (
                                    <Package className="h-4 w-4 text-primary" />
                                ) : type.id === 'moving' ? (
                                    <Truck className="h-4 w-4 text-primary" />
                                ) : (
                                    <span className="text-lg">🎂</span>
                                )}
                                <span className={`text-xs font-medium text-center whitespace-nowrap ${parcelType === type.id ? 'text-primary' : 'text-slate-700'}`}>
                                    {type.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Informations colis - Formulaire adaptatif */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-accent" />
                        <h2 className="text-lg font-semibold text-slate-900">Informations du colis</h2>
                    </div>
                    
                    {/* Formulaire pour Document */}
                    {parcelType === 'document' && (
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="numberOfPages">Nombre de pages (optionnel)</Label>
                                <Input
                                    id="numberOfPages"
                                    type="number"
                                    placeholder="Ex: 10"
                                    value={numberOfPages}
                                    onChange={(e) => setNumberOfPages(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="declaredValue">Valeur déclarée (FCFA)</Label>
                                <Input
                                    id="declaredValue"
                                    type="number"
                                    placeholder="Ex: 5000"
                                    value={declaredValue}
                                    onChange={(e) => {
                                        setDeclaredValue(e.target.value);
                                        const error = validateField('declaredValue', e.target.value);
                                        setErrors(prev => ({ ...prev, declaredValue: error }));
                                    }}
                                    className={errors.declaredValue ? 'border-red-500' : ''}
                                />
                                {errors.declaredValue && (
                                    <p className="text-sm text-red-600">{errors.declaredValue}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Formulaire pour Colis standard */}
                    {parcelType === 'package' && (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="weight">Poids (kg)</Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    step="0.1"
                                    placeholder="Ex: 2.5"
                                    value={weight}
                                    onChange={(e) => {
                                        setWeight(e.target.value);
                                        const error = validateField('weight', e.target.value);
                                        setErrors(prev => ({ ...prev, weight: error }));
                                    }}
                                    className={errors.weight ? 'border-red-500' : ''}
                                />
                                {errors.weight && (
                                    <p className="text-sm text-red-600">{errors.weight}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="volume">Volume (L)</Label>
                                <Input
                                    id="volume"
                                    type="number"
                                    placeholder="Ex: 10"
                                    value={volume}
                                    onChange={(e) => {
                                        setVolume(e.target.value);
                                        const error = validateField('volume', e.target.value);
                                        setErrors(prev => ({ ...prev, volume: error }));
                                    }}
                                    className={errors.volume ? 'border-red-500' : ''}
                                />
                                {errors.volume && (
                                    <p className="text-sm text-red-600">{errors.volume}</p>
                                )}
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="declaredValue">Valeur déclarée (FCFA)</Label>
                                <Input
                                    id="declaredValue"
                                    type="number"
                                    placeholder="Ex: 50000"
                                    value={declaredValue}
                                    onChange={(e) => {
                                        setDeclaredValue(e.target.value);
                                        const error = validateField('declaredValue', e.target.value);
                                        setErrors(prev => ({ ...prev, declaredValue: error }));
                                    }}
                                    className={errors.declaredValue ? 'border-red-500' : ''}
                                />
                                {errors.declaredValue && (
                                    <p className="text-sm text-red-600">{errors.declaredValue}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Formulaire pour Gâteau */}
                    {parcelType === 'cake' && (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="cakeSize">Taille du gâteau</Label>
                                <Input
                                    id="cakeSize"
                                    type="text"
                                    placeholder="Ex: 20cm, 30cm"
                                    value={cakeSize}
                                    onChange={(e) => setCakeSize(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cakeLayers">Nombre d'étages</Label>
                                <Input
                                    id="cakeLayers"
                                    type="number"
                                    placeholder="Ex: 2"
                                    value={cakeLayers}
                                    onChange={(e) => setCakeLayers(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="weight">Poids (kg)</Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    step="0.1"
                                    placeholder="Ex: 2"
                                    value={weight}
                                    onChange={(e) => {
                                        setWeight(e.target.value);
                                        const error = validateField('weight', e.target.value);
                                        setErrors(prev => ({ ...prev, weight: error }));
                                    }}
                                    className={errors.weight ? 'border-red-500' : ''}
                                />
                                {errors.weight && (
                                    <p className="text-sm text-red-600">{errors.weight}</p>
                                )}
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="declaredValue">Valeur déclarée (FCFA)</Label>
                                <Input
                                    id="declaredValue"
                                    type="number"
                                    placeholder="Ex: 30000"
                                    value={declaredValue}
                                    onChange={(e) => {
                                        setDeclaredValue(e.target.value);
                                        const error = validateField('declaredValue', e.target.value);
                                        setErrors(prev => ({ ...prev, declaredValue: error }));
                                    }}
                                    className={errors.declaredValue ? 'border-red-500' : ''}
                                />
                                {errors.declaredValue && (
                                    <p className="text-sm text-red-600">{errors.declaredValue}</p>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                    {/* Formulaire pour Déménagement */}
                    {parcelType === 'moving' && (
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="movingBoxes">Nombre de cartons</Label>
                                <Input
                                    id="movingBoxes"
                                    type="number"
                                    placeholder="Ex: 20"
                                    value={movingBoxes}
                                    onChange={(e) => setMovingBoxes(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="movingFurniture">Meubles à transporter (optionnel)</Label>
                                <Input
                                    id="movingFurniture"
                                    placeholder="Ex: Canapé, Table, Armoire"
                                    value={movingFurniture}
                                    onChange={(e) => setMovingFurniture(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="movingAccess">Accès (étage, ascenseur, etc.)</Label>
                                <Input
                                    id="movingAccess"
                                    placeholder="Ex: 3ème étage, ascenseur disponible"
                                    value={movingAccess}
                                    onChange={(e) => setMovingAccess(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="volume">Volume estimé (m³)</Label>
                                <Input
                                    id="volume"
                                    type="number"
                                    placeholder="Ex: 20"
                                    value={volume}
                                    onChange={(e) => {
                                        setVolume(e.target.value);
                                        const error = validateField('volume', e.target.value);
                                        setErrors(prev => ({ ...prev, volume: error }));
                                    }}
                                    className={errors.volume ? 'border-red-500' : ''}
                                />
                                {errors.volume && (
                                    <p className="text-sm text-red-600">{errors.volume}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="declaredValue">Valeur déclarée (FCFA)</Label>
                                <Input
                                    id="declaredValue"
                                    type="number"
                                    placeholder="Ex: 500000"
                                    value={declaredValue}
                                    onChange={(e) => {
                                        setDeclaredValue(e.target.value);
                                        const error = validateField('declaredValue', e.target.value);
                                        setErrors(prev => ({ ...prev, declaredValue: error }));
                                    }}
                                    className={errors.declaredValue ? 'border-red-500' : ''}
                                />
                                {errors.declaredValue && (
                                    <p className="text-sm text-red-600">{errors.declaredValue}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Type de transport souhaité */}
                    <div className="mt-6 grid gap-4">
                        <div className="mb-2 flex items-center gap-2">
                            <Truck className="h-5 w-5 text-primary" />
                            <h3 className="text-base font-semibold text-slate-900">Type de transport souhaité</h3>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {VEHICLE_TRANSPORT_OPTIONS.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setTransportMode(transportMode === type.value ? '' : type.value)}
                                    className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-3 min-h-[80px] transition-all ${transportMode === type.value
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <span className="text-2xl">{type.icon}</span>
                                    <span className={`text-xs font-medium text-center leading-tight ${transportMode === type.value ? 'text-primary' : 'text-slate-700'}`}>
                                        {type.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Si aucun type n'est sélectionné, la moto sera utilisée par défaut.
                        </p>
                    </div>
                </section>

                {/* Point de collecte */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-success" />
                        <h2 className="text-lg font-semibold text-slate-900">Point de collecte *</h2>
                    </div>
                    {pickupLocation ? (
                        <div className={`rounded-lg border p-4 ${errors.pickup ? 'border-red-500' : 'border-slate-200 bg-slate-50'}`}>
                            <p className="text-sm text-slate-700">
                                {pickupLocation.address ||
                                    `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}`}
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPickupLocation(null);
                                    setErrors(prev => ({ ...prev, pickup: '' }));
                                }}
                                className="mt-2"
                            >
                                Modifier
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => setShowPickupGPS(true)}
                            className="w-full"
                        >
                            <MapPin className="mr-2 h-4 w-4" />
                            Sélectionner le point de collecte
                        </Button>
                    )}
                    {errors.pickup && (
                        <p className="mt-2 text-sm text-red-600">{errors.pickup}</p>
                    )}
                </section>

                {/* Point de livraison */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-slate-900">Point de livraison *</h2>
                    </div>
                    {dropoffLocation ? (
                        <div className={`rounded-lg border p-4 ${errors.dropoff ? 'border-red-500' : 'border-slate-200 bg-slate-50'}`}>
                            <p className="text-sm text-slate-700">
                                {dropoffLocation.address ||
                                    `${dropoffLocation.latitude.toFixed(6)}, ${dropoffLocation.longitude.toFixed(6)}`}
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setDropoffLocation(null);
                                    setErrors(prev => ({ ...prev, dropoff: '' }));
                                }}
                                className="mt-2"
                            >
                                Modifier
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => setShowDropoffGPS(true)}
                            className="w-full"
                        >
                            <MapPin className="mr-2 h-4 w-4" />
                            Sélectionner le point de livraison
                        </Button>
                    )}
                    {errors.dropoff && (
                        <p className="mt-2 text-sm text-red-600">{errors.dropoff}</p>
                    )}
                    {estimatedDistance !== null && pickupLocation && dropoffLocation && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3">
                            <AlertCircle className="h-4 w-4 text-accent" />
                            <span className="text-sm font-medium text-slate-700">
                                Distance estimée : {estimatedDistance.toFixed(1)} km
                            </span>
                        </div>
                    )}
                </section>

                {/* Photos du colis */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <Camera className="h-5 w-5 text-accent" />
                        <h2 className="text-lg font-semibold text-slate-900">Photos du colis (optionnel)</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => photoInputRef.current?.click()}
                                disabled={photos.length >= 5}
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Ajouter des photos
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCapturePhoto}
                                disabled={photos.length >= 5}
                            >
                                <Camera className="mr-2 h-4 w-4" />
                                Prendre une photo
                            </Button>
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                                className="hidden"
                            />
                        </div>
                        {photos.length > 0 && (
                            <div className="grid grid-cols-3 gap-4">
                                {photos.map((photo, index) => {
                                    const progress = uploadProgress[index];
                                    const compression = photoCompression[index];
                                    const isUploading = progress !== undefined && progress < 100;

                                    return (
                                        <div key={index} className="relative group">
                                            <div className="relative">
                                                <img
                                                    src={photo}
                                                    alt={`Photo ${index + 1}`}
                                                    className="w-full h-32 object-cover rounded-lg border border-slate-200"
                                                />
                                                {isUploading && (
                                                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                                        <div className="text-white text-xs font-medium">
                                                            {progress}%
                                                        </div>
                                                    </div>
                                                )}
                                                {compression && compression.compressionRatio > 10 && (
                                                    <div className="absolute bottom-1 left-1 bg-green-500/80 text-white text-xs px-2 py-1 rounded">
                                                        -{compression.compressionRatio.toFixed(0)}%
                                                    </div>
                                                )}
                                            </div>
                                            {progress === 100 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removePhoto(index)}
                                                    className="absolute top-1 right-1 bg-white/80 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="h-4 w-4 text-red-600" />
                                                </Button>
                                            )}
                                            {/* Barre de progression */}
                                            {isUploading && (
                                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200 rounded-b-lg overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary transition-all duration-300"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {photos.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-4">
                                Aucune photo ajoutée. Ajoutez jusqu'à 5 photos pour documenter votre colis.
                            </p>
                        )}
                        {photos.length > 0 && photos.length < 5 && (
                            <p className="text-xs text-slate-500">
                                {photos.length}/5 photos ajoutées
                            </p>
                        )}
                    </div>
                </section>

                {/* Notes */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <Label htmlFor="notes">Instructions de livraison (optionnel)</Label>
                    <textarea
                        id="notes"
                        className="mt-2 min-h-[100px] w-full rounded-lg border border-slate-300 p-3 text-sm"
                        placeholder="Ex: Sonner deux fois, laisser devant la porte..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </section>

                {/* Informations du destinataire */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-slate-900">Informations du destinataire *</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="recipientName">Nom du destinataire *</Label>
                            <Input
                                id="recipientName"
                                type="text"
                                placeholder="Ex: Jean Dupont"
                                value={recipientName}
                                onChange={(e) => {
                                    setRecipientName(e.target.value);
                                    setErrors(prev => ({ ...prev, recipientName: '' }));
                                }}
                                className={errors.recipientName ? 'border-red-500' : ''}
                            />
                            {errors.recipientName && (
                                <p className="text-sm text-red-600">{errors.recipientName}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="recipientPhone">Téléphone *</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="recipientCountryCode"
                                    type="text"
                                    placeholder="+237"
                                    value={recipientCountryCode}
                                    onChange={(e) => setRecipientCountryCode(e.target.value)}
                                    className="w-24"
                                />
                                <Input
                                    id="recipientPhone"
                                    type="tel"
                                    placeholder="6XX XXX XXX"
                                    value={recipientPhone}
                                    onChange={(e) => {
                                        setRecipientPhone(e.target.value);
                                        setErrors(prev => ({ ...prev, recipientPhone: '' }));
                                    }}
                                    className={`flex-1 ${errors.recipientPhone ? 'border-red-500' : ''}`}
                                />
                            </div>
                            {errors.recipientPhone && (
                                <p className="text-sm text-red-600">{errors.recipientPhone}</p>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                        <Label htmlFor="recipientInstructions">Instructions de livraison (optionnel)</Label>
                        <textarea
                            id="recipientInstructions"
                            className="min-h-[100px] w-full rounded-lg border border-slate-300 p-3 text-sm"
                            placeholder="Ex: Sonner 2 fois, laisser devant la porte..."
                            value={recipientInstructions}
                            onChange={(e) => setRecipientInstructions(e.target.value)}
                        />
                    </div>
                    <div className="mt-4 space-y-3">
                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="recipientConsentGranted"
                                checked={recipientConsentGranted}
                                onChange={(e) => {
                                    setRecipientConsentGranted(e.target.checked);
                                    setErrors(prev => ({ ...prev, recipientConsentGranted: '' }));
                                }}
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                            />
                            <Label htmlFor="recipientConsentGranted" className="cursor-pointer flex-1">
                                Le destinataire consent à recevoir le colis et à être contacté *
                            </Label>
                        </div>
                        {errors.recipientConsentGranted && (
                            <p className="text-sm text-red-600 ml-6">{errors.recipientConsentGranted}</p>
                        )}
                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="recipientAllowTracking"
                                checked={recipientAllowTracking}
                                onChange={(e) => setRecipientAllowTracking(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                            />
                            <Label htmlFor="recipientAllowTracking" className="cursor-pointer flex-1">
                                Autoriser le suivi de position du destinataire (optionnel)
                            </Label>
                        </div>
                    </div>
                </section>

                {/* Préférences de livraison */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-accent" />
                        <h2 className="text-lg font-semibold text-slate-900">Préférences de livraison (optionnel)</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="preferredDeliveryDate">Date de livraison</Label>
                            <Input
                                id="preferredDeliveryDate"
                                type="date"
                                value={preferredDeliveryDate}
                                onChange={(e) => {
                                    setPreferredDeliveryDate(e.target.value);
                                    const error = validateField('preferredDeliveryDate', e.target.value);
                                    setErrors(prev => ({ ...prev, preferredDeliveryDate: error }));
                                }}
                                min={new Date().toISOString().split('T')[0]}
                                className={errors.preferredDeliveryDate ? 'border-red-500' : ''}
                            />
                            {errors.preferredDeliveryDate && (
                                <p className="text-sm text-red-600">{errors.preferredDeliveryDate}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="urgencyLevel">Niveau d'urgence</Label>
                            <select
                                id="urgencyLevel"
                                value={urgencyLevel}
                                onChange={(e) => setUrgencyLevel(e.target.value as any)}
                                className="rounded-lg border border-slate-300 p-2 text-sm"
                            >
                                <option value="standard">Standard</option>
                                <option value="urgent">Urgent</option>
                                <option value="scheduled">Programmé</option>
                            </select>
                        </div>
                    </div>

                    {/* ✅ Section Planification */}
                    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isScheduled"
                                checked={isScheduled}
                                onChange={(e) => {
                                    setIsScheduled(e.target.checked);
                                    if (!e.target.checked) {
                                        setScheduledDate('');
                                        setScheduledTime('');
                                    } else {
                                        // Pré-remplir avec demain à 14h par défaut
                                        const tomorrow = new Date();
                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                        setScheduledDate(tomorrow.toISOString().split('T')[0]);
                                        setScheduledTime('14:00');
                                    }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="isScheduled" className="text-base font-semibold text-slate-900 cursor-pointer">
                                Planifier cette livraison
                            </Label>
                        </div>
                        {isScheduled && (
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="scheduledDate">Date de livraison *</Label>
                                <Input
                                    id="scheduledDate"
                                    type="date"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="border-slate-300"
                                />
                                <p className="text-xs text-slate-500">
                                    Sélectionnez une date future pour planifier votre livraison
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="scheduledTime">Heure de livraison *</Label>
                                <Input
                                    id="scheduledTime"
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="border-slate-300"
                                />
                                <p className="text-xs text-slate-500">
                                    Heure souhaitée de collecte (format 24h)
                                </p>
                            </div>
                        </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="matchingMode">Quand matcher le coursier ?</Label>
                                    <select
                                        id="matchingMode"
                                        value={matchingMode}
                                        onChange={(e) => setMatchingMode(e.target.value as 'immediate' | 'scheduled')}
                                        className="rounded-lg border border-slate-300 p-2 text-sm"
                                    >
                                        <option value="immediate">Maintenant (par défaut - pour contacter le coursier à l'avance)</option>
                                        <option value="scheduled">Au moment de la livraison planifiée</option>
                                    </select>
                                    <p className="text-xs text-slate-600">
                                        {matchingMode === 'immediate'
                                            ? "✅ Le coursier sera assigné maintenant. Vous pourrez le contacter et préparer la livraison. Il devra déclencher la livraison au moment planifié."
                                            : "Le coursier sera recherché automatiquement à la date et heure planifiée."}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {preferredDeliveryDate && (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="preferredDeliveryTimeStart">Heure de début</Label>
                                <Input
                                    id="preferredDeliveryTimeStart"
                                    type="time"
                                    value={preferredDeliveryTimeStart}
                                    onChange={(e) => {
                                        setPreferredDeliveryTimeStart(e.target.value);
                                        const error = validateField('preferredDeliveryTimeStart', e.target.value);
                                        setErrors(prev => ({ ...prev, preferredDeliveryTimeStart: error }));
                                    }}
                                    className={errors.preferredDeliveryTimeStart ? 'border-red-500' : ''}
                                />
                                {errors.preferredDeliveryTimeStart && (
                                    <p className="text-sm text-red-600">{errors.preferredDeliveryTimeStart}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="preferredDeliveryTimeEnd">Heure de fin</Label>
                                <Input
                                    id="preferredDeliveryTimeEnd"
                                    type="time"
                                    value={preferredDeliveryTimeEnd}
                                    onChange={(e) => setPreferredDeliveryTimeEnd(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                    <div className="mt-4 flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isFlexible"
                            checked={isFlexible}
                            onChange={(e) => setIsFlexible(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                        />
                        <Label htmlFor="isFlexible" className="cursor-pointer">
                            Accepter d'autres créneaux si indisponible
                        </Label>
                    </div>
                    {isFlexible && (
                        <div className="mt-4 grid gap-2">
                            <Label htmlFor="flexibilityWindowDays">Fenêtre de flexibilité (jours)</Label>
                            <Input
                                id="flexibilityWindowDays"
                                type="number"
                                min="1"
                                value={flexibilityWindowDays}
                                onChange={(e) => setFlexibilityWindowDays(parseInt(e.target.value) || 3)}
                            />
                        </div>
                    )}
                </section>

                {/* Actions */}
                <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => navigate('/delivery')}>
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !pickupLocation || !dropoffLocation || !recipientName || !recipientPhone || !recipientConsentGranted}
                    >
                        {loading ? 'Création...' : 'Créer la livraison'}
                    </Button>
                </div>
            </div>

            {/* Modals GPS */}
            {showPickupGPS && (
                <div className="fixed inset-0 z-50">
                    <AdvancedGPSModal
                        onClose={() => setShowPickupGPS(false)}
                        onSelect={(path, previewUrl, metadata) => handleGPSSelect(path, previewUrl, metadata, 'pickup')}
                        initialLocation={
                            pickupLocation
                                ? { lat: pickupLocation.latitude, lng: pickupLocation.longitude }
                                : undefined
                        }
                    />
                </div>
            )}
            {showDropoffGPS && (
                <div className="fixed inset-0 z-50">
                    <AdvancedGPSModal
                        onClose={() => setShowDropoffGPS(false)}
                        onSelect={(path, previewUrl, metadata) => handleGPSSelect(path, previewUrl, metadata, 'dropoff')}
                        initialLocation={
                            dropoffLocation
                                ? { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude }
                                : undefined
                        }
                    />
                </div>
            )}

            {/* ✅ Modals GPS pour retour */}
            {showReturnPickupGPS && (
                <div className="fixed inset-0 z-50">
                    <AdvancedGPSModal
                        onClose={() => setShowReturnPickupGPS(false)}
                        onSelect={(path, previewUrl, metadata) => {
                            if (!path || path.length === 0) return;
                            const firstPoint = path[0];
                            setReturnPickupLocation({
                                latitude: firstPoint.lat,
                                longitude: firstPoint.lng,
                                address: metadata?.address || metadata?.formatted_address || undefined,
                            });
                            setShowReturnPickupGPS(false);
                        }}
                        initialLocation={
                            returnPickupLocation
                                ? { lat: returnPickupLocation.latitude, lng: returnPickupLocation.longitude }
                                : dropoffLocation
                                    ? { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude }
                                    : undefined
                        }
                    />
                </div>
            )}

            {showReturnDropoffGPS && (
                <div className="fixed inset-0 z-50">
                    <AdvancedGPSModal
                        onClose={() => setShowReturnDropoffGPS(false)}
                        onSelect={(path, previewUrl, metadata) => {
                            if (!path || path.length === 0) return;
                            const firstPoint = path[0];
                            setReturnDropoffLocation({
                                latitude: firstPoint.lat,
                                longitude: firstPoint.lng,
                                address: metadata?.address || metadata?.formatted_address || undefined,
                            });
                            setShowReturnDropoffGPS(false);
                        }}
                        initialLocation={
                            returnDropoffLocation
                                ? { lat: returnDropoffLocation.latitude, lng: returnDropoffLocation.longitude }
                                : pickupLocation
                                    ? { lat: pickupLocation.latitude, lng: pickupLocation.longitude }
                                    : undefined
                        }
                    />
                </div>
            )}
        </AppLayout>
    );
};

export default DeliveryParcelFlowPage;

