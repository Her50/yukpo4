import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi } from '../services/api';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

interface ServiceManagementCardProps {
    service: any;
    onServiceUpdated?: () => void;
    onServiceDeleted?: () => void;
}

const ServiceManagementCard: React.FC<ServiceManagementCardProps> = ({
    service,
    onServiceUpdated,
    onServiceDeleted,
}) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [showShareModal, setShowShareModal] = useState(false);
    const [showPromotionModal, setShowPromotionModal] = useState(false);
    const [promotionData, setPromotionData] = useState({
        title: '',
        description: '',
        discount: '',
        duration: '7',
    });

    // Extraire les données du service
    const getServiceFieldValue = (field: any) => {
        if (!field) return 'Non spécifié';
        if (typeof field === 'string') return field;
        if (field.valeur) return field.valeur;
        if (field.value) return field.value;
        return 'Non spécifié';
    };

    const serviceTitle = getServiceFieldValue(service.data?.titre || service.data?.titre_service || service.nom);
    const serviceDescription = getServiceFieldValue(service.data?.description || service.data?.description_service);
    const servicePrice = getServiceFieldValue(service.data?.prix || service.data?.prix_service);
    const serviceCategory = getServiceFieldValue(service.data?.categorie || service.data?.categorie_service);
    const serviceLocation = getServiceFieldValue(service.data?.localisation || service.data?.adresse);

    const isActive = service.is_active !== undefined ? service.is_active : service.actif;

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Date inconnue';
        try {
            return new Date(dateString).toLocaleDateString('fr-FR');
        } catch {
            return 'Date inconnue';
        }
    };

    const getStatusColor = (active: boolean) => {
        return active ? '#10B981' : '#EF4444';
    };

    const getStatusText = (active: boolean) => {
        return active ? 'Actif' : 'Inactif';
    };

    const getStatusIcon = (active: boolean) => {
        return active ? '🟢' : '🔴';
    };

    // Fonction pour activer/désactiver un service (avec gestion du coût comme le frontend)
    const toggleServiceStatus = async () => {
        try {
            // Si on réactive un service (passage de inactif à actif), facturer 1000 FCFA
            if (!isActive) {
                // Vérifier le solde avant la réactivation
                const balanceResponse = await servicesApi.getTokensBalance();

                if (balanceResponse.success) {
                    const currentBalance = balanceResponse.data.tokens_balance;
                    const activationCost = 1000; // 1000 FCFA pour réactivation

                    if (currentBalance < activationCost) {
                        Alert.alert(
                            'Solde insuffisant',
                            `Solde insuffisant pour réactiver le service.\n\nSolde actuel: ${currentBalance} FCFA\nCoût de réactivation: ${activationCost} FCFA`
                        );
                        return;
                    }

                    // Confirmer la réactivation avec coût
                    Alert.alert(
                        'Confirmer la réactivation',
                        `Cette action coûtera ${activationCost} FCFA.\n\nVotre solde actuel: ${currentBalance} FCFA\nNouveau solde: ${currentBalance - activationCost} FCFA`,
                        [
                            { text: 'Annuler', style: 'cancel' },
                            {
                                text: 'Confirmer',
                                onPress: async () => {
                                    try {
                                        // Déduire le coût de réactivation
                                        await servicesApi.deductBalance(activationCost, 'Réactivation de service');

                                        // Activer le service
                                        const response = await servicesApi.toggleServiceStatus(service.id, true);

                                        if (response.success) {
                                            Alert.alert(
                                                'Succès',
                                                `Service réactivé avec succès.\n\n${activationCost} FCFA ont été déduits de votre solde.`,
                                                [{ text: 'OK', onPress: onServiceUpdated }]
                                            );
                                        } else {
                                            Alert.alert('Erreur', 'Impossible de réactiver le service');
                                        }
                                    } catch (error) {
                                        console.error('Erreur lors de la réactivation:', error);
                                        Alert.alert('Erreur', 'Erreur lors de la réactivation du service');
                                    }
                                }
                            }
                        ]
                    );
                } else {
                    Alert.alert('Erreur', 'Impossible de récupérer votre solde');
                }
            } else {
                // Désactivation (gratuite)
                const response = await servicesApi.toggleServiceStatus(service.id, false);

                if (response.success) {
                    Alert.alert(
                        'Succès',
                        'Service désactivé avec succès',
                        [{ text: 'OK', onPress: onServiceUpdated }]
                    );
                } else {
                    Alert.alert('Erreur', 'Impossible de désactiver le service');
                }
            }
        } catch (error) {
            console.error('Erreur lors du changement de statut:', error);
            Alert.alert('Erreur', 'Erreur lors du changement de statut');
        }
    };

    // Fonction pour supprimer un service
    const deleteService = () => {
        Alert.alert(
            'Confirmer la suppression',
            `Êtes-vous sûr de vouloir supprimer définitivement le service "${serviceTitle}" ?\n\nCette action est irréversible.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await servicesApi.deleteService(service.id);

                            if (response.success) {
                                Alert.alert('Succès', 'Service supprimé avec succès');
                                onServiceDeleted?.();
                            } else {
                                Alert.alert('Erreur', 'Impossible de supprimer le service');
                            }
                        } catch (error) {
                            console.error('Erreur lors de la suppression:', error);
                            Alert.alert('Erreur', 'Erreur lors de la suppression du service');
                        }
                    },
                },
            ]
        );
    };

    // Fonction pour partager un service
    const shareService = async () => {
        try {
            const serviceUrl = `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/service/${service.id}`;
            const shareText = `Découvrez ce service exceptionnel sur Yukpo : ${serviceTitle}\n\n${serviceUrl}`;

            const result = await Share.share({
                message: shareText,
                title: serviceTitle,
                url: serviceUrl,
            });

            if (result.action === Share.sharedAction) {
                Alert.alert('Succès', 'Service partagé avec succès');
            }
        } catch (error) {
            console.error('Erreur lors du partage:', error);
            Alert.alert('Erreur', 'Impossible de partager le service');
        }
    };

    // Fonction pour modifier un service (comme le frontend)
    const editService = () => {
        console.log('[ServiceManagementCard] Navigation vers modification service:', service.id);
        (navigation as any).navigate('FormulaireYukpoIntelligent', {
            suggestion: {
                data: service.data || {},
                intention: service.intention || 'creation_service',
                confidence: service.confidence || 0.8
            },
            type: 'modification_service',
            mode: 'edit',
            serviceId: service.id
        });
    };

    // Fonction pour voir un service (comme le frontend)
    const viewService = () => {
        console.log('[ServiceManagementCard] Navigation vers visualisation service:', service.id);
        (navigation as any).navigate('FormulaireYukpoIntelligent', {
            suggestion: {
                data: service.data || {},
                intention: service.intention || 'creation_service',
                confidence: service.confidence || 0.8
            },
            type: 'visualisation_service',
            mode: 'readonly',
            serviceId: service.id
        });
    };

    // Fonction pour gérer la promotion
    const handlePromotion = () => {
        setShowPromotionModal(true);
    };

    const savePromotion = async () => {
        try {
            const response = await servicesApi.updateServicePromotion(service.id, promotionData);

            if (response.success) {
                Alert.alert('Succès', 'Promotion mise à jour avec succès');
                setShowPromotionModal(false);
                onServiceUpdated?.();
            } else {
                Alert.alert('Erreur', 'Impossible de mettre à jour la promotion');
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la promotion:', error);
            Alert.alert('Erreur', 'Erreur lors de la mise à jour de la promotion');
        }
    };

    return (
        <View style={styles.container}>
            {/* Header avec statut */}
            <View style={styles.header}>
                <View style={styles.statusContainer}>
                    <Text style={styles.statusIcon}>{getStatusIcon(isActive)}</Text>
                    <Text style={[styles.statusText, { color: getStatusColor(isActive) }]}>
                        {getStatusText(isActive)}
                    </Text>
                </View>
                <Text style={styles.dateText}>🗓 Créé le {formatDate(service.created_at)}</Text>
            </View>

            {/* Contenu principal */}
            <View style={styles.content}>
                <Text style={styles.title}>{serviceTitle}</Text>
                <Text style={styles.description}>{serviceDescription}</Text>

                {/* Informations du service */}
                <View style={styles.infoContainer}>
                    {servicePrice !== 'Non spécifié' && (
                        <View style={styles.infoItem}>
                            <Text style={styles.infoIcon}>💰</Text>
                            <Text style={styles.infoText}>{servicePrice} FCFA</Text>
                        </View>
                    )}
                    {serviceCategory !== 'Non spécifié' && (
                        <View style={styles.infoItem}>
                            <Text style={styles.infoIcon}>📂</Text>
                            <Text style={styles.infoText}>{serviceCategory}</Text>
                        </View>
                    )}
                    {serviceLocation !== 'Non spécifié' && (
                        <View style={styles.infoItem}>
                            <Text style={styles.infoIcon}>📍</Text>
                            <Text style={styles.infoText}>{serviceLocation}</Text>
                        </View>
                    )}
                </View>

                {/* Promotion active */}
                {service.promotion?.active && (
                    <View style={styles.promotionBanner}>
                        <Text style={styles.promotionIcon}>🎉</Text>
                        <Text style={styles.promotionText}>Promotion active</Text>
                    </View>
                )}
            </View>

            {/* Actions avec design moderne */}
            <View style={styles.actionsContainer}>
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={editService}>
                        <Text style={styles.actionIcon}>✏️</Text>
                        <Text style={styles.actionText}>Modifier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, styles.viewButton]} onPress={viewService}>
                        <Text style={styles.actionIcon}>👁️</Text>
                        <Text style={styles.actionText}>Voir</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={shareService}>
                        <Text style={styles.actionIcon}>📤</Text>
                        <Text style={styles.actionText}>Partager</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            service.promotion?.active ? styles.promotionButtonActive : styles.actionButton
                        ]}
                        onPress={handlePromotion}
                    >
                        <Text style={styles.actionIcon}>🎉</Text>
                        <Text style={styles.actionText}>Promotion</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            isActive ? styles.deactivateButton : styles.activateButton
                        ]}
                        onPress={toggleServiceStatus}
                    >
                        <Text style={styles.actionIcon}>{isActive ? '⏸️' : '▶️'}</Text>
                        <Text style={styles.actionText}>{isActive ? 'Désactiver' : 'Activer'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={deleteService}>
                        <Text style={styles.actionIcon}>🗑️</Text>
                        <Text style={styles.actionText}>Supprimer</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Modal de promotion */}
            <Modal
                visible={showPromotionModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowPromotionModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>🎉 Gérer la promotion</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Titre de la promotion"
                            value={promotionData.title}
                            onChangeText={(text) => setPromotionData(prev => ({ ...prev, title: text }))}
                        />

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Description"
                            value={promotionData.description}
                            onChangeText={(text) => setPromotionData(prev => ({ ...prev, description: text }))}
                            multiline
                        />

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Remise (ex: 20%)"
                            value={promotionData.discount}
                            onChangeText={(text) => setPromotionData(prev => ({ ...prev, discount: text }))}
                        />

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Durée (jours)"
                            value={promotionData.duration}
                            onChangeText={(text) => setPromotionData(prev => ({ ...prev, duration: text }))}
                            keyboardType="numeric"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setShowPromotionModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Annuler</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalSaveButton]}
                                onPress={savePromotion}
                            >
                                <Text style={styles.modalSaveText}>Sauvegarder</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginHorizontal: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingBottom: 8,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusIcon: {
        fontSize: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    dateText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    content: {
        padding: 16,
        paddingTop: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 12,
        lineHeight: 20,
    },
    infoContainer: {
        gap: 8,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoIcon: {
        fontSize: 14,
    },
    infoText: {
        fontSize: 14,
        color: theme.colors.text,
    },
    promotionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        padding: 8,
        borderRadius: 8,
        marginTop: 12,
        gap: 8,
    },
    promotionIcon: {
        fontSize: 16,
    },
    promotionText: {
        fontSize: 12,
        color: '#D97706',
        fontWeight: '600',
    },
    actionsContainer: {
        flexDirection: 'column',
        padding: 16,
        paddingTop: 8,
        gap: 12,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 10, // ✅ Réduit de 16 à 10
        paddingVertical: 8, // ✅ Réduit de 12 à 8
        borderRadius: 10, // ✅ Réduit de 12 à 10
        gap: 4, // ✅ Réduit de 6 à 4
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    promotionButtonActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    editButton: {
        backgroundColor: '#EFF6FF', // ✅ Couleur plus légère
        borderColor: '#3B82F6',
    },
    viewButton: {
        backgroundColor: '#F0FDF4', // Conservé - déjà léger
        borderColor: '#10B981',
    },
    shareButton: {
        backgroundColor: '#FAF5FF', // ✅ Couleur plus légère
        borderColor: '#8B5CF6',
    },
    activateButton: {
        backgroundColor: '#F0FDF4',
        borderColor: '#10B981',
    },
    deactivateButton: {
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
    },
    deleteButton: {
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
    },
    actionIcon: {
        fontSize: 12, // ✅ Réduit de 14 à 12
    },
    actionText: {
        fontSize: 10, // ✅ Réduit de 12 à 10
        color: theme.colors.text,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: theme.colors.text,
        backgroundColor: 'white',
        marginBottom: 12,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalCancelButton: {
        backgroundColor: '#F3F4F6',
    },
    modalCancelText: {
        color: theme.colors.text,
        fontWeight: '600',
    },
    modalSaveButton: {
        backgroundColor: theme.colors.primary,
    },
    modalSaveText: {
        color: 'white',
        fontWeight: '600',
    },
});

export default ServiceManagementCard;
