// @ts-nocheck
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import React, { useEffect, useState } from 'react';
import ReactNative from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi } from '../services/api';
import { theme } from '../theme/theme';
import SafeStorage from '../utils/safeStorage';

const {
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TextInput,
    ActivityIndicator,
    Image
} = ReactNative;

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

const ServicesInteragisScreen: React.FC = () => {
    const [services, setServices] = useState<InteractedService[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);
    const { user } = useAuth();

    useEffect(() => {
        if (user?.id) {
            loadInteractedServices();
        }
    }, [user?.id]);

    const loadInteractedServices = async () => {
        setLoading(true);
        try {
            const response = await servicesApi.getInteractedServices();

            if (response.success) {
                const data = response.data;
                const servicesData = data.services || [];
                setServices(servicesData);

                // Extraire les cat�gories et types disponibles
                const categories = [...new Set(servicesData.map((s: InteractedService) => s.category))];
                const types = [...new Set(servicesData.map((s: InteractedService) => s.interactionType))];
                setAvailableCategories(categories);
                setAvailableTypes(types);
            } else {
                // Charger depuis AsyncStorage si l'API �choue
                const savedServices = await SafeStorage.getItem('interactedServices');
                if (savedServices) {
                    try {
                        const parsedServices = JSON.parse(savedServices);
                        setServices(parsedServices);

                        // Extraire les cat�gories et types disponibles
                        const categories = [...new Set(parsedServices.map((s: InteractedService) => s.category))];
                        const types = [...new Set(parsedServices.map((s: InteractedService) => s.interactionType))];
                        setAvailableCategories(categories);
                        setAvailableTypes(types);
                    } catch (e) {
                        setServices([]);
                        setAvailableCategories([]);
                        setAvailableTypes([]);
                    }
                } else {
                    setServices([]);
                    setAvailableCategories([]);
                    setAvailableTypes([]);
                }
            }
        } catch (error) {
            console.error('Erreur chargement services interagis:', error);
            // Fallback: charger depuis AsyncStorage
            const savedServices = await SafeStorage.getItem('interactedServices');
            if (savedServices) {
                try {
                    const parsedServices = JSON.parse(savedServices);
                    setServices(parsedServices);
                } catch (e) {
                    setServices([]);
                }
            } else {
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
            case 'message': return '??';
            case 'call': return '??';
            case 'video': return '??';
            case 'review': return '?';
            case 'favorite': return '??';
            case 'share': return '??';
            case 'view': return '???';
            default: return '??';
        }
    };

    const getInteractionColor = (type: string) => {
        switch (type) {
            case 'message': return theme.colors.primary;
            case 'call': return '#10B981';
            case 'video': return '#8B5CF6';
            case 'review': return '#F59E0B';
            case 'favorite': return '#EF4444';
            case 'share': return '#6B7280';
            case 'view': return '#6366F1';
            default: return '#6B7280';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#10B981';
            case 'completed': return theme.colors.primary;
            case 'cancelled': return '#EF4444';
            default: return '#6B7280';
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Chargement de vos services...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Mon historique</Text>
                    <Text style={styles.subtitle}>
                        Retrouvez tous vos �changes et interactions avec les services
                    </Text>
                </View>

                {/* Filtres et recherche */}
                <View style={styles.filtersCard}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher un service..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        placeholderTextColor="#9CA3AF"
                    />

                    <View style={styles.filterRow}>
                        <TouchableOpacity
                            style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
                            onPress={() => setFilterType('all')}
                        >
                            <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
                                Tous
                            </Text>
                        </TouchableOpacity>

                        {availableTypes.map(type => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.filterButton, filterType === type && styles.filterButtonActive]}
                                onPress={() => setFilterType(type)}
                            >
                                <Text style={[styles.filterButtonText, filterType === type && styles.filterButtonTextActive]}>
                                    {type === 'message' ? 'Messages' :
                                        type === 'call' ? 'Appels' :
                                            type === 'video' ? 'Vid�os' :
                                                type === 'review' ? 'Avis' :
                                                    type === 'favorite' ? 'Favoris' :
                                                        type === 'share' ? 'Partages' :
                                                            type === 'view' ? 'Vues' : type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.refreshButton} onPress={loadInteractedServices}>
                        <Text style={styles.refreshButtonText}>?? Actualiser</Text>
                    </TouchableOpacity>
                </View>

                {/* Liste des services */}
                <View style={styles.servicesList}>
                    {filteredServices.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>??</Text>
                            <Text style={styles.emptyTitle}>Aucun service interagi</Text>
                            <Text style={styles.emptySubtitle}>
                                Commencez � interagir avec des services pour les voir appara�tre ici
                            </Text>
                        </View>
                    ) : (
                        filteredServices.map((service) => (
                            <View key={service.id} style={styles.serviceCard}>
                                <View style={styles.serviceHeader}>
                                    <View style={styles.serviceInfo}>
                                        <View style={styles.avatarContainer}>
                                            {service.prestataireAvatar ? (
                                                <Image source={{ uri: service.prestataireAvatar }} style={styles.avatar} />
                                            ) : (
                                                <View style={styles.avatarFallback}>
                                                    <Text style={styles.avatarText}>
                                                        {service.prestataireName.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.serviceDetails}>
                                            <View style={styles.serviceTitleRow}>
                                                <Text style={styles.serviceTitle}>{service.serviceTitle}</Text>
                                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(service.status) }]}>
                                                    <Text style={styles.statusText}>{service.status}</Text>
                                                </View>
                                                <View style={[styles.typeBadge, { backgroundColor: getInteractionColor(service.interactionType) }]}>
                                                    <Text style={styles.typeText}>
                                                        {getInteractionIcon(service.interactionType)} {service.interactionType}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={styles.serviceDescription}>{service.serviceDescription}</Text>

                                            <View style={styles.serviceMeta}>
                                                <Text style={styles.metaItem}>?? {service.location}</Text>
                                                <Text style={styles.metaItem}>? {service.prestataireRating}</Text>
                                                <Text style={styles.metaItem}>?? {formatTimeAgo(service.lastInteraction)}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.serviceActions}>
                                        <TouchableOpacity style={styles.actionButton}>
                                            <Text style={[styles.actionIcon, service.isFavorite && styles.favoriteActive]}>
                                                {service.isFavorite ? '??' : '??'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionButton}>
                                            <Text style={styles.actionIcon}>??</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.serviceFooter}>
                                    <View style={styles.serviceStats}>
                                        <Text style={styles.interactionCount}>
                                            {getInteractionIcon(service.interactionType)} {String(service.interactionCount)} interactions
                                        </Text>
                                        <Text style={styles.price}>{service.price.toLocaleString()} FCFA</Text>
                                    </View>

                                    <View style={styles.serviceButtons}>
                                        <TouchableOpacity
                                            style={styles.chatButton}
                                            onPress={() => {
                                                Alert.alert("Chat", `Chat avec ${service.prestataireName}`);
                                            }}
                                        >
                                            <Text style={styles.chatButtonText}>?? Chat</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.callButton}
                                            onPress={() => {
                                                Alert.alert("Appel", `Appel vers ${service.prestataireName}`);
                                            }}
                                        >
                                            <Text style={styles.callButtonText}>?? Appeler</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

export default ServicesInteragisScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    header: {
        padding: 20,
        paddingTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    filtersCard: {
        backgroundColor: '#FFFFFF',
        margin: 20,
        marginTop: 0,
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    searchInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 16,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    filterButtonActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    filterButtonText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
    },
    refreshButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    refreshButtonText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    servicesList: {
        padding: 20,
        paddingTop: 0,
    },
    emptyState: {
        backgroundColor: '#FFFFFF',
        padding: 40,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    serviceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    serviceInfo: {
        flexDirection: 'row',
        flex: 1,
    },
    avatarContainer: {
        marginRight: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    serviceDetails: {
        flex: 1,
    },
    serviceTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginRight: 8,
        marginBottom: 4,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
        marginBottom: 4,
    },
    statusText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 4,
    },
    typeText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    serviceDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
        lineHeight: 20,
    },
    serviceMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metaItem: {
        fontSize: 12,
        color: '#6B7280',
    },
    serviceActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
    },
    actionIcon: {
        fontSize: 20,
    },
    favoriteActive: {
        color: '#EF4444',
    },
    serviceFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceStats: {
        flex: 1,
    },
    interactionCount: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    price: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    serviceButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    chatButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    chatButtonText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    callButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    callButtonText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
});











