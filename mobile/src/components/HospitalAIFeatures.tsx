/**
 * HospitalAIFeatures - Composant réutilisable pour fonctionnalités IA hôpital
 * 
 * Fonctionnalités:
 * - Triage IA (analyse urgence)
 * - Recommandations IA selon symptômes
 * - Consultation temps d'attente
 * - Gestion créneaux
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { hapticPress } from '../utils/hapticFeedback';
import SafeIcon from './SafeIcon';

interface TriageResult {
    severity: 'low' | 'moderate' | 'high' | 'critical';
    recommended_action: string;
    estimated_wait_time?: number;
    recommended_hospital_type: string;
    urgency_score: number;
    symptoms_analysis: string;
}

interface RecommendationResult {
    hospitals: Array<{
        hospital_id: number;
        hospital_name: string;
        match_score: number;
        distance_km?: number;
        specialties: string[];
        has_blood_bank: boolean;
        wait_time_minutes?: number;
    }>;
    reasoning: string;
}

interface WaitTimeResult {
    hospital_id: number;
    hospital_name: string;
    current_wait_time: number;
    estimated_wait_time: number;
    queue_length: number;
    last_updated: string;
}

interface HospitalAIFeaturesProps {
    hospitalId?: number;
    visible: boolean;
    onClose: () => void;
}

const HospitalAIFeatures: React.FC<HospitalAIFeaturesProps> = ({
    hospitalId,
    visible,
    onClose
}) => {
    const { t } = useLanguageSafe();
    const [activeTab, setActiveTab] = useState<'triage' | 'recommendations' | 'wait_time' | 'slots'>('triage');
    const [loading, setLoading] = useState(false);

    // État pour triage
    const [symptoms, setSymptoms] = useState('');
    const [age, setAge] = useState('');
    const [triageResult, setTriageResult] = useState<TriageResult | null>(null);

    // État pour recommandations
    const [recommendationQuery, setRecommendationQuery] = useState('');
    const [recommendationResult, setRecommendationResult] = useState<RecommendationResult | null>(null);

    // État pour temps d'attente
    const [waitTimeResult, setWaitTimeResult] = useState<WaitTimeResult | null>(null);

    // État pour créneaux
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedService, setSelectedService] = useState('');
    const [availableSlots, setAvailableSlots] = useState<any[]>([]);

    // Triage IA
    const performTriage = async () => {
        if (!symptoms.trim()) {
            Alert.alert('Erreur', t('hospitalAIFeatures.veuillezDecrireVosSymptomes'));
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/hopitaux/ai/triage', {
                symptoms: symptoms.trim(),
                age: age ? parseInt(age) : undefined,
            });

            if (response?.success && response?.data) {
                setTriageResult(response.data as any);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible d\'effectuer le triage');
            }
        } catch (error: any) {
            console.error('[HospitalAIFeatures] Erreur triage:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Recommandations IA
    const getRecommendations = async () => {
        if (!recommendationQuery.trim()) {
            Alert.alert('Erreur', t('hospitalAIFeatures.veuillezDecrireVotreBesoinMedical'));
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/hopitaux/ai/recommendations', {
                query: recommendationQuery.trim(),
            });

            if (response?.success && response?.data) {
                setRecommendationResult(response.data as any);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible d\'obtenir des recommandations');
            }
        } catch (error: any) {
            console.error('[HospitalAIFeatures] Erreur recommandations:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Temps d'attente
    const getWaitTime = async () => {
        if (!hospitalId) {
            Alert.alert('Erreur', t('hospitalAIFeatures.idHopitalRequis'));
            return;
        }

        try {
            setLoading(true);
            const response = await apiGet(`/api/hopitaux/${hospitalId}/wait-times`);

            if (response?.success && response?.data) {
                setWaitTimeResult(response.data as any);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible d\'obtenir les temps d\'attente');
            }
        } catch (error: any) {
            console.error('[HospitalAIFeatures] Erreur temps attente:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Créneaux disponibles
    const getAvailableSlots = async () => {
        if (!hospitalId) {
            Alert.alert('Erreur', t('hospitalAIFeatures.idHopitalRequis'));
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost(`/api/hopitaux/${hospitalId}/slots`, {
                date: selectedDate || new Date().toISOString().split('T')[0],
                service: selectedService || undefined,
            });

            if (response?.success && response?.data) {
                setAvailableSlots((response.data as any).slots || []);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible d\t('hospitalAIFeatures.obtenirLesCreneaux'));
            }
        } catch (error: any) {
            console.error('[HospitalAIFeatures] Erreur créneaux:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#DC2626';
            case 'high': return '#F59E0B';
            case 'moderate': return '#FBBF24';
            case 'low': return '#10B981';
            default: return '#6B7280';
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#3B82F6', '#60A5FA']}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.headerIconContainer}>
                                <SafeIcon name="hospital" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <Text style={styles.headerTitle}>{t('hospitalAIFeatures.fonctionnalitesIaHopital')}</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                            >
                                <SafeIcon name="x" size={24} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    {/* Tabs */}
                    <View style={styles.tabsContainer}>
                        {[
                            { id: 'triage', label: 'Triage', icon: 'alert-triangle' },
                            { id: 'recommendations', label: 'Recommandations', icon: 'sparkles' },
                            { id: 'wait_time', label: 'Temps attente', icon: 'clock' },
                            { id: 'slots', label: t('hospitalAIFeatures.creneaux'), icon: 'calendar' },
                        ].map((tab) => (
                            <TouchableOpacity
                                key={tab.id}
                                style={[
                                    styles.tab,
                                    activeTab === tab.id && styles.tabActive
                                ]}
                                onPress={() => {
                                    hapticPress();
                                    setActiveTab(tab.id as any);
                                }}
                            >
                                <SafeIcon
                                    name={tab.icon}
                                    size={16}
                                    color={activeTab === tab.id ? '#3B82F6' : '#6B7280'}
                                    type="lucide"
                                />
                                <Text style={[
                                    styles.tabText,
                                    activeTab === tab.id && styles.tabTextActive
                                ]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <Text style={styles.loadingText}>Analyse en cours...</Text>
                            </View>
                        )}

                        {/* Triage Tab */}
                        {activeTab === 'triage' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Triage IA - Analyse d'urgence</Text>
                                <Text style={styles.sectionDescription}>
                                    Décrivez vos symptômes pour obtenir une évaluation de l'urgence
                                </Text>

                                <TextInput
                                    style={styles.textArea}
                                    placeholder={t('hospitalAIFeatures.decrivezVosSymptomesEnDetail')}
                                    value={symptoms}
                                    onChangeText={setSymptoms}
                                    multiline
                                    numberOfLines={4}
                                />

                                <TextInput
                                    style={styles.input}
                                    placeholder={t('hospitalAIFeatures.ageOptionnel')}
                                    value={age}
                                    onChangeText={setAge}
                                    keyboardType="numeric"
                                />

                                <TouchableOpacity
                                    onPress={performTriage}
                                    disabled={!symptoms.trim()}
                                    style={[styles.actionButton, !symptoms.trim() && styles.actionButtonDisabled]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Analyser l'urgence</Text>
                                </TouchableOpacity>

                                {triageResult && (
                                    <View style={[styles.resultCard, { borderColor: getSeverityColor(triageResult.severity) }]}>
                                        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(triageResult.severity) }]}>
                                            <Text style={styles.severityText}>
                                                {triageResult.severity.toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.resultTitle}>Score d'urgence: {triageResult.urgency_score}/10</Text>
                                        <Text style={styles.resultTitle}>{t('hospitalAIFeatures.actionRecommandee')}</Text>
                                        <Text style={styles.resultText}>{triageResult.recommended_action}</Text>
                                        <Text style={styles.resultTitle}>{t('hospitalAIFeatures.typeDetablissementRecommande')}</Text>
                                        <Text style={styles.resultText}>{triageResult.recommended_hospital_type}</Text>
                                        {triageResult.estimated_wait_time && (
                                            <>
                                                <Text style={styles.resultTitle}>{t('hospitalAIFeatures.tempsDattenteEstime')}</Text>
                                                <Text style={styles.resultText}>{triageResult.estimated_wait_time} minutes</Text>
                                            </>
                                        )}
                                        <Text style={styles.resultTitle}>{t('hospitalAIFeatures.analyseDesSymptomes')}</Text>
                                        <Text style={styles.resultText}>{triageResult.symptoms_analysis}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Recommendations Tab */}
                        {activeTab === 'recommendations' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Recommandations IA</Text>
                                <Text style={styles.sectionDescription}>
                                    Obtenez des recommandations personnalisées d'hôpitaux selon votre besoin
                                </Text>

                                <TextInput
                                    style={styles.textArea}
                                    placeholder={t('hospitalAIFeatures.decrivezVotreBesoinMedicalEx')}
                                    value={recommendationQuery}
                                    onChangeText={setRecommendationQuery}
                                    multiline
                                    numberOfLines={3}
                                />

                                <TouchableOpacity
                                    onPress={getRecommendations}
                                    disabled={!recommendationQuery.trim()}
                                    style={[styles.actionButton, !recommendationQuery.trim() && styles.actionButtonDisabled]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Obtenir recommandations</Text>
                                </TouchableOpacity>

                                {recommendationResult && (
                                    <View style={styles.resultCard}>
                                        <Text style={styles.resultTitle}>Raisonnement:</Text>
                                        <Text style={styles.resultText}>{recommendationResult.reasoning}</Text>
                                        <Text style={styles.resultSubtitle}>{t('hospitalAIFeatures.hopitauxRecommandes')}</Text>
                                        {recommendationResult.hospitals.map((hospital, index) => (
                                            <View key={index} style={styles.hospitalCard}>
                                                <Text style={styles.hospitalName}>{hospital.hospital_name}</Text>
                                                <View style={styles.hospitalDetails}>
                                                    <Text style={styles.hospitalDetail}>Score: {hospital.match_score}/10</Text>
                                                    {hospital.distance_km && (
                                                        <Text style={styles.hospitalDetail}>Distance: {hospital.distance_km.toFixed(1)} km</Text>
                                                    )}
                                                    {hospital.wait_time_minutes && (
                                                        <Text style={styles.hospitalDetail}>Attente: {hospital.wait_time_minutes} min</Text>
                                                    )}
                                                </View>
                                                {hospital.specialties.length > 0 && (
                                                    <Text style={styles.hospitalSpecialties}>
                                                        Spécialités: {hospital.specialties.join(', ')}
                                                    </Text>
                                                )}
                                                {hospital.has_blood_bank && (
                                                    <View style={styles.bloodBankBadge}>
                                                        <SafeIcon name="droplet" size={14} color="#DC2626" type="lucide" />
                                                        <Text style={styles.bloodBankText}>Banque de sang</Text>
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Wait Time Tab */}
                        {activeTab === 'wait_time' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Temps d'attente</Text>
                                <Text style={styles.sectionDescription}>
                                    {t('hospitalAIFeatures.consultWaitTimes')}
                                </Text>

                                {hospitalId ? (
                                    <>
                                        <TouchableOpacity
                                            onPress={getWaitTime}
                                            style={styles.actionButton}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.actionButtonText}>{t('hospitalAIFeatures.actualiserLesTempsDattente')}</Text>
                                        </TouchableOpacity>

                                        {waitTimeResult && (
                                            <View style={styles.resultCard}>
                                                <Text style={styles.resultTitle}>{waitTimeResult.hospital_name}</Text>
                                                <View style={styles.waitTimeInfo}>
                                                    <View style={styles.waitTimeItem}>
                                                        <Text style={styles.waitTimeLabel}>Temps d'attente actuel:</Text>
                                                        <Text style={styles.waitTimeValue}>{waitTimeResult.current_wait_time} min</Text>
                                                    </View>
                                                    <View style={styles.waitTimeItem}>
                                                        <Text style={styles.waitTimeLabel}>{t('hospitalAIFeatures.tempsEstime')}</Text>
                                                        <Text style={styles.waitTimeValue}>{waitTimeResult.estimated_wait_time} min</Text>
                                                    </View>
                                                    <View style={styles.waitTimeItem}>
                                                        <Text style={styles.waitTimeLabel}>Longueur de file:</Text>
                                                        <Text style={styles.waitTimeValue}>{waitTimeResult.queue_length} personnes</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.lastUpdated}>
                                                    Dernière mise à jour: {new Date(waitTimeResult.last_updated).toLocaleString('fr-FR')}
                                                </Text>
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <Text style={styles.infoText}>
                                        Sélectionnez un hôpital pour consulter les temps d'attente
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Slots Tab */}
                        {activeTab === 'slots' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>{t('hospitalAIFeatures.creneauxDisponibles')}</Text>
                                <Text style={styles.sectionDescription}>
                                    Consultez et réservez des créneaux disponibles
                                </Text>

                                {hospitalId ? (
                                    <>
                                        <TextInput
                                            style={styles.input}
                                            placeholder={t('hospitalAIFeatures.datePlaceholder')}
                                            value={selectedDate}
                                            onChangeText={setSelectedDate}
                                        />

                                        <TextInput
                                            style={styles.input}
                                            placeholder={t('hospitalAIFeatures.serviceOptionnel')}
                                            value={selectedService}
                                            onChangeText={setSelectedService}
                                        />

                                        <TouchableOpacity
                                            onPress={getAvailableSlots}
                                            style={styles.actionButton}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.actionButtonText}>{t('hospitalAIFeatures.rechercherCreneaux')}</Text>
                                        </TouchableOpacity>

                                        {availableSlots.length > 0 ? (
                                            <View style={styles.resultCard}>
                                                <Text style={styles.resultSubtitle}>
                                                    {availableSlots.length} créneau(x) disponible(s)
                                                </Text>
                                                {availableSlots.map((slot, index) => (
                                                    <View key={index} style={styles.slotCard}>
                                                        <Text style={styles.slotTime}>
                                                            {slot.start_time} - {slot.end_time}
                                                        </Text>
                                                        {slot.service && (
                                                            <Text style={styles.slotService}>{slot.service}</Text>
                                                        )}
                                                        {slot.available && (
                                                            <TouchableOpacity style={styles.bookSlotButton}>
                                                                <Text style={styles.bookSlotText}>{t('hospitalAIFeatures.reserver')}</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                ))}
                                            </View>
                                        ) : availableSlots.length === 0 && selectedDate ? (
                                            <Text style={styles.infoText}>{t('hospitalAIFeatures.aucunCreneauDisponiblePourCette')}</Text>
                                        ) : null}
                                    </>
                                ) : (
                                    <Text style={styles.infoText}>
                                        Sélectionnez un hôpital pour consulter les créneaux
                                    </Text>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginLeft: 12,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        gap: 4,
    },
    tabActive: {
        backgroundColor: '#DBEAFE',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    tabTextActive: {
        color: '#3B82F6',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
        lineHeight: 20,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
    },
    textArea: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    actionButton: {
        marginTop: 8,
        marginBottom: 20,
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    resultCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        marginTop: 12,
    },
    severityBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 12,
    },
    severityText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    resultTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginTop: 12,
        marginBottom: 4,
    },
    resultText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    resultSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 16,
        marginBottom: 8,
    },
    hospitalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    hospitalName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    hospitalDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 8,
    },
    hospitalDetail: {
        fontSize: 12,
        color: '#6B7280',
    },
    hospitalSpecialties: {
        fontSize: 12,
        color: '#374151',
        marginTop: 4,
    },
    bloodBankBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        gap: 4,
    },
    bloodBankText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    waitTimeInfo: {
        marginVertical: 12,
    },
    waitTimeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    waitTimeLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    waitTimeValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    lastUpdated: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 8,
        fontStyle: 'italic',
    },
    slotCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    slotTime: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    slotService: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    bookSlotButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
    },
    bookSlotText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    infoText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        padding: 20,
        fontStyle: 'italic',
    },
});

export default HospitalAIFeatures;

