import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { VEHICLE_TRANSPORT_OPTIONS, type VehicleType } from '../../config/deliveryConfig';
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
    const [fullName, setFullName] = useState(user?.name || '');
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

    useEffect(() => {
        checkApplicationStatus();
    }, [user]);

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
                // L'utilisateur est déjà coursier approuvé
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

            // ✅ CORRIGÉ: Protection contre undefined pour MediaType.Images
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
            // Convertir les documents en base64
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

    // ✅ CORRECTION : Utiliser la constante partagée pour aligner avec les options de commande
    const vehicleTypes = VEHICLE_TRANSPORT_OPTIONS;

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

    const selectedVehicle = vehicleTypes.find(v => v.value === vehicleType);
    const requiresLicense = selectedVehicle?.requiresLicense ?? false;

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView 
                style={styles.scroll} 
                contentContainerStyle={styles.scrollContent}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
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
                    <TextInput
                        style={styles.input}
                        placeholder="Adresse complète *"
                        value={address}
                        onChangeText={setAddress}
                        multiline
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Ville *"
                        value={city}
                        onChangeText={setCity}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Pays"
                        value={country}
                        onChangeText={setCountry}
                    />
                </NativeCard>

                {/* Transport */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Moyen de transport</Text>
                    <View style={styles.vehicleContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={true}
                            style={styles.vehicleScroll}
                            contentContainerStyle={styles.vehicleListContent}
                            nestedScrollEnabled={true}
                            scrollEnabled={true}
                            bounces={true}
                            decelerationRate="fast"
                            scrollEventThrottle={16}
                            removeClippedSubviews={false}
                            alwaysBounceHorizontal={false}
                            pagingEnabled={false}
                            snapToInterval={0}
                            snapToAlignment="start"
                            keyboardShouldPersistTaps="handled"
                        >
                            {vehicleTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.value}
                                    style={[
                                        styles.vehicleOption,
                                        vehicleType === type.value && styles.vehicleOptionSelected,
                                    ]}
                                    onPress={() => setVehicleType(type.value)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.vehicleIcon}>{type.icon}</Text>
                                    <Text
                                        style={[
                                            styles.vehicleLabel,
                                            vehicleType === type.value && styles.vehicleLabelSelected,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {type.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
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
    vehicleContainer: {
        width: '100%',
        marginBottom: 16,
        minHeight: 110,
        maxHeight: 120,
    },
    vehicleScroll: {
        width: '100%',
        flexGrow: 0,
    },
    vehicleListContent: {
        paddingHorizontal: 4,
        paddingVertical: 8,
        alignItems: 'center',
        paddingRight: 16,
        gap: 12,
    },
    vehicleOption: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        width: 90,
        height: 90,
        marginRight: 8,
        flexShrink: 0,
    },
    vehicleOptionSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '20',
    },
    vehicleIcon: {
        fontSize: 32,
        marginBottom: 4,
    },
    vehicleLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    vehicleLabelSelected: {
        color: modernColors.primary,
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

