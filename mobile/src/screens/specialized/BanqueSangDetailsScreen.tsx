// ✅ Détails d'une banque de sang avec boutons d'action (Mobile)
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
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface BanqueSangDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    stocks?: Record<string, number>;
    telephone?: string;
    email?: string;
}

const BanqueSangDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;

    const [banque, setBanque] = useState<BanqueSangDetails | null>(null);
    const [loading, setLoading] = useState(true);
    // ✅ 2025-01-27: Chat et Avis
    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [prestataireInfo, setPrestataireInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);

    useEffect(() => {
        loadBanqueDetails();
    }, []);

    // ✅ 2025-01-27: Charger infos prestataire et statistiques ratings
    useEffect(() => {
        if (banque) {
            loadPrestataireInfo();
            loadRatingStats();
        }
    }, [banque]);

    const loadBanqueDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/banques-sang/${params.banqueId}`);

            if (response.success && response.data) {
                setBanque(response.data);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails de la banque de sang');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[BanqueSangDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleCall = () => {
        if (banque?.telephone) {
            Linking.openURL(`tel:${banque.telephone}`);
        }
    };

    const handleRequestDonation = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour faire une demande de don');
            navigation.navigate('Login' as never);
            return;
        }
        navigation.navigate('BloodDonation' as never);
    };

    // ✅ 2025-01-27: Charger infos prestataire
    const loadPrestataireInfo = async () => {
        if (!banque?.user_id) return;
        try {
            const response = await apiGet(`/api/users/${banque.user_id}`);
            if (response.success && response.data) {
                setPrestataireInfo(response.data);
            }
        } catch (error: any) {
            console.warn('[BanqueSangDetailsScreen] Impossible de charger prestataire:', error);
        }
    };

    // ✅ 2025-01-27: Charger statistiques ratings
    const loadRatingStats = async () => {
        if (!banque?.service_id) return;
        try {
            const response = await apiGet(`/api/specialized-services/${banque.service_id}/ratings/stats`);
            if (response.success && response.data) {
                const data = response.data as any;
                setRatingStats(data.stats || data);
            }
        } catch (error: any) {
            console.warn('[BanqueSangDetailsScreen] Impossible de charger stats ratings:', error);
        }
    };

    // ✅ 2025-01-27: Ouvrir chat
    const handleOpenChat = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour contacter la banque de sang');
            navigation.navigate('Login' as never);
            return;
        }
        setShowChat(true);
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!banque) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Banque de sang non trouvée</Text>
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
                        <SafeIcon name="droplet" size={32} color="#DC2626" />
                        <View style={styles.titleContainer}>
                            <Text style={styles.nom}>{banque.nom}</Text>
                        </View>
                    </View>

                    <View style={styles.badgesRow}>
                        <View style={[styles.statusBadge, banque.is_available_now && styles.statusBadgeAvailable]}>
                            <Text style={[styles.statusText, banque.is_available_now && styles.statusTextAvailable]}>
                                {banque.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Text>
                        </View>
                    </View>

                    {(banque.adresse || banque.ville || banque.quartier) && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <View style={styles.infoContent}>
                                {banque.adresse && <Text style={styles.infoText}>{banque.adresse}</Text>}
                                <Text style={styles.infoSubtext}>
                                    {[banque.quartier, banque.ville].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                        </View>
                    )}

                    {banque.gps && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{banque.gps}</Text>
                        </View>
                    )}

                    {banque.telephone && (
                        <TouchableOpacity style={styles.infoRow} onPress={handleCall}>
                            <SafeIcon name="phone" size={20} color={modernColors.primary} />
                            <Text style={[styles.infoText, styles.linkText]}>{banque.telephone}</Text>
                        </TouchableOpacity>
                    )}

                    {banque.email && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="mail" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{banque.email}</Text>
                        </View>
                    )}

                    {banque.stocks && Object.keys(banque.stocks).length > 0 && (
                        <View style={styles.stocksSection}>
                            <Text style={styles.sectionTitle}>Stocks disponibles</Text>
                            <View style={styles.stocksGrid}>
                                {Object.entries(banque.stocks).map(([groupe, qty]) => (
                                    <View key={groupe} style={styles.stockCard}>
                                        <Text style={styles.stockGroupe}>{groupe}</Text>
                                        <Text style={styles.stockQty}>{qty} unités</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </NativeCard>

                <View style={styles.actionsContainer}>
                    <NativeButton onPress={handleRequestDonation} style={styles.actionButton}>
                        <SafeIcon name="droplet" size={20} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Faire une demande de don</Text>
                    </NativeButton>
                    {/* ✅ 2025-01-27: Bouton Contacter */}
                    <NativeButton
                        title="💬 Contacter"
                        onPress={handleOpenChat}
                        variant="outline"
                        style={styles.contactButton}
                    />
                    {banque.telephone && (
                        <NativeButton onPress={handleCall} style={[styles.actionButton, styles.actionButtonSecondary]}>
                            <SafeIcon name="phone" size={20} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Appeler</Text>
                        </NativeButton>
                    )}
                </View>

                {/* ✅ 2025-01-27: Section Avis et Commentaires */}
                {banque.service_id && (
                    <ProductCommentsSection
                        serviceId={banque.service_id}
                        serviceTitle={banque.nom}
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
                        id: banque.service_id,
                        nom: banque.nom,
                        type: 'banque_sang',
                    }}
                    prestataireInfo={prestataireInfo || {
                        id: banque.user_id,
                        nom: banque.nom,
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
    stocksSection: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    stocksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    stockCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
    },
    stockGroupe: {
        fontSize: 14,
        fontWeight: '600',
        color: '#991B1B',
        marginBottom: 4,
    },
    stockQty: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#DC2626',
    },
    actionsContainer: {
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    actionButtonSecondary: {
        backgroundColor: modernColors.primary,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    contactButton: {
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
});

export default BanqueSangDetailsScreen;

