import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { bloodDonationService } from '../../services/bloodDonationService';
import { modernColors } from '../../theme/modernTheme';

interface BloodDonationRequest {
    id: string;
    banque_sang_nom: string;
    groupe_sanguin_requis: string;
    quantite_requise: number;
    is_urgent: boolean;
    urgence_level: string;
    status: string;
    created_at: string;
    matches_count: number;
    accepted_matches_count: number;
}

interface UserBloodGroup {
    id: number;
    groupe_sanguin: string;
    is_available_for_donation: boolean;
    last_donation_date: string | null;
    next_donation_available_date: string | null;
}

const MyBloodDonationsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [requests, setRequests] = useState<BloodDonationRequest[]>([]);
    const [bloodGroup, setBloodGroup] = useState<UserBloodGroup | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

    useEffect(() => {
        loadData();
    }, [filter]);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([loadMyRequests(), loadBloodGroup()]);
        } catch (error: any) {
            console.error('[MyBloodDonationsScreen] Erreur chargement:', error);
            Alert.alert('Erreur', 'Impossible de charger vos demandes');
        } finally {
            setLoading(false);
        }
    };

    const loadMyRequests = async () => {
        try {
            // Pour l'instant, on charge toutes les demandes actives
            // TODO: Créer endpoint pour demandes de l'utilisateur spécifiquement
            const response = await apiGet('/api/blood-donation/requests?status=active');
            if (response.success && response.data) {
                let allRequests = (response.data as any).requests || [];

                // Filtrer selon le filtre sélectionné
                if (filter === 'active') {
                    allRequests = allRequests.filter((r: BloodDonationRequest) => r.status === 'active');
                } else if (filter === 'completed') {
                    allRequests = allRequests.filter((r: BloodDonationRequest) => r.status === 'completed');
                }

                setRequests(allRequests);
            }
        } catch (error: any) {
            console.error('[MyBloodDonationsScreen] Erreur chargement demandes:', error);
        }
    };

    const loadBloodGroup = async () => {
        try {
            const response = await apiGet('/api/blood-donation/donor/blood-groups');
            if (response.success && response.data) {
                const groups = (response.data as any).data || [];
                if (groups.length > 0) {
                    setBloodGroup(groups[0] as UserBloodGroup);
                }
            }
        } catch (error: any) {
            console.error('[MyBloodDonationsScreen] Erreur chargement groupe sanguin:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const canDonateAgain = () => {
        if (!bloodGroup || !bloodGroup.next_donation_available_date) return true;
        const nextDate = new Date(bloodGroup.next_donation_available_date);
        return nextDate <= new Date();
    };

    // === B1 - Programmer rappel prochain don ===
    const handleScheduleReminder = async () => {
        if (!bloodGroup?.last_donation_date) {
            Alert.alert('Rappel', 'Aucune date de dernier don enregistrée.');
            return;
        }
        try {
            const id = await bloodDonationService.scheduleNextDonationReminder(bloodGroup.last_donation_date);
            if (id) {
                const nextDate = new Date(bloodGroup.last_donation_date);
                nextDate.setDate(nextDate.getDate() + 90);
                Alert.alert(
                    'Rappel programmé',
                    `Vous serez notifié le ${nextDate.toLocaleDateString('fr-FR')} pour votre prochain don.`
                );
            } else {
                Alert.alert('Info', 'Vous pouvez déjà donner votre sang aujourd\'hui.');
            }
        } catch {
            Alert.alert('Erreur', 'Impossible de programmer le rappel.');
        }
    };

    const getNextDonationDate = (): string | null => {
        if (!bloodGroup?.last_donation_date) return null;
        const next = new Date(bloodGroup.last_donation_date);
        next.setDate(next.getDate() + 90);
        return next.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // === B5 - Générer certificat PDF ===
    const handleGenerateCertificate = async (donationId: string) => {
        try {
            const response = await bloodDonationService.getDonationCertificateData(Number(donationId));
            const cert = (response as any)?.data || {};
            const donorName = cert.donor_name || user?.name || 'Donneur';
            const donationDate = cert.donation_date ? formatDate(cert.donation_date) : formatDate(donationId);
            const bloodType = cert.blood_group || bloodGroup?.groupe_sanguin || 'N/A';
            const bankName = cert.banque_nom || 'Banque de Sang';
            const certNumber = cert.certificate_number || `CERT-${donationId}-${Date.now()}`;

            const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #111; }
    .header { text-align: center; border-bottom: 3px solid #DC2626; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 28px; font-weight: bold; color: #DC2626; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #6B7280; }
    .content { padding: 20px; background: #FEF2F2; border-radius: 8px; margin-bottom: 30px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .label { color: #6B7280; font-size: 13px; }
    .value { font-weight: bold; font-size: 14px; }
    .cert-number { text-align: center; font-size: 12px; color: #9CA3AF; margin-top: 20px; }
    .signature { margin-top: 40px; text-align: right; }
    .signature-line { border-top: 1px solid #111; width: 200px; margin-left: auto; padding-top: 4px; font-size: 12px; color: #6B7280; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">CERTIFICAT DE DON DE SANG</div>
    <div class="subtitle">Délivré par ${bankName}</div>
  </div>
  <p>Le présent certificat atteste que :</p>
  <div class="content">
    <div class="row"><span class="label">Nom du donneur</span><span class="value">${donorName}</span></div>
    <div class="row"><span class="label">Groupe sanguin</span><span class="value">${bloodType}</span></div>
    <div class="row"><span class="label">Date du don</span><span class="value">${donationDate}</span></div>
    <div class="row"><span class="label">Établissement</span><span class="value">${bankName}</span></div>
  </div>
  <p>a effectué un don de sang volontaire et bénévole, contribuant ainsi à sauver des vies.</p>
  <div class="signature">
    <div class="signature-line">Responsable médical - ${bankName}</div>
  </div>
  <div class="cert-number">N° ${certNumber}</div>
</body>
</html>`;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Certificat de don de sang' });
            } else {
                Alert.alert('PDF créé', `Fichier disponible : ${uri}`);
            }
        } catch (error: any) {
            console.error('[B5] Erreur génération PDF:', error);
            Alert.alert('Erreur', 'Impossible de générer le certificat PDF.');
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('myBloodDonations.mesDonsDeSang')}</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('myBloodDonations.chargement')}</Text>
                </View>
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
                <Text style={styles.title}>{t('myBloodDonations.mesDonsDeSang')}</Text>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {/* Carte groupe sanguin et disponibilité */}
                {bloodGroup && (
                    <View style={styles.bloodGroupCard}>
                        <View style={styles.bloodGroupHeader}>
                            <View style={styles.bloodGroupBadge}>
                                <Text style={styles.bloodGroupText}>{bloodGroup.groupe_sanguin}</Text>
                            </View>
                            <View style={styles.bloodGroupInfo}>
                                <Text style={styles.bloodGroupLabel}>{t('myBloodDonations.monGroupeSanguin')}</Text>
                                <Text style={styles.availabilityStatus}>
                                    {canDonateAgain()
                                        ? '✅ Disponible pour donner'
                                        : '⏳ Prochain don disponible'}
                                </Text>
                            </View>
                        </View>

                        {bloodGroup.last_donation_date && (
                            <View style={styles.donationInfo}>
                                <Text style={styles.donationLabel}>Dernier don</Text>
                                <Text style={styles.donationDate}>
                                    {formatDate(bloodGroup.last_donation_date)}
                                </Text>
                            </View>
                        )}

                        {bloodGroup.next_donation_available_date && !canDonateAgain() && (
                            <View style={styles.donationInfo}>
                                <Text style={styles.donationLabel}>Prochain don possible</Text>
                                <Text style={styles.donationDate}>
                                    {formatDate(bloodGroup.next_donation_available_date)}
                                </Text>
                            </View>
                        )}

                        <NativeButton
                            title={t('myBloodDonations.gererMonGroupeSanguin')}
                            onPress={() => {
                                navigation.navigate('BloodGroupManagement' as never);
                            }}
                            variant="outline"
                            size="medium"
                            style={styles.manageButton}
                        />
                    </View>
                )}

                {/* Statistiques */}
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{requests.length}</Text>
                        <Text style={styles.statLabel}>{t('myBloodDonations.demandesCreees')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: '#10B981' }]}>
                            {requests.reduce((sum, r) => sum + r.accepted_matches_count, 0)}
                        </Text>
                        <Text style={styles.statLabel}>{t('myBloodDonations.matchesAcceptes')}</Text>
                    </View>
                </View>

                {/* Filtres */}
                <View style={styles.filtersContainer}>
                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                        onPress={() => setFilter('all')}
                    >
                        <Text
                            style={[
                                styles.filterButtonText,
                                filter === 'all' && styles.filterButtonTextActive,
                            ]}
                        >
                            Toutes
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'active' && styles.filterButtonActive]}
                        onPress={() => setFilter('active')}
                    >
                        <Text
                            style={[
                                styles.filterButtonText,
                                filter === 'active' && styles.filterButtonTextActive,
                            ]}
                        >
                            Actives
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
                        onPress={() => setFilter('completed')}
                    >
                        <Text
                            style={[
                                styles.filterButtonText,
                                filter === 'completed' && styles.filterButtonTextActive,
                            ]}
                        >
                            Complétées
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Liste des demandes */}
                {requests.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="droplet" size={48} color="#9CA3AF" />
                        <Text style={styles.emptyText}>{t('myBloodDonations.aucuneDemandeDeDon')}</Text>
                        <Text style={styles.emptySubtext}>
                            Créez votre première demande de don de sang
                        </Text>
                        <NativeButton
                            title={t('myBloodDonations.creerUneDemande')}
                            onPress={() => {
                                navigation.navigate('BloodDonationRequest' as never);
                            }}
                            variant="primary"
                            size="medium"
                            style={styles.createButton}
                        />
                    </View>
                ) : (
                    requests.map((request) => (
                        <TouchableOpacity
                            key={request.id}
                            style={styles.requestCard}
                            onPress={() => {
                                navigation.navigate('BloodDonationMatches' as never, {
                                    requestId: request.id,
                                } as never);
                            }}
                        >
                            <View style={styles.requestHeader}>
                                <View style={styles.requestHeaderLeft}>
                                    <View style={[styles.bloodGroupBadgeSmall, { borderColor: '#DC2626' }]}>
                                        <Text style={[styles.bloodGroupTextSmall, { color: '#DC2626' }]}>
                                            {request.groupe_sanguin_requis}
                                        </Text>
                                    </View>
                                    <View style={styles.requestInfo}>
                                        <Text style={styles.requestTitle}>{request.banque_sang_nom}</Text>
                                        <Text style={styles.requestDate}>
                                            {formatDate(request.created_at)}
                                        </Text>
                                    </View>
                                </View>
                                {request.is_urgent && (
                                    <View style={styles.urgentBadge}>
                                        <Text style={styles.urgentBadgeText}>URGENT</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.requestStats}>
                                <View style={styles.requestStatItem}>
                                    <SafeIcon name="users" size={16} color="#6B7280" />
                                    <Text style={styles.requestStatText}>
                                        {request.matches_count} matches
                                    </Text>
                                </View>
                                <View style={styles.requestStatItem}>
                                    <SafeIcon name="check-circle" size={16} color="#10B981" />
                                    <Text style={[styles.requestStatText, { color: '#10B981' }]}>
                                        {request.accepted_matches_count} acceptés
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.requestFooter}>
                                <View
                                    style={[
                                        styles.statusBadge,
                                        {
                                            backgroundColor:
                                                request.status === 'active'
                                                    ? '#EEF2FF'
                                                    : request.status === 'completed'
                                                        ? '#F0FDF4'
                                                        : '#F3F4F6',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            {
                                                color:
                                                    request.status === 'active'
                                                        ? '#6366F1'
                                                        : request.status === 'completed'
                                                            ? '#10B981'
                                                            : '#6B7280',
                                            },
                                        ]}
                                    >
                                        {request.status === 'active' ? 'Active' : t('myBloodDonationsScreen.completee')}
                                    </Text>
                                </View>
                                <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                            </View>
                        </TouchableOpacity>
                    ))
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    bloodGroupCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    bloodGroupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    bloodGroupBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
    },
    bloodGroupText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#DC2626',
    },
    bloodGroupInfo: {
        flex: 1,
    },
    bloodGroupLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    availabilityStatus: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    donationInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        marginTop: 8,
    },
    donationLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    donationDate: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    manageButton: {
        marginTop: 12,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 16,
    },
    filtersContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    filterButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    filterButtonActive: {
        borderColor: modernColors.primary,
        backgroundColor: `${modernColors.primary}10`,
    },
    filterButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterButtonTextActive: {
        color: modernColors.primary,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    createButton: {
        marginTop: 8,
    },
    requestCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    requestHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    bloodGroupBadgeSmall: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
    },
    bloodGroupTextSmall: {
        fontSize: 12,
        fontWeight: '700',
    },
    requestInfo: {
        flex: 1,
    },
    requestTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    requestDate: {
        fontSize: 12,
        color: '#6B7280',
    },
    urgentBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#EF4444',
    },
    urgentBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
    requestStats: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    requestStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    requestStatText: {
        fontSize: 12,
        color: '#6B7280',
    },
    requestFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
});

export default MyBloodDonationsScreen;

