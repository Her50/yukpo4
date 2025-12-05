// ✅ Phase 3: Détails d'un hôpital avec boutons d'action
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ChatModalMobile from '../../components/ChatModalMobile';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { EmergencyStatus, hospitalService, WaitTime } from '../../services/hospitalService';
import { modernColors } from '../../theme/modernTheme';

interface HopitalDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    type_etablissement: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    urgences_disponible: boolean;
    banque_sang: boolean;
    rdv_en_ligne: boolean;
    prestations_medicales?: string[];
    telephone?: string;
    telephone_urgence?: string;
    whatsapp?: string;
    email?: string;
    site_web?: string;
}

interface HopitalDetailsScreenParams {
    hospitalId: number;
}

const HopitalDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as HopitalDetailsScreenParams;

    const [hopital, setHopital] = useState<HopitalDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    // ✅ 2025-01-27: Nouvelles fonctionnalités
    const [waitTimes, setWaitTimes] = useState<WaitTime[] | null>(null);
    const [emergencyStatus, setEmergencyStatus] = useState<EmergencyStatus | null>(null);
    const [loadingWaitTimes, setLoadingWaitTimes] = useState(false);
    const [loadingEmergency, setLoadingEmergency] = useState(false);
    // ✅ 2025-01-27: Chat et Avis
    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [prestataireInfo, setPrestataireInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);

    useEffect(() => {
        loadHopitalDetails();
    }, []);

    // ✅ 2025-01-27: Charger temps d'attente et statut urgences si disponibles
    useEffect(() => {
        if (hopital?.urgences_disponible) {
            loadEmergencyStatus();
            loadWaitTimes();
        }
    }, [hopital]);

    // ✅ 2025-01-27: Charger infos prestataire et statistiques ratings
    useEffect(() => {
        if (hopital) {
            loadPrestataireInfo();
            loadRatingStats();
        }
    }, [hopital]);

    const loadHopitalDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/hopitaux/${params.hospitalId}`);

            if (response.success && response.data) {
                setHopital(response.data as HopitalDetails);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails de l\'hôpital');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[HopitalDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour réserver un rendez-vous');
            navigation.navigate('Login' as never);
            return;
        }

        try {
            setBooking(true);
            const response = await apiPost(`/api/hopitaux/${params.hospitalId}/book`, {
                notes: 'Réservation depuis l\'application mobile',
            });

            if (response.success) {
                Alert.alert(
                    'Réservation créée',
                    'Votre demande de rendez-vous a été envoyée. L\'hôpital vous contactera.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer la réservation');
            }
        } catch (error: any) {
            console.error('[HopitalDetailsScreen] Erreur réservation:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la réservation');
        } finally {
            setBooking(false);
        }
    };

    const handleCall = () => {
        if (hopital?.telephone) {
            Linking.openURL(`tel:${hopital.telephone}`);
        }
    };

    const handleCallUrgence = () => {
        if (hopital?.telephone_urgence) {
            Linking.openURL(`tel:${hopital.telephone_urgence}`);
        }
    };

    // ✅ 2025-01-27: Charger temps d'attente
    const loadWaitTimes = async () => {
        try {
            setLoadingWaitTimes(true);
            const response = await hospitalService.getWaitTimes(params.hospitalId);
            if (response.success && response.data) {
                setWaitTimes(response.data.wait_times);
            }
        } catch (error: any) {
            console.error('[HopitalDetailsScreen] Erreur chargement temps d\'attente:', error);
        } finally {
            setLoadingWaitTimes(false);
        }
    };

    // ✅ 2025-01-27: Charger statut urgences
    const loadEmergencyStatus = async () => {
        try {
            setLoadingEmergency(true);
            const response = await hospitalService.getEmergencyStatus(params.hospitalId);
            if (response.success && response.data) {
                setEmergencyStatus(response.data);
            }
        } catch (error: any) {
            console.error('[HopitalDetailsScreen] Erreur chargement statut urgences:', error);
        } finally {
            setLoadingEmergency(false);
        }
    };

    // ✅ 2025-01-27: Recommandations IA
    const handleAIRecommendations = () => {
        navigation.navigate('HospitalAIRecommendations' as never, {
            hospitalId: params.hospitalId,
        } as never);
    };

    // ✅ 2025-01-27: Navigation vers mes consultations
    const handleViewMyConsultations = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir vos consultations');
            navigation.navigate('Login' as never);
            return;
        }
        navigation.navigate('MyConsultations' as never);
    };

    // ✅ 2025-01-27: Navigation vers analytics (prestataire uniquement)
    const handleViewAnalytics = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir les analytics');
            navigation.navigate('Login' as never);
            return;
        }
        navigation.navigate('HospitalAnalytics' as never, {
            hospitalId: params.hospitalId,
        } as never);
    };

    // ✅ 2025-01-27: Charger infos prestataire
    const loadPrestataireInfo = async () => {
        if (!hopital?.user_id) return;
        try {
            const response = await apiGet(`/api/users/${hopital.user_id}`);
            if (response.success && response.data) {
                setPrestataireInfo(response.data);
            }
        } catch (error: any) {
            console.warn('[HopitalDetailsScreen] Impossible de charger prestataire:', error);
        }
    };

    // ✅ 2025-01-27: Charger statistiques ratings
    const loadRatingStats = async () => {
        if (!hopital?.service_id) return;
        try {
            const response = await apiGet(`/api/specialized-services/${hopital.service_id}/ratings/stats`);
            if (response.success && response.data) {
                const data = response.data as any;
                setRatingStats(data.stats || data);
            }
        } catch (error: any) {
            console.warn('[HopitalDetailsScreen] Impossible de charger stats ratings:', error);
        }
    };

    // ✅ 2025-01-27: Ouvrir chat
    const handleOpenChat = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour contacter l\'hôpital');
            navigation.navigate('Login' as never);
            return;
        }
        setShowChat(true);
    };

    // Vérifier si l'utilisateur est le propriétaire
    const isOwner = user && hopital && String(user.id) === String(hopital.user_id);

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!hopital) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Hôpital non trouvé</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Détails de l'hôpital</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <NativeCard style={styles.card}>
                    <View style={styles.statusRow}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.nom}>{hopital.nom}</Text>
                            <Text style={styles.type}>{hopital.type_etablissement}</Text>
                        </View>
                        <View style={styles.badgesContainer}>
                            <View style={[styles.statusBadge, hopital.is_available_now && styles.statusBadgeAvailable]}>
                                <Text style={[styles.statusText, hopital.is_available_now && styles.statusTextAvailable]}>
                                    {hopital.is_available_now ? 'Disponible' : 'Indisponible'}
                                </Text>
                            </View>
                            {hopital.urgences_disponible && (
                                <View style={styles.urgenceBadge}>
                                    <SafeIcon name="alert-circle" size={12} color="#DC2626" />
                                    <Text style={styles.urgenceText}>Urgences</Text>
                                </View>
                            )}
                            {hopital.banque_sang && (
                                <View style={styles.banqueSangBadge}>
                                    <Text style={styles.banqueSangText}>Banque de sang</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {(hopital.adresse || hopital.ville || hopital.quartier) && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <View style={styles.infoTextContainer}>
                                {hopital.adresse && <Text style={styles.infoText}>{hopital.adresse}</Text>}
                                <Text style={styles.infoSubtext}>
                                    {[hopital.quartier, hopital.ville].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                        </View>
                    )}

                    {hopital.gps && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{hopital.gps}</Text>
                        </View>
                    )}

                    {hopital.telephone && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="phone" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{hopital.telephone}</Text>
                        </View>
                    )}

                    {hopital.telephone_urgence && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="alert-circle" size={20} color="#DC2626" />
                            <Text style={[styles.infoText, styles.urgenceText]}>
                                Urgences: {hopital.telephone_urgence}
                            </Text>
                        </View>
                    )}

                    {hopital.email && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="mail" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{hopital.email}</Text>
                        </View>
                    )}

                    {hopital.prestations_medicales && hopital.prestations_medicales.length > 0 && (
                        <View style={styles.prestationsSection}>
                            <Text style={styles.sectionTitle}>Prestations médicales</Text>
                            <View style={styles.prestationsChips}>
                                {hopital.prestations_medicales.map((prest, idx) => (
                                    <View key={idx} style={styles.prestationChip}>
                                        <Text style={styles.prestationChipText}>{prest}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {hopital.rdv_en_ligne && (
                        <View style={styles.rdvBadge}>
                            <SafeIcon name="check-circle" size={16} color="#059669" />
                            <Text style={styles.rdvText}>Rendez-vous en ligne disponible</Text>
                        </View>
                    )}
                </NativeCard>

                {/* ✅ 2025-01-27: Section Temps d'attente */}
                {hopital.urgences_disponible && waitTimes && waitTimes.length > 0 && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.sectionTitle}>⏱️ Temps d'attente estimés</Text>
                        {loadingWaitTimes ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        ) : (
                            waitTimes.map((wt, idx) => (
                                <View key={idx} style={styles.waitTimeRow}>
                                    <View style={styles.waitTimeInfo}>
                                        <Text style={styles.waitTimeSpecialty}>
                                            {wt.specialty || 'Général'}
                                        </Text>
                                        <Text style={styles.waitTimeSubtext}>
                                            {wt.consultation_count} consultation(s)
                                        </Text>
                                    </View>
                                    <View style={styles.waitTimeValue}>
                                        <Text style={styles.waitTimeMinutes}>
                                            {wt.avg_wait_time_minutes
                                                ? `${Math.round(wt.avg_wait_time_minutes)} min`
                                                : 'N/A'}
                                        </Text>
                                        {wt.max_wait_time_minutes && (
                                            <Text style={styles.waitTimeMax}>
                                                Max: {Math.round(wt.max_wait_time_minutes)} min
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}
                    </NativeCard>
                )}

                {/* ✅ 2025-01-27: Section Statut Urgences */}
                {hopital.urgences_disponible && emergencyStatus && (
                    <NativeCard style={styles.card}>
                        <View style={styles.emergencyStatusHeader}>
                            <SafeIcon
                                name="alert-circle"
                                size={24}
                                color={
                                    emergencyStatus.status === 'saturated' ? '#DC2626' :
                                        emergencyStatus.status === 'busy' ? '#F59E0B' :
                                            '#059669'
                                }
                            />
                            <View style={styles.emergencyStatusTitleContainer}>
                                <Text style={styles.emergencyStatusTitle}>
                                    Statut Urgences: {
                                        emergencyStatus.status === 'available' ? 'Disponible' :
                                            emergencyStatus.status === 'busy' ? 'Occupé' :
                                                'Saturé'
                                    }
                                </Text>
                            </View>
                        </View>
                        <View style={styles.emergencyStatsRow}>
                            <View style={styles.emergencyStat}>
                                <Text style={styles.emergencyStatLabel}>Patients critiques</Text>
                                <Text style={[styles.emergencyStatValue, styles.criticalValue]}>
                                    {emergencyStatus.critical_count}
                                </Text>
                            </View>
                            <View style={styles.emergencyStat}>
                                <Text style={styles.emergencyStatLabel}>Temps moyen</Text>
                                <Text style={styles.emergencyStatValue}>
                                    {emergencyStatus.avg_wait_time_minutes
                                        ? `${Math.round(emergencyStatus.avg_wait_time_minutes)} min`
                                        : 'N/A'}
                                </Text>
                            </View>
                            <View style={styles.emergencyStat}>
                                <Text style={styles.emergencyStatLabel}>Total patients</Text>
                                <Text style={styles.emergencyStatValue}>
                                    {emergencyStatus.total_patients}
                                </Text>
                            </View>
                        </View>
                    </NativeCard>
                )}

                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="Réserver un rendez-vous"
                        onPress={handleBook}
                        disabled={booking || !hopital.is_available_now}
                        variant="primary"
                        style={styles.bookButton}
                    />
                    {/* ✅ 2025-01-27: Bouton Contacter */}
                    <NativeButton
                        title="💬 Contacter"
                        onPress={handleOpenChat}
                        variant="outline"
                        style={styles.contactButton}
                    />
                    {/* ✅ 2025-01-27: Bouton Recommandations IA */}
                    <NativeButton
                        title="🤖 Obtenir recommandations IA"
                        onPress={handleAIRecommendations}
                        variant="outline"
                        style={styles.aiButton}
                    />
                    {/* ✅ 2025-01-27: Bouton Mes consultations */}
                    <NativeButton
                        title="📋 Mes consultations"
                        onPress={handleViewMyConsultations}
                        variant="outline"
                        style={styles.myConsultationsButton}
                    />
                    {/* ✅ 2025-01-27: Bouton Analytics (prestataire uniquement) */}
                    {isOwner && (
                        <NativeButton
                            title="📊 Analytics"
                            onPress={handleViewAnalytics}
                            variant="outline"
                            style={styles.analyticsButton}
                        />
                    )}
                    {hopital.telephone && (
                        <NativeButton
                            title="Appeler"
                            onPress={handleCall}
                            variant="outline"
                            style={styles.callButton}
                        />
                    )}
                    {hopital.telephone_urgence && hopital.urgences_disponible && (
                        <NativeButton
                            title="Appeler les urgences"
                            onPress={handleCallUrgence}
                            variant="outline"
                            style={[styles.callButton, styles.urgenceButton]}
                        />
                    )}
                </View>

                {/* ✅ 2025-01-27: Section Avis et Commentaires */}
                {hopital.service_id && (
                    <ProductCommentsSection
                        serviceId={hopital.service_id}
                        serviceTitle={hopital.nom}
                        onOpenChat={handleOpenChat}
                        mode="inline"
                    />
                )}
            </ScrollView>

            {/* ✅ 2025-01-27: Modal Chat */}
            {user && (
                <ChatModalMobile
                    visible={showChat}
                    onClose={() => setShowChat(false)}
                    service={{
                        id: hopital.service_id,
                        nom: hopital.nom,
                        type: 'hopital_clinique',
                    }}
                    prestataireInfo={prestataireInfo || {
                        id: hopital.user_id,
                        nom: hopital.nom,
                    }}
                    user={user}
                    conversationId={conversationId}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    card: {
        padding: 20,
        marginBottom: 16,
    },
    statusRow: {
        marginBottom: 16,
    },
    titleContainer: {
        marginBottom: 12,
    },
    nom: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    type: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    badgesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
    },
    statusBadgeAvailable: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    statusTextAvailable: {
        color: '#059669',
    },
    urgenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
        gap: 4,
    },
    urgenceText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    banqueSangBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FCE7F3',
    },
    banqueSangText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#BE185D',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoText: {
        fontSize: 16,
        color: '#374151',
    },
    infoSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    prestationsSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    prestationsChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    prestationChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#DBEAFE',
    },
    prestationChipText: {
        fontSize: 12,
        color: '#1E40AF',
    },
    rdvBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 8,
    },
    rdvText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#059669',
    },
    actionsContainer: {
        gap: 12,
    },
    bookButton: {
        marginTop: 8,
    },
    callButton: {
        marginTop: 8,
    },
    urgenceButton: {
        backgroundColor: '#FEE2E2',
        borderColor: '#DC2626',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: '#DC2626',
    },
    // ✅ 2025-01-27: Nouveaux styles pour temps d'attente et urgences
    waitTimeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    waitTimeInfo: {
        flex: 1,
    },
    waitTimeSpecialty: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    waitTimeSubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    waitTimeValue: {
        alignItems: 'flex-end',
    },
    waitTimeMinutes: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    waitTimeMax: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    emergencyStatusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    emergencyStatusTitleContainer: {
        flex: 1,
    },
    emergencyStatusTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    emergencyStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: 16,
    },
    emergencyStat: {
        alignItems: 'center',
        flex: 1,
    },
    emergencyStatLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    emergencyStatValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    criticalValue: {
        color: '#DC2626',
    },
    aiButton: {
        marginTop: 8,
        borderColor: modernColors.primary,
    },
    myConsultationsButton: {
        marginTop: 8,
    },
    analyticsButton: {
        marginTop: 8,
        backgroundColor: modernColors.secondary,
        borderColor: modernColors.secondary,
    },
    contactButton: {
        marginTop: 8,
    },
});

export default HopitalDetailsScreen;

