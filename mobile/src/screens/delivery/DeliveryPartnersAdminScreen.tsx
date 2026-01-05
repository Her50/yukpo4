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
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import LocationSelector, { LocationObject } from '../../components/LocationSelector'; // ✅ NOUVEAU 2026-01-04: Composant de localisation intelligent
import { useAuth } from '../../contexts/AuthContext';
import { apiDelete, apiGet, apiPost, apiPut } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface DeliveryPartner {
    id: number;
    name: string;
    description?: string;
    partner_type?: string; // ✅ NOUVEAU 2026-01-04: Type de partenaire
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    city?: string;
    country: string; // ✅ NOUVEAU 2026-01-04: Pays obligatoire pour distinguer les partenaires
    continent?: string; // ✅ NOUVEAU 2026-01-04: Continent pour meilleure organisation
    website?: string;
    logo_url?: string;
    // ✅ NOUVEAU 2026-01-04: Localisation intelligente du partenaire
    location_latitude?: number;
    location_longitude?: number;
    location_address?: string;
    is_active: boolean;
    created_by?: number;
    created_at: string;
    updated_at: string;
}

const DeliveryPartnersAdminScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [partners, setPartners] = useState<DeliveryPartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [showPartnerTypePicker, setShowPartnerTypePicker] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        partner_type: 'livraison', // ✅ NOUVEAU 2026-01-04: Type de partenaire par défaut
        contact_email: '',
        contact_phone: '',
        address: '',
        city: '',
        country: '',
        website: '',
        logo_url: '',
        // ✅ NOUVEAU 2026-01-04: Localisation intelligente du partenaire
        location_latitude: undefined as number | undefined,
        location_longitude: undefined as number | undefined,
        location_address: '' as string | undefined,
        is_active: true,
    });

    const partnerTypes = [
        { value: 'livraison', label: 'Livraison' },
        { value: 'pharmacie', label: 'Pharmacie' },
        { value: 'hopital', label: 'Hôpital' },
        { value: 'laboratoire', label: 'Laboratoire' },
        { value: 'agence de voyage', label: 'Agence de voyage' },
        { value: 'demenagement', label: 'Déménagement' },
        { value: 'transport', label: 'Transport' },
        { value: 'assureur', label: 'Assureur' }, // ✅ NOUVEAU 2026-01-04
        { value: 'supermarche', label: 'Supermarché' }, // ✅ NOUVEAU 2026-01-04
        { value: 'telecom', label: 'Télécom' }, // ✅ NOUVEAU 2026-01-04
    ];

    useEffect(() => {
        if (user?.role !== 'admin') {
            Alert.alert('Accès refusé', 'Cette page est réservée aux administrateurs');
            navigation.goBack();
            return;
        }
        loadPartners();
    }, [user]);

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

    const handleCreate = () => {
        setEditingPartner(null);
        setFormData({
            name: '',
            description: '',
            partner_type: 'livraison', // ✅ NOUVEAU 2026-01-04: Type par défaut
            contact_email: '',
            contact_phone: '',
            address: '',
            city: '',
            country: '',
            website: '',
            logo_url: '',
            location_latitude: undefined,
            location_longitude: undefined,
            location_address: '',
            is_active: true,
        });
        setShowForm(true);
    };

    const handleEdit = (partner: DeliveryPartner) => {
        setEditingPartner(partner);
        setFormData({
            name: partner.name,
            description: partner.description || '',
            partner_type: partner.partner_type || 'livraison', // ✅ NOUVEAU 2026-01-04: Type de partenaire
            contact_email: partner.contact_email || '',
            contact_phone: partner.contact_phone || '',
            address: partner.address || '',
            city: partner.city || '',
            country: partner.country || '',
            website: partner.website || '',
            logo_url: partner.logo_url || '',
            location_latitude: partner.location_latitude,
            location_longitude: partner.location_longitude,
            location_address: partner.location_address || '',
            is_active: partner.is_active,
        });
        setShowForm(true);
    };

    const handleDelete = async (partnerId: number) => {
        Alert.alert(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir supprimer ce partenaire ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiDelete(`/api/delivery/partners/${partnerId}`);
                            Alert.alert('✅ Succès', 'Partenaire supprimé avec succès');
                            loadPartners();
                        } catch (error: any) {
                            console.error('[DeliveryPartnersAdminScreen] Erreur suppression:', error);
                            Alert.alert('Erreur', error?.message || 'Impossible de supprimer le partenaire');
                        }
                    },
                },
            ]
        );
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Erreur', 'Le nom est requis');
            return;
        }
        if (!formData.country.trim()) {
            Alert.alert('Erreur', 'Le pays est requis');
            return;
        }

        try {
            let response;
            if (editingPartner) {
                response = await apiPut(`/api/delivery/partners/${editingPartner.id}`, formData);
                Alert.alert('✅ Succès', 'Partenaire mis à jour avec succès');
            } else {
                response = await apiPost('/api/delivery/partners', formData);
                Alert.alert('✅ Succès', 'Partenaire créé avec succès');
            }
            
            // ✅ CORRECTION: Vérifier que la réponse est valide
            console.log('[DeliveryPartnersAdminScreen] Réponse sauvegarde:', response);
            
            setShowForm(false);
            // ✅ CORRECTION: Recharger la liste après un court délai pour s'assurer que la DB est à jour
            setTimeout(() => {
                loadPartners();
            }, 500);
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminScreen] Erreur sauvegarde:', error);
            const errorMessage = error?.response?.data?.error || error?.message || 'Impossible de sauvegarder le partenaire';
            Alert.alert('Erreur', errorMessage);
        }
    };

    if (loading) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Gestion des partenaires</Text>
                    <TouchableOpacity onPress={handleCreate} style={styles.addButton}>
                        <SafeIcon name="plus" size={24} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>

                {showForm && (
                    <NativeCard style={styles.formCard}>
                        <Text style={styles.formTitle}>
                            {editingPartner ? 'Modifier le partenaire' : 'Nouveau partenaire'}
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nom *"
                            value={formData.name}
                            onChangeText={(text) => setFormData({ ...formData, name: text })}
                        />
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Description"
                            value={formData.description}
                            onChangeText={(text) => setFormData({ ...formData, description: text })}
                            multiline
                            numberOfLines={3}
                        />
                        {/* ✅ NOUVEAU 2026-01-04: Sélecteur de type de partenaire - Liste déroulante */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Type de partenaire *</Text>
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => setShowPartnerTypePicker(true)}
                            >
                                <Text style={[
                                    styles.pickerButtonText,
                                    !formData.partner_type && styles.pickerButtonPlaceholder
                                ]}>
                                    {formData.partner_type 
                                        ? partnerTypes.find(t => t.value === formData.partner_type)?.label || formData.partner_type
                                        : 'Sélectionner un type...'}
                                </Text>
                                <SafeIcon name="chevron-down" size={18} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                            
                            {/* Modal pour sélectionner le type */}
                            <Modal
                                visible={showPartnerTypePicker}
                                transparent
                                animationType="slide"
                                onRequestClose={() => setShowPartnerTypePicker(false)}
                            >
                                <View style={styles.modalOverlay}>
                                    <View style={styles.modalContent}>
                                        <View style={styles.modalHeader}>
                                            <Text style={styles.modalTitle}>Sélectionner un type de partenaire</Text>
                                            <TouchableOpacity onPress={() => setShowPartnerTypePicker(false)}>
                                                <SafeIcon name="x" size={24} color={modernColors.text} />
                                            </TouchableOpacity>
                                        </View>
                                        <ScrollView style={styles.modalList}>
                                            {partnerTypes.map((type) => (
                                                <TouchableOpacity
                                                    key={type.value}
                                                    style={[
                                                        styles.modalOption,
                                                        formData.partner_type === type.value && styles.modalOptionSelected
                                                    ]}
                                                    onPress={() => {
                                                        setFormData({ ...formData, partner_type: type.value });
                                                        setShowPartnerTypePicker(false);
                                                    }}
                                                >
                                                    <Text style={[
                                                        styles.modalOptionText,
                                                        formData.partner_type === type.value && styles.modalOptionTextSelected
                                                    ]}>
                                                        {type.label}
                                                    </Text>
                                                    {formData.partner_type === type.value && (
                                                        <SafeIcon name="check" size={18} color={modernColors.primary} />
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </View>
                            </Modal>
                        </View>
                        {/* ✅ NOUVEAU 2026-01-04: Sélecteur de localisation intelligent */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Localisation du partenaire</Text>
                            <LocationSelector
                                label=""
                                value={formData.location_address ? { raw: formData.location_address, place_name: formData.location_address } : ''}
                                onSelect={(location: LocationObject) => {
                                    setFormData({
                                        ...formData,
                                        location_latitude: location.coordinates?.lat,
                                        location_longitude: location.coordinates?.lng,
                                        location_address: location.raw || location.place_name || '',
                                        // ✅ NOUVEAU: Extraire ville et pays depuis les composants si disponibles
                                        city: location.components?.ville || formData.city,
                                        country: location.components?.pays || formData.country,
                                    });
                                }}
                                placeholder="Rechercher l'adresse du partenaire..."
                                scope="all" // ✅ EXPLICITE: Recherche universelle pour adresse/lieu
                            />
                            {formData.location_address && (
                                <Text style={styles.locationInfo}>
                                    📍 {formData.location_address}
                                </Text>
                            )}
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="Email de contact"
                            value={formData.contact_email}
                            onChangeText={(text) => setFormData({ ...formData, contact_email: text })}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Téléphone de contact"
                            value={formData.contact_phone}
                            onChangeText={(text) => setFormData({ ...formData, contact_phone: text })}
                            keyboardType="phone-pad"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Adresse"
                            value={formData.address}
                            onChangeText={(text) => setFormData({ ...formData, address: text })}
                            multiline
                        />
                        {/* ✅ NOUVEAU: Ville avec autocomplétion intelligente */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Ville</Text>
                            <LocationSelector
                                label="Ville"
                                value={formData.city ? { raw: formData.city, place_name: formData.city } : ''}
                                onSelect={(location: LocationObject) => {
                                    setFormData({
                                        ...formData,
                                        city: location.place_name || location.raw || '',
                                        // ✅ Extraire le pays depuis les composants si disponible
                                        country: location.components?.pays || formData.country,
                                    });
                                }}
                                placeholder="Rechercher une ville..."
                                scope="city" // ✅ EXPLICITE: Recherche de villes uniquement
                            />
                        </View>
                        {/* ✅ NOUVEAU: Pays avec autocomplétion intelligente */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Pays *</Text>
                            <LocationSelector
                                label="Pays"
                                value={formData.country ? { raw: formData.country, place_name: formData.country } : ''}
                                onSelect={(location: LocationObject) => {
                                    setFormData({
                                        ...formData,
                                        country: location.place_name || location.raw || '',
                                    });
                                }}
                                placeholder="Rechercher un pays..."
                                scope="all" // ✅ EXPLICITE: Recherche universelle pour pays
                            />
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="Continent (ex: Afrique, Europe, Asie...)"
                            value={formData.continent}
                            onChangeText={(text) => setFormData({ ...formData, continent: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Site web"
                            value={formData.website}
                            onChangeText={(text) => setFormData({ ...formData, website: text })}
                            keyboardType="url"
                            autoCapitalize="none"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="URL du logo"
                            value={formData.logo_url}
                            onChangeText={(text) => setFormData({ ...formData, logo_url: text })}
                            keyboardType="url"
                            autoCapitalize="none"
                        />
                        <View style={styles.switchContainer}>
                            <Text style={styles.switchLabel}>Actif</Text>
                            <TouchableOpacity
                                style={[
                                    styles.switch,
                                    formData.is_active && styles.switchActive,
                                ]}
                                onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
                            >
                                <View
                                    style={[
                                        styles.switchThumb,
                                        formData.is_active && styles.switchThumbActive,
                                    ]}
                                />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.formActions}>
                            <NativeButton
                                title="Annuler"
                                variant="outline"
                                onPress={() => setShowForm(false)}
                            />
                            <NativeButton
                                title={editingPartner ? 'Modifier' : 'Créer'}
                                variant="primary"
                                onPress={handleSave}
                            />
                        </View>
                    </NativeCard>
                )}

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
        marginBottom: 24,
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
        color: modernColors.textSecondary,
        marginTop: 8,
        fontStyle: 'italic',
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
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
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

