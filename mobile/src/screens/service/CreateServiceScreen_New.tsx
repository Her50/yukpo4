// @ts-nocheck
import * as ReactNavigation from '@react-navigation/native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, Chip, Switch, Text, TextInput } from 'react-native-paper';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, serviceService } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const CreateServiceScreen: React.FC = () => {
    const [formData, setFormData] = useState({
        titre_service: '',
        description: '',
        category: '',
        prix: '',
        devise: 'XAF',
        gps_fixe: '',
        adresse: '',
        zone_intervention: '',
        telephone: '',
        whatsapp: '',
        email: '',
        horaires: '',
        is_tarissable: false,
        vitesse_tarissement: '',
    });
    const [loading, setLoading] = useState(false);
    const [suggestionData, setSuggestionData] = useState<any>(null);
    const [userContactInfo, setUserContactInfo] = useState<any>(null);
    const [currentStep, setCurrentStep] = useState(1);
    const navigation = ReactNavigation.useNavigation();
    const { location } = useLocation();
    const { user } = useAuth();

    const vitesses_tarissement = ['lente', 'moyenne', 'rapide'];
    const devises = ['XAF', 'EUR', 'USD', 'GBP'];
    const totalSteps = 4; // Informations de base, Localisation, Tarification, Contact

    // Charger les informations de contact de l'utilisateur depuis le dernier service
    useEffect(() => {
        const loadLastServiceContactInfo = async () => {
            if (!user?.id) return;

            try {
                const response = await apiGet(`/api/services/utilisateur/${user.id}/dernier-contact`);

                if (response.data && Object.keys(response.data).length > 0) {
                    const contactData = {
                        whatsapp: response.data.whatsapp?.valeur || response.data.whatsapp || '',
                        telephone: response.data.telephone?.valeur || response.data.telephone || '',
                        email: response.data.email?.valeur || response.data.email || '',
                    };

                    const hasContactInfo = Object.values(contactData).some(value => value && value.trim() !== '');
                    if (hasContactInfo) {
                        setUserContactInfo(contactData);
                        // Pré-remplir les champs de contact
                        setFormData(prev => ({
                            ...prev,
                            ...contactData
                        }));
                    }
                }
            } catch (error) {
                console.warn('Impossible de charger les contacts précédents:', error);
            }
        };

        loadLastServiceContactInfo();
    }, [user?.id]);

    // Charger les données de suggestion depuis la navigation
    useEffect(() => {
        const route = ReactNavigation.useRoute();
        const params = (route.params as any) || {};

        if (params.suggestion) {
            setSuggestionData(params.suggestion);
            // Pré-remplir avec les données de l'IA
            if (params.suggestion.data) {
                const suggestion = params.suggestion.data;

                // Extraire les valeurs des champs
                const getFieldValue = (field: any): any => {
                    if (!field) return '';
                    if (typeof field === 'object' && field.valeur !== undefined) {
                        return field.valeur;
                    }
                    return field;
                };

                setFormData(prev => ({
                    ...prev,
                    titre_service: getFieldValue(suggestion.titre_service) || '',
                    description: getFieldValue(suggestion.description) || '',
                    category: getFieldValue(suggestion.category) || '',
                    is_tarissable: getFieldValue(suggestion.is_tarissable) || false,
                    vitesse_tarissement: getFieldValue(suggestion.vitesse_tarissement) || '',
                }));
            }
        }
    }, []);

    const handleSubmit = async () => {
        // Validation des champs obligatoires
        if (!formData.titre_service || !formData.description || !formData.category || !formData.whatsapp) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires (titre, description, catégorie, WhatsApp)');
            return;
        }

        try {
            setLoading(true);

            const serviceData: any = {
                titre_service: formData.titre_service,
                description: formData.description,
                category: formData.category,
                prix: formData.prix ? parseFloat(formData.prix) : null,
                devise: formData.devise,
                gps_fixe: formData.gps_fixe,
                adresse: formData.adresse,
                zone_intervention: formData.zone_intervention,
                telephone: formData.telephone,
                whatsapp: formData.whatsapp,
                email: formData.email,
                horaires: formData.horaires,
                is_tarissable: formData.is_tarissable,
                vitesse_tarissement: formData.vitesse_tarissement,
                // Ne pas envoyer gps_mobile, le backend utilise gps_fixe ou position utilisateur
                gps_mobile: location ? `${location.coords.latitude},${location.coords.longitude}` : null,
            };

            const response = await serviceService.createService(serviceData);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Service créé avec succès !',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                DeviceEventEmitter.emit('service:refresh');
                                (navigation as any).navigate('Main', { screen: 'Services' });
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Erreur', response.message || 'Impossible de créer le service');
            }

            setLoading(false);
        } catch (error) {
            console.error('Erreur lors de la création du service:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la création du service');
            setLoading(false);
        }
    };

    const nextStep = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* En-tête avec progression */}
                <View style={styles.header}>
                    <Text style={styles.title}>Créer un Nouveau Service</Text>
                    <Text style={styles.subtitle}>Partagez votre expertise avec la communauté</Text>

                    {/* Indicateur d'étapes */}
                    <View style={styles.stepsIndicator}>
                        {[...Array(totalSteps)].map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.stepDot,
                                    currentStep > index && styles.stepDotCompleted,
                                    currentStep === index + 1 && styles.stepDotActive
                                ]}
                            >
                                <Text style={[
                                    styles.stepNumber,
                                    currentStep > index && styles.stepNumberCompleted,
                                    currentStep === index + 1 && styles.stepNumberActive
                                ]}>
                                    {index + 1}
                                </Text>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.stepInfo}>Étape {currentStep} sur {totalSteps}</Text>
                </View>

                {/* Étape 1: Informations de base */}
                {currentStep === 1 && (
                    <Card style={styles.card}>
                        <View style={styles.cardContent}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Informations de Base</Text>
                                {suggestionData && (
                                    <View style={styles.aiIndicator}>
                                        <SafeIcon name="cpu" size={16} color={modernColors.primary} />
                                        <Text style={styles.aiText}>Généré par l'IA</Text>
                                    </View>
                                )}
                            </View>

                            <TextInput
                                label="Titre du service *"
                                value={formData.titre_service}
                                onChangeText={(text) => {
                                    if (!suggestionData) {
                                        setFormData({ ...formData, titre_service: text });
                                    }
                                }}
                                mode="outlined"
                                style={styles.input}
                                placeholder="Ex: Coiffure à domicile"
                                editable={!suggestionData}
                                disabled={!!suggestionData}
                            />

                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>Catégorie *</Text>
                                {suggestionData && formData.category ? (
                                    <View style={styles.readOnlyField}>
                                        <Text style={styles.readOnlyText}>{formData.category}</Text>
                                    </View>
                                ) : (
                                    <TextInput
                                        label="Entrez une catégorie"
                                        value={formData.category}
                                        onChangeText={(text) => setFormData({ ...formData, category: text })}
                                        mode="outlined"
                                        style={styles.input}
                                        placeholder="Ex: Coiffure, Plomberie, etc."
                                    />
                                )}
                            </View>

                            <View style={styles.switchContainer}>
                                <Text style={styles.switchLabel}>Service tarissable</Text>
                                <Switch
                                    value={formData.is_tarissable}
                                    onValueChange={(value) => {
                                        if (!suggestionData) {
                                            setFormData({ ...formData, is_tarissable: value });
                                        }
                                    }}
                                    color={modernColors.primary}
                                    disabled={!!suggestionData}
                                />
                            </View>

                            {formData.is_tarissable && (
                                <View style={styles.vitesseContainer}>
                                    <Text style={styles.label}>Vitesse de tarissement</Text>
                                    <View style={styles.chipContainer}>
                                        {vitesses_tarissement.map((vitesse) => (
                                            <Chip
                                                key={vitesse}
                                                selected={formData.vitesse_tarissement === vitesse}
                                                onPress={() => {
                                                    if (!suggestionData) {
                                                        setFormData({ ...formData, vitesse_tarissement: vitesse });
                                                    }
                                                }}
                                                style={[
                                                    styles.chip,
                                                    formData.vitesse_tarissement === vitesse && styles.selectedChip,
                                                    suggestionData && styles.readOnlyChip
                                                ]}
                                                textStyle={[
                                                    styles.chipText,
                                                    formData.vitesse_tarissement === vitesse && styles.selectedChipText
                                                ]}
                                                mode={formData.vitesse_tarissement === vitesse ? "flat" : "outlined"}
                                                disabled={!!suggestionData}
                                            >
                                                {vitesse}
                                            </Chip>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <TextInput
                                label="Description *"
                                value={formData.description}
                                onChangeText={(text) => {
                                    if (!suggestionData) {
                                        setFormData({ ...formData, description: text });
                                    }
                                }}
                                mode="outlined"
                                multiline
                                numberOfLines={4}
                                style={styles.input}
                                placeholder="Décrivez votre service en détail..."
                                editable={!suggestionData}
                                disabled={!!suggestionData}
                            />
                        </View>
                    </Card>
                )}

                {/* Étape 2: Localisation */}
                {currentStep === 2 && (
                    <Card style={styles.card}>
                        <View style={styles.cardContent}>
                            <Text style={styles.sectionTitle}>Localisation</Text>

                            <View style={styles.gpsContainer}>
                                <TextInput
                                    label="Coordonnées GPS fixes (optionnel)"
                                    value={formData.gps_fixe}
                                    onChangeText={(text) => setFormData({ ...formData, gps_fixe: text })}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="48.8566,2.3522"
                                    left={<TextInput.Icon icon="map-marker" />}
                                />
                                <Text style={styles.helperText}>
                                    Format: latitude,longitude. Si non renseigné, la position en temps réel sera utilisée.
                                </Text>
                            </View>

                            <TextInput
                                label="Adresse"
                                value={formData.adresse}
                                onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                                mode="outlined"
                                style={styles.input}
                                placeholder="123 Rue de la Paix, Ville"
                            />

                            <TextInput
                                label="Zone d'intervention"
                                value={formData.zone_intervention}
                                onChangeText={(text) => setFormData({ ...formData, zone_intervention: text })}
                                mode="outlined"
                                style={styles.input}
                                placeholder="Paris et banlieue"
                            />
                        </View>
                    </Card>
                )}

                {/* Étape 3: Tarification */}
                {currentStep === 3 && (
                    <Card style={styles.card}>
                        <View style={styles.cardContent}>
                            <Text style={styles.sectionTitle}>Tarification</Text>

                            <View style={styles.priceContainer}>
                                <View style={styles.priceInput}>
                                    <TextInput
                                        label="Prix"
                                        value={formData.prix}
                                        onChangeText={(text) => setFormData({ ...formData, prix: text })}
                                        mode="outlined"
                                        keyboardType="numeric"
                                        style={styles.input}
                                        placeholder="Ex: 25000"
                                    />
                                </View>
                                <View style={styles.currencyContainer}>
                                    <Text style={styles.label}>Devise</Text>
                                    <View style={styles.chipContainer}>
                                        {devises.map((devise) => (
                                            <Chip
                                                key={devise}
                                                selected={formData.devise === devise}
                                                onPress={() => setFormData({ ...formData, devise })}
                                                style={[
                                                    styles.chip,
                                                    formData.devise === devise && styles.selectedChip
                                                ]}
                                                textStyle={[
                                                    styles.chipText,
                                                    formData.devise === devise && styles.selectedChipText
                                                ]}
                                                mode={formData.devise === devise ? "flat" : "outlined"}
                                            >
                                                {devise}
                                            </Chip>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>
                    </Card>
                )}

                {/* Étape 4: Informations de contact */}
                {currentStep === 4 && (
                    <Card style={styles.card}>
                        <View style={styles.cardContent}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Informations de Contact</Text>
                                {userContactInfo && (
                                    <View style={styles.aiIndicator}>
                                        <SafeIcon name="check" size={16} color={modernColors.success} />
                                        <Text style={styles.aiText}>Pré-rempli</Text>
                                    </View>
                                )}
                            </View>

                            <TextInput
                                label="WhatsApp * (obligatoire)"
                                value={formData.whatsapp}
                                onChangeText={(text) => setFormData({ ...formData, whatsapp: text })}
                                mode="outlined"
                                keyboardType="phone-pad"
                                style={styles.input}
                                placeholder="+XXX XXXXXXXXX"
                                left={<TextInput.Icon icon="whatsapp" />}
                                error={!formData.whatsapp}
                            />
                            {!formData.whatsapp && (
                                <Text style={styles.errorText}>Ce champ est obligatoire</Text>
                            )}

                            <TextInput
                                label="Téléphone"
                                value={formData.telephone}
                                onChangeText={(text) => setFormData({ ...formData, telephone: text })}
                                mode="outlined"
                                keyboardType="phone-pad"
                                style={styles.input}
                                placeholder="+XXX XXXXXXXXX"
                                left={<TextInput.Icon icon="phone" />}
                            />

                            <TextInput
                                label="Email"
                                value={formData.email}
                                onChangeText={(text) => setFormData({ ...formData, email: text })}
                                mode="outlined"
                                keyboardType="email-address"
                                style={styles.input}
                                placeholder="contact@service.com"
                                left={<TextInput.Icon icon="email" />}
                            />

                            <TextInput
                                label="Horaires d'ouverture"
                                value={formData.horaires}
                                onChangeText={(text) => setFormData({ ...formData, horaires: text })}
                                mode="outlined"
                                style={styles.input}
                                placeholder="Lun-Ven: 8h-18h, Sam: 9h-17h"
                            />
                        </View>
                    </Card>
                )}

                {/* Boutons de navigation */}
                <View style={styles.navigationButtons}>
                    {currentStep > 1 && (
                        <TouchableOpacity style={styles.prevButton} onPress={prevStep}>
                            <SafeIcon name="arrow-back" size={20} color={modernColors.primary} />
                            <Text style={styles.prevButtonText}>Précédent</Text>
                        </TouchableOpacity>
                    )}

                    {currentStep < totalSteps ? (
                        <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
                            <Text style={styles.nextButtonText}>Suivant</Text>
                            <SafeIcon name="arrow-forward" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={loading}
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                        >
                            <SafeIcon name="check" size={20} color="#FFFFFF" />
                            <Text style={styles.submitButtonText}>
                                {loading ? 'Création...' : 'Créer le Service'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.infoText}>
                    Les champs marqués d'un * sont obligatoires. Les autres champs sont optionnels et peuvent être ajoutés plus tard.
                </Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    content: {
        padding: 16,
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.primary,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 16,
    },
    stepsIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 16,
        gap: 16,
    },
    stepDot: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: modernColors.border,
    },
    stepDotActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    stepDotCompleted: {
        backgroundColor: modernColors.success,
        borderColor: modernColors.success,
    },
    stepNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.textSecondary,
    },
    stepNumberActive: {
        color: '#FFFFFF',
    },
    stepNumberCompleted: {
        color: '#FFFFFF',
    },
    stepInfo: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
    },
    card: {
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardContent: {
        padding: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    aiIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surfaceVariant,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    aiText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
    },
    input: {
        marginBottom: 16,
    },
    fieldContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: modernColors.text,
    },
    readOnlyField: {
        backgroundColor: modernColors.surfaceVariant,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    readOnlyText: {
        fontSize: 16,
        color: modernColors.text,
        fontWeight: '500',
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    switchLabel: {
        fontSize: 16,
        color: modernColors.text,
    },
    vitesseContainer: {
        marginBottom: 16,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    selectedChip: {
        backgroundColor: modernColors.primary,
    },
    readOnlyChip: {
        opacity: 0.6,
    },
    chipText: {
        color: modernColors.text,
    },
    selectedChipText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    gpsContainer: {
        marginBottom: 8,
    },
    helperText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: -12,
        marginBottom: 16,
        marginLeft: 12,
    },
    priceContainer: {
        gap: 16,
    },
    priceInput: {
        marginBottom: 16,
    },
    currencyContainer: {
    },
    errorText: {
        fontSize: 12,
        color: modernColors.error,
        marginTop: -12,
        marginBottom: 16,
        marginLeft: 12,
    },
    navigationButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 24,
        marginBottom: 16,
    },
    prevButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        gap: 8,
        flex: 1,
        justifyContent: 'center',
    },
    prevButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        gap: 8,
        flex: 1,
        justifyContent: 'center',
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: modernColors.success,
        gap: 8,
        flex: 1,
        justifyContent: 'center',
    },
    submitButtonDisabled: {
        backgroundColor: modernColors.textSecondary,
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    infoText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
        paddingHorizontal: 16,
    },
});

export default CreateServiceScreen;





