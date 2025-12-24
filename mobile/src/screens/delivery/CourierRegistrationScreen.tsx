import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import PaymentMethodSelector from '../../components/PaymentMethodSelector';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { VEHICLE_TRANSPORT_OPTIONS, type VehicleOption, type VehicleType } from '../../config/deliveryConfig';
import { useAuth } from '../../contexts/AuthContext';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface DocumentFile {
    uri: string;
    name: string;
    type: string;
    size?: number;
}

const CourierRegistrationScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [applicationStatus, setApplicationStatus] = useState<'none' | 'draft' | 'submitted' | 'approved' | 'rejected'>('none');

    // Informations personnelles
    const getCleanName = (name: string | undefined): string => {
        if (!name) return '';
        const cleaned = name.trim().replace(/\s+/g, ' ');
        const parts = cleaned.split(' ');
        if (parts.length >= 4) {
            const firstHalf = parts.slice(0, Math.floor(parts.length / 2)).join(' ');
            const secondHalf = parts.slice(Math.floor(parts.length / 2)).join(' ');
            if (firstHalf === secondHalf) {
                return firstHalf;
            }
        }
        return cleaned;
    };
    const [fullName, setFullName] = useState(getCleanName(user?.name));
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [idNumber, setIdNumber] = useState('');

    // Transport
    const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
    const [vehicleBrand, setVehicleBrand] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [licensePlate, setLicensePlate] = useState('');

    // Documents
    const [idDocument, setIdDocument] = useState<DocumentFile | null>(null);
    const [driverLicense, setDriverLicense] = useState<DocumentFile | null>(null);
    const [vehicleRegistration, setVehicleRegistration] = useState<DocumentFile | null>(null);
    const [insuranceDocument, setInsuranceDocument] = useState<DocumentFile | null>(null);

    // Disponibilités
    const [availabilityDays, setAvailabilityDays] = useState<string[]>([]);
    const [availabilityStart, setAvailabilityStart] = useState('08:00');
    const [availabilityEnd, setAvailabilityEnd] = useState('18:00');

    // Autres
    const [bio, setBio] = useState('');
    const [experience, setExperience] = useState('');

    // Comptes de paiement
    const [paymentMethod, setPaymentMethod] = useState<any>(null);

    // Modal de sélection du moyen de transport
    const [showVehicleModal, setShowVehicleModal] = useState(false);

    useEffect(() => {
        checkApplicationStatus();
        loadUserPhoneFromServices();
    }, [user]);

    const hasInitializedNameRef = React.useRef(false);
    useEffect(() => {
        if (user?.name && !hasInitializedNameRef.current) {
            const cleanedName = getCleanName(user.name);
            setFullName(cleanedName);
            hasInitializedNameRef.current = true;
        }
    }, [user?.name]);

    const loadUserPhoneFromServices = async () => {
        if (!user?.id || phone) return;

        try {
            const { apiGet } = require('../../services/api');
            const response = await apiGet('/api/prestataire/services');
            const services = response.data || response;

            if (Array.isArray(services) && services.length > 0) {
                for (const service of services) {
                    const serviceData = service.data || service;
                    const whatsapp = serviceData.whatsapp || 
                                   serviceData.whatsapp_contact?.valeur ||
                                   serviceData.contact?.whatsapp ||
                                   serviceData.contact_whatsapp?.valeur ||
                                   serviceData.telephone_whatsapp?.valeur;

                    if (whatsapp && typeof whatsapp === 'string' && whatsapp.trim().length > 0) {
                        setPhone(whatsapp.trim());
                        return;
                    }
                }
            }
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur chargement téléphone depuis services:', error);
        }
    };

    const checkApplicationStatus = async () => {
        if (!user?.id) {
            setCheckingStatus(false);
            return;
        }

        try {
            const { apiGet } = require('../../services/api');
            const response = await apiGet('/api/courier/me');
            const data = response.data || response;

            if (data.application) {
                const status = data.application.status?.toLowerCase() || '';
                if (status.includes('approved')) {
                    setApplicationStatus('approved');
                } else if (status.includes('rejected')) {
                    setApplicationStatus('rejected');
                } else if (status.includes('submitted')) {
                    setApplicationStatus('submitted');
                } else if (status.includes('draft')) {
                    setApplicationStatus('draft');
                }
            }
            if (data.is_courier && data.courier) {
                setApplicationStatus('approved');
            }
            setCheckingStatus(false);
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur vérification statut:', error);
            setCheckingStatus(false);
        }
    };

    const pickDocument = async (type: 'id' | 'license' | 'registration' | 'insurance') => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                const file = result.assets[0];
                const document: DocumentFile = {
                    uri: file.uri,
                    name: file.name || 'document',
                    type: file.mimeType || 'application/octet-stream',
                    size: file.size,
                };

                switch (type) {
                    case 'id':
                        setIdDocument(document);
                        break;
                    case 'license':
                        setDriverLicense(document);
                        break;
                    case 'registration':
                        setVehicleRegistration(document);
                        break;
                    case 'insurance':
                        setInsuranceDocument(document);
                        break;
                }
            }
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur sélection document:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner le document');
        }
    };

    const pickImage = async (type: 'id' | 'license' | 'registration' | 'insurance') => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour ajouter des photos');
                return;
            }

            if (!ImagePicker || !ImagePicker.MediaType) {
                console.error('[CourierRegistrationScreen] ImagePicker ou MediaType est undefined');
                Alert.alert('Erreur', 'Impossible d\'accéder à la galerie. Veuillez réessayer.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaType.Images,
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const document: DocumentFile = {
                    uri: asset.uri,
                    name: `photo_${type}_${Date.now()}.jpg`,
                    type: 'image/jpeg',
                    size: asset.fileSize,
                };

                switch (type) {
                    case 'id':
                        setIdDocument(document);
                        break;
                    case 'license':
                        setDriverLicense(document);
                        break;
                    case 'registration':
                        setVehicleRegistration(document);
                        break;
                    case 'insurance':
                        setInsuranceDocument(document);
                        break;
                }
            }
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur sélection image:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    const toggleAvailabilityDay = (day: string) => {
        setAvailabilityDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const convertFileToBase64 = async (file: DocumentFile): Promise<string> => {
        try {
            const response = await fetch(file.uri);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur conversion base64:', error);
            throw error;
        }
    };

    const validateForm = (): boolean => {
        if (!fullName.trim()) {
            Alert.alert('Erreur', 'Le nom complet est requis');
            return false;
        }
        if (!phone.trim()) {
            Alert.alert('Erreur', 'Le numéro de téléphone est requis');
            return false;
        }
        if (!address.trim()) {
            Alert.alert('Erreur', 'L\'adresse est requise');
            return false;
        }
        if (!city.trim()) {
            Alert.alert('Erreur', 'La ville est requise');
            return false;
        }
        if (!idNumber.trim()) {
            Alert.alert('Erreur', 'Le numéro de pièce d\'identité est requis');
            return false;
        }
        if (!idDocument) {
            Alert.alert('Erreur', 'La pièce d\'identité est requise');
            return false;
        }
        if (vehicleType !== 'walking' && !driverLicense) {
            Alert.alert('Erreur', 'Le permis de conduire est requis');
            return false;
        }
        if (availabilityDays.length === 0) {
            Alert.alert('Erreur', 'Sélectionnez au moins un jour de disponibilité');
            return false;
        }
        return true;
    };

    const handleSubmit = async (submit: boolean = false) => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const documents: Record<string, any> = {};
            if (idDocument) {
                documents.id_document = {
                    name: idDocument.name,
                    data: await convertFileToBase64(idDocument),
                    type: idDocument.type,
                };
            }
            if (driverLicense) {
                documents.driver_license = {
                    name: driverLicense.name,
                    data: await convertFileToBase64(driverLicense),
                    type: driverLicense.type,
                };
            }
            if (vehicleRegistration) {
                documents.vehicle_registration = {
                    name: vehicleRegistration.name,
                    data: await convertFileToBase64(vehicleRegistration),
                    type: vehicleRegistration.type,
                };
            }
            if (insuranceDocument) {
                documents.insurance = {
                    name: insuranceDocument.name,
                    data: await convertFileToBase64(insuranceDocument),
                    type: insuranceDocument.type,
                };
            }

            const profileData = {
                personal: {
                    fullName,
                    phone,
                    email: user?.email,
                    address,
                    city,
                    country,
                    dateOfBirth,
                    idNumber,
                },
                transport: {
                    vehicleType,
                    vehicleBrand,
                    vehicleModel,
                    licensePlate,
                },
                availability: {
                    days: availabilityDays,
                    hours: { start: availabilityStart, end: availabilityEnd },
                },
                bio,
                experience,
                paymentMethod: paymentMethod ? {
                    type: paymentMethod.type,
                    phoneNumber: paymentMethod.phoneNumber,
                    cardNumber: paymentMethod.cardNumber,
                    cardExpiry: paymentMethod.cardExpiry,
                    cardCVV: paymentMethod.cardCVV,
                    cardHolder: paymentMethod.cardHolder,
                    taxId: paymentMethod.taxId,
                } : null,
            };

            const response = await deliveryApi.submitCourierApplication({
                profile_data: profileData,
                documents,
                submitted: submit,
            });

            if (response.success) {
                setApplicationStatus(submit ? 'submitted' : 'draft');
                Alert.alert(
                    submit ? '✅ Candidature soumise' : '💾 Brouillon enregistré',
                    submit
                        ? 'Votre candidature a été soumise avec succès. Elle sera examinée par notre équipe.'
                        : 'Votre candidature a été enregistrée en brouillon.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (submit) {
                                    navigation.goBack();
                                }
                            },
                        },
                    ]
                );
            }
        } catch (error: any) {
            console.error('[CourierRegistrationScreen] Erreur soumission:', error);
            Alert.alert('Erreur', error.message || 'Impossible de soumettre la candidature');
        } finally {
            setLoading(false);
        }
    };

    const daysOfWeek = [
        { value: 'monday', label: 'Lun' },
        { value: 'tuesday', label: 'Mar' },
        { value: 'wednesday', label: 'Mer' },
        { value: 'thursday', label: 'Jeu' },
        { value: 'friday', label: 'Ven' },
        { value: 'saturday', label: 'Sam' },
        { value: 'sunday', label: 'Dim' },
    ];

    // ✅ CRITIQUE 2025-12-24: Déplacer TOUS les hooks AVANT les early returns
    // pour éviter l'erreur "Rendered more hooks than during the previous render"
    // ✅ CONSTANTE: VEHICLE_TRANSPORT_OPTIONS est une constante importée, pas besoin de useMemo
    const selectedVehicle = VEHICLE_TRANSPORT_OPTIONS.find(v => v.value === vehicleType);
    const requiresLicense = selectedVehicle?.requiresLicense ?? false;

    // ✅ SIMPLIFIÉ: Pas besoin de useCallback pour une fonction simple
    const handleVehicleSelect = (vehicle: VehicleType) => {
        setVehicleType(vehicle);
        setShowVehicleModal(false);
    };

    // ✅ CRITIQUE 2025-12-24: Early returns APRÈS tous les hooks
    if (checkingStatus) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Vérification du statut...</Text>
                </View>
            </SafeNativeView>
        );
    }

    if (applicationStatus === 'approved') {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.statusContainer}>
                    <SafeIcon name="check-circle" size={64} color={modernColors.success} />
                    <Text style={styles.statusTitle}>Candidature approuvée !</Text>
                    <Text style={styles.statusText}>
                        Félicitations ! Votre candidature de coursier a été approuvée. Vous pouvez maintenant recevoir des livraisons.
                    </Text>
                    <NativeButton
                        title="Voir mes livraisons"
                        variant="primary"
                        onPress={() => navigation.navigate('Delivery' as never)}
                    />
                </View>
            </SafeNativeView>
        );
    }

    if (applicationStatus === 'submitted') {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.statusContainer}>
                    <SafeIcon name="clock" size={64} color={modernColors.warning} />
                    <Text style={styles.statusTitle}>Candidature en cours d'examen</Text>
                    <Text style={styles.statusText}>
                        Votre candidature a été soumise avec succès. Notre équipe l'examinera sous peu. Vous recevrez une notification une fois la décision prise.
                    </Text>
                    <NativeButton
                        title="Retour"
                        variant="outline"
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </SafeNativeView>
        );
    }

    if (applicationStatus === 'rejected') {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.statusContainer}>
                    <SafeIcon name="x-circle" size={64} color={modernColors.error} />
                    <Text style={styles.statusTitle}>Candidature refusée</Text>
                    <Text style={styles.statusText}>
                        Votre candidature n'a pas été approuvée. Veuillez contacter le support pour plus d'informations.
                    </Text>
                    <NativeButton
                        title="Retour"
                        variant="outline"
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView 
                style={styles.scroll} 
                contentContainerStyle={styles.scrollContent}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={true}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Devenir coursier Yukpo</Text>
                    <Text style={styles.subtitle}>
                        Complétez ce formulaire pour devenir coursier. Toutes les informations seront vérifiées avant validation.
                    </Text>
                </View>

                {/* Informations personnelles */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Informations personnelles</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Nom complet *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Entrez votre nom complet"
                            value={fullName}
                            onChangeText={setFullName}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Téléphone *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Entrez votre numéro de téléphone"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={user?.email || ''}
                            editable={false}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Date de naissance</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="YYYY-MM-DD"
                            value={dateOfBirth}
                            onChangeText={setDateOfBirth}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Numéro de pièce d'identité *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Entrez votre numéro de pièce d'identité"
                            value={idNumber}
                            onChangeText={setIdNumber}
                        />
                    </View>
                </NativeCard>

                {/* Adresse */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Adresse de résidence</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Adresse complète *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Entrez votre adresse complète"
                            value={address}
                            onChangeText={setAddress}
                            multiline
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <LocationSelector
                            label="Ville *"
                            value={city}
                            onSelect={(location: LocationObject) => {
                                const ville = location.components?.ville || location.place_name || '';
                                setCity(ville);
                                // Si le pays n'est pas encore défini, l'extraire aussi
                                if (location.components?.pays && !country) {
                                    setCountry(location.components.pays);
                                }
                            }}
                            placeholder="Rechercher une ville..."
                            scope="city"
                            required={true}
                            enrichWithBackend={true}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <LocationSelector
                            label="Pays"
                            value={country}
                            onSelect={(location: LocationObject) => {
                                const pays = location.components?.pays || location.place_name || '';
                                setCountry(pays);
                            }}
                            placeholder="Rechercher un pays..."
                            scope="all"
                            enrichWithBackend={true}
                        />
                    </View>
                </NativeCard>

                {/* Transport */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Moyen de transport</Text>
                    <TouchableOpacity
                        style={styles.vehicleSelector}
                        onPress={() => setShowVehicleModal(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.vehicleSelectorContent}>
                            <Text style={styles.vehicleSelectorIcon}>
                                {selectedVehicle?.icon || '🚗'}
                            </Text>
                            <View style={styles.vehicleSelectorTextContainer}>
                                <Text style={styles.vehicleSelectorLabel}>
                                    {selectedVehicle?.label || 'Sélectionner un moyen de transport'}
                                </Text>
                            </View>
                            <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                        </View>
                    </TouchableOpacity>
                    {vehicleType !== 'walking' && (
                        <>
                            <TextInput
                                style={styles.input}
                                placeholder="Marque"
                                value={vehicleBrand}
                                onChangeText={setVehicleBrand}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Modèle"
                                value={vehicleModel}
                                onChangeText={setVehicleModel}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Plaque d'immatriculation"
                                value={licensePlate}
                                onChangeText={setLicensePlate}
                            />
                        </>
                    )}
                </NativeCard>

                {/* Documents */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Documents</Text>
                    <View style={styles.documentRow}>
                        <View style={styles.documentInfo}>
                            <Text style={styles.documentLabel}>Pièce d'identité *</Text>
                            {idDocument && <Text style={styles.documentName}>{idDocument.name}</Text>}
                        </View>
                        <View style={styles.documentButtons}>
                            <NativeButton
                                title="📷 Photo"
                                variant="outline"
                                size="small"
                                onPress={() => pickImage('id')}
                            />
                            <NativeButton
                                title="📄 Fichier"
                                variant="outline"
                                size="small"
                                onPress={() => pickDocument('id')}
                            />
                        </View>
                    </View>
                    {requiresLicense && (
                        <View style={styles.documentRow}>
                            <View style={styles.documentInfo}>
                                <Text style={styles.documentLabel}>Permis de conduire *</Text>
                                {driverLicense && <Text style={styles.documentName}>{driverLicense.name}</Text>}
                            </View>
                            <View style={styles.documentButtons}>
                                <NativeButton
                                    title="📷 Photo"
                                    variant="outline"
                                    size="small"
                                    onPress={() => pickImage('license')}
                                />
                                <NativeButton
                                    title="📄 Fichier"
                                    variant="outline"
                                    size="small"
                                    onPress={() => pickDocument('license')}
                                />
                            </View>
                        </View>
                    )}
                    {vehicleType !== 'walking' && (
                        <>
                            <View style={styles.documentRow}>
                                <View style={styles.documentInfo}>
                                    <Text style={styles.documentLabel}>Carte grise</Text>
                                    {vehicleRegistration && (
                                        <Text style={styles.documentName}>{vehicleRegistration.name}</Text>
                                    )}
                                </View>
                                <View style={styles.documentButtons}>
                                    <NativeButton
                                        title="📷 Photo"
                                        variant="outline"
                                        size="small"
                                        onPress={() => pickImage('registration')}
                                    />
                                    <NativeButton
                                        title="📄 Fichier"
                                        variant="outline"
                                        size="small"
                                        onPress={() => pickDocument('registration')}
                                    />
                                </View>
                            </View>
                            {(vehicleType === 'car' || vehicleType === 'pickup' || vehicleType === 'van' || vehicleType === 'truck') && (
                                <View style={styles.documentRow}>
                                    <View style={styles.documentInfo}>
                                        <Text style={styles.documentLabel}>Assurance</Text>
                                        {insuranceDocument && (
                                            <Text style={styles.documentName}>{insuranceDocument.name}</Text>
                                        )}
                                    </View>
                                    <View style={styles.documentButtons}>
                                        <NativeButton
                                            title="📷 Photo"
                                            variant="outline"
                                            size="small"
                                            onPress={() => pickImage('insurance')}
                                        />
                                        <NativeButton
                                            title="📄 Fichier"
                                            variant="outline"
                                            size="small"
                                            onPress={() => pickDocument('insurance')}
                                        />
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                </NativeCard>

                {/* Disponibilités */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Disponibilités</Text>
                    <View style={styles.daysContainer}>
                        {daysOfWeek.map((day) => (
                            <TouchableOpacity
                                key={day.value}
                                style={[
                                    styles.dayButton,
                                    availabilityDays.includes(day.value) && styles.dayButtonSelected,
                                ]}
                                onPress={() => toggleAvailabilityDay(day.value)}
                            >
                                <Text
                                    style={[
                                        styles.dayButtonText,
                                        availabilityDays.includes(day.value) && styles.dayButtonTextSelected,
                                    ]}
                                >
                                    {day.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.timeRow}>
                        <TextInput
                            style={[styles.input, styles.timeInput]}
                            placeholder="08:00"
                            value={availabilityStart}
                            onChangeText={setAvailabilityStart}
                        />
                        <Text style={styles.timeSeparator}>-</Text>
                        <TextInput
                            style={[styles.input, styles.timeInput]}
                            placeholder="18:00"
                            value={availabilityEnd}
                            onChangeText={setAvailabilityEnd}
                        />
                    </View>
                </NativeCard>

                {/* Bio et expérience */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Informations complémentaires</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Bio (optionnel)"
                        value={bio}
                        onChangeText={setBio}
                        multiline
                        numberOfLines={3}
                    />
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Expérience (optionnel)"
                        value={experience}
                        onChangeText={setExperience}
                        multiline
                        numberOfLines={3}
                    />
                </NativeCard>

                {/* Comptes de paiement */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Comptes de paiement</Text>
                    <Text style={styles.helperText}>
                        Renseignez votre compte pour recevoir vos paiements de livraison. L'argent transite toujours dans le compte de l'application avant reversement.
                    </Text>
                    <PaymentMethodSelector
                        onPaymentChange={setPaymentMethod}
                        readonly={false}
                    />
                </NativeCard>

                {/* Actions */}
                <View style={styles.actions}>
                    <NativeButton
                        title="Enregistrer en brouillon"
                        variant="outline"
                        onPress={() => handleSubmit(false)}
                        disabled={loading}
                    />
                    <NativeButton
                        title={loading ? 'Envoi en cours...' : 'Soumettre la candidature'}
                        variant="primary"
                        onPress={() => handleSubmit(true)}
                        disabled={loading}
                    />
                </View>
            </ScrollView>

            {/* Modal de sélection du moyen de transport */}
            <Modal
                visible={showVehicleModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowVehicleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => setShowVehicleModal(false)}
                    />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Sélectionner un moyen de transport</Text>
                            <TouchableOpacity
                                onPress={() => setShowVehicleModal(false)}
                                style={styles.modalCloseButton}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView 
                            style={styles.modalScrollView}
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                        >
                            {VEHICLE_TRANSPORT_OPTIONS.map((vehicle) => {
                                const isSelected = vehicleType === vehicle.value;
                                return (
                                    <TouchableOpacity
                                        key={vehicle.value}
                                        style={[
                                            styles.vehicleModalOption,
                                            isSelected && styles.vehicleModalOptionSelected,
                                        ]}
                                        onPress={() => handleVehicleSelect(vehicle.value)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.vehicleModalIcon}>{vehicle.icon}</Text>
                                        <View style={styles.vehicleModalTextContainer}>
                                            <Text
                                                style={[
                                                    styles.vehicleModalLabel,
                                                    isSelected && styles.vehicleModalLabelSelected,
                                                ]}
                                            >
                                                {vehicle.label}
                                            </Text>
                                            {vehicle.requiresLicense && (
                                                <Text style={styles.vehicleModalHint}>
                                                    Permis de conduire requis
                                                </Text>
                                            )}
                                        </View>
                                        {isSelected && (
                                            <SafeIcon name="check" size={20} color={modernColors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    helperText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 12,
        lineHeight: 18,
    },
    card: {
        marginBottom: 16,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    inputContainer: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    vehicleSelector: {
        borderWidth: 2,
        borderColor: modernColors.border,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        marginBottom: 16,
    },
    vehicleSelectorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    vehicleSelectorIcon: {
        fontSize: 32,
    },
    vehicleSelectorTextContainer: {
        flex: 1,
    },
    vehicleSelectorLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    vehicleModalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        marginBottom: 12,
        gap: 12,
        minHeight: 64,
    },
    vehicleModalOptionSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '15',
    },
    vehicleModalIcon: {
        fontSize: 32,
    },
    vehicleModalTextContainer: {
        flex: 1,
    },
    vehicleModalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    vehicleModalLabelSelected: {
        color: modernColors.primary,
    },
    vehicleModalHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: modernColors.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 32,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
    },
    modalCloseButton: {
        padding: 4,
    },
    modalScrollView: {
        flex: 1,
    },
    modalScrollContent: {
        padding: 16,
    },
    documentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    documentInfo: {
        flex: 1,
        marginRight: 12,
    },
    documentLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    documentName: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    documentButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    dayButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    dayButtonSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary,
    },
    dayButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    dayButtonTextSelected: {
        color: modernColors.surface,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    timeInput: {
        flex: 1,
        marginBottom: 0,
    },
    timeSeparator: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    actions: {
        gap: 12,
        marginTop: 8,
    },
    statusContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    statusTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    statusText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
    },
});

export default CourierRegistrationScreen;
