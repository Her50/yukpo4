import { Ionicons } from '@expo/vector-icons';
import * as React from "react";
import { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { Avatar, Badge, Card, IconButton, Title } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi } from '../services/api';
import { theme } from '../theme/theme';
import { SafeIcon } from './SafeIcon';

interface InteractedService {
    id: string;
    serviceId: string;
    serviceTitle: string;
    serviceDescription: string;
    prestataireName: string;
    prestataireAvatar?: string;
    prestataireRating: number;
    lastInteraction: Date;
    interactionType: 'message' | 'call' | 'video' | 'review' | 'favorite' | 'share' | 'view';
    interactionCount: number;
    isFavorite: boolean;
    location: string;
    price: number;
    category: string;
    status: 'active' | 'completed' | 'cancelled';
}

interface ServiceHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenChat: (serviceId: string, prestataireName: string) => void;
    onCall: (serviceId: string, prestataireName: string) => void;
}

const ServiceHistoryModal: React.FC<ServiceHistoryModalProps> = ({
    isOpen,
    onClose,
    onOpenChat,
    onCall
}) => {
    const { user } = useAuth();
    const [services, setServices] = useState<InteractedService[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && user?.id) {
            loadInteractedServices();
        }
    }, [isOpen, user?.id]);

    const loadInteractedServices = async () => {
        setLoading(true);
        try {
            const response = await servicesApi.getInteractedServices();

            if (response.data) {
                const servicesData = (response.data as InteractedService[]) || [];
                setServices(servicesData);

                // Extraire les catégories et types disponibles
                const categories = [...new Set(servicesData.map(s => s.category))];
                const types = [...new Set(servicesData.map(s => s.interactionType))];
                setAvailableCategories(categories);
                setAvailableTypes(types);
            } else {
                setServices([]);
                setAvailableCategories([]);
                setAvailableTypes([]);
            }
        } catch (error) {
            console.error('Erreur chargement services interagis:', error);
            // Fallback: charger depuis AsyncStorage si l'API échoue
            try {
                // TODO: Implémenter la récupération depuis AsyncStorage
                setServices([]);
            } catch (e) {
                setServices([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredServices = services
        .filter(service => {
            const matchesSearch = service.serviceTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                service.prestataireName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = filterType === 'all' || service.interactionType === filterType;
            const matchesCategory = filterCategory === 'all' || service.category === filterCategory;
            return matchesSearch && matchesFilter && matchesCategory;
        })
        .sort((a, b) => b.lastInteraction.getTime() - a.lastInteraction.getTime());

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 60) return `Il y a ${minutes}min`;
        if (hours < 24) return `Il y a ${hours}h`;
        return `Il y a ${days}j`;
    };

    const getInteractionIcon = (type: string) => {
        switch (type) {
            case 'message': return 'chatbubbles';
            case 'call': return 'call';
            case 'video': return 'videocam';
            case 'review': return 'star';
            case 'favorite': return 'heart';
            case 'share': return 'share';
            case 'view': return 'eye';
            default: return 'chatbubbles';
        }
    };

    const getInteractionColor = (type: string) => {
        switch (type) {
            case 'message': return '#2196F3';
            case 'call': return '#4CAF50';
            case 'video': return '#9C27B0';
            case 'review': return '#FF9800';
            case 'favorite': return '#F44336';
            case 'share': return '#9E9E9E';
            case 'view': return '#3F51B5';
            default: return '#9E9E9E';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#4CAF50';
            case 'completed': return '#2196F3';
            case 'cancelled': return '#F44336';
            default: return '#9E9E9E';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return 'En cours';
            case 'completed': return 'Terminé';
            case 'cancelled': return 'Annulé';
            default: return 'Inconnu';
        }
    };

    const getInteractionText = (type: string) => {
        switch (type) {
            case 'message': return 'Messages';
            case 'call': return 'Appels';
            case 'video': return 'Vidéos';
            case 'review': return 'Avis';
            case 'favorite': return 'Favoris';
            case 'share': return 'Partages';
            case 'view': return 'Vues';
            default: return type;
        }
    };

    const toggleFavorite = async (serviceId: string) => {
        try {
            // TODO: Implémenter l'API pour marquer/démarquer comme favori
            setServices(prev =>
                prev.map(service =>
                    service.id === serviceId
                        ? { ...service, isFavorite: !service.isFavorite }
                        : service
                )
            );
            Alert.alert('Favori', 'Service mis à jour dans vos favoris');
        } catch (error) {
            console.error('Erreur toggle favori:', error);
        }
    };

    const shareService = (service: InteractedService) => {
        // TODO: Implémenter le partage natif
        Alert.alert(
            'Partager',
            `Service: ${service.serviceTitle}\nPrestataire: ${service.prestataireName}\nPrix: ${service.price} FCFA`,
            [{ text: 'OK' }]
        );
    };

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Title style={styles.headerTitle}>
                            📋 Mon historique
                        </Title>
                        <Text style={styles.headerSubtitle}>
                            Retrouvez tous vos échanges et interactions avec les services
                        </Text>
                    </View>

                    <IconButton
                        icon="close"
                        size={24}
                        onPress={onClose}
                        iconColor={theme.colors.text}
                    />
                </View>

                {/* Filtres et recherche */}
                <Card style={styles.filtersCard}>
                    <Card.Content style={styles.filtersContent}>
                        {/* Barre de recherche */}
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color={theme.colors.primary} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher un service..."
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                            />
                        </View>

                        {/* Filtres horizontaux */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                            <TouchableOpacity
                                style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
                                onPress={() => setFilterType('all')}
                            >
                                <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
                                    Tous les types
                                </Text>
                            </TouchableOpacity>

                            {availableTypes.map(type => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.filterChip, filterType === type && styles.filterChipActive]}
                                    onPress={() => setFilterType(type)}
                                >
                                    <Text style={[styles.filterChipText, filterType === type && styles.filterChipTextActive]}>
                                        {getInteractionText(type)}
                                    </Text>
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                                style={[styles.filterChip, filterCategory === 'all' && styles.filterChipActive]}
                                onPress={() => setFilterCategory('all')}
                            >
                                <Text style={[styles.filterChipText, filterCategory === 'all' && styles.filterChipTextActive]}>
                                    Toutes catégories
                                </Text>
                            </TouchableOpacity>

                            {availableCategories.map(category => (
                                <TouchableOpacity
                                    key={category}
                                    style={[styles.filterChip, filterCategory === category && styles.filterChipActive]}
                                    onPress={() => setFilterCategory(category)}
                                >
                                    <Text style={[styles.filterChipText, filterCategory === category && styles.filterChipTextActive]}>
                                        {category}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Bouton actualiser */}
                        <TouchableOpacity
                            style={styles.refreshButton}
                            onPress={loadInteractedServices}
                        >
                            <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                            <Text style={styles.refreshButtonText}>Actualiser</Text>
                        </TouchableOpacity>
                    </Card.Content>
                </Card>

                {/* Liste des services */}
                <ScrollView style={styles.servicesList}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>Chargement de vos services...</Text>
                        </View>
                    ) : filteredServices.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={48} color="#9E9E9E" />
                            <Text style={styles.emptyTitle}>Aucun service interagi</Text>
                            <Text style={styles.emptyText}>
                                Commencez à interagir avec des services pour les voir apparaître ici
                            </Text>
                        </View>
                    ) : (
                        filteredServices.map((service) => (
                            <Card key={service.id} style={styles.serviceCard}>
                                <Card.Content style={styles.serviceContent}>
                                    {/* Header du service */}
                                    <View style={styles.serviceHeader}>
                                        <Avatar.Text
                                            size={48}
                                            label={service.prestataireName.charAt(0)}
                                            style={styles.prestataireAvatar}
                                        />

                                        <View style={styles.serviceInfo}>
                                            <View style={styles.serviceTitleRow}>
                                                <Text style={styles.serviceTitle} numberOfLines={1}>
                                                    {service.serviceTitle}
                                                </Text>
                                                <View style={styles.badgesContainer}>
                                                    <Badge style={[styles.statusBadge, { backgroundColor: getStatusColor(service.status) }]}>
                                                        {getStatusText(service.status)}
                                                    </Badge>
                                                    <Badge style={[styles.interactionBadge, { backgroundColor: getInteractionColor(service.interactionType) }]}>
                                                        <Ionicons
                                                            name={getInteractionIcon(service.interactionType)}
                                                            size={12}
                                                            color="white"
                                                            style={styles.badgeIcon}
                                                        />
                                                        <Text style={styles.badgeText}>{getInteractionText(service.interactionType)}</Text>
                                                    </Badge>
                                                </View>
                                            </View>

                                            <Text style={styles.serviceDescription} numberOfLines={2}>
                                                {service.serviceDescription}
                                            </Text>

                                            <View style={styles.serviceMeta}>
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="location" size={14} color={theme.colors.textSecondary} />
                                                    <Text style={styles.metaText}>{service.location}</Text>
                                                </View>
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="star" size={14} color="#FF9800" />
                                                    <Text style={styles.metaText}>{service.prestataireRating}</Text>
                                                </View>
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="time" size={14} color={theme.colors.textSecondary} />
                                                    <Text style={styles.metaText}>{formatTimeAgo(service.lastInteraction)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Actions du service */}
                                    <View style={styles.serviceActions}>
                                        <View style={styles.serviceStats}>
                                            <View style={styles.statItem}>
                                                <Ionicons
                                                    name={getInteractionIcon(service.interactionType)}
                                                    size={16}
                                                    color={getInteractionColor(service.interactionType)}
                                                />
                                                <Text style={styles.statText}>
                                                    {service.interactionCount} interactions
                                                </Text>
                                            </View>
                                            <Text style={styles.servicePrice}>
                                                {service.price.toLocaleString()} FCFA
                                            </Text>
                                        </View>

                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity
                                                style={[styles.favoriteButton, service.isFavorite && styles.favoriteButtonActive]}
                                                onPress={() => toggleFavorite(service.id)}
                                            >
                                                <Ionicons
                                                    name={service.isFavorite ? "heart" : "heart-outline"}
                                                    size={20}
                                                    color={service.isFavorite ? "#F44336" : theme.colors.textSecondary}
                                                />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.shareButton}
                                                onPress={() => shareService(service)}
                                            >
                                                <SafeIcon name="Redo2" size={20} color={theme.colors.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Boutons d'action principaux */}
                                    <View style={styles.primaryActions}>
                                        <TouchableOpacity
                                            mode="outlined"
                                            compact
                                            onPress={() => onOpenChat(service.serviceId, service.prestataireName)}
                                            style={styles.chatButton}
                                            labelStyle={styles.chatButtonLabel}
                                        >
                                            <Ionicons name="chatbubbles" size={16} color={theme.colors.primary} style={styles.buttonIcon} />
                                            Chat
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            mode="outlined"
                                            compact
                                            onPress={() => onCall(service.serviceId, service.prestataireName)}
                                            style={styles.callButton}
                                            labelStyle={styles.callButtonLabel}
                                        >
                                            <Ionicons name="call" size={16} color="#4CAF50" style={styles.buttonIcon} />
                                            Appeler
                                        </TouchableOpacity>
                                    </View>
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    filtersCard: {
        margin: 16,
        marginBottom: 8,
    },
    filtersContent: {
        paddingVertical: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.text,
        paddingVertical: 12,
    },
    filtersScroll: {
        marginBottom: 16,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    filterChipActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    filterChipText: {
        fontSize: 12,
        color: theme.colors.text,
    },
    filterChipTextActive: {
        color: 'white',
        fontWeight: '600',
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.primary,
    },
    refreshButtonText: {
        fontSize: 14,
        color: theme.colors.primary,
        marginLeft: 8,
        fontWeight: '500',
    },
    servicesList: {
        flex: 1,
        paddingHorizontal: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    serviceCard: {
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    serviceContent: {
        padding: 16,
    },
    serviceHeader: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    prestataireAvatar: {
        backgroundColor: theme.colors.primary,
        marginRight: 12,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        flex: 1,
        marginRight: 8,
    },
    badgesContainer: {
        flexDirection: 'row',
        gap: 4,
    },
    statusBadge: {
        fontSize: 10,
    },
    interactionBadge: {
        fontSize: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeIcon: {
        marginRight: 2,
    },
    badgeText: {
        fontSize: 10,
        color: 'white',
        fontWeight: '600',
    },
    serviceDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 12,
        lineHeight: 20,
    },
    serviceMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 4,
    },
    serviceActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    serviceStats: {
        flex: 1,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    statText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginLeft: 4,
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    favoriteButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
    },
    favoriteButtonActive: {
        backgroundColor: '#FFEBEE',
    },
    shareButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
    },
    primaryActions: {
        flexDirection: 'row',
        gap: 12,
    },
    chatButton: {
        flex: 1,
        borderColor: theme.colors.primary,
    },
    chatButtonLabel: {
        fontSize: 14,
        color: theme.colors.primary,
    },
    callButton: {
        flex: 1,
        borderColor: '#4CAF50',
    },
    callButtonLabel: {
        fontSize: 14,
        color: '#4CAF50',
    },
    buttonIcon: {
        marginRight: 4,
    },
});

export default ServiceHistoryModal;








