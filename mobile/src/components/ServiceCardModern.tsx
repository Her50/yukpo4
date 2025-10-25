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
        [key: string]: any;
    };
    onEdit: (service: any) => void;
    onView: (service: any) => void;
    onShare: (service: any) => void;
    onToggleStatus: (service: any) => void;
    onDelete: (service: any) => void;
    onPromotion?: (service: any) => void;
    onViewProducts?: (service: any) => void;
}

const ServiceCardModern: React.FC<ServiceCardModernProps> = ({
    service,
    onEdit,
    onView,
    onShare,
    onToggleStatus,
    onDelete,
    onPromotion,
    onViewProducts
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

            {/* Actions - Design comme le frontend */}
            <View style={styles.actionsContainer}>
                <View style={styles.actionsRow}>
                    {/* Modifier */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => onEdit(service)}
                    >
                        <SafeIcon name="edit" size={20} color="#6B7280" />
                    </TouchableOpacity>

                    {/* Voir */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => onView(service)}
                    >
                        <SafeIcon name="eye" size={20} color="#6B7280" />
                    </TouchableOpacity>

                    {/* Partager */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => onShare(service)}
                    >
                        <SafeIcon name="share" size={20} color="#3B82F6" />
                    </TouchableOpacity>

                    {/* Promotion */}
                    {onPromotion && (
                        <TouchableOpacity
                            style={styles.actionIcon}
                            onPress={() => onPromotion(service)}
                        >
                            <Text style={styles.promotionIcon}>🎉</Text>
                        </TouchableOpacity>
                    )}

                    {/* Supprimer */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={handleDelete}
                    >
                        <SafeIcon name="trash-2" size={20} color="#EF4444" />
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
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 8,
    },
    actionIcon: {
        padding: 8,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    promotionIcon: {
        fontSize: 18,
    },
});

export default ServiceCardModern;
