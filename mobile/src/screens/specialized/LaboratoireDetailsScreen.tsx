// ✅ Phase 3: Détails d'un laboratoire avec boutons d'action
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ChatModalMobile from '../../components/ChatModalMobile';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { ExaminationType, labService } from '../../services/labService';
import { modernColors } from '../../theme/modernTheme';

interface LaboratoireDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    type_laboratoire: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    analyses_disponibles?: string[];
    imagerie_disponible?: string[];
    rdv_requis: boolean;
    resultats_en_ligne: boolean;
    telephone?: string;
    whatsapp?: string;
    email?: string;
}

interface LaboratoireDetailsScreenParams {
    laboratoryId: number;
}

const LaboratoireDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as LaboratoireDetailsScreenParams;

    const [laboratoire, setLaboratoire] = useState<LaboratoireDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    // ✅ 2025-01-27: Nouvelles fonctionnalités
    const [examinationTypes, setExaminationTypes] = useState<ExaminationType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(false);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedExamination, setSelectedExamination] = useState<ExaminationType | null>(null);
    const [bookingNotes, setBookingNotes] = useState('');
    const [bookingExamination, setBookingExamination] = useState(false);
    // ✅ 2025-01-27: Chat et Avis
    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [prestataireInfo, setPrestataireInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);

    useEffect(() => {
        loadLaboratoireDetails();
    }, []);

    // ✅ 2025-01-27: Charger les types d'examens disponibles
    useEffect(() => {
        if (laboratoire) {
            loadExaminationTypes();
            loadPrestataireInfo();
            loadRatingStats();
        }
    }, [laboratoire]);

    const loadLaboratoireDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/laboratoires/${params.laboratoryId}`);

            if (response.success && response.data) {
                setLaboratoire(response.data as LaboratoireDetails);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails du laboratoire');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[LaboratoireDetailsScreen] Erreur:', error);
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
            const response = await apiPost(`/api/laboratoires/${params.laboratoryId}/book`, {
                notes: 'Réservation depuis l\'application mobile',
            });

            if (response.success) {
                Alert.alert(
                    'Réservation créée',
                    'Votre demande de rendez-vous a été envoyée. Le laboratoire vous contactera.',
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
            console.error('[LaboratoireDetailsScreen] Erreur réservation:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la réservation');
        } finally {
            setBooking(false);
        }
    };

    const handleCall = () => {
        if (laboratoire?.telephone) {
            Linking.openURL(`tel:${laboratoire.telephone}`);
        }
    };

    // ✅ 2025-01-27: Charger les types d'examens disponibles
    const loadExaminationTypes = async () => {
        try {
            setLoadingTypes(true);
            const response = await labService.getExaminationTypes(params.laboratoryId);

            if (response.success && response.data) {
                setExaminationTypes(response.data.examination_types);
            } else {
                console.warn('[LaboratoireDetailsScreen] Impossible de charger les types d\'examens:', response.error);
            }
        } catch (error: any) {
            console.error('[LaboratoireDetailsScreen] Erreur chargement types d\'examens:', error);
        } finally {
            setLoadingTypes(false);
        }
    };

    // ✅ 2025-01-27: Réserver un examen
    const handleBookExamination = async (examinationType: ExaminationType) => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour réserver un examen');
            navigation.navigate('Login' as never);
            return;
        }

        setSelectedExamination(examinationType);
        setShowBookingModal(true);
    };

    const handleConfirmBooking = async () => {
        if (!selectedExamination) return;

        try {
            setBookingExamination(true);
            const response = await labService.bookExamination(
                params.laboratoryId,
                {
                    examination_type_id: selectedExamination.id,
                    notes: bookingNotes.trim() || undefined,
                }
            );

            if (response.success && response.data) {
                Alert.alert(
                    'Réservation réussie',
                    `Votre réservation d'examen (ID: ${response.data.examination_id}) a été créée avec succès.`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setShowBookingModal(false);
                                setSelectedExamination(null);
                                setBookingNotes('');
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer la réservation');
            }
        } catch (error: any) {
            console.error('[LaboratoireDetailsScreen] Erreur réservation examen:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la réservation');
        } finally {
            setBookingExamination(false);
        }
    };

    const handleViewMyExaminations = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir vos examens');
            navigation.navigate('Login' as never);
            return;
        }
        navigation.navigate('MyLabExaminations' as never);
    };

    // ✅ 2025-01-27: Navigation vers analytics (prestataire uniquement)
    const handleViewAnalytics = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir les analytics');
            navigation.navigate('Login' as never);
            return;
        }
        navigation.navigate('LabAnalytics' as never, {
            laboratoryId: params.laboratoryId,
        } as never);
    };

    // ✅ 2025-01-27: Charger infos prestataire
    const loadPrestataireInfo = async () => {
        if (!laboratoire?.user_id) return;
        try {
            const response = await apiGet(`/api/users/${laboratoire.user_id}`);
            if (response.success && response.data) {
                setPrestataireInfo(response.data);
            }
        } catch (error: any) {
            console.warn('[LaboratoireDetailsScreen] Impossible de charger prestataire:', error);
        }
    };

    // ✅ 2025-01-27: Charger statistiques ratings
    const loadRatingStats = async () => {
        if (!laboratoire?.service_id) return;
        try {
            const response = await apiGet(`/api/specialized-services/${laboratoire.service_id}/ratings/stats`);
            if (response.success && response.data) {
                const data = response.data as any;
                setRatingStats(data.stats || data);
            }
        } catch (error: any) {
            console.warn('[LaboratoireDetailsScreen] Impossible de charger stats ratings:', error);
        }
    };

    // ✅ 2025-01-27: Ouvrir chat
    const handleOpenChat = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour contacter le laboratoire');
            navigation.navigate('Login' as never);
            return;
        }
        setShowChat(true);
    };

    // Vérifier si l'utilisateur est le propriétaire
    const isOwner = user && laboratoire && String(user.id) === String(laboratoire.user_id);

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!laboratoire) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Laboratoire non trouvé</Text>
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
                <Text style={styles.title}>Détails du laboratoire</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <NativeCard style={styles.card}>
                    <View style={styles.statusRow}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.nom}>{laboratoire.nom}</Text>
                            <Text style={styles.type}>{laboratoire.type_laboratoire}</Text>
                        </View>
                        <View style={[styles.statusBadge, laboratoire.is_available_now && styles.statusBadgeAvailable]}>
                            <Text style={[styles.statusText, laboratoire.is_available_now && styles.statusTextAvailable]}>
                                {laboratoire.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Text>
                        </View>
                    </View>

                    {(laboratoire.adresse || laboratoire.ville || laboratoire.quartier) && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <View style={styles.infoTextContainer}>
                                {laboratoire.adresse && <Text style={styles.infoText}>{laboratoire.adresse}</Text>}
                                <Text style={styles.infoSubtext}>
                                    {[laboratoire.quartier, laboratoire.ville].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                        </View>
                    )}

                    {laboratoire.gps && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{laboratoire.gps}</Text>
                        </View>
                    )}

                    {laboratoire.telephone && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="phone" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{laboratoire.telephone}</Text>
                        </View>
                    )}

                    {laboratoire.email && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="mail" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{laboratoire.email}</Text>
                        </View>
                    )}

                    {laboratoire.analyses_disponibles && laboratoire.analyses_disponibles.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Analyses disponibles</Text>
                            <View style={styles.chipsContainer}>
                                {laboratoire.analyses_disponibles.map((anal, idx) => (
                                    <View key={idx} style={styles.analyseChip}>
                                        <Text style={styles.analyseChipText}>{anal}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {laboratoire.imagerie_disponible && laboratoire.imagerie_disponible.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Imagerie disponible</Text>
                            <View style={styles.chipsContainer}>
                                {laboratoire.imagerie_disponible.map((img, idx) => (
                                    <View key={idx} style={styles.imagerieChip}>
                                        <Text style={styles.imagerieChipText}>{img}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.badgesContainer}>
                        {laboratoire.rdv_requis && (
                            <View style={styles.rdvBadge}>
                                <Text style={styles.rdvBadgeText}>Rendez-vous requis</Text>
                            </View>
                        )}
                        {laboratoire.resultats_en_ligne && (
                            <View style={styles.resultatsBadge}>
                                <SafeIcon name="check-circle" size={16} color="#059669" />
                                <Text style={styles.resultatsText}>Résultats en ligne disponible</Text>
                            </View>
                        )}
                    </View>
                </NativeCard>

                {/* ✅ 2025-01-27: Section Types d'Examens Disponibles */}
                {loadingTypes ? (
                    <NativeCard style={styles.card}>
                        <ActivityIndicator size="small" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Chargement des types d'examens...</Text>
                    </NativeCard>
                ) : examinationTypes.length > 0 && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.sectionTitle}>🔬 Types d'examens disponibles</Text>
                        {examinationTypes.map((type) => (
                            <TouchableOpacity
                                key={type.id}
                                style={styles.examinationTypeRow}
                                onPress={() => handleBookExamination(type)}
                            >
                                <View style={styles.examinationTypeInfo}>
                                    <Text style={styles.examinationTypeName}>{type.name}</Text>
                                    {type.category && (
                                        <Text style={styles.examinationTypeCategory}>
                                            Catégorie: {type.category}
                                        </Text>
                                    )}
                                    {type.description && (
                                        <Text style={styles.examinationTypeDescription} numberOfLines={2}>
                                            {type.description}
                                        </Text>
                                    )}
                                    <View style={styles.examinationTypeDetails}>
                                        {type.price && (
                                            <Text style={styles.examinationTypePrice}>
                                                {type.price} XAF
                                            </Text>
                                        )}
                                        {type.duration_minutes && (
                                            <Text style={styles.examinationTypeDuration}>
                                                ⏱️ {type.duration_minutes} min
                                            </Text>
                                        )}
                                    </View>
                                    {type.requires_fasting && (
                                        <Text style={styles.fastingWarning}>
                                            ⚠️ Jeûne requis
                                        </Text>
                                    )}
                                </View>
                                <NativeButton
                                    title="Réserver"
                                    onPress={() => handleBookExamination(type)}
                                    variant="outline"
                                    size="small"
                                />
                            </TouchableOpacity>
                        ))}
                    </NativeCard>
                )}

                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="📅 Réserver un rendez-vous"
                        onPress={handleBook}
                        disabled={booking || !laboratoire.is_available_now}
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
                    <NativeButton
                        title="📋 Mes examens"
                        onPress={handleViewMyExaminations}
                        variant="outline"
                        style={styles.myExaminationsButton}
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
                    {laboratoire.telephone && (
                        <NativeButton
                            title="📞 Appeler"
                            onPress={handleCall}
                            variant="outline"
                            style={styles.callButton}
                        />
                    )}
                </View>

                {/* ✅ 2025-01-27: Section Avis et Commentaires */}
                {laboratoire.service_id && (
                    <ProductCommentsSection
                        serviceId={laboratoire.service_id}
                        serviceTitle={laboratoire.nom}
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
                        id: laboratoire.service_id,
                        nom: laboratoire.nom,
                        type: 'laboratoire',
                    }}
                    prestataireInfo={prestataireInfo || {
                        id: laboratoire.user_id,
                        nom: laboratoire.nom,
                    }}
                    user={user}
                    conversationId={conversationId}
                />
            )}

            {/* Modal pour réserver un examen */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showBookingModal}
                onRequestClose={() => {
                    setShowBookingModal(false);
                    setSelectedExamination(null);
                    setBookingNotes('');
                }}
            >
                <View style={styles.modalBackground}>
                    <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalScrollContent}>
                        <Text style={styles.modalTitle}>Réserver un examen</Text>

                        {selectedExamination && (
                            <View style={styles.examinationBookingInfo}>
                                <Text style={styles.examinationBookingName}>{selectedExamination.name}</Text>
                                {selectedExamination.category && (
                                    <Text style={styles.examinationBookingCategory}>
                                        Catégorie: {selectedExamination.category}
                                    </Text>
                                )}
                                {selectedExamination.price && (
                                    <Text style={styles.examinationBookingPrice}>
                                        Prix: {selectedExamination.price} XAF
                                    </Text>
                                )}
                                {selectedExamination.requires_fasting && (
                                    <Text style={styles.examinationBookingFasting}>
                                        ⚠️ Jeûne requis avant l'examen
                                    </Text>
                                )}
                                {selectedExamination.preparation_instructions && (
                                    <View style={styles.preparationInstructions}>
                                        <Text style={styles.preparationTitle}>Instructions de préparation:</Text>
                                        <Text style={styles.preparationText}>
                                            {selectedExamination.preparation_instructions}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={styles.notesContainer}>
                            <Text style={styles.notesLabel}>Notes (optionnel)</Text>
                            <NativeInput
                                placeholder="Ajoutez des notes pour le laboratoire..."
                                value={bookingNotes}
                                onChangeText={setBookingNotes}
                                multiline
                                style={styles.notesInput}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => {
                                    setShowBookingModal(false);
                                    setSelectedExamination(null);
                                    setBookingNotes('');
                                }}
                                variant="ghost"
                            />
                            <NativeButton
                                title="Confirmer la réservation"
                                onPress={handleConfirmBooking}
                                disabled={bookingExamination || !selectedExamination}
                            />
                        </View>
                        {bookingExamination && (
                            <ActivityIndicator size="small" color={modernColors.primary} style={styles.modalLoading} />
                        )}
                    </ScrollView>
                </View>
            </Modal>
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    titleContainer: {
        flex: 1,
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
    section: {
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
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    analyseChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F3E8FF',
    },
    analyseChipText: {
        fontSize: 12,
        color: '#7C3AED',
    },
    imagerieChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#DBEAFE',
    },
    imagerieChipText: {
        fontSize: 12,
        color: '#1E40AF',
    },
    badgesContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 8,
    },
    rdvBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        alignSelf: 'flex-start',
    },
    rdvBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#D97706',
    },
    resultatsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    resultatsText: {
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
    // ✅ 2025-01-27: Nouveaux styles pour les fonctionnalités avancées
    examinationTypeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    examinationTypeInfo: {
        flex: 1,
        marginRight: 12,
    },
    examinationTypeName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    examinationTypeCategory: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    examinationTypeDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 18,
    },
    examinationTypeDetails: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 4,
    },
    examinationTypePrice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#059669',
    },
    examinationTypeDuration: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    fastingWarning: {
        fontSize: 13,
        color: '#F59E0B',
        marginTop: 4,
        fontStyle: 'italic',
    },
    myExaminationsButton: {
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
    modalBackground: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
    },
    modalScrollContent: {
        paddingBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: modernColors.text,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 15,
    },
    modalLoading: {
        marginTop: 15,
    },
    examinationBookingInfo: {
        marginBottom: 20,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    examinationBookingName: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    examinationBookingCategory: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    examinationBookingPrice: {
        fontSize: 16,
        fontWeight: '600',
        color: '#059669',
        marginBottom: 4,
    },
    examinationBookingFasting: {
        fontSize: 14,
        color: '#F59E0B',
        marginTop: 8,
        fontStyle: 'italic',
    },
    preparationInstructions: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    preparationTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    preparationText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    notesContainer: {
        marginBottom: 20,
    },
    notesLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    notesInput: {
        minHeight: 100,
    },
});

export default LaboratoireDetailsScreen;

