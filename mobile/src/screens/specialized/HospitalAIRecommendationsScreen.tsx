// ✅ Phase 3: Écran recommandations IA pour hôpitaux
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { HospitalRecommendation, hospitalService } from '../../services/hospitalService';
import { modernColors } from '../../theme/modernTheme';

interface HospitalAIRecommendationsScreenParams {
    hospitalId?: number;
    initialSymptoms?: string;
}

const HospitalAIRecommendationsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as HospitalAIRecommendationsScreenParams | undefined;

    const [symptoms, setSymptoms] = useState(params?.initialSymptoms || '');
    const [location, setLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [recommendations, setRecommendations] = useState<HospitalRecommendation | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    const handleGetLocation = () => {
        // TODO: Implémenter la géolocalisation
        Alert.alert('Info', 'La géolocalisation sera bientôt disponible');
    };

    const handleGetRecommendations = async () => {
        if (!symptoms.trim()) {
            Alert.alert('Erreur', 'Veuillez décrire vos symptômes');
            return;
        }

        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour obtenir des recommandations IA');
            navigation.navigate('Login' as never);
            return;
        }

        setLoading(true);
        try {
            const response = await hospitalService.getAIRecommendations(
                symptoms.trim(),
                location.trim() || undefined,
                userLocation || undefined
            );

            if (response.success && response.data) {
                setRecommendations(response.data.recommendation);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'obtenir les recommandations IA');
            }
        } catch (error: any) {
            console.error('[HospitalAIRecommendationsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'obtenir les recommandations IA');
        } finally {
            setLoading(false);
        }
    };

    const handleViewHospital = (hospitalId: number) => {
        navigation.navigate('HopitalDetails' as never, {
            hospitalId,
        } as never);
    };

    const getUrgencyColor = (level?: number) => {
        if (!level) return modernColors.textSecondary;
        if (level <= 2) return modernColors.error; // Critique
        if (level <= 3) return modernColors.warning; // Urgent
        return modernColors.success; // Normal
    };

    const getUrgencyLabel = (level?: number) => {
        if (!level) return 'Non spécifié';
        if (level <= 2) return 'Critique';
        if (level <= 3) return 'Urgent';
        return 'Normal';
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Recommandations IA</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {!recommendations ? (
                    <>
                        <NativeCard style={styles.card}>
                            <View style={styles.cardHeader}>
                                <SafeIcon name="sparkles" size={32} color={modernColors.primary} />
                                <Text style={styles.cardTitle}>Décrivez vos symptômes</Text>
                                <Text style={styles.cardSubtitle}>
                                    Notre IA analysera vos symptômes et vous recommandera les meilleurs hôpitaux
                                </Text>
                            </View>

                            <View style={styles.formContainer}>
                                <Text style={styles.label}>Symptômes *</Text>
                                <NativeInput
                                    placeholder="Ex: Fièvre, toux, maux de tête, douleur abdominale..."
                                    value={symptoms}
                                    onChangeText={setSymptoms}
                                    multiline
                                    style={styles.symptomsInput}
                                />

                                <Text style={styles.label}>Localisation (optionnel)</Text>
                                <NativeInput
                                    placeholder="Ex: Yaoundé, Douala..."
                                    value={location}
                                    onChangeText={setLocation}
                                    style={styles.locationInput}
                                />

                                <NativeButton
                                    title="📍 Utiliser ma position GPS"
                                    onPress={handleGetLocation}
                                    variant="outline"
                                    style={styles.locationButton}
                                />

                                <NativeButton
                                    title="🤖 Obtenir les recommandations"
                                    onPress={handleGetRecommendations}
                                    disabled={loading || !symptoms.trim()}
                                    variant="primary"
                                    style={styles.submitButton}
                                />
                            </View>
                        </NativeCard>
                    </>
                ) : (
                    <>
                        {/* Résultats des recommandations */}
                        <NativeCard style={styles.card}>
                            <View style={styles.cardHeader}>
                                <SafeIcon name="check-circle" size={32} color={modernColors.success} />
                                <Text style={styles.cardTitle}>Recommandations générées</Text>
                            </View>

                            {recommendations.urgency_level && (
                                <View style={styles.urgencyContainer}>
                                    <View style={[
                                        styles.urgencyBadge,
                                        { backgroundColor: `${getUrgencyColor(recommendations.urgency_level)}20` }
                                    ]}>
                                        <SafeIcon
                                            name="alert-circle"
                                            size={20}
                                            color={getUrgencyColor(recommendations.urgency_level)}
                                        />
                                        <Text style={[
                                            styles.urgencyText,
                                            { color: getUrgencyColor(recommendations.urgency_level) }
                                        ]}>
                                            Niveau d'urgence: {getUrgencyLabel(recommendations.urgency_level)}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {recommendations.recommendations && (
                                <View style={styles.recommendationsContainer}>
                                    <Text style={styles.recommendationsTitle}>Recommandations:</Text>
                                    <Text style={styles.recommendationsText}>
                                        {recommendations.recommendations}
                                    </Text>
                                </View>
                            )}

                            {recommendations.advice && (
                                <View style={styles.adviceContainer}>
                                    <Text style={styles.adviceTitle}>Conseils:</Text>
                                    <Text style={styles.adviceText}>
                                        {recommendations.advice}
                                    </Text>
                                </View>
                            )}

                            {recommendations.specialties && recommendations.specialties.length > 0 && (
                                <View style={styles.specialtiesContainer}>
                                    <Text style={styles.specialtiesTitle}>Spécialités recommandées:</Text>
                                    <View style={styles.specialtiesList}>
                                        {recommendations.specialties.map((specialty, idx) => (
                                            <View key={idx} style={styles.specialtyTag}>
                                                <Text style={styles.specialtyTagText}>{specialty}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </NativeCard>

                        {/* Hôpitaux suggérés */}
                        {recommendations.hospital_ids && recommendations.hospital_ids.length > 0 && (
                            <NativeCard style={styles.card}>
                                <Text style={styles.hospitalsTitle}>Hôpitaux suggérés:</Text>
                                {recommendations.hospital_ids.map((hospitalId, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.hospitalItem}
                                        onPress={() => handleViewHospital(hospitalId)}
                                    >
                                        <SafeIcon name="hospital" size={24} color={modernColors.primary} />
                                        <Text style={styles.hospitalItemText}>
                                            Hôpital #{hospitalId}
                                        </Text>
                                        <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </NativeCard>
                        )}

                        <NativeButton
                            title="🔄 Nouvelle recherche"
                            onPress={() => {
                                setRecommendations(null);
                                setSymptoms('');
                                setLocation('');
                                setUserLocation(null);
                            }}
                            variant="outline"
                            style={styles.resetButton}
                        />
                    </>
                )}

                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Analyse en cours...</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    card: {
        marginBottom: 16,
        padding: 20,
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 12,
        textAlign: 'center',
    },
    cardSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    formContainer: {
        marginTop: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
        marginTop: 16,
    },
    symptomsInput: {
        minHeight: 120,
        textAlignVertical: 'top',
    },
    locationInput: {
        marginBottom: 12,
    },
    locationButton: {
        marginBottom: 12,
    },
    submitButton: {
        marginTop: 8,
    },
    urgencyContainer: {
        marginBottom: 20,
    },
    urgencyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    urgencyText: {
        fontSize: 14,
        fontWeight: '600',
    },
    recommendationsContainer: {
        marginBottom: 20,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    recommendationsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    recommendationsText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 22,
    },
    adviceContainer: {
        marginBottom: 20,
        padding: 16,
        backgroundColor: '#E0F2FE',
        borderRadius: 8,
    },
    adviceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    adviceText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 22,
    },
    specialtiesContainer: {
        marginBottom: 20,
    },
    specialtiesTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    specialtiesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    specialtyTag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#E0E7FF',
        borderRadius: 6,
    },
    specialtyTagText: {
        fontSize: 14,
        color: '#1E40AF',
        fontWeight: '500',
    },
    hospitalsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 16,
    },
    hospitalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        gap: 12,
    },
    hospitalItemText: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
        fontWeight: '500',
    },
    resetButton: {
        marginTop: 8,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
});

export default HospitalAIRecommendationsScreen;

