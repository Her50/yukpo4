import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme/theme';
import SafeIcon from './SafeIcon';

interface ServiceCardModernProps {
    service: {
        id: string | number;
        title: string;
        description: string;
        status: 'active' | 'inactive' | 'pending';
        createdAt: string;
        views?: number;
        interactions?: number;
        data?: any;
        service_id?: number | string;
        [key: string]: any;
    };
    onEdit: (service: any) => void;
    onView: (service: any) => void;
    onShare: (service: any) => void;
    onToggleStatus: (service: any) => void;
    onDelete: (service: any) => void;
    onPromotion?: (service: any) => void;
    onViewProducts?: (service: any) => void;
    onManageTeam?: (service: any) => void;  // ✅ NOUVEAU : Gérer l'équipe
    onCreateVideo?: (service: any) => void;  // ✅ NOUVEAU : Créer une vidéo
}

const ServiceCardModern: React.FC<ServiceCardModernProps> = ({
    service,
    onEdit,
    onView,
    onShare,
    onToggleStatus,
    onDelete,
    onPromotion,
    onViewProducts,
    onManageTeam,  // ✅ NOUVEAU
    onCreateVideo  // ✅ NOUVEAU
}) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#4CAF50';
            case 'inactive': return '#9E9E9E';
            case 'pending': return '#FF9800';
            default: return '#9E9E9E';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return 'Actif';
            case 'inactive': return 'Inactif';
            case 'pending': return 'En attente';
            default: return 'Inconnu';
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Date inconnue';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            return 'Date invalide';
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Supprimer le service',
            `Êtes-vous sûr de vouloir supprimer définitivement le service "${service.title}" ?\n\nCette action est irréversible.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => onDelete(service)
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header avec titre et statut */}
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title} numberOfLines={2}>
                        {service.title}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(service.status) }]}>
                        <Text style={styles.statusText}>
                            {getStatusText(service.status)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Description */}
            <Text style={styles.description} numberOfLines={3}>
                {service.description}
            </Text>

            {/* Informations du service */}
            <View style={styles.serviceInfo}>
                <View style={styles.infoRow}>
                    <SafeIcon name="calendar" size={14} color="#666" />
                    <Text style={styles.infoText}>Créé le {formatDate(service.createdAt)}</Text>
                </View>
                {service.views !== undefined && (
                    <View style={styles.infoRow}>
                        <SafeIcon name="eye" size={14} color="#3B82F6" />
                        <Text style={styles.infoText}>{service.views} vues</Text>
                    </View>
                )}
                {service.interactions !== undefined && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>📊 {service.interactions} interactions</Text>
                    </View>
                )}
                {/* Nombre de produits - Cliquable comme statistique */}
                {service.data?.produits?.valeur && Array.isArray(service.data.produits.valeur) && service.data.produits.valeur.length > 0 && (
                    <TouchableOpacity
                        style={styles.productsStatRow}
                        onPress={() => onViewProducts && onViewProducts(service)}
                        activeOpacity={0.6}
                    >
                        <SafeIcon name="package" size={14} color="#6366F1" />
                        <Text style={styles.productsStatText}>
                            {service.data.produits.valeur.length} produit{service.data.produits.valeur.length > 1 ? 's' : ''}
                        </Text>
                        <SafeIcon name="chevron-right" size={12} color="#6366F1" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Badge Produits - Bien visible */}
            {service.data?.produits?.valeur && Array.isArray(service.data.produits.valeur) && service.data.produits.valeur.length > 0 && (
                <TouchableOpacity
                    style={styles.productsBadge}
                    onPress={() => onViewProducts && onViewProducts(service)}
                    activeOpacity={0.7}
                >
                    <View style={styles.productsBadgeContent}>
                        <SafeIcon name="package" size={18} color="#FFFFFF" />
                        <View style={styles.productsBadgeTextContainer}>
                            <Text style={styles.productsBadgeCount}>
                                {service.data.produits.valeur.length} produit{service.data.produits.valeur.length > 1 ? 's' : ''}
                            </Text>
                            <Text style={styles.productsBadgeAction}>
                                Voir le détail →
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            )}

            {/* Actions - Design amélioré avec labels */}
            <View style={styles.actionsContainer}>
                <View style={styles.actionsRow}>
                    {/* Modifier */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionEdit]}
                        onPress={() => onEdit(service)}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="edit" size={18} color="#6B7280" />
                        <Text style={styles.actionLabel}>Modifier</Text>
                    </TouchableOpacity>

                    {/* Voir */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionView]}
                        onPress={() => onView(service)}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="eye" size={18} color="#6B7280" />
                        <Text style={styles.actionLabel}>Voir</Text>
                    </TouchableOpacity>

                    {/* Partager */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionShare]}
                        onPress={() => onShare(service)}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="share" size={18} color="#3B82F6" />
                        <Text style={[styles.actionLabel, { color: '#3B82F6' }]}>Partager</Text>
                    </TouchableOpacity>

                    {/* Supprimer */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionDelete]}
                        onPress={handleDelete}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="trash-2" size={18} color="#EF4444" />
                        <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Supprimer</Text>
                    </TouchableOpacity>
                </View>

                {/* ✅ NOUVEAU : Seconde rangée d'actions */}
                <View style={styles.actionsRow}>
                    {/* Créer une vidéo */}
                    {onCreateVideo && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionVideo]}
                            onPress={() => onCreateVideo(service)}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="video" size={18} color="#EC4899" />
                            <Text style={[styles.actionLabel, { color: '#EC4899' }]}>Vidéo</Text>
                        </TouchableOpacity>
                    )}

                    {/* Gérer l'équipe */}
                    {onManageTeam && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionTeam]}
                            onPress={() => onManageTeam(service)}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="users" size={18} color="#6366F1" />
                            <Text style={[styles.actionLabel, { color: '#6366F1' }]}>Équipe</Text>
                        </TouchableOpacity>
                    )}

                    {/* Promouvoir (publicité) */}
                    {onPromotion && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionPromo]}
                            onPress={() => onPromotion(service)}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="megaphone" size={18} color="#F59E0B" />
                            <Text style={[styles.actionLabel, { color: '#F59E0B' }]}>Promouvoir</Text>
                        </TouchableOpacity>
                    )}

                    {/* Activer/Désactiver */}
                    <TouchableOpacity
                        style={[styles.actionButton, service.status === 'active' ? styles.actionDeactivate : styles.actionActivate]}
                        onPress={() => onToggleStatus(service)}
                        activeOpacity={0.7}
                    >
                        <SafeIcon
                            name={service.status === 'active' ? 'pause-circle' : 'play-circle'}
                            size={18}
                            color={service.status === 'active' ? '#F97316' : '#10B981'}
                        />
                        <Text style={[styles.actionLabel, { color: service.status === 'active' ? '#F97316' : '#10B981' }]}>
                            {service.status === 'active' ? 'Désactiver' : 'Activer'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    header: {
        marginBottom: 12,
    },
    titleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        flex: 1,
        marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    description: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
        marginBottom: 12,
    },
    serviceInfo: {
        marginBottom: 16,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 12,
        color: '#666',
        marginLeft: 6,
    },
    productsStatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        alignSelf: 'flex-start',
    },
    productsStatText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366F1',
    },
    productsBadge: {
        marginTop: 12,
        marginBottom: 8,
        backgroundColor: '#6366F1',
        borderRadius: 12,
        padding: 14,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    productsBadgeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    productsBadgeTextContainer: {
        flex: 1,
    },
    productsBadgeCount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    productsBadgeAction: {
        fontSize: 12,
        color: '#E0E7FF',
        marginTop: 2,
    },
    actionsContainer: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 4,
        minWidth: 85,
    },
    actionEdit: {
        backgroundColor: '#F3F4F6',
    },
    actionView: {
        backgroundColor: '#EEF2FF',
    },
    actionShare: {
        backgroundColor: '#EFF6FF',
        borderColor: '#BFDBFE',
    },
    actionDelete: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    actionTeam: {
        backgroundColor: '#EEF2FF',
        borderColor: '#C7D2FE',
    },
    actionPromo: {
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
    },
    actionActivate: {
        backgroundColor: '#D1FAE5',
        borderColor: '#A7F3D0',
    },
    actionDeactivate: {
        backgroundColor: '#FFEDD5',
        borderColor: '#FED7AA',
    },
    actionVideo: {
        backgroundColor: '#FDF2F8',
        borderColor: '#FBCFE8',
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
    },
});

export default ServiceCardModern;
