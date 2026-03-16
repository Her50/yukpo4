import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { config } from '../config/environment';
import { modernColors } from '../theme/modernTheme';
import { theme } from '../theme/theme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

// ✅ Helper pour construire l'URL complète d'un média (même logique que MesProduitsScreen)
const buildServiceMediaUrl = (path?: string | null): string | null => {
    if (!path || typeof path !== 'string') return null;
    const trimmed = path.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const base = (config.API_BASE_URL || config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
    if (!base) return null;
    return `${base}/api/media/files/${cleanPath}`;
};

// ✅ Extraire les URLs de média de manière robuste (string, {valeur:...}, array)
const extractServiceMediaUrls = (field: any): string[] => {
    if (!field) return [];
    if (Array.isArray(field)) {
        return field.flatMap((item: any) => {
            if (typeof item === 'string' && item.trim()) return [item.trim()];
            if (item && typeof item === 'object') {
                if (typeof item.valeur === 'string' && item.valeur.trim()) return [item.valeur.trim()];
                if (typeof item.url === 'string' && item.url.trim()) return [item.url.trim()];
                if (typeof item.path === 'string' && item.path.trim()) return [item.path.trim()];
                if (Array.isArray(item.valeur)) return item.valeur.filter((v: any) => typeof v === 'string' && v.trim());
            }
            return [];
        });
    }
    if (typeof field === 'object' && field !== null) {
        if (Array.isArray(field.valeur)) return field.valeur.filter((v: any) => typeof v === 'string' && v.trim());
        if (typeof field.valeur === 'string' && field.valeur.trim()) return [field.valeur.trim()];
    }
    if (typeof field === 'string' && field.trim()) return [field.trim()];
    return [];
};

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
    // ✅ NOUVEAU: Support sélection multiple (Bulk Actions)
    bulkMode?: boolean;
    selected?: boolean;
    onSelect?: (serviceId: string | number) => void;
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
    bulkMode = false,
    selected = false,
    onSelect,
}) => {
    const getStatusColor = (status: string | undefined | null) => {
        if (!status || typeof status !== 'string') return '#9E9E9E';
        switch (status) {
            case 'active': return '#4CAF50';
            case 'inactive': return '#9E9E9E';
            case 'pending': return '#FF9800';
            default: return '#9E9E9E';
        }
    };

    const getStatusText = (status: string | undefined | null) => {
        if (!status || typeof status !== 'string') return 'Inconnu';
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
            t('serviceCardModern.etesvousSurDeVouloirSupprimerDefinitivement', { service_title: service.title }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => onDelete(service)
                }
            ]
        );
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                bulkMode && styles.containerBulkMode,
                selected && styles.containerSelected,
            ]}
            activeOpacity={bulkMode ? 0.7 : 1}
            onPress={bulkMode && onSelect ? () => onSelect(service.id) : undefined}
        >
            {/* ✅ NOUVEAU: Checkbox de sélection en mode bulk */}
            {bulkMode && (
                <View style={styles.checkboxContainer}>
                    <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                        {selected && <SafeIcon name="check" size={16} color="#fff" />}
                    </View>
                </View>
            )}

            {/* ✅ NOUVEAU 2026-03-03: Thumbnail du service */}
            {(() => {
                // Chercher la première image disponible: logo → banner → images → premier produit
                const data = service.data || {};
                const candidates: string[] = [];

                // Logo
                const logo = data.logo?.valeur || data.logo;
                if (typeof logo === 'string' && logo.trim()) candidates.push(logo.trim());

                // Bannière
                const banner = data.banner?.valeur || data.banner;
                if (typeof banner === 'string' && banner.trim()) candidates.push(banner.trim());

                // Images du service
                candidates.push(...extractServiceMediaUrls(data.images));

                // Images du premier produit
                const produits = data.produits?.valeur || data.produits;
                if (Array.isArray(produits) && produits.length > 0) {
                    candidates.push(...extractServiceMediaUrls(produits[0]?.images));
                }

                // Trouver la première image (pas vidéo)
                const firstImg = candidates.find(c => !c.includes('.mp4') && !c.includes('.webm') && !c.includes('.mov'));
                const thumbUrl = firstImg ? buildServiceMediaUrl(firstImg) : null;

                if (thumbUrl) {
                    return (
                        <View style={styles.thumbnailContainer}>
                            <Image
                                source={{ uri: thumbUrl }}
                                style={styles.thumbnailImage}
                                resizeMode="cover"
                            />
                            <View style={[styles.statusOverlay, { backgroundColor: getStatusColor(service?.status) }]}>
                                <Text style={styles.statusOverlayText}>
                                    {getStatusText(service?.status)}
                                </Text>
                            </View>
                        </View>
                    );
                }
                return null;
            })()}

            {/* Header avec titre et statut */}
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title} numberOfLines={2}>
                        {service.title || t('serviceCardModern.serviceSansTitre')}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(service?.status) }]}>
                        <Text style={styles.statusText}>
                            {getStatusText(service?.status)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Description */}
            <Text style={styles.description} numberOfLines={3}>
                {service.description || t('serviceCardModern.aucuneDescription')}
            </Text>

            {/* Informations du service */}
            <View style={styles.serviceInfo}>
                <View style={styles.infoRow}>
                    <SafeIcon name="calendar" size={14} color="#666" />
                    <Text style={styles.infoText}>{t('serviceCardModern.createdOn')} {formatDate(service.createdAt || service.created_at || '')}</Text>
                </View>
                {service.views !== undefined && service.views != null && (
                    <View style={styles.infoRow}>
                        <SafeIcon name="eye" size={14} color="#3B82F6" />
                        <Text style={styles.infoText}>{String(service.views || 0)} vues</Text>
                    </View>
                )}
                {service.interactions !== undefined && service.interactions != null && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>📊 {String(service.interactions || 0)} interactions</Text>
                    </View>
                )}
                {/* Nombre de produits - Cliquable comme statistique */}
                {(() => {
                    // ✅ CORRECTION: Vérifier et sécuriser l'accès aux produits
                    const produits = service?.data?.produits?.valeur;
                    if (!produits || !Array.isArray(produits) || produits.length === 0) {
                        return null;
                    }
                    const produitsCount = produits.length || 0;
                    return (
                        <TouchableOpacity
                            style={styles.productsStatRow}
                            onPress={() => onViewProducts && onViewProducts(service)}
                            activeOpacity={0.6}
                        >
                            <SafeIcon name="package" size={14} color="#6366F1" />
                            <Text style={styles.productsStatText}>
                                {produitsCount} produit{produitsCount > 1 ? 's' : ''}
                            </Text>
                            <SafeIcon name="chevron-right" size={12} color="#6366F1" />
                        </TouchableOpacity>
                    );
                })()}
            </View>

            {/* Badge Produits - Bien visible */}
            {(() => {
                // ✅ CORRECTION: Vérifier et sécuriser l'accès aux produits
                const produits = service?.data?.produits?.valeur;
                if (!produits || !Array.isArray(produits) || produits.length === 0) {
                    return null;
                }
                const produitsCount = produits.length || 0;
                return (
                    <TouchableOpacity
                        style={styles.productsBadge}
                        onPress={() => onViewProducts && onViewProducts(service)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.productsBadgeContent}>
                            <SafeIcon name="package" size={18} color="#FFFFFF" />
                            <View style={styles.productsBadgeTextContainer}>
                                <Text style={styles.productsBadgeCount}>
                                    {produitsCount} produit{produitsCount > 1 ? 's' : ''}
                                </Text>
                                <Text style={styles.productsBadgeAction}>
                                    Voir le détail →
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                );
            })()}

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
                        <Text style={styles.actionLabel}>{t('serviceCardModern.modifier')}</Text>
                    </TouchableOpacity>

                    {/* Voir */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionView]}
                        onPress={() => onView(service)}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="eye" size={18} color="#6B7280" />
                        <Text style={styles.actionLabel}>{t('serviceCardModern.voir')}</Text>
                    </TouchableOpacity>

                    {/* Partager */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionShare]}
                        onPress={() => onShare(service)}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="Redo2" size={18} color="#3B82F6" />
                        <Text style={[styles.actionLabel, { color: '#3B82F6' }]}>{t('serviceCardModern.partager')}</Text>
                    </TouchableOpacity>

                    {/* Supprimer */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionDelete]}
                        onPress={handleDelete}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="trash-2" size={18} color="#EF4444" />
                        <Text style={[styles.actionLabel, { color: '#EF4444' }]}>{t('serviceCardModern.supprimer')}</Text>
                    </TouchableOpacity>
                </View>

                {/* ✅ Seconde rangée d'actions - Bouton vidéo déplacé dans le menu global */}
                <View style={styles.actionsRow}>
                    {/* Promouvoir (publicité) - Retiré car maintenant dans le menu global */}

                    {/* Activer/Désactiver */}
                    <TouchableOpacity
                        style={[styles.actionButton, (service?.status || 'inactive') === 'active' ? styles.actionDeactivate : styles.actionActivate]}
                        onPress={() => onToggleStatus(service)}
                        activeOpacity={0.7}
                    >
                        <SafeIcon
                            name={(service?.status || 'inactive') === 'active' ? 'pause-circle' : 'play-circle'}
                            size={18}
                            color={(service?.status || 'inactive') === 'active' ? '#F97316' : '#10B981'}
                        />
                        <Text style={[styles.actionLabel, { color: (service?.status || 'inactive') === 'active' ? '#F97316' : '#10B981' }]}>
                            {(service?.status || 'inactive') === 'active' ? 'Désactiver' : 'Activer'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
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
        position: 'relative',
    },
    containerBulkMode: {
        borderWidth: 2,
        borderColor: '#e0e0e0',
    },
    containerSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '05',
    },
    checkboxContainer: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#9CA3AF',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
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
    actionFlashPromo: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        borderWidth: 2,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    flashIcon: {
        fontSize: 20,
        marginRight: 4,
    },
    flashPromoLabel: {
        color: '#F59E0B',
        fontWeight: '700',
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
    thumbnailContainer: {
        width: '100%',
        height: 180,
        marginBottom: 12,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    statusOverlay: {
        position: 'absolute',
        top: 10,
        right: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusOverlayText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
    },
});

export default ServiceCardModern;
