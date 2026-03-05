// ✅ Détails d'un troc avec actions (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface TrocDetails {
    troc: {
        id: number;
        type_troc: string;
        statut: string;
        livre_offert_id: number;
        livre_souhaite_id: number;
        participant_id?: number;
        initiateur_id: number;
        chaine_troc_id?: number;
        distance_km?: number;
        validation_initiateur: boolean;
        validation_participant: boolean;
        created_at: string;
    };
    livre_offert?: any;
    livre_souhaite?: any;
    initiateur?: any;
    participant?: any;
    chaine?: any;
}

const TrocDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;
    const trocId = params?.trocId as number;
    const typeTroc = params?.typeTroc as string;

    const [loading, setLoading] = useState(true);
    const [troc, setTroc] = useState<TrocDetails | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        loadTrocDetails();
    }, [trocId, typeTroc]);

    const loadTrocDetails = async () => {
        try {
            setLoading(true);
            const endpoint = typeTroc === 'chaine' && params?.chaineId
                ? `/api/troc-livres/chaines/${params.chaineId}`
                : `/api/troc-livres/${trocId}`;

            const response = await apiGet(endpoint);

            const r = response.data as any;
            if (response.success && r) {
                setTroc(r);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails du troc');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[TrocDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        try {
            setActionLoading(true);
            const response = await apiPost(`/api/troc-livres/${trocId}/accept`, {});

            if (response.success) {
                Alert.alert('Succès', 'Troc accepté !');
                loadTrocDetails();
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'accepter le troc');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRefuse = async () => {
        Alert.alert(
            'Refuser le troc',
            'Êtes-vous sûr de vouloir refuser ce troc ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Refuser',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setActionLoading(true);
                            const response = await apiPost(`/api/troc-livres/${trocId}/refuse`, {});

                            if (response.success) {
                                Alert.alert('Succès', 'Troc refusé');
                                navigation.goBack();
                            } else {
                                Alert.alert('Erreur', response.error || 'Impossible de refuser le troc');
                            }
                        } catch (error: any) {
                            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleComplete = async () => {
        Alert.alert(
            'Finaliser le troc',
            'Confirmez-vous que l\'échange a été effectué ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Confirmer',
                    onPress: async () => {
                        try {
                            setActionLoading(true);
                            const response = await apiPost(`/api/troc-livres/${trocId}/complete`, {});

                            if (response.success) {
                                Alert.alert('Succès', 'Troc finalisé avec succès !');
                                loadTrocDetails();
                            } else {
                                Alert.alert('Erreur', response.error || 'Impossible de finaliser le troc');
                            }
                        } catch (error: any) {
                            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const getStatutColor = (statut: string): string => {
        switch (statut) {
            case 'en_attente': return modernColors.warning;
            case 'accepte': return modernColors.success;
            case 'refuse': return modernColors.error;
            case 'complete': return modernColors.primary;
            case 'annule': return modernColors.textSecondary;
            default: return modernColors.textSecondary;
        }
    };

    const getStatutLabel = (statut: string): string => {
        switch (statut) {
            case 'en_attente': return 'En attente';
            case 'accepte': return 'Accepté';
            case 'refuse': return 'Refusé';
            case 'complete': return 'Complété';
            case 'annule': return 'Annulé';
            default: return statut;
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!troc) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Troc non trouvé</Text>
            </View>
        );
    }

    const isInitiateur = user?.id === troc.troc.initiateur_id;
    const canAccept = !isInitiateur && troc.troc.statut === 'en_attente';
    const canRefuse = troc.troc.statut === 'en_attente';
    const canComplete = troc.troc.statut === 'accepte';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Détails du troc</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Statut */}
                <NativeCard style={styles.card}>
                    <View style={[
                        styles.statutBadge,
                        { backgroundColor: getStatutColor(troc.troc.statut) + '20' }
                    ]}>
                        <Text style={[
                            styles.statutText,
                            { color: getStatutColor(troc.troc.statut) }
                        ]}>
                            {getStatutLabel(troc.troc.statut)}
                        </Text>
                    </View>
                    {troc.troc.type_troc === 'chaine' && (
                        <View style={styles.chaineBadge}>
                            <SafeIcon name="link" size={16} color={modernColors.primary} />
                            <Text style={styles.chaineText}>Chaîne de troc</Text>
                        </View>
                    )}
                </NativeCard>

                {/* Échange */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>📚 Échange</Text>
                    <View style={styles.exchangeRow}>
                        <View style={styles.livreCard}>
                            <Text style={styles.livreLabel}>
                                {isInitiateur ? 'Vous offrez' : 'Vous recevez'}
                            </Text>
                            <Text style={styles.livreTitle}>
                                {troc.livre_offert?.titre || 'Livre offert'}
                            </Text>
                            {troc.livre_offert && (
                                <Text style={styles.livreMeta}>
                                    📖 {troc.livre_offert.classe_actuelle} → {troc.livre_offert.classe_souhaitee}
                                </Text>
                            )}
                        </View>
                        <SafeIcon name="arrow-right" size={24} color={modernColors.primary} />
                        <View style={styles.livreCard}>
                            <Text style={styles.livreLabel}>
                                {isInitiateur ? 'Vous recevez' : 'Vous offrez'}
                            </Text>
                            <Text style={styles.livreTitle}>
                                {troc.livre_souhaite?.titre || 'Livre souhaité'}
                            </Text>
                            {troc.livre_souhaite && (
                                <Text style={styles.livreMeta}>
                                    📖 {troc.livre_souhaite.classe_actuelle} → {troc.livre_souhaite.classe_souhaitee}
                                </Text>
                            )}
                        </View>
                    </View>
                </NativeCard>

                {/* Informations */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>ℹ️ Informations</Text>
                    {troc.troc.distance_km && (
                        <Text style={styles.infoText}>
                            📍 Distance: {troc.troc.distance_km.toFixed(1)} km
                        </Text>
                    )}
                    <Text style={styles.infoText}>
                        📅 Créé le: {new Date(troc.troc.created_at).toLocaleDateString()}
                    </Text>
                </NativeCard>

                {/* Validations */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>✅ Validations</Text>
                    <View style={styles.validationRow}>
                        <View style={[
                            styles.validationBadge,
                            troc.troc.validation_initiateur && styles.validationBadgeValid
                        ]}>
                            <Text style={[
                                styles.validationText,
                                troc.troc.validation_initiateur && styles.validationTextValid
                            ]}>
                                {troc.troc.validation_initiateur ? '✓' : '○'} Initiateur
                            </Text>
                        </View>
                        <View style={[
                            styles.validationBadge,
                            troc.troc.validation_participant && styles.validationBadgeValid
                        ]}>
                            <Text style={[
                                styles.validationText,
                                troc.troc.validation_participant && styles.validationTextValid
                            ]}>
                                {troc.troc.validation_participant ? '✓' : '○'} Participant
                            </Text>
                        </View>
                    </View>
                </NativeCard>

                {/* Actions */}
                {(canAccept || canRefuse || canComplete) && (
                    <View style={styles.actions}>
                        {canAccept && (
                            <NativeButton
                                title="✅ Accepter le troc"
                                variant="primary"
                                onPress={handleAccept}
                                style={styles.actionButton}
                                disabled={actionLoading}
                            />
                        )}
                        {canRefuse && (
                            <NativeButton
                                title="❌ Refuser le troc"
                                variant="outline"
                                onPress={handleRefuse}
                                style={styles.actionButton}
                                disabled={actionLoading}
                            />
                        )}
                        {canComplete && (
                            <NativeButton
                                title="✅ Finaliser l'échange"
                                variant="primary"
                                onPress={handleComplete}
                                style={styles.actionButton}
                                disabled={actionLoading}
                            />
                        )}
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
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        gap: 16,
    },
    card: {
        padding: 16,
        gap: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    statutBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    statutText: {
        fontSize: 14,
        fontWeight: '600',
    },
    chaineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        padding: 8,
        borderRadius: 8,
        backgroundColor: modernColors.primary + '20',
    },
    chaineText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    exchangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    livreCard: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        gap: 8,
    },
    livreLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    livreTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    livreMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    infoText: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 4,
    },
    validationRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    validationBadge: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    validationBadgeValid: {
        backgroundColor: modernColors.success + '20',
        borderColor: modernColors.success,
    },
    validationText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    validationTextValid: {
        color: modernColors.success,
        fontWeight: '600',
    },
    actions: {
        gap: 12,
        marginTop: 8,
    },
    actionButton: {
        width: '100%',
    },
});

export default TrocDetailsScreen;

