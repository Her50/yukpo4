// ✅ Écran Don de Sang - Profil donneur + Demandes urgentes + Matching
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import {
    BloodCompatibility,
    BloodDonationRequest,
    BloodGroupInfo,
    bloodDonationService,
} from '../../services/bloodDonationService';
import { modernColors } from '../../theme/modernTheme';

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

type TabType = 'requests' | 'profile' | 'compatibility';

const BloodDonationScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [activeTab, setActiveTab] = useState<TabType>('requests');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Profil donneur
    const [myBloodGroups, setMyBloodGroups] = useState<BloodGroupInfo[]>([]);
    const [selectedBloodGroup, setSelectedBloodGroup] = useState<string | null>(null);
    const [showGroupSelector, setShowGroupSelector] = useState(false);
    const [savingGroup, setSavingGroup] = useState(false);

    // Demandes urgentes
    const [activeRequests, setActiveRequests] = useState<BloodDonationRequest[]>([]);

    // Compatibilité
    const [compatibilities, setCompatibilities] = useState<BloodCompatibility[]>([]);
    const [loadingCompatibility, setLoadingCompatibility] = useState(false);

    // Modal répondre à une demande
    const [showRespondModal, setShowRespondModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<BloodDonationRequest | null>(null);
    const [responding, setResponding] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            // Charger profil donneur + demandes actives en parallèle
            const [groupsResponse, requestsResponse] = await Promise.allSettled([
                bloodDonationService.getMyBloodGroups(),
                bloodDonationService.listActiveRequests(),
            ]);

            if (groupsResponse.status === 'fulfilled' && groupsResponse.value.success) {
                const groups = (groupsResponse.value.data as any)?.data || groupsResponse.value.data || [];
                setMyBloodGroups(Array.isArray(groups) ? groups : []);
                if (Array.isArray(groups) && groups.length > 0) {
                    setSelectedBloodGroup(groups[0].blood_group);
                }
            }

            if (requestsResponse.status === 'fulfilled' && requestsResponse.value.success) {
                const requests = (requestsResponse.value.data as any)?.data || requestsResponse.value.data || [];
                setActiveRequests(Array.isArray(requests) ? requests : []);
            }
        } catch (error) {
            console.error('[BloodDonationScreen] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSaveBloodGroup = async (group: string) => {
        try {
            setSavingGroup(true);
            const response = await bloodDonationService.createOrUpdateBloodGroup(group);
            if (response.success) {
                setSelectedBloodGroup(group);
                setShowGroupSelector(false);
                Alert.alert(t('message.success'), t('bloodDonation.bloodGroupSaved', { group }));
                loadData();
            } else {
                Alert.alert(t('message.error'), t('bloodDonation.cannotSaveBloodGroup'));
            }
        } catch (error: any) {
            console.error('[BloodDonationScreen] Erreur sauvegarde groupe:', error);
            Alert.alert(t('message.error'), error.message || t('bloodDonation.saveError'));
        } finally {
            setSavingGroup(false);
        }
    };

    const handleLoadCompatibility = async () => {
        if (!selectedBloodGroup) {
            Alert.alert('Info', t('bloodDonation.registerBloodGroupFirst'));
            return;
        }
        try {
            setLoadingCompatibility(true);
            const response = await bloodDonationService.getBloodGroupCompatibility(selectedBloodGroup);
            if (response.success) {
                const data = (response.data as any)?.data || response.data || [];
                setCompatibilities(Array.isArray(data) ? data : []);
            }
        } catch (error: any) {
            console.error('[BloodDonationScreen] Erreur compatibilité:', error);
            // Fallback local
            setCompatibilities([]);
        } finally {
            setLoadingCompatibility(false);
        }
    };

    const handleRespondToRequest = async (request: BloodDonationRequest) => {
        if (!user) {
            Alert.alert(t('bloodDonation.loginRequired'), t('bloodDonation.loginToRespond'));
            return;
        }
        if (!selectedBloodGroup) {
            Alert.alert(t('bloodDonation.incompleteProfile'), t('bloodDonation.registerBloodGroupInProfile'));
            setActiveTab('profile');
            return;
        }
        setSelectedRequest(request);
        setShowRespondModal(true);
    };

    const handleConfirmResponse = async () => {
        if (!selectedRequest) return;
        try {
            setResponding(true);
            // Notifier le backend que le donneur est intéressé
            const response = await bloodDonationService.notifyDonorsForRequest(selectedRequest.id);
            if (response.success) {
                Alert.alert(
                    t('bloodDonation.thankYou'),
                    t('bloodDonation.availabilityReported'),
                    [{ text: 'OK', onPress: () => setShowRespondModal(false) }]
                );
            } else {
                Alert.alert(t('message.error'), t('bloodDonation.cannotReportAvailability'));
            }
        } catch (error: any) {
            console.error('[BloodDonationScreen] Erreur réponse:', error);
            Alert.alert(t('message.error'), error.message || t('bloodDonation.responseError'));
        } finally {
            setResponding(false);
        }
    };

    const getUrgencyColor = (level: string) => {
        switch (level) {
            case 'critical': return '#DC2626';
            case 'urgent': return '#F59E0B';
            default: return '#10B981';
        }
    };

    const getUrgencyLabel = (level: string) => {
        switch (level) {
            case 'critical': return 'CRITIQUE';
            case 'urgent': return 'URGENT';
            default: return 'Normal';
        }
    };

    // === RENDER DEMANDES URGENTES ===
    const renderRequest = ({ item }: { item: BloodDonationRequest }) => (
        <NativeCard style={styles.requestCard}>
            <View style={styles.requestHeader}>
                <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency_level) + '20' }]}>
                    <SafeIcon name="alert-circle" size={14} color={getUrgencyColor(item.urgency_level)} />
                    <Text style={[styles.urgencyText, { color: getUrgencyColor(item.urgency_level) }]}>
                        {getUrgencyLabel(item.urgency_level)}
                    </Text>
                </View>
                <View style={styles.bloodGroupBadge}>
                    <Text style={styles.bloodGroupBadgeText}>{item.blood_group_needed}</Text>
                </View>
            </View>

            <Text style={styles.requestTitle}>
                Besoin de {item.units_needed} unité{item.units_needed > 1 ? 's' : ''} de sang {item.blood_group_needed}
            </Text>

            {item.banque_nom && (
                <View style={styles.requestInfoRow}>
                    <SafeIcon name="building" size={14} color="#6B7280" />
                    <Text style={styles.requestInfoText}>{item.banque_nom}</Text>
                </View>
            )}

            {item.banque_adresse && (
                <View style={styles.requestInfoRow}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.requestInfoText}>{item.banque_adresse}</Text>
                </View>
            )}

            {item.description && (
                <Text style={styles.requestDescription}>{item.description}</Text>
            )}

            <Text style={styles.requestDate}>
                Publiée le {new Date(item.created_at).toLocaleDateString('fr-FR')}
            </Text>

            <TouchableOpacity
                style={styles.respondButton}
                onPress={() => handleRespondToRequest(item)}
            >
                <SafeIcon name="heart" size={16} color="#FFFFFF" />
                <Text style={styles.respondButtonText}>Je suis disponible pour donner</Text>
            </TouchableOpacity>
        </NativeCard>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#DC2626" />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Don de Sang</Text>
                    <Text style={styles.headerSubtitle}>Sauvez des vies</Text>
                </View>
                <SafeIcon name="droplet" size={28} color="#DC2626" />
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                {[
                    { key: 'requests' as TabType, label: 'Demandes', icon: 'alert-circle' },
                    { key: 'profile' as TabType, label: 'Mon Profil', icon: 'user' },
                    { key: 'compatibility' as TabType, label: 'Compatibilité', icon: 'check-circle' },
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                        onPress={() => {
                            setActiveTab(tab.key);
                            if (tab.key === 'compatibility' && compatibilities.length === 0) {
                                handleLoadCompatibility();
                            }
                        }}
                    >
                        <SafeIcon
                            name={tab.icon}
                            size={16}
                            color={activeTab === tab.key ? '#DC2626' : '#6B7280'}
                        />
                        <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {activeTab === 'requests' && (
                <FlatList
                    data={activeRequests}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderRequest}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#DC2626']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="heart" size={64} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>Aucune demande active</Text>
                            <Text style={styles.emptyText}>
                                Il n'y a pas de demande de don de sang en cours. Revenez régulièrement.
                            </Text>
                        </View>
                    }
                    ListHeaderComponent={
                        activeRequests.length > 0 ? (
                            <View style={styles.listHeader}>
                                <Text style={styles.listHeaderText}>
                                    {activeRequests.length} demande{activeRequests.length > 1 ? 's' : ''} active{activeRequests.length > 1 ? 's' : ''}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            )}

            {activeTab === 'profile' && (
                <ScrollView
                    style={styles.profileContainer}
                    contentContainerStyle={styles.profileContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#DC2626']} />
                    }
                >
                    {/* Groupe sanguin */}
                    <NativeCard style={styles.profileCard}>
                        <View style={styles.profileCardHeader}>
                            <SafeIcon name="droplet" size={20} color="#DC2626" />
                            <Text style={styles.profileCardTitle}>Mon groupe sanguin</Text>
                        </View>

                        {selectedBloodGroup ? (
                            <View style={styles.bloodGroupDisplay}>
                                <Text style={styles.bloodGroupLarge}>{selectedBloodGroup}</Text>
                                <TouchableOpacity
                                    style={styles.changeGroupButton}
                                    onPress={() => setShowGroupSelector(true)}
                                >
                                    <Text style={styles.changeGroupText}>Modifier</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.addGroupButton}
                                onPress={() => setShowGroupSelector(true)}
                            >
                                <SafeIcon name="plus" size={20} color="#DC2626" />
                                <Text style={styles.addGroupText}>Enregistrer mon groupe sanguin</Text>
                            </TouchableOpacity>
                        )}
                    </NativeCard>

                    {/* Info donneur */}
                    {myBloodGroups.length > 0 && myBloodGroups[0] && (
                        <NativeCard style={styles.profileCard}>
                            <View style={styles.profileCardHeader}>
                                <SafeIcon name="calendar" size={20} color="#6366F1" />
                                <Text style={styles.profileCardTitle}>Historique</Text>
                            </View>
                            {myBloodGroups[0].last_donation_date ? (
                                <View>
                                    <Text style={styles.profileInfoText}>
                                        Dernier don : {new Date(myBloodGroups[0].last_donation_date).toLocaleDateString('fr-FR')}
                                    </Text>
                                    <View style={[
                                        styles.donationStatus,
                                        { backgroundColor: myBloodGroups[0].can_donate ? '#F0FDF4' : '#FEF2F2' }
                                    ]}>
                                        <SafeIcon
                                            name={myBloodGroups[0].can_donate ? 'check-circle' : 'clock'}
                                            size={16}
                                            color={myBloodGroups[0].can_donate ? '#10B981' : '#EF4444'}
                                        />
                                        <Text style={{
                                            color: myBloodGroups[0].can_donate ? '#10B981' : '#EF4444',
                                            fontWeight: '600',
                                            fontSize: 14,
                                        }}>
                                            {myBloodGroups[0].can_donate
                                                ? 'Vous êtes éligible pour donner'
                                                : `Prochain don possible: ${myBloodGroups[0].next_eligible_date
                                                    ? new Date(myBloodGroups[0].next_eligible_date).toLocaleDateString('fr-FR')
                                                    : 'Date non disponible'
                                                }`
                                            }
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <Text style={styles.profileInfoText}>Aucun don enregistré</Text>
                            )}

                            <NativeButton
                                title="Enregistrer un don"
                                onPress={() => {
                                    Alert.alert(
                                        t('bloodDonation.registerDonation'),
                                        t('bloodDonation.confirmDonationToday'),
                                        [
                                            { text: 'Annuler', style: 'cancel' },
                                            {
                                                text: 'Confirmer',
                                                onPress: async () => {
                                                    try {
                                                        await bloodDonationService.updateLastDonation(
                                                            new Date().toISOString().split('T')[0]
                                                        );
                                                        Alert.alert(t('bloodDonation.thankYou'), t('bloodDonation.donationRegistered'));
                                                        loadData();
                                                    } catch (err) {
                                                        Alert.alert(t('message.error'), t('bloodDonation.cannotRegisterDonation'));
                                                    }
                                                },
                                            },
                                        ]
                                    );
                                }}
                                variant="outline"
                                icon="heart"
                                style={{ marginTop: 16 }}
                            />
                        </NativeCard>
                    )}

                    {/* Statistiques */}
                    <NativeCard style={styles.profileCard}>
                        <View style={styles.profileCardHeader}>
                            <SafeIcon name="bar-chart" size={20} color="#F59E0B" />
                            <Text style={styles.profileCardTitle}>Saviez-vous ?</Text>
                        </View>
                        <Text style={styles.factText}>
                            Un don de sang peut sauver jusqu'à 3 vies. En Afrique, le besoin en sang est critique avec seulement 40% des besoins couverts.
                        </Text>
                        <Text style={styles.factText}>
                            Vous pouvez donner du sang tous les 56 jours (8 semaines) pour les hommes et 84 jours (12 semaines) pour les femmes.
                        </Text>
                    </NativeCard>
                </ScrollView>
            )}

            {activeTab === 'compatibility' && (
                <ScrollView style={styles.profileContainer} contentContainerStyle={styles.profileContent}>
                    <NativeCard style={styles.profileCard}>
                        <View style={styles.profileCardHeader}>
                            <SafeIcon name="check-circle" size={20} color="#10B981" />
                            <Text style={styles.profileCardTitle}>Tableau de compatibilité</Text>
                        </View>

                        {!selectedBloodGroup ? (
                            <View style={styles.noGroupWarning}>
                                <SafeIcon name="alert-triangle" size={20} color="#F59E0B" />
                                <Text style={styles.noGroupText}>
                                    Enregistrez d'abord votre groupe sanguin dans l'onglet Profil
                                </Text>
                            </View>
                        ) : loadingCompatibility ? (
                            <ActivityIndicator size="small" color="#DC2626" style={{ marginVertical: 20 }} />
                        ) : (
                            <View>
                                <Text style={styles.compatibilityIntro}>
                                    Avec votre groupe {selectedBloodGroup}, vous pouvez :
                                </Text>

                                {/* Donneur universel info */}
                                <View style={styles.compatibilitySection}>
                                    <Text style={styles.compatibilitySectionTitle}>Donner à :</Text>
                                    <View style={styles.compatibilityChips}>
                                        {getCanDonateTo(selectedBloodGroup).map(group => (
                                            <View key={group} style={styles.compatibleChip}>
                                                <Text style={styles.compatibleChipText}>{group}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.compatibilitySection}>
                                    <Text style={styles.compatibilitySectionTitle}>Recevoir de :</Text>
                                    <View style={styles.compatibilityChips}>
                                        {getCanReceiveFrom(selectedBloodGroup).map(group => (
                                            <View key={group} style={[styles.compatibleChip, styles.receiveChip]}>
                                                <Text style={[styles.compatibleChipText, styles.receiveChipText]}>{group}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        )}
                    </NativeCard>

                    {/* Tableau complet */}
                    <NativeCard style={styles.profileCard}>
                        <Text style={styles.profileCardTitle}>Tableau complet</Text>
                        <View style={styles.compatibilityTable}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableCell, styles.tableHeaderCell]}>Groupe</Text>
                                <Text style={[styles.tableCell, styles.tableHeaderCell]}>Donne à</Text>
                                <Text style={[styles.tableCell, styles.tableHeaderCell]}>Reçoit de</Text>
                            </View>
                            {BLOOD_GROUPS.map(group => (
                                <View key={group} style={[
                                    styles.tableRow,
                                    selectedBloodGroup === group && styles.tableRowHighlighted
                                ]}>
                                    <Text style={[styles.tableCell, styles.tableCellGroup]}>{group}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}>
                                        {getCanDonateTo(group).join(', ')}
                                    </Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}>
                                        {getCanReceiveFrom(group).join(', ')}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </NativeCard>
                </ScrollView>
            )}

            {/* Modal sélection groupe sanguin */}
            <Modal visible={showGroupSelector} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Sélectionnez votre groupe sanguin</Text>
                        <View style={styles.groupGrid}>
                            {BLOOD_GROUPS.map(group => (
                                <TouchableOpacity
                                    key={group}
                                    style={[
                                        styles.groupItem,
                                        selectedBloodGroup === group && styles.groupItemSelected,
                                    ]}
                                    onPress={() => handleSaveBloodGroup(group)}
                                    disabled={savingGroup}
                                >
                                    <Text style={[
                                        styles.groupItemText,
                                        selectedBloodGroup === group && styles.groupItemTextSelected,
                                    ]}>
                                        {group}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {savingGroup && <ActivityIndicator size="small" color="#DC2626" style={{ marginTop: 12 }} />}
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowGroupSelector(false)}
                        >
                            <Text style={styles.modalCloseText}>Fermer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal répondre à une demande */}
            <Modal visible={showRespondModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <SafeIcon name="heart" size={32} color="#DC2626" />
                        <Text style={styles.modalTitle}>Répondre à la demande</Text>
                        {selectedRequest && (
                            <View style={styles.respondModalContent}>
                                <Text style={styles.respondModalText}>
                                    Besoin : {selectedRequest.units_needed} unité(s) de {selectedRequest.blood_group_needed}
                                </Text>
                                {selectedRequest.banque_nom && (
                                    <Text style={styles.respondModalText}>
                                        Lieu : {selectedRequest.banque_nom}
                                    </Text>
                                )}
                                <Text style={styles.respondModalWarning}>
                                    En confirmant, la banque de sang sera notifiée de votre disponibilité.
                                </Text>
                            </View>
                        )}
                        <NativeButton
                            title={responding ? 'Envoi en cours...' : 'Confirmer ma disponibilité'}
                            onPress={handleConfirmResponse}
                            disabled={responding}
                            variant="primary"
                            icon="check"
                            style={{ marginTop: 16, backgroundColor: '#DC2626' }}
                        />
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowRespondModal(false)}
                        >
                            <Text style={styles.modalCloseText}>Annuler</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// Fonctions utilitaires de compatibilité sanguine (fallback local)
function getCanDonateTo(group: string): string[] {
    const map: Record<string, string[]> = {
        'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
        'O+': ['O+', 'A+', 'B+', 'AB+'],
        'A-': ['A-', 'A+', 'AB-', 'AB+'],
        'A+': ['A+', 'AB+'],
        'B-': ['B-', 'B+', 'AB-', 'AB+'],
        'B+': ['B+', 'AB+'],
        'AB-': ['AB-', 'AB+'],
        'AB+': ['AB+'],
    };
    return map[group] || [];
}

function getCanReceiveFrom(group: string): string[] {
    const map: Record<string, string[]> = {
        'O-': ['O-'],
        'O+': ['O-', 'O+'],
        'A-': ['O-', 'A-'],
        'A+': ['O-', 'O+', 'A-', 'A+'],
        'B-': ['O-', 'B-'],
        'B+': ['O-', 'O+', 'B-', 'B+'],
        'AB-': ['O-', 'A-', 'B-', 'AB-'],
        'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    };
    return map[group] || [];
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    loadingText: { marginTop: 16, fontSize: 14, color: '#6B7280' },
    header: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 12,
    },
    backButton: { padding: 4 },
    headerContent: { flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
    headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
    tabContainer: {
        flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
        paddingHorizontal: 8,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: '#DC2626' },
    tabText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
    tabTextActive: { color: '#DC2626', fontWeight: '600' },
    listContent: { padding: 16 },
    listHeader: { marginBottom: 12 },
    listHeaderText: { fontSize: 16, fontWeight: '600', color: '#111827' },
    requestCard: { padding: 16, marginBottom: 12 },
    requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    urgencyBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },
    urgencyText: { fontSize: 12, fontWeight: '700' },
    bloodGroupBadge: {
        backgroundColor: '#DC262620', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 16,
    },
    bloodGroupBadgeText: { fontSize: 16, fontWeight: '800', color: '#DC2626' },
    requestTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
    requestInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    requestInfoText: { fontSize: 13, color: '#6B7280', flex: 1 },
    requestDescription: { fontSize: 13, color: '#374151', marginTop: 8, lineHeight: 18 },
    requestDate: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
    respondButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#DC2626', padding: 14, borderRadius: 12, marginTop: 12,
    },
    respondButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
    emptyContainer: { alignItems: 'center', padding: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
    profileContainer: { flex: 1 },
    profileContent: { padding: 16 },
    profileCard: { padding: 20, marginBottom: 16 },
    profileCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    profileCardTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
    bloodGroupDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bloodGroupLarge: {
        fontSize: 48, fontWeight: '800', color: '#DC2626',
        backgroundColor: '#FEF2F2', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 16,
    },
    changeGroupButton: { padding: 12 },
    changeGroupText: { fontSize: 14, fontWeight: '600', color: modernColors.primary },
    addGroupButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: 16, borderWidth: 2, borderColor: '#DC2626', borderStyle: 'dashed', borderRadius: 12,
    },
    addGroupText: { fontSize: 16, fontWeight: '600', color: '#DC2626' },
    profileInfoText: { fontSize: 14, color: '#374151', marginBottom: 8 },
    donationStatus: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 12, borderRadius: 8, marginTop: 8,
    },
    factText: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 12 },
    noGroupWarning: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 12, backgroundColor: '#FFFBEB', borderRadius: 8,
    },
    noGroupText: { fontSize: 14, color: '#92400E', flex: 1 },
    compatibilityIntro: { fontSize: 15, color: '#374151', marginBottom: 16, fontWeight: '500' },
    compatibilitySection: { marginBottom: 16 },
    compatibilitySectionTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 },
    compatibilityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    compatibleChip: {
        backgroundColor: '#F0FDF4', paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 16, borderWidth: 1, borderColor: '#BBF7D0',
    },
    compatibleChipText: { fontSize: 14, fontWeight: '700', color: '#15803D' },
    receiveChip: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
    receiveChipText: { color: '#1D4ED8' },
    compatibilityTable: { marginTop: 8 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 8, marginBottom: 4 },
    tableHeaderCell: { fontWeight: '700', color: '#374151', fontSize: 12 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    tableRowHighlighted: { backgroundColor: '#FEF2F2' },
    tableCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 13 },
    tableCellGroup: { fontWeight: '700', color: '#DC2626', flex: 0.5 },
    tableCellSmall: { fontSize: 11, color: '#6B7280' },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, alignItems: 'center',
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 20 },
    groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
    groupItem: {
        width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#E5E7EB',
        alignItems: 'center', justifyContent: 'center',
    },
    groupItemSelected: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
    groupItemText: { fontSize: 18, fontWeight: '700', color: '#374151' },
    groupItemTextSelected: { color: '#DC2626' },
    modalCloseButton: { marginTop: 20, padding: 12 },
    modalCloseText: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
    respondModalContent: { width: '100%', marginTop: 12 },
    respondModalText: { fontSize: 15, color: '#374151', marginBottom: 8 },
    respondModalWarning: { fontSize: 13, color: '#6B7280', marginTop: 8, fontStyle: 'italic' },
});

export default BloodDonationScreen;
