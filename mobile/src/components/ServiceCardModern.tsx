import { Calendar, Edit2, Eye, Power, PowerOff, Share, Trash2 } from 'phosphor-react-native';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme/theme';

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
}

const ServiceCardModern: React.FC<ServiceCardModernProps> = ({
    service,
    onEdit,
    onView,
    onShare,
    onToggleStatus,
    onDelete,
    onPromotion
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

    const handleToggleStatus = () => {
        const newStatus = service.status === 'active' ? 'inactive' : 'active';
        Alert.alert(
            newStatus === 'active' ? 'Activer le service' : 'Désactiver le service',
            `Voulez-vous ${newStatus === 'active' ? 'activer' : 'désactiver'} ce service ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: newStatus === 'active' ? 'Activer' : 'Désactiver',
                    onPress: () => onToggleStatus(service)
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
                    <Calendar size={14} color="#666" />
                    <Text style={styles.infoText}>Créé le {formatDate(service.createdAt)}</Text>
                </View>
                {service.views !== undefined && (
                    <View style={styles.infoRow}>
                        <Eye size={14} color="#3B82F6" />
                        <Text style={styles.infoText}>{service.views} vues</Text>
                    </View>
                )}
                {service.interactions !== undefined && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>📊 {service.interactions} interactions</Text>
                    </View>
                )}
            </View>

            {/* Actions - Design comme le frontend */}
            <View style={styles.actionsContainer}>
                <View style={styles.actionsRow}>
                    {/* Modifier */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => onEdit(service)}
                    >
                        <Edit2 size={20} color="#6B7280" />
                    </TouchableOpacity>

                    {/* Voir */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => onView(service)}
                    >
                        <Eye size={20} color="#6B7280" />
                    </TouchableOpacity>

                    {/* Partager */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={() => onShare(service)}
                    >
                        <Share size={20} color="#3B82F6" />
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

                    {/* Activer/Désactiver */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={handleToggleStatus}
                    >
                        {service.status === 'active' ? (
                            <PowerOff size={20} color="#EF4444" />
                        ) : (
                            <Power size={20} color="#10B981" />
                        )}
                    </TouchableOpacity>

                    {/* Supprimer */}
                    <TouchableOpacity
                        style={styles.actionIcon}
                        onPress={handleDelete}
                    >
                        <Trash2 size={20} color="#EF4444" />
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
