import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    Linking,
    Modal,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiDelete, apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { isAdminUser } from '../../utils/roleHelpers';

interface ExternalProvider {
    id: number;
    provider_name: string;
    api_key: string;
    api_secret: string;
    contact_email?: string;
    contact_phone?: string;
    webhook_url?: string;
    is_active: boolean;
    rate_limit_per_hour: number;
    total_deliveries: number;
    created_at: string;
    last_used_at?: string;
}

const FORM_URL = 'https://yukpo-backend-376093909298.europe-west1.run.app/api/delivery/partner-form';

const ExternalProvidersAdminScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const [providers, setProviders] = useState<ExternalProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<ExternalProvider | null>(null);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({
        provider_name: '',
        contact_phone: '',
        contact_email: '',
    });
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdProvider, setCreatedProvider] = useState<ExternalProvider | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !isAdminUser(user)) {
            Alert.alert(t('extProviders.accessDenied'), t('extProviders.adminOnly'));
            navigation.goBack();
            return;
        }
        loadProviders();
    }, [user]);

    const loadProviders = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/admin/external-providers');
            const data: any = response?.data || response;
            const list = data?.providers || [];
            setProviders(list);
        } catch (error: any) {
            console.error('[ExternalProviders] Erreur chargement:', error);
            Alert.alert(t('message.error'), error?.message || t('extProviders.cannotLoadProviders'));
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!createForm.provider_name.trim()) {
            Alert.alert(t('message.error'), t('extProviders.nameRequired'));
            return;
        }

        try {
            setCreating(true);
            const response = await apiPost('/api/admin/external-providers', {
                provider_name: createForm.provider_name.trim(),
                contact_phone: createForm.contact_phone.trim() || null,
                contact_email: createForm.contact_email.trim() || null,
            });

            const data: any = response?.data || response;
            if (data?.success !== false) {
                const provider = data?.provider;
                setShowCreateModal(false);
                setCreateForm({ provider_name: '', contact_phone: '', contact_email: '' });
                loadProviders();

                // Ouvrir le modal de succès avec les identifiants et options de partage
                if (provider) {
                    setCreatedProvider(provider);
                    setShowSuccessModal(true);
                }
            } else {
                throw new Error(data?.message || 'Erreur lors de la création');
            }
        } catch (error: any) {
            console.error('[ExternalProviders] Erreur création:', error);
            Alert.alert(t('message.error'), error?.message || t('extProviders.cannotCreate'));
        } finally {
            setCreating(false);
        }
    };

    const handleDeactivate = (provider: ExternalProvider) => {
        Alert.alert(
            t('extProviders.deactivateProvider'),
            t('extProviders.confirmDeactivate', { name: provider.provider_name }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Désactiver',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiDelete(`/api/admin/external-providers/${provider.id}`);
                            loadProviders();
                            setShowDetailModal(false);
                            setSelectedProvider(null);
                            Alert.alert(t('message.success'), t('extProviders.providerDeactivated'));
                        } catch (error: any) {
                            Alert.alert(t('message.error'), error?.message || t('extProviders.cannotDeactivate'));
                        }
                    },
                },
            ]
        );
    };

    const shareProviderCredentials = async (provider: ExternalProvider) => {
        const message =
            `\uD83D\uDE9A Yukpo - Vos identifiants de livraison\n\n` +
            `Bonjour ${provider.provider_name},\n\n` +
            `Voici vos identifiants pour commander des livraisons Yukpo :\n\n` +
            `\uD83D\uDCCB Votre clé API : ${provider.api_key}\n\n` +
            `\uD83D\uDCF1 Formulaire de commande :\n${FORM_URL}\n\n` +
            `Ouvrez le lien ci-dessus dans votre navigateur, entrez votre clé API et les détails de la livraison.\n\n` +
            `Pour toute question, contactez le support Yukpo.`;

        try {
            await Share.share({
                message,
                title: 'Identifiants Yukpo Livraison',
            });
        } catch (error) {
            console.error('[ExternalProviders] Erreur partage:', error);
        }
    };

    const sendViaWhatsApp = async (provider: ExternalProvider) => {
        const phone = provider.contact_phone?.replace(/[^0-9+]/g, '') || '';
        const message =
            `\uD83D\uDE9A *Yukpo - Vos identifiants de livraison*\n\n` +
            `Bonjour *${provider.provider_name}*,\n\n` +
            `Voici vos identifiants pour commander des livraisons Yukpo :\n\n` +
            `\uD83D\uDCCB Votre clé API : \`${provider.api_key}\`\n\n` +
            `\uD83D\uDCF1 Formulaire de commande :\n${FORM_URL}\n\n` +
            `Ouvrez le lien ci-dessus dans votre navigateur, entrez votre clé API et les détails de la livraison.`;

        const encodedMessage = encodeURIComponent(message);
        let url = '';

        if (phone) {
            // Numéro avec préfixe international
            const cleanPhone = phone.startsWith('+') ? phone.substring(1) : phone;
            url = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
        } else {
            // Sans numéro, ouvrir WhatsApp pour choisir le contact
            url = `whatsapp://send?text=${encodedMessage}`;
        }

        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            // Fallback: partage standard
            shareProviderCredentials(provider);
        }
    };

    const sendViaSMS = async (provider: ExternalProvider) => {
        const phone = provider.contact_phone?.replace(/[^0-9+]/g, '') || '';
        const message =
            `Yukpo Livraison - Vos identifiants\n` +
            `Clé API: ${provider.api_key}\n` +
            `Formulaire: ${FORM_URL}`;

        const url = `sms:${phone}?body=${encodeURIComponent(message)}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert(t('message.error'), t('extProviders.cannotOpenSMS'));
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

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Prestataires externes</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.addButton}>
                    <SafeIcon name="plus" size={24} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {/* Info card */}
            <NativeCard style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <SafeIcon name="info" size={18} color="#3B82F6" />
                    <Text style={styles.infoText}>
                        Les prestataires externes peuvent commander des livraisons via le formulaire web avec leur clé API.
                    </Text>
                </View>
            </NativeCard>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : providers.length === 0 ? (
                <NativeCard style={styles.emptyCard}>
                    <SafeIcon name="users" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucun prestataire externe</Text>
                    <Text style={styles.emptySubtext}>
                        Créez un prestataire et partagez-lui sa clé API pour qu'il puisse commander des livraisons
                    </Text>
                    <NativeButton
                        title="Créer un prestataire"
                        variant="primary"
                        onPress={() => setShowCreateModal(true)}
                    />
                </NativeCard>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {providers.map((provider) => (
                        <TouchableOpacity
                            key={provider.id}
                            onPress={() => {
                                setSelectedProvider(provider);
                                setShowDetailModal(true);
                            }}
                        >
                            <NativeCard style={styles.providerCard}>
                                <View style={styles.providerHeader}>
                                    <View style={styles.providerInfo}>
                                        <Text style={styles.providerName}>{provider.provider_name}</Text>
                                        {provider.contact_phone && (
                                            <Text style={styles.providerMeta}>
                                                \uD83D\uDCDE {provider.contact_phone}
                                            </Text>
                                        )}
                                        {provider.contact_email && (
                                            <Text style={styles.providerMeta}>
                                                ✉️ {provider.contact_email}
                                            </Text>
                                        )}
                                        <Text style={styles.providerMeta}>
                                            \uD83D\uDCE6 {provider.total_deliveries} livraison{provider.total_deliveries !== 1 ? 's' : ''}
                                        </Text>
                                        <Text style={styles.providerMeta}>
                                            \uD83D\uDCC5 Créé: {formatDate(provider.created_at)}
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.statusBadge,
                                        provider.is_active ? styles.activeBadge : styles.inactiveBadge
                                    ]}>
                                        <Text style={[
                                            styles.statusText,
                                            provider.is_active ? styles.activeText : styles.inactiveText
                                        ]}>
                                            {provider.is_active ? 'Actif' : 'Inactif'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Actions rapides */}
                                <View style={styles.quickActions}>
                                    <TouchableOpacity
                                        style={[styles.quickAction, { backgroundColor: '#25D366' }]}
                                        onPress={() => sendViaWhatsApp(provider)}
                                    >
                                        <Text style={styles.quickActionText}>WhatsApp</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickAction, { backgroundColor: '#3B82F6' }]}
                                        onPress={() => sendViaSMS(provider)}
                                    >
                                        <Text style={styles.quickActionText}>SMS</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickAction, { backgroundColor: '#8B5CF6' }]}
                                        onPress={() => shareProviderCredentials(provider)}
                                    >
                                        <Text style={styles.quickActionText}>Partager</Text>
                                    </TouchableOpacity>
                                </View>
                            </NativeCard>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Modal de création */}
            <Modal
                visible={showCreateModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nouveau prestataire</Text>
                            <TouchableOpacity
                                onPress={() => setShowCreateModal(false)}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Nom du prestataire *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Ex: Pharmacie du Centre, Restaurant Le Bon"
                                    value={createForm.provider_name}
                                    onChangeText={(text) => setCreateForm({ ...createForm, provider_name: text })}
                                    autoFocus
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Téléphone (WhatsApp)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="+237 6XX XXX XXX"
                                    value={createForm.contact_phone}
                                    onChangeText={(text) => setCreateForm({ ...createForm, contact_phone: text })}
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Email</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="contact@prestataire.com"
                                    value={createForm.contact_email}
                                    onChangeText={(text) => setCreateForm({ ...createForm, contact_email: text })}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <NativeCard style={styles.infoCard}>
                                <Text style={styles.infoTextSmall}>
                                    Une clé API unique sera automatiquement générée. Vous pourrez l'envoyer au prestataire par WhatsApp, SMS ou autre.
                                </Text>
                            </NativeCard>

                            <View style={styles.modalActions}>
                                <NativeButton
                                    title="Annuler"
                                    variant="outline"
                                    onPress={() => setShowCreateModal(false)}
                                />
                                <NativeButton
                                    title={creating ? 'Création...' : 'Créer'}
                                    variant="primary"
                                    onPress={handleCreate}
                                    disabled={!createForm.provider_name.trim() || creating}
                                    loading={creating}
                                />
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal de succès après création — Identifiants + Partage */}
            <Modal
                visible={showSuccessModal && !!createdProvider}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowSuccessModal(false);
                    setCreatedProvider(null);
                    setCopiedField(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalHeader, { backgroundColor: '#F0FDF4', borderBottomColor: '#BBF7D0' }]}>
                            <Text style={[styles.modalTitle, { color: '#166534' }]}>
                                Prestataire créé avec succès
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowSuccessModal(false);
                                    setCreatedProvider(null);
                                    setCopiedField(null);
                                }}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        {createdProvider && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.successBanner}>
                                    <SafeIcon name="check-circle" size={40} color="#22C55E" />
                                    <Text style={styles.successTitle}>{createdProvider.provider_name}</Text>
                                    <Text style={styles.successSubtitle}>Les identifiants ci-dessous permettent de commander des livraisons</Text>
                                </View>

                                {/* Clé API */}
                                <NativeCard style={styles.credentialCard}>
                                    <Text style={styles.credentialLabel}>Clé API</Text>
                                    <View style={styles.credentialRow}>
                                        <Text style={styles.apiKeyText} selectable numberOfLines={1}>
                                            {createdProvider.api_key}
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.copyBtn, copiedField === 'api_key' && styles.copyBtnDone]}
                                            onPress={() => {
                                                Clipboard.setString(createdProvider.api_key);
                                                setCopiedField('api_key');
                                                setTimeout(() => setCopiedField(null), 2000);
                                            }}
                                        >
                                            <SafeIcon name={copiedField === 'api_key' ? 'check' : 'copy'} size={16} color={copiedField === 'api_key' ? '#22C55E' : '#7C3AED'} />
                                        </TouchableOpacity>
                                    </View>
                                </NativeCard>

                                {/* Lien formulaire */}
                                <NativeCard style={styles.credentialCard}>
                                    <Text style={styles.credentialLabel}>Lien du formulaire de commande</Text>
                                    <View style={styles.credentialRow}>
                                        <Text style={[styles.urlText, { flex: 1 }]} selectable numberOfLines={2}>
                                            {`${FORM_URL}?key=${createdProvider.api_key}`}
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.copyBtn, copiedField === 'url' && styles.copyBtnDone]}
                                            onPress={() => {
                                                Clipboard.setString(`${FORM_URL}?key=${createdProvider.api_key}`);
                                                setCopiedField('url');
                                                setTimeout(() => setCopiedField(null), 2000);
                                            }}
                                        >
                                            <SafeIcon name={copiedField === 'url' ? 'check' : 'copy'} size={16} color={copiedField === 'url' ? '#22C55E' : '#3B82F6'} />
                                        </TouchableOpacity>
                                    </View>
                                </NativeCard>

                                {/* Info */}
                                <NativeCard style={[styles.infoCard, { marginHorizontal: 0, marginTop: 4 }]}>
                                    <View style={styles.infoRow}>
                                        <SafeIcon name="info" size={16} color="#3B82F6" />
                                        <Text style={[styles.infoText, { fontSize: 12 }]}>
                                            Le prestataire ouvrira ce lien dans son navigateur pour commander des livraisons. La clé API est pré-remplie dans le formulaire.
                                        </Text>
                                    </View>
                                </NativeCard>

                                {/* Boutons de partage */}
                                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Envoyer au prestataire</Text>

                                <TouchableOpacity
                                    style={styles.whatsappMainBtn}
                                    onPress={() => sendViaWhatsApp(createdProvider)}
                                >
                                    <SafeIcon name="message-circle" size={22} color="white" />
                                    <Text style={styles.whatsappMainBtnText}>Envoyer par WhatsApp</Text>
                                </TouchableOpacity>

                                <View style={[styles.shareButtons, { marginTop: 10 }]}>
                                    <TouchableOpacity
                                        style={[styles.shareButton, { backgroundColor: '#3B82F6' }]}
                                        onPress={() => sendViaSMS(createdProvider)}
                                    >
                                        <SafeIcon name="smartphone" size={20} color="white" />
                                        <Text style={styles.shareButtonText}>SMS</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.shareButton, { backgroundColor: '#8B5CF6' }]}
                                        onPress={() => shareProviderCredentials(createdProvider)}
                                    >
                                        <SafeIcon name="Redo2" size={20} color="white" />
                                        <Text style={styles.shareButtonText}>Partager</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={styles.laterBtn}
                                    onPress={() => {
                                        setShowSuccessModal(false);
                                        setCreatedProvider(null);
                                        setCopiedField(null);
                                    }}
                                >
                                    <Text style={styles.laterBtnText}>Fermer</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal de détails */}
            <Modal
                visible={showDetailModal && !!selectedProvider}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowDetailModal(false);
                    setSelectedProvider(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {selectedProvider?.provider_name}
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowDetailModal(false);
                                    setSelectedProvider(null);
                                }}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedProvider && (
                            <ScrollView style={styles.modalBody}>
                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Clé API</Text>
                                    <Text style={styles.apiKeyText} selectable>
                                        {selectedProvider.api_key}
                                    </Text>
                                </NativeCard>

                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Formulaire web</Text>
                                    <Text style={styles.urlText} selectable>
                                        {FORM_URL}
                                    </Text>
                                </NativeCard>

                                {selectedProvider.contact_phone && (
                                    <NativeCard style={styles.detailCard}>
                                        <Text style={styles.detailLabel}>Téléphone</Text>
                                        <Text style={styles.detailValue}>{selectedProvider.contact_phone}</Text>
                                    </NativeCard>
                                )}

                                {selectedProvider.contact_email && (
                                    <NativeCard style={styles.detailCard}>
                                        <Text style={styles.detailLabel}>Email</Text>
                                        <Text style={styles.detailValue}>{selectedProvider.contact_email}</Text>
                                    </NativeCard>
                                )}

                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Statistiques</Text>
                                    <Text style={styles.detailValue}>
                                        \uD83D\uDCE6 {selectedProvider.total_deliveries} livraison{selectedProvider.total_deliveries !== 1 ? 's' : ''}
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        ⚡ Limite: {selectedProvider.rate_limit_per_hour} requêtes/heure
                                    </Text>
                                    {selectedProvider.last_used_at && (
                                        <Text style={styles.detailValue}>
                                            \uD83D\uDD50 Dernière utilisation: {formatDate(selectedProvider.last_used_at)}
                                        </Text>
                                    )}
                                </NativeCard>

                                <Text style={styles.sectionTitle}>Envoyer les identifiants</Text>

                                <View style={styles.shareButtons}>
                                    <TouchableOpacity
                                        style={[styles.shareButton, { backgroundColor: '#25D366' }]}
                                        onPress={() => sendViaWhatsApp(selectedProvider)}
                                    >
                                        <SafeIcon name="message-circle" size={24} color="white" />
                                        <Text style={styles.shareButtonText}>WhatsApp</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.shareButton, { backgroundColor: '#3B82F6' }]}
                                        onPress={() => sendViaSMS(selectedProvider)}
                                    >
                                        <SafeIcon name="smartphone" size={24} color="white" />
                                        <Text style={styles.shareButtonText}>SMS</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.shareButton, { backgroundColor: '#8B5CF6' }]}
                                        onPress={() => shareProviderCredentials(selectedProvider)}
                                    >
                                        <SafeIcon name="Redo2" size={24} color="white" />
                                        <Text style={styles.shareButtonText}>Partager</Text>
                                    </TouchableOpacity>
                                </View>

                                {selectedProvider.is_active && (
                                    <TouchableOpacity
                                        style={styles.deactivateButton}
                                        onPress={() => handleDeactivate(selectedProvider)}
                                    >
                                        <SafeIcon name="x-circle" size={18} color="#EF4444" />
                                        <Text style={styles.deactivateText}>Désactiver ce prestataire</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeNativeView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginLeft: 8,
    },
    addButton: {
        padding: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    infoCard: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#1E40AF',
        lineHeight: 18,
    },
    infoTextSmall: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 18,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    emptyCard: {
        margin: 16,
        padding: 32,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 8,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        gap: 12,
    },
    providerCard: {
        padding: 16,
        borderRadius: 12,
    },
    providerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    providerInfo: {
        flex: 1,
    },
    providerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 4,
    },
    providerMeta: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activeBadge: {
        backgroundColor: '#D1FAE5',
    },
    inactiveBadge: {
        backgroundColor: '#FEE2E2',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    activeText: {
        color: '#059669',
    },
    inactiveText: {
        color: '#DC2626',
    },
    quickActions: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    quickAction: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    quickActionText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        padding: 16,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        marginBottom: 32,
    },
    inputContainer: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: '#FAFAFA',
    },
    // Detail modal
    detailCard: {
        padding: 14,
        marginBottom: 12,
        borderRadius: 10,
    },
    detailLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        color: modernColors.text,
        marginTop: 2,
    },
    apiKeyText: {
        fontSize: 14,
        fontFamily: 'monospace',
        color: '#7C3AED',
        fontWeight: '600',
        backgroundColor: '#F5F3FF',
        padding: 8,
        borderRadius: 6,
        marginTop: 4,
    },
    urlText: {
        fontSize: 13,
        color: '#3B82F6',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 8,
        marginBottom: 12,
    },
    shareButtons: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    shareButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        gap: 6,
    },
    shareButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    deactivateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 12,
        backgroundColor: '#FEF2F2',
    },
    deactivateText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EF4444',
    },
    // Success modal styles
    successBanner: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 16,
    },
    credentialCard: {
        padding: 14,
        marginBottom: 10,
        borderRadius: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#7C3AED',
    },
    credentialLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: modernColors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    credentialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    copyBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F5F3FF',
    },
    copyBtnDone: {
        backgroundColor: '#D1FAE5',
    },
    whatsappMainBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#25D366',
        paddingVertical: 16,
        borderRadius: 14,
    },
    whatsappMainBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    laterBtn: {
        alignItems: 'center',
        paddingVertical: 14,
        marginTop: 8,
        marginBottom: 32,
    },
    laterBtnText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
});

export default ExternalProvidersAdminScreen;
