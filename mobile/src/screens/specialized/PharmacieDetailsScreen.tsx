// ✅ Détails d'une pharmacie avec boutons d'action (Mobile)
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
import { NativeButton, NativeCard, NativeInput } from '../../components/NativeDesign';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import {
    MedicationAvailability,
    MedicationInteraction,
    pharmacyService
} from '../../services/pharmacyService';
import { modernColors } from '../../theme/modernTheme';

interface PharmacieDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    is_on_duty: boolean;
    telephone?: string;
    telephone_urgence?: string;
    email?: string;
}

const PharmacieDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;

    const [pharmacie, setPharmacie] = useState<PharmacieDetails | null>(null);
    const [loading, setLoading] = useState(true);
    // ✅ 2025-01-27: Nouvelles fonctionnalités
    const [searchMedication, setSearchMedication] = useState('');
    const [medicationAvailability, setMedicationAvailability] = useState<MedicationAvailability | null>(null);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showInteractionsModal, setShowInteractionsModal] = useState(false);
    const [medicationsForInteraction, setMedicationsForInteraction] = useState<string[]>([]);
    const [medicationInput, setMedicationInput] = useState('');
    const [checkingInteractions, setCheckingInteractions] = useState(false);
    const [interactionResult, setInteractionResult] = useState<MedicationInteraction | null>(null);
    // ✅ 2025-01-27: Chat et Avis
    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [prestataireInfo, setPrestataireInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);

    useEffect(() => {
        loadPharmacieDetails();
    }, []);

    // ✅ 2025-01-27: Charger infos prestataire et statistiques ratings
    useEffect(() => {
        if (pharmacie) {
            loadPrestataireInfo();
            loadRatingStats();
        }
    }, [pharmacie]);

    const loadPharmacieDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/pharmacies/${params.pharmacieId}`);

            if (response.success && response.data) {
                setPharmacie(response.data as PharmacieDetails);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails de la pharmacie');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[PharmacieDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleCall = () => {
        if (pharmacie?.telephone) {
            Linking.openURL(`tel:${pharmacie.telephone}`);
        }
    };

    // ✅ 2025-01-27: Vérifier disponibilité d'un médicament
    const handleCheckAvailability = async () => {
        if (!searchMedication.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer le nom d\'un médicament');
            return;
        }

        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour vérifier la disponibilité');
            navigation.navigate('Login' as never);
            return;
        }

        setCheckingAvailability(true);
        try {
            const response = await pharmacyService.checkAvailability(
                params.pharmacieId,
                searchMedication.trim()
            );

            if (response.success && response.data) {
                setMedicationAvailability(response.data);
                setShowSearchModal(false);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de vérifier la disponibilité');
            }
        } catch (error: any) {
            console.error('[PharmacieDetailsScreen] Erreur vérification disponibilité:', error);
            Alert.alert('Erreur', error.message || 'Impossible de vérifier la disponibilité');
        } finally {
            setCheckingAvailability(false);
        }
    };

    // ✅ 2025-01-27: Réserver un médicament
    const handleReserveMedication = async () => {
        if (!medicationAvailability?.available || !user) {
            Alert.alert('Erreur', 'Médicament non disponible ou connexion requise');
            return;
        }

        try {
            const response = await pharmacyService.reserveMedication(
                params.pharmacieId,
                medicationAvailability.medication.name,
                medicationAvailability.requested_quantity || 1
            );

            if (response.success && response.data) {
                Alert.alert(
                    'Réservation réussie',
                    `Votre réservation (ID: ${response.data.reservation_id}) expire le ${new Date(response.data.expiry_time).toLocaleString()}`
                );
                setMedicationAvailability(null);
                setSearchMedication('');
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de réserver le médicament');
            }
        } catch (error: any) {
            console.error('[PharmacieDetailsScreen] Erreur réservation:', error);
            Alert.alert('Erreur', error.message || 'Impossible de réserver le médicament');
        }
    };

    // ✅ 2025-01-27: Vérifier interactions médicamenteuses (IA)
    const handleCheckInteractions = async () => {
        if (medicationsForInteraction.length === 0) {
            Alert.alert('Erreur', 'Veuillez ajouter au moins un médicament');
            return;
        }

        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour vérifier les interactions');
            navigation.navigate('Login' as never);
            return;
        }

        setCheckingInteractions(true);
        try {
            const response = await pharmacyService.checkInteractions(medicationsForInteraction);

            if (response.success && response.data) {
                setInteractionResult(response.data.interaction);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de vérifier les interactions');
            }
        } catch (error: any) {
            console.error('[PharmacieDetailsScreen] Erreur vérification interactions:', error);
            Alert.alert('Erreur', error.message || 'Impossible de vérifier les interactions');
        } finally {
            setCheckingInteractions(false);
        }
    };

    const addMedicationForInteraction = () => {
        if (medicationInput.trim() && !medicationsForInteraction.includes(medicationInput.trim())) {
            setMedicationsForInteraction([...medicationsForInteraction, medicationInput.trim()]);
            setMedicationInput('');
        }
    };

    const removeMedicationForInteraction = (medication: string) => {
        setMedicationsForInteraction(medicationsForInteraction.filter(m => m !== medication));
    };

    // ✅ 2025-01-27: Navigation vers analytics (prestataire uniquement)
    const handleViewAnalytics = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir les analytics');
            navigation.navigate('Login' as never);
            return;
        }
        navigation.navigate('PharmacyAnalytics' as never, {
            pharmacyId: params.pharmacieId,
        } as never);
    };

    // ✅ 2025-01-27: Charger infos prestataire
    const loadPrestataireInfo = async () => {
        if (!pharmacie?.user_id) return;
        try {
            const response = await apiGet(`/api/users/${pharmacie.user_id}`);
            if (response.success && response.data) {
                setPrestataireInfo(response.data);
            }
        } catch (error: any) {
            console.warn('[PharmacieDetailsScreen] Impossible de charger prestataire:', error);
        }
    };

    // ✅ 2025-01-27: Charger statistiques ratings
    const loadRatingStats = async () => {
        if (!pharmacie?.service_id) return;
        try {
            const response = await apiGet(`/api/specialized-services/${pharmacie.service_id}/ratings/stats`);
            if (response.success && response.data) {
                const data = response.data as any;
                setRatingStats(data.stats || data);
            }
        } catch (error: any) {
            console.warn('[PharmacieDetailsScreen] Impossible de charger stats ratings:', error);
        }
    };

    // ✅ 2025-01-27: Ouvrir chat
    const handleOpenChat = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour contacter la pharmacie');
            navigation.navigate('Login' as never);
            return;
        }
        setShowChat(true);
    };

    // Vérifier si l'utilisateur est le propriétaire
    const isOwner = user && pharmacie && String(user.id) === String(pharmacie.user_id);

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!pharmacie) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Pharmacie non trouvée</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Détails</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <NativeCard style={styles.detailsCard}>
                    <View style={styles.titleRow}>
                        <SafeIcon name="pill" size={32} color={modernColors.primary} />
                        <View style={styles.titleContainer}>
                            <Text style={styles.nom}>{pharmacie.nom}</Text>
                        </View>
                    </View>

                    <View style={styles.badgesRow}>
                        <View style={[styles.statusBadge, pharmacie.is_available_now && styles.statusBadgeAvailable]}>
                            <Text style={[styles.statusText, pharmacie.is_available_now && styles.statusTextAvailable]}>
                                {pharmacie.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Text>
                        </View>
                        {pharmacie.is_on_duty && (
                            <View style={styles.dutyBadge}>
                                <Text style={styles.dutyText}>De garde</Text>
                            </View>
                        )}
                    </View>

                    {(pharmacie.adresse || pharmacie.ville || pharmacie.quartier) && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <View style={styles.infoContent}>
                                {pharmacie.adresse && <Text style={styles.infoText}>{pharmacie.adresse}</Text>}
                                <Text style={styles.infoSubtext}>
                                    {[pharmacie.quartier, pharmacie.ville].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                        </View>
                    )}

                    {pharmacie.gps && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{pharmacie.gps}</Text>
                        </View>
                    )}

                    {pharmacie.telephone && (
                        <TouchableOpacity style={styles.infoRow} onPress={handleCall}>
                            <SafeIcon name="phone" size={20} color={modernColors.primary} />
                            <Text style={[styles.infoText, styles.linkText]}>{pharmacie.telephone}</Text>
                        </TouchableOpacity>
                    )}

                    {pharmacie.telephone_urgence && (
                        <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${pharmacie.telephone_urgence}`)}>
                            <SafeIcon name="phone" size={20} color="#DC2626" />
                            <Text style={[styles.infoText, styles.urgenceText]}>
                                Urgences: {pharmacie.telephone_urgence}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {pharmacie.email && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="mail" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{pharmacie.email}</Text>
                        </View>
                    )}
                </NativeCard>

                {/* ✅ 2025-01-27: Section Recherche Médicaments */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>🔍 Rechercher un médicament</Text>
                    <View style={styles.searchRow}>
                        <NativeInput
                            placeholder="Nom du médicament ou DCI"
                            value={searchMedication}
                            onChangeText={setSearchMedication}
                            style={styles.searchInput}
                        />
                        <NativeButton
                            title="Vérifier"
                            onPress={() => setShowSearchModal(true)}
                            variant="primary"
                            size="small"
                            disabled={!searchMedication.trim()}
                        />
                    </View>

                    {medicationAvailability && (
                        <View style={styles.availabilityResult}>
                            <View style={styles.availabilityHeader}>
                                <SafeIcon
                                    name={medicationAvailability.available ? 'check-circle' : 'x-circle'}
                                    size={24}
                                    color={medicationAvailability.available ? '#059669' : '#DC2626'}
                                />
                                <Text style={[
                                    styles.availabilityStatus,
                                    medicationAvailability.available ? styles.availabilityStatusAvailable : styles.availabilityStatusUnavailable
                                ]}>
                                    {medicationAvailability.available ? '✅ Disponible' : '❌ Indisponible'}
                                </Text>
                            </View>

                            {medicationAvailability.available && (
                                <>
                                    <View style={styles.availabilityInfo}>
                                        <Text style={styles.availabilityLabel}>Médicament:</Text>
                                        <Text style={styles.availabilityValue}>
                                            {medicationAvailability.medication.name}
                                        </Text>
                                    </View>
                                    {medicationAvailability.medication.dci && (
                                        <View style={styles.availabilityInfo}>
                                            <Text style={styles.availabilityLabel}>DCI:</Text>
                                            <Text style={styles.availabilityValue}>
                                                {medicationAvailability.medication.dci}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.availabilityInfo}>
                                        <Text style={styles.availabilityLabel}>Stock:</Text>
                                        <Text style={styles.availabilityValue}>
                                            {medicationAvailability.medication.stock_quantity} unité(s)
                                        </Text>
                                    </View>
                                    {medicationAvailability.medication.price && (
                                        <View style={styles.availabilityInfo}>
                                            <Text style={styles.availabilityLabel}>Prix:</Text>
                                            <Text style={styles.availabilityValue}>
                                                {medicationAvailability.medication.price} XAF
                                            </Text>
                                        </View>
                                    )}
                                    {medicationAvailability.medication.requires_prescription && (
                                        <Text style={styles.prescriptionWarning}>
                                            ⚠️ Prescription médicale requise
                                        </Text>
                                    )}
                                    <NativeButton
                                        title="Réserver ce médicament"
                                        onPress={handleReserveMedication}
                                        variant="primary"
                                        style={styles.reserveButton}
                                    />
                                </>
                            )}
                        </View>
                    )}
                </NativeCard>

                {/* ✅ 2025-01-27: Section Actions Rapides */}
                <View style={styles.actionsContainer}>
                    {pharmacie.telephone && (
                        <NativeButton
                            title="📞 Appeler"
                            onPress={handleCall}
                            style={styles.actionButton}
                            variant="primary"
                        />
                    )}
                    {/* ✅ 2025-01-27: Bouton Contacter */}
                    <NativeButton
                        title="💬 Contacter"
                        onPress={handleOpenChat}
                        variant="outline"
                        style={styles.contactButton}
                    />
                    <NativeButton
                        title="⚕️ Vérifier interactions (IA)"
                        onPress={() => navigation.navigate('PharmacyAIInteractions' as never)}
                        variant="outline"
                        style={styles.aiButton}
                    />
                    <NativeButton
                        title="📋 Mes commandes"
                        onPress={() => {
                            if (!user) {
                                Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir vos commandes');
                                navigation.navigate('Login' as never);
                                return;
                            }
                            navigation.navigate('MyPharmacyOrders' as never);
                        }}
                        variant="outline"
                        style={styles.myOrdersButton}
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
                </View>

                {/* ✅ 2025-01-27: Section Avis et Commentaires */}
                {pharmacie.service_id && (
                    <ProductCommentsSection
                        serviceId={pharmacie.service_id}
                        serviceTitle={pharmacie.nom}
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
                        id: pharmacie.service_id,
                        nom: pharmacie.nom,
                        type: 'pharmacie',
                    }}
                    prestataireInfo={prestataireInfo || {
                        id: pharmacie.user_id,
                        nom: pharmacie.nom,
                    }}
                    user={user}
                    conversationId={conversationId}
                />
            )}

            {/* Modal pour la recherche de médicament */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showSearchModal}
                onRequestClose={() => setShowSearchModal(false)}
            >
                <View style={styles.modalBackground}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Rechercher un médicament</Text>
                        <NativeInput
                            placeholder="Nom du médicament ou DCI"
                            value={searchMedication}
                            onChangeText={setSearchMedication}
                            style={styles.modalInput}
                        />
                        <View style={styles.modalActions}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => {
                                    setShowSearchModal(false);
                                    setSearchMedication('');
                                }}
                                variant="ghost"
                            />
                            <NativeButton
                                title="Vérifier disponibilité"
                                onPress={handleCheckAvailability}
                                disabled={checkingAvailability || !searchMedication.trim()}
                            />
                        </View>
                        {checkingAvailability && (
                            <ActivityIndicator size="small" color={modernColors.primary} style={styles.modalLoading} />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal pour vérifier interactions médicamenteuses */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showInteractionsModal}
                onRequestClose={() => setShowInteractionsModal(false)}
            >
                <View style={styles.modalBackground}>
                    <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalScrollContent}>
                        <Text style={styles.modalTitle}>Vérifier les interactions médicamenteuses</Text>

                        <View style={styles.interactionInputContainer}>
                            <NativeInput
                                placeholder="Nom du médicament"
                                value={medicationInput}
                                onChangeText={setMedicationInput}
                                style={styles.modalInput}
                            />
                            <NativeButton
                                title="Ajouter"
                                onPress={addMedicationForInteraction}
                                disabled={!medicationInput.trim()}
                                variant="primary"
                                size="small"
                            />
                        </View>

                        {medicationsForInteraction.length > 0 && (
                            <View style={styles.medicationsList}>
                                <Text style={styles.medicationsListTitle}>Médicaments ajoutés:</Text>
                                {medicationsForInteraction.map((med, idx) => (
                                    <View key={idx} style={styles.medicationTag}>
                                        <Text style={styles.medicationTagText}>{med}</Text>
                                        <TouchableOpacity onPress={() => removeMedicationForInteraction(med)}>
                                            <SafeIcon name="x" size={16} color={modernColors.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {interactionResult && (
                            <View style={styles.interactionResultContainer}>
                                <View style={[
                                    styles.severityBadge,
                                    interactionResult.severity === 'contraindicated' && styles.severityBadgeCritical,
                                    interactionResult.severity === 'major' && styles.severityBadgeHigh,
                                    interactionResult.severity === 'moderate' && styles.severityBadgeMedium,
                                ]}>
                                    <Text style={styles.severityText}>
                                        Sévérité: {
                                            interactionResult.severity === 'contraindicated' ? 'Contre-indiqué' :
                                                interactionResult.severity === 'major' ? 'Majeure' :
                                                    interactionResult.severity === 'moderate' ? 'Modérée' :
                                                        interactionResult.severity === 'minor' ? 'Mineure' : 'Aucune'
                                        }
                                    </Text>
                                </View>
                                <Text style={styles.interactionDescription}>
                                    {interactionResult.description}
                                </Text>
                                <Text style={styles.interactionRecommendation}>
                                    {interactionResult.recommendation}
                                </Text>
                                {interactionResult.alternative_suggestions.length > 0 && (
                                    <View style={styles.alternativesContainer}>
                                        <Text style={styles.alternativesTitle}>Alternatives suggérées:</Text>
                                        {interactionResult.alternative_suggestions.map((alt, idx) => (
                                            <Text key={idx} style={styles.alternativeItem}>• {alt}</Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <NativeButton
                                title="Fermer"
                                onPress={() => {
                                    setShowInteractionsModal(false);
                                    setMedicationsForInteraction([]);
                                    setInteractionResult(null);
                                }}
                                variant="ghost"
                            />
                            <NativeButton
                                title="Vérifier interactions"
                                onPress={handleCheckInteractions}
                                disabled={checkingInteractions || medicationsForInteraction.length === 0}
                            />
                        </View>
                        {checkingInteractions && (
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
    detailsCard: {
        padding: 20,
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    titleContainer: {
        flex: 1,
    },
    nom: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    badgesRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
    },
    statusBadgeAvailable: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '600',
    },
    statusTextAvailable: {
        color: '#065F46',
    },
    dutyBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#DBEAFE',
    },
    dutyText: {
        fontSize: 14,
        color: '#1E40AF',
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 12,
    },
    infoContent: {
        flex: 1,
    },
    infoText: {
        fontSize: 16,
        color: '#111827',
    },
    infoSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    linkText: {
        color: modernColors.primary,
    },
    urgenceText: {
        color: '#DC2626',
        fontWeight: '600',
    },
    actionsContainer: {
        gap: 12,
    },
    actionButton: {
        marginTop: 8,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    // ✅ 2025-01-27: Nouveaux styles pour les fonctionnalités avancées
    card: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 16,
    },
    searchRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
    },
    availabilityResult: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    availabilityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    availabilityStatus: {
        fontSize: 16,
        fontWeight: '600',
    },
    availabilityStatusAvailable: {
        color: '#059669',
    },
    availabilityStatusUnavailable: {
        color: '#DC2626',
    },
    availabilityInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    availabilityLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    availabilityValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    prescriptionWarning: {
        fontSize: 14,
        color: '#F59E0B',
        marginTop: 8,
        fontStyle: 'italic',
    },
    reserveButton: {
        marginTop: 12,
    },
    aiButton: {
        marginTop: 8,
        backgroundColor: modernColors.secondary,
        borderColor: modernColors.secondary,
    },
    myOrdersButton: {
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
    modalInput: {
        marginBottom: 15,
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
    interactionInputContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    medicationsList: {
        marginBottom: 16,
    },
    medicationsListTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: modernColors.text,
    },
    medicationTag: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginBottom: 8,
    },
    medicationTagText: {
        fontSize: 14,
        color: '#1E40AF',
        fontWeight: '500',
    },
    interactionResultContainer: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    severityBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginBottom: 12,
        alignSelf: 'flex-start',
    },
    severityBadgeCritical: {
        backgroundColor: '#FEE2E2',
    },
    severityBadgeHigh: {
        backgroundColor: '#FEF3C7',
    },
    severityBadgeMedium: {
        backgroundColor: '#DBEAFE',
    },
    severityText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    interactionDescription: {
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 12,
        lineHeight: 20,
    },
    interactionRecommendation: {
        fontSize: 14,
        color: '#059669',
        fontWeight: '600',
        marginBottom: 12,
        lineHeight: 20,
    },
    alternativesContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    alternativesTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: modernColors.text,
    },
    alternativeItem: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
});

export default PharmacieDetailsScreen;

