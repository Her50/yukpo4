import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
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
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost, apiPut } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { isAdminUser } from '../../utils/roleHelpers'; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

interface DeliveryPartner {
    id: number;
    name: string;
    description?: string;
    partner_type?: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    city?: string;
    country: string;
    continent?: string;
    website?: string;
    logo_url?: string;
    location_latitude?: number;
    location_longitude?: number;
    location_address?: string;
    is_active: boolean;
    created_by?: number;
    created_at: string;
    updated_at: string;
}

interface PendingPartner {
    id: number;
    email: string;
    nom_complet: string | null;
    partner_type: string | null;
    partner_status: string | null;
    created_at: string;
}

const DeliveryPartnersAdminScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
    const [partners, setPartners] = useState<DeliveryPartner[]>([]);
    const [pendingPartners, setPendingPartners] = useState<PendingPartner[]>([]);
    const [loading, setLoading] = useState(false); // ✅ CORRIGÉ: Initialiser à false car l'onglet pending est actif par défaut (loadingPending gère cet onglet)
    const [loadingPending, setLoadingPending] = useState(true); // ✅ CORRIGÉ: Initialiser à true car l'onglet pending est actif par défaut
    const [selectedPendingPartner, setSelectedPendingPartner] = useState<PendingPartner | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState<number | null>(null);
    // ✅ NOUVEAU: États pour le modal d'édition
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        partner_type: 'livraison',
        contact_email: '',
        contact_phone: '',
        address: '',
        city: '',
        country: '',
        continent: '',
        website: '',
        logo_url: '',
        location_latitude: undefined as number | undefined,
        location_longitude: undefined as number | undefined,
        location_address: '',
        is_active: true,
    });


    useEffect(() => {
        // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
        if (!user || !isAdminUser(user)) {
            Alert.alert('Accès refusé', 'Cette page est réservée aux administrateurs');
            navigation.goBack();
            return;
        }
        if (activeTab === 'pending') {
            loadPendingPartners();
        } else {
            loadPartners();
        }
    }, [user, activeTab]);

    const loadPartners = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/delivery/partners');
            const partnersList = response.partners || response.data?.partners || [];
            setPartners(partnersList);
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminScreen] Erreur chargement partenaires:', error);
            Alert.alert('Erreur', error?.message || 'Impossible de charger les partenaires');
        } finally {
            setLoading(false);
        }
    };

    const loadPendingPartners = async () => {
        try {
            setLoadingPending(true);
            const response = await apiGet('/api/admin/partners/pending');

            // ✅ CORRECTION CRITIQUE: apiGet retourne ApiResponse<T> avec structure { success?, data?, error? }
            // Le backend retourne probablement { partners: [...] } ou directement un tableau
            // Donc response.data devrait contenir { partners: [...] } ou directement un tableau

            console.log('[DeliveryPartnersAdminScreen] 🔍 Réponse API complète:', JSON.stringify(response, null, 2));

            let partnersList: PendingPartner[] = [];

            // Vérifier la structure de la réponse
            if (response && typeof response === 'object') {
                // Cas 1: response.data.partners (structure normale)
                if (response.data && typeof response.data === 'object' && Array.isArray(response.data.partners)) {
                    partnersList = response.data.partners;
                    console.log('[DeliveryPartnersAdminScreen] ✅ Partenaires trouvés dans response.data.partners:', partnersList.length);
                }
                // Cas 2: response.partners (si data n'existe pas)
                else if (Array.isArray(response.partners)) {
                    partnersList = response.partners;
                    console.log('[DeliveryPartnersAdminScreen] ✅ Partenaires trouvés dans response.partners:', partnersList.length);
                }
                // Cas 3: response.data est directement un tableau
                else if (Array.isArray(response.data)) {
                    partnersList = response.data;
                    console.log('[DeliveryPartnersAdminScreen] ✅ Partenaires trouvés dans response.data (tableau direct):', partnersList.length);
                }
                // Cas 4: response est directement un tableau
                else if (Array.isArray(response)) {
                    partnersList = response;
                    console.log('[DeliveryPartnersAdminScreen] ✅ Partenaires trouvés dans response (tableau direct):', partnersList.length);
                }
                // Cas 5: response.data existe mais structure inattendue
                else if (response.data && typeof response.data === 'object') {
                    console.warn('[DeliveryPartnersAdminScreen] ⚠️ Structure de réponse.data inattendue:', Object.keys(response.data));
                    console.warn('[DeliveryPartnersAdminScreen] ⚠️ Contenu de response.data:', JSON.stringify(response.data, null, 2));
                    partnersList = [];
                }
                else {
                    console.warn('[DeliveryPartnersAdminScreen] ⚠️ Format de réponse complètement inattendu:', typeof response, Object.keys(response || {}));
                    partnersList = [];
                }
            } else {
                console.warn('[DeliveryPartnersAdminScreen] ⚠️ Réponse n\'est pas un objet:', typeof response);
                partnersList = [];
            }

            console.log('[DeliveryPartnersAdminScreen] ✅ Partenaires finaux à afficher:', partnersList.length);
            setPendingPartners(partnersList);
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminScreen] ❌ Erreur chargement candidatures:', error);
            console.error('[DeliveryPartnersAdminScreen] ❌ Stack trace:', error.stack);
            Alert.alert('Erreur', error.message || 'Impossible de charger les candidatures');
            setPendingPartners([]);
        } finally {
            setLoadingPending(false);
        }
    };

    const handleApprove = async (userId: number) => {
        try {
            setProcessing(userId);
            const response = await apiPost(`/api/admin/partners/${userId}/validate`, {
                action: 'approve',
            });

            if (response.success) {
                Alert.alert('✅ Succès', 'Le partenaire a été approuvé avec succès', [
                    {
                        text: 'OK', onPress: () => {
                            setShowDetailModal(false);
                            loadPendingPartners();
                            loadPartners(); // Recharger aussi les partenaires validés
                        }
                    },
                ]);
            } else {
                throw new Error(response.error || 'Erreur lors de l\'approbation');
            }
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminScreen] Erreur approbation:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'approuver le partenaire');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (userId: number) => {
        if (!rejectionReason.trim()) {
            Alert.alert('Erreur', 'Veuillez indiquer une raison de refus');
            return;
        }

        try {
            setProcessing(userId);
            const response = await apiPost(`/api/admin/partners/${userId}/validate`, {
                action: 'reject',
                reason: rejectionReason,
            });

            if (response.success) {
                Alert.alert('✅ Succès', 'Le partenaire a été rejeté', [
                    {
                        text: 'OK', onPress: () => {
                            setShowRejectModal(false);
                            setShowDetailModal(false);
                            setRejectionReason('');
                            loadPendingPartners();
                        }
                    },
                ]);
            } else {
                throw new Error(response.error || 'Erreur lors du rejet');
            }
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminScreen] Erreur rejet:', error);
            Alert.alert('Erreur', error.message || 'Impossible de rejeter le partenaire');
        } finally {
            setProcessing(null);
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const handleCreate = () => {
        // ✅ NOUVEAU: Naviguer vers l'écran de création de partenaire
        navigation.navigate('PartnerRegister' as never);
    };

    const handleEdit = (partner: DeliveryPartner) => {
        // ✅ IMPLÉMENTÉ: Ouvrir le modal d'édition avec les données du partenaire
        setEditingPartner(partner);
        setEditForm({
            name: partner.name || '',
            description: partner.description || '',
            partner_type: partner.partner_type || 'livraison',
            contact_email: partner.contact_email || '',
            contact_phone: partner.contact_phone || '',
            address: partner.address || '',
            city: partner.city || '',
            country: partner.country || '',
            continent: partner.continent || '',
            website: partner.website || '',
            logo_url: partner.logo_url || '',
            location_latitude: partner.location_latitude,
            location_longitude: partner.location_longitude,
            location_address: partner.location_address || '',
            is_active: partner.is_active,
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingPartner) return;

        if (!editForm.name.trim()) {
            Alert.alert('Erreur', 'Le nom est requis');
            return;
        }

        try {
            setProcessing(editingPartner.id);
            const response = await apiPut(`/api/delivery/partners/${editingPartner.id}`, editForm);

            if (response.success !== false) {
                Alert.alert('✅ Succès', 'Le partenaire a été modifié avec succès', [
                    {
                        text: 'OK', onPress: () => {
                            setShowEditModal(false);
                            setEditingPartner(null);
                            loadPartners();
                        }
                    },
                ]);
            } else {
                throw new Error(response.message || 'Erreur lors de la modification');
            }
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminScreen] Erreur modification:', error);
            Alert.alert('Erreur', error.message || 'Impossible de modifier le partenaire');
        } finally {
            setProcessing(null);
        }
    };

    const handleDelete = async (partnerId: number) => {
        // ✅ NOTE: La suppression des partenaires validés n'est pas recommandée car ils sont liés à des utilisateurs
        // Pour désactiver un partenaire, utilisez plutôt la fonctionnalité de désactivation (is_active = false)
        Alert.alert(
            'Information',
            'La suppression des partenaires validés n\'est pas disponible dans l\'application mobile.\n\n' +
            'Les partenaires sont liés à des comptes utilisateurs et ne doivent pas être supprimés.\n\n' +
            'Pour désactiver un partenaire, utilisez l\'interface web d\'administration ou contactez le support.'
        );
    };


    // ✅ CORRECTION: Ne pas bloquer le render complet - le chargement est géré par loading/loadingPending dans les onglets

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Gestion des partenaires</Text>
                {activeTab === 'approved' && (
                    <TouchableOpacity onPress={handleCreate} style={styles.addButton}>
                        <SafeIcon name="plus" size={24} color={modernColors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Onglets */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
                    onPress={() => setActiveTab('pending')}
                >
                    <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
                        Candidatures ({pendingPartners.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'approved' && styles.tabActive]}
                    onPress={() => setActiveTab('approved')}
                >
                    <Text style={[styles.tabText, activeTab === 'approved' && styles.tabTextActive]}>
                        Partenaires validés ({partners.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Contenu selon l'onglet actif */}
            {activeTab === 'pending' ? (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {loadingPending ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                            <Text style={styles.loadingText}>Chargement...</Text>
                        </View>
                    ) : pendingPartners.length === 0 ? (
                        <NativeCard style={styles.emptyCard}>
                            <SafeIcon name="inbox" size={48} color={modernColors.textSecondary} />
                            <Text style={styles.emptyText}>Aucune candidature en attente</Text>
                        </NativeCard>
                    ) : (
                        pendingPartners.map((partner) => (
                            <NativeCard key={partner.id} style={styles.partnerCard}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setSelectedPendingPartner(partner);
                                        setShowDetailModal(true);
                                    }}
                                >
                                    <View style={styles.partnerHeader}>
                                        <View style={styles.partnerInfo}>
                                            <Text style={styles.partnerName}>
                                                {partner.nom_complet || partner.email}
                                            </Text>
                                            <Text style={styles.partnerDescription}>{partner.email}</Text>
                                            {partner.partner_type && (
                                                <Text style={styles.partnerMetaText}>
                                                    🏷️ Type: {partner.partner_type}
                                                </Text>
                                            )}
                                            <Text style={styles.partnerMetaText}>
                                                📅 Inscrit: {formatDate(partner.created_at)}
                                            </Text>
                                        </View>
                                        <View style={styles.statusBadgePending}>
                                            <Text style={styles.statusTextPending}>En attente</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                                <View style={styles.partnerActions}>
                                    <NativeButton
                                        title="Approuver"
                                        variant="primary"
                                        onPress={() => {
                                            setSelectedPendingPartner(partner);
                                            Alert.alert(
                                                'Confirmer',
                                                'Êtes-vous sûr de vouloir approuver ce partenaire ?',
                                                [
                                                    { text: 'Annuler', style: 'cancel' },
                                                    {
                                                        text: 'Approuver',
                                                        onPress: () => handleApprove(partner.id),
                                                    },
                                                ],
                                            );
                                        }}
                                        disabled={processing === partner.id}
                                    />
                                    <NativeButton
                                        title="Rejeter"
                                        variant="outline"
                                        onPress={() => {
                                            setSelectedPendingPartner(partner);
                                            setShowRejectModal(true);
                                        }}
                                        disabled={processing === partner.id}
                                    />
                                </View>
                            </NativeCard>
                        ))
                    )}
                </ScrollView>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

                    {partners.length === 0 ? (
                        <NativeCard style={styles.emptyCard}>
                            <SafeIcon name="truck" size={48} color={modernColors.textSecondary} />
                            <Text style={styles.emptyText}>Aucun partenaire enregistré</Text>
                            <Text style={styles.emptySubtext}>
                                Cliquez sur le bouton + pour créer un nouveau partenaire
                            </Text>
                        </NativeCard>
                    ) : (
                        partners.map((partner) => (
                            <NativeCard key={partner.id} style={styles.partnerCard}>
                                <View style={styles.partnerHeader}>
                                    <View style={styles.partnerInfo}>
                                        <Text style={styles.partnerName}>{partner.name}</Text>
                                        {partner.description && (
                                            <Text style={styles.partnerDescription} numberOfLines={2}>
                                                {partner.description}
                                            </Text>
                                        )}
                                        <View style={styles.partnerMeta}>
                                            {partner.partner_type && (
                                                <Text style={styles.partnerMetaText}>
                                                    🏷️ Type: {partner.partner_type}
                                                </Text>
                                            )}
                                            {partner.city && partner.country && (
                                                <Text style={styles.partnerMetaText}>
                                                    📍 {partner.city}, {partner.country}
                                                </Text>
                                            )}
                                            {partner.contact_phone && (
                                                <Text style={styles.partnerMetaText}>
                                                    📞 {partner.contact_phone}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.partnerStatus}>
                                        {partner.is_active ? (
                                            <View style={styles.activeBadge}>
                                                <Text style={styles.activeBadgeText}>Actif</Text>
                                            </View>
                                        ) : (
                                            <View style={styles.inactiveBadge}>
                                                <Text style={styles.inactiveBadgeText}>Inactif</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.partnerActions}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleEdit(partner)}
                                    >
                                        <SafeIcon name="edit" size={18} color={modernColors.primary} />
                                        <Text style={styles.actionButtonText}>Modifier</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.deleteButton]}
                                        onPress={() => handleDelete(partner.id)}
                                    >
                                        <SafeIcon name="trash" size={18} color={modernColors.error || '#EF4444'} />
                                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                                            Supprimer
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </NativeCard>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Modal de détails pour candidature en attente */}
            <Modal
                visible={showDetailModal && !!selectedPendingPartner}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowDetailModal(false);
                    setSelectedPendingPartner(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Détails de la candidature</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowDetailModal(false);
                                    setSelectedPendingPartner(null);
                                }}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedPendingPartner ? (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Candidat</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedPendingPartner.nom_complet || selectedPendingPartner.email}
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        {selectedPendingPartner.email}
                                    </Text>
                                </NativeCard>

                                {selectedPendingPartner.partner_type && (
                                    <NativeCard style={styles.detailCard}>
                                        <Text style={styles.detailLabel}>Type de partenaire</Text>
                                        <Text style={styles.detailValue}>
                                            {selectedPendingPartner.partner_type}
                                        </Text>
                                    </NativeCard>
                                )}

                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Date d'inscription</Text>
                                    <Text style={styles.detailValue}>
                                        {formatDate(selectedPendingPartner.created_at)}
                                    </Text>
                                </NativeCard>

                                {(!selectedPendingPartner.partner_status || selectedPendingPartner.partner_status === 'pending') && (
                                    <View style={styles.modalActions}>
                                        <NativeButton
                                            title="Approuver"
                                            variant="primary"
                                            onPress={() => {
                                                Alert.alert(
                                                    'Confirmer',
                                                    'Êtes-vous sûr de vouloir approuver ce partenaire ?',
                                                    [
                                                        { text: 'Annuler', style: 'cancel' },
                                                        {
                                                            text: 'Approuver',
                                                            onPress: () =>
                                                                handleApprove(selectedPendingPartner.id),
                                                        },
                                                    ],
                                                );
                                            }}
                                            disabled={processing === selectedPendingPartner.id}
                                        />
                                        <NativeButton
                                            title="Rejeter"
                                            variant="outline"
                                            onPress={() => {
                                                setShowRejectModal(true);
                                            }}
                                            disabled={processing === selectedPendingPartner.id}
                                        />
                                    </View>
                                )}
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* Modal de rejet */}
            <Modal
                visible={showRejectModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowRejectModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Raison du refus</Text>
                            <TouchableOpacity
                                onPress={() => setShowRejectModal(false)}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.inputLabel}>
                                Indiquez la raison du refus (obligatoire)
                            </Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Ex: Documents incomplets, informations manquantes..."
                                value={rejectionReason}
                                onChangeText={setRejectionReason}
                                multiline
                                numberOfLines={4}
                            />
                            <View style={styles.modalActions}>
                                <NativeButton
                                    title="Annuler"
                                    variant="outline"
                                    onPress={() => {
                                        setShowRejectModal(false);
                                        setRejectionReason('');
                                    }}
                                />
                                <NativeButton
                                    title="Rejeter"
                                    variant="primary"
                                    onPress={() => {
                                        if (selectedPendingPartner) {
                                            handleReject(selectedPendingPartner.id);
                                        }
                                    }}
                                    disabled={!rejectionReason.trim() || processing !== null}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal d'édition de partenaire */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowEditModal(false);
                    setEditingPartner(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Modifier le partenaire</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowEditModal(false);
                                    setEditingPartner(null);
                                }}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        <KeyboardAwareScreen style={styles.modalBody}>
                            <ScrollView showsVerticalScrollIndicator={true}>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Nom *</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Nom du partenaire"
                                        value={editForm.name}
                                        onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Description</Text>
                                    <TextInput
                                        style={[styles.textInput, styles.textArea]}
                                        placeholder="Description du partenaire"
                                        value={editForm.description}
                                        onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Type de partenaire</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="livraison, pharmacie, etc."
                                        value={editForm.partner_type}
                                        onChangeText={(text) => setEditForm({ ...editForm, partner_type: text })}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Email de contact</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="contact@partenaire.com"
                                        value={editForm.contact_email}
                                        onChangeText={(text) => setEditForm({ ...editForm, contact_email: text })}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Téléphone</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="+237 6XX XXX XXX"
                                        value={editForm.contact_phone}
                                        onChangeText={(text) => setEditForm({ ...editForm, contact_phone: text })}
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Adresse</Text>
                                    <TextInput
                                        style={[styles.textInput, styles.textArea]}
                                        placeholder="Adresse complète"
                                        value={editForm.address}
                                        onChangeText={(text) => setEditForm({ ...editForm, address: text })}
                                        multiline
                                        numberOfLines={2}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Ville</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Ville"
                                        value={editForm.city}
                                        onChangeText={(text) => setEditForm({ ...editForm, city: text })}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Pays *</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Cameroun, Sénégal, etc."
                                        value={editForm.country}
                                        onChangeText={(text) => setEditForm({ ...editForm, country: text })}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Continent</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Afrique, Europe, etc."
                                        value={editForm.continent}
                                        onChangeText={(text) => setEditForm({ ...editForm, continent: text })}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Site web</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="https://..."
                                        value={editForm.website}
                                        onChangeText={(text) => setEditForm({ ...editForm, website: text })}
                                        keyboardType="url"
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>URL du logo</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="https://..."
                                        value={editForm.logo_url}
                                        onChangeText={(text) => setEditForm({ ...editForm, logo_url: text })}
                                        keyboardType="url"
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Adresse de localisation</Text>
                                    <TextInput
                                        style={[styles.textInput, styles.textArea]}
                                        placeholder="Adresse formatée"
                                        value={editForm.location_address}
                                        onChangeText={(text) => setEditForm({ ...editForm, location_address: text })}
                                        multiline
                                        numberOfLines={2}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Latitude</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="4.0511"
                                        value={editForm.location_latitude?.toString() || ''}
                                        onChangeText={(text) => setEditForm({
                                            ...editForm,
                                            location_latitude: text ? parseFloat(text) : undefined
                                        })}
                                        keyboardType="numeric"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Longitude</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="9.7679"
                                        value={editForm.location_longitude?.toString() || ''}
                                        onChangeText={(text) => setEditForm({
                                            ...editForm,
                                            location_longitude: text ? parseFloat(text) : undefined
                                        })}
                                        keyboardType="numeric"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.checkboxContainer,
                                            editForm.is_active && styles.checkboxContainerActive
                                        ]}
                                        onPress={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                                    >
                                        <SafeIcon
                                            name={editForm.is_active ? "check-square" : "square"}
                                            size={20}
                                            color={editForm.is_active ? modernColors.primary : modernColors.textSecondary}
                                        />
                                        <Text style={styles.checkboxLabel}>Partenaire actif</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalActions}>
                                    <NativeButton
                                        title="Annuler"
                                        variant="outline"
                                        onPress={() => {
                                            setShowEditModal(false);
                                            setEditingPartner(null);
                                        }}
                                        style={styles.modalButton}
                                    />
                                    <NativeButton
                                        title={processing === editingPartner?.id ? 'Enregistrement...' : 'Enregistrer'}
                                        variant="primary"
                                        onPress={handleSaveEdit}
                                        disabled={!editForm.name.trim() || processing === editingPartner?.id}
                                        loading={processing === editingPartner?.id}
                                        style={styles.modalButton}
                                    />
                                </View>
                            </ScrollView>
                        </KeyboardAwareScreen>
                    </View>
                </View>
            </Modal>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        flex: 1,
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginLeft: 12,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        paddingHorizontal: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: modernColors.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    tabTextActive: {
        color: modernColors.primary,
    },
    statusBadgePending: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: modernColors.warning + '20' || '#FEF3C7',
    },
    statusTextPending: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.warning || '#F59E0B',
    },
    detailCard: {
        marginBottom: 16,
        padding: 16,
    },
    detailLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    detailValue: {
        fontSize: 16,
        color: modernColors.text,
        marginBottom: 4,
    },
    closeButton: {
        padding: 4,
    },
    textInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.background,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    formCard: {
        marginBottom: 16,
        padding: 16,
    },
    formTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
        marginBottom: 12,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    switchLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    switch: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.border,
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    switchActive: {
        backgroundColor: modernColors.primary,
    },
    switchThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
    },
    switchThumbActive: {
        marginLeft: 22,
    },
    formActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        marginBottom: 12,
    },
    checkboxContainerActive: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '10',
    },
    checkboxLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    modalButton: {
        flex: 1,
    },
    emptyCard: {
        padding: 32,
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    partnerCard: {
        marginBottom: 16,
        padding: 16,
    },
    partnerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    partnerInfo: {
        flex: 1,
    },
    partnerName: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    partnerDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    partnerMeta: {
        gap: 4,
    },
    partnerMetaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    partnerStatus: {
        marginLeft: 12,
    },
    activeBadge: {
        backgroundColor: modernColors.success || '#10B981',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    activeBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    inactiveBadge: {
        backgroundColor: modernColors.textSecondary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    inactiveBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    partnerActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        gap: 6,
    },
    deleteButton: {
        borderColor: modernColors.error || '#EF4444',
        backgroundColor: '#FEF2F2',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    deleteButtonText: {
        color: modernColors.error || '#EF4444',
    },
    // ✅ NOUVEAU 2026-01-04: Styles pour le sélecteur de type de partenaire
    inputContainer: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    pickerContainer: {
        gap: 8,
    },
    partnerTypeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    partnerTypeOptionSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary,
    },
    partnerTypeOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    partnerTypeOptionTextSelected: {
        color: modernColors.surface,
        fontWeight: '600',
    },
    // ✅ NOUVEAU 2026-01-04: Styles pour la localisation
    locationInfo: {
        fontSize: 12,
        color: modernColors.primary,
        marginTop: 8,
        fontWeight: '500',
    },
    // ✅ NOUVEAU: Styles pour le bouton GPS
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    gpsText: {
        marginTop: 8,
        fontSize: 12,
        color: '#6B7280',
    },
    // ✅ NOUVEAU: Styles pour la liste déroulante de type de partenaire
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    pickerButtonText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    pickerButtonPlaceholder: {
        color: modernColors.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        width: '100%',
        zIndex: 1001,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    modalList: {
        maxHeight: 400,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalOptionSelected: {
        backgroundColor: modernColors.primary + '10',
    },
    modalOptionText: {
        fontSize: 16,
        color: modernColors.text,
    },
    modalOptionTextSelected: {
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default DeliveryPartnersAdminScreen;

