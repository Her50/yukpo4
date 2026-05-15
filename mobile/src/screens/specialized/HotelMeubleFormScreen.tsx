// ✅ NOUVEAU: Écran de gestion dédié pour gérants d'hôtels et meublés
// Date: 2026-01-27
// Description: Interface complète pour gérer propriétés, unités, réservations, analytics

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeNativeView } from '../../components/SafeNativeView';
import { NativeButton } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { notify } from '../../utils/notify';

interface Property {
    id: number;
    titre: string;
    type_bien: string;
    adresse?: string;
    ville?: string;
    photos?: string[];
    prix_location?: number;
    service_id: number;
}

interface Reservation {
    id: number;
    property_id: number;
    property_name: string;
    unit_number?: string;
    nom_client: string;
    date_arrivee: string;
    date_depart: string;
    montant_total: number;
    status: string;
    payment_status: string;
    can_check_in: boolean;
    can_check_out: boolean;
}

interface Stats {
    total_properties: number;
    total_units: number;
    total_reservations: number;
    active_reservations: number;
    occupancy_rate: number;
    total_revenue: number;
    pending_payments: number;
}

type TabType = 'dashboard' | 'properties' | 'reservations' | 'analytics';

const HotelMeubleFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Données
    const [properties, setProperties] = useState<Property[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [stats, setStats] = useState<Stats>({
        total_properties: 0,
        total_units: 0,
        total_reservations: 0,
        active_reservations: 0,
        occupancy_rate: 0,
        total_revenue: 0,
        pending_payments: 0,
    });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                loadProperties(),
                loadStats(),
                activeTab === 'reservations' && loadReservations(),
            ]);
        } catch (error: any) {
            console.error('[HotelMeubleForm] Erreur chargement:', error);
            notify.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    const loadProperties = async () => {
        try {
            const response = await apiGet<{
                success: boolean;
                data: Property[];
            }>('/api/hotel/my-properties');
            
            if (response.success && response.data) {
                setProperties(response.data);
            }
        } catch (error: any) {
            console.error('[HotelMeubleForm] Erreur chargement propriétés:', error);
        }
    };

    const loadStats = async () => {
        try {
            // Calculer stats depuis propriétés et réservations
            const propsResponse = await apiGet<{
                success: boolean;
                data: Property[];
            }>('/api/hotel/my-properties');

            // Récupérer toutes les réservations
            const reservationsResponse = await apiGet<{
                success: boolean;
                data: Reservation[];
            }>('/api/hotel/reservations/my');

            if (propsResponse.success && propsResponse.data) {
                const props = propsResponse.data;
                const reservs = reservationsResponse.success && reservationsResponse.data 
                    ? reservationsResponse.data 
                    : [];
                
                // Mettre à jour les réservations pour le dashboard
                setReservations(reservs);

                const activeReservations = reservs.filter(
                    r => r.status === 'confirmed' || r.status === 'checked_in'
                );

                const totalRevenue = reservs
                    .filter(r => r.payment_status === 'fully_paid')
                    .reduce((sum, r) => sum + (r.montant_total || 0), 0);

                const pendingPayments = reservs
                    .filter(r => r.payment_status === 'pending' || r.payment_status === 'advance_paid')
                    .reduce((sum, r) => sum + (r.montant_total || 0), 0);

                // Calculer taux d'occupation (simplifié)
                const occupancyRate = props.length > 0 
                    ? Math.min(100, (activeReservations.length / props.length) * 100)
                    : 0;

                setStats({
                    total_properties: props.length,
                    total_units: 0, // À récupérer depuis unités
                    total_reservations: reservs.length,
                    active_reservations: activeReservations.length,
                    occupancy_rate: Math.round(occupancyRate),
                    total_revenue: totalRevenue,
                    pending_payments: pendingPayments,
                });
            }
        } catch (error: any) {
            console.error('[HotelMeubleForm] Erreur chargement stats:', error);
        }
    };

    const loadReservations = async () => {
        try {
            const response = await apiGet<{
                success: boolean;
                data: Reservation[];
            }>('/api/hotel/reservations/my');

            if (response.success && response.data) {
                setReservations(response.data);
            }
        } catch (error: any) {
            console.error('[HotelMeubleForm] Erreur chargement réservations:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handlePropertyPress = (property: Property) => {
        // Navigation vers détails propriété ou gestion unités
        (navigation as any).navigate('HotelAvailabilityManagement', {
            propertyId: property.id,
            serviceId: property.service_id,
        });
    };

    const handleScanQR = () => {
        (navigation as any).navigate('HotelQRScanner');
    };

    const handleCreateReservation = () => {
        // Navigation vers création réservation manuelle
        Alert.alert(
            'Créer une réservation',
            'Sélectionnez d\'abord une propriété',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'OK',
                    onPress: () => {
                        if (properties.length > 0) {
                            (navigation as any).navigate('HotelAvailabilityManagement', {
                                propertyId: properties[0].id,
                                serviceId: properties[0].service_id,
                            });
                        } else {
                            notify.error('Aucune propriété disponible');
                        }
                    },
                },
            ]
        );
    };

    const renderDashboard = () => (
        <ScrollView
            style={styles.tabContent}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
        >
            {/* Statistiques rapides */}
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <SafeIcon name="building" size={24} color={modernColors.primary} />
                    <Text style={styles.statValue}>{stats.total_properties}</Text>
                    <Text style={styles.statLabel}>Propriétés</Text>
                </View>
                <View style={styles.statCard}>
                    <SafeIcon name="calendar" size={24} color="#10B981" />
                    <Text style={styles.statValue}>{stats.active_reservations}</Text>
                    <Text style={styles.statLabel}>Réservations actives</Text>
                </View>
                <View style={styles.statCard}>
                    <SafeIcon name="trending-up" size={24} color="#F59E0B" />
                    <Text style={styles.statValue}>{stats.occupancy_rate}%</Text>
                    <Text style={styles.statLabel}>Taux occupation</Text>
                </View>
                <View style={styles.statCard}>
                    <SafeIcon name="dollar-sign" size={24} color="#8B5CF6" />
                    <Text style={styles.statValue}>
                        {stats.total_revenue.toLocaleString()} FCFA
                    </Text>
                    <Text style={styles.statLabel}>Revenus</Text>
                </View>
            </View>

            {/* Actions rapides */}
            <View style={styles.quickActions}>
                <Text style={styles.sectionTitle}>Actions rapides</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={handleScanQR}
                    >
                        <SafeIcon name="qr-code" size={32} color={modernColors.primary} />
                        <Text style={styles.actionLabel}>Scanner QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={handleCreateReservation}
                    >
                        <SafeIcon name="plus-circle" size={32} color="#10B981" />
                        <Text style={styles.actionLabel}>Nouvelle réservation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => setActiveTab('properties')}
                    >
                        <SafeIcon name="settings" size={32} color="#F59E0B" />
                        <Text style={styles.actionLabel}>Gérer propriétés</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => setActiveTab('reservations')}
                    >
                        <SafeIcon name="list" size={32} color="#8B5CF6" />
                        <Text style={styles.actionLabel}>Voir réservations</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Réservations récentes */}
            {reservations.length > 0 && (
                <View style={styles.recentSection}>
                    <Text style={styles.sectionTitle}>Réservations récentes</Text>
                    {reservations.slice(0, 5).map((reservation) => (
                        <TouchableOpacity
                            key={reservation.id}
                            style={styles.reservationCard}
                            onPress={() => {
                                // Navigation vers gestion disponibilité de la propriété
                                const property = properties.find(p => p.id === reservation.property_id);
                                if (property) {
                                    (navigation as any).navigate('HotelAvailabilityManagement', {
                                        propertyId: property.id,
                                        serviceId: property.service_id,
                                    });
                                }
                            }}
                        >
                            <View style={styles.reservationHeader}>
                                <Text style={styles.reservationProperty}>
                                    {reservation.property_name}
                                </Text>
                                <View
                                    style={[
                                        styles.statusBadge,
                                        {
                                            backgroundColor:
                                                reservation.status === 'confirmed'
                                                    ? '#D1FAE5'
                                                    : reservation.status === 'checked_in'
                                                    ? '#DBEAFE'
                                                    : '#FEE2E2',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            {
                                                color:
                                                    reservation.status === 'confirmed'
                                                        ? '#059669'
                                                        : reservation.status === 'checked_in'
                                                        ? '#1D4ED8'
                                                        : '#DC2626',
                                            },
                                        ]}
                                    >
                                        {reservation.status}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.reservationClient}>
                                {reservation.nom_client}
                            </Text>
                            <Text style={styles.reservationDates}>
                                {new Date(reservation.date_arrivee).toLocaleDateString('fr-FR')} -{' '}
                                {new Date(reservation.date_depart).toLocaleDateString('fr-FR')}
                            </Text>
                            <Text style={styles.reservationAmount}>
                                {reservation.montant_total.toLocaleString()} FCFA
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Alertes */}
            {stats.pending_payments > 0 && (
                <View style={styles.alertCard}>
                    <SafeIcon name="alert-circle" size={24} color="#F59E0B" />
                    <View style={styles.alertContent}>
                        <Text style={styles.alertTitle}>Paiements en attente</Text>
                        <Text style={styles.alertText}>
                            {stats.pending_payments.toLocaleString()} FCFA en attente de paiement
                        </Text>
                    </View>
                </View>
            )}
        </ScrollView>
    );

    const renderProperties = () => (
        <View style={styles.tabContent}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                </View>
            ) : properties.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="building" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>Aucune propriété</Text>
                    <Text style={styles.emptySubtext}>
                        Créez votre première propriété depuis l'écran Immobilier
                    </Text>
                    <NativeButton
                        title="Créer une propriété"
                        onPress={() => {
                            (navigation as any).navigate('ImmobilierForm');
                        }}
                        variant="primary"
                        style={styles.emptyButton}
                    />
                </View>
            ) : (
                <FlatList
                    data={properties}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.propertyCard}
                            onPress={() => handlePropertyPress(item)}
                        >
                            {item.photos && item.photos.length > 0 ? (
                                <View style={styles.propertyImageContainer}>
                                    <Image
                                        source={{ uri: item.photos[0] }}
                                        style={styles.propertyImage}
                                        resizeMode="cover"
                                    />
                                </View>
                            ) : (
                                <View style={styles.propertyImageContainer}>
                                    <View style={styles.propertyImagePlaceholder}>
                                        <SafeIcon name="image" size={32} color="#9CA3AF" />
                                    </View>
                                </View>
                            )}
                            <View style={styles.propertyContent}>
                                <Text style={styles.propertyTitle}>{item.titre}</Text>
                                <Text style={styles.propertyType}>
                                    {item.type_bien}
                                </Text>
                                {item.ville && (
                                    <View style={styles.propertyLocation}>
                                        <SafeIcon name="map-pin" size={14} color="#6B7280" />
                                        <Text style={styles.propertyLocationText}>
                                            {item.ville}
                                        </Text>
                                    </View>
                                )}
                                {item.prix_location && (
                                    <Text style={styles.propertyPrice}>
                                        {item.prix_location.toLocaleString()} FCFA/nuit
                                    </Text>
                                )}
                            </View>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );

    const renderReservations = () => (
        <View style={styles.tabContent}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                </View>
            ) : reservations.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="calendar" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>Aucune réservation</Text>
                    <Text style={styles.emptySubtext}>
                        Les réservations apparaîtront ici
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={reservations}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.reservationCard}
                            onPress={() => {
                                // Navigation vers gestion disponibilité de la propriété
                                const property = properties.find(p => p.id === reservation.property_id);
                                if (property) {
                                    (navigation as any).navigate('HotelAvailabilityManagement', {
                                        propertyId: property.id,
                                        serviceId: property.service_id,
                                    });
                                }
                            }}
                        >
                            <View style={styles.reservationHeader}>
                                <Text style={styles.reservationProperty}>
                                    {item.property_name}
                                </Text>
                                <View
                                    style={[
                                        styles.statusBadge,
                                        {
                                            backgroundColor:
                                                item.status === 'confirmed'
                                                    ? '#D1FAE5'
                                                    : item.status === 'checked_in'
                                                    ? '#DBEAFE'
                                                    : '#FEE2E2',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            {
                                                color:
                                                    item.status === 'confirmed'
                                                        ? '#059669'
                                                        : item.status === 'checked_in'
                                                        ? '#1D4ED8'
                                                        : '#DC2626',
                                            },
                                        ]}
                                    >
                                        {item.status}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.reservationClient}>{item.nom_client}</Text>
                            {item.unit_number && (
                                <Text style={styles.reservationUnit}>
                                    Chambre: {item.unit_number}
                                </Text>
                            )}
                            <Text style={styles.reservationDates}>
                                {new Date(item.date_arrivee).toLocaleDateString('fr-FR')} -{' '}
                                {new Date(item.date_depart).toLocaleDateString('fr-FR')}
                            </Text>
                            <View style={styles.reservationFooter}>
                                <Text style={styles.reservationAmount}>
                                    {item.montant_total.toLocaleString()} FCFA
                                </Text>
                                <View style={styles.reservationActions}>
                                    {item.can_check_in && (
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={async () => {
                                                try {
                                                    const response = await apiPost<{
                                                        success: boolean;
                                                        message: string;
                                                    }>(`/api/hotel/reservations/${item.id}/check-in`, {});
                                                    
                                                    if (response.success) {
                                                        notify.success('Check-in effectué avec succès');
                                                        await loadReservations();
                                                        await loadStats();
                                                    } else {
                                                        notify.error('Erreur lors du check-in');
                                                    }
                                                } catch (error: any) {
                                                    console.error('[HotelMeubleForm] Erreur check-in:', error);
                                                    notify.error(error.message || 'Erreur lors du check-in');
                                                }
                                            }}
                                        >
                                            <Text style={styles.actionButtonText}>Check-in</Text>
                                        </TouchableOpacity>
                                    )}
                                    {item.can_check_out && (
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.actionButtonPrimary]}
                                            onPress={async () => {
                                                try {
                                                    const response = await apiPost<{
                                                        success: boolean;
                                                        message: string;
                                                    }>(`/api/hotel/reservations/${item.id}/check-out`, {});
                                                    
                                                    if (response.success) {
                                                        notify.success('Check-out effectué avec succès');
                                                        await loadReservations();
                                                        await loadStats();
                                                    } else {
                                                        notify.error('Erreur lors du check-out');
                                                    }
                                                } catch (error: any) {
                                                    console.error('[HotelMeubleForm] Erreur check-out:', error);
                                                    notify.error(error.message || 'Erreur lors du check-out');
                                                }
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.actionButtonText,
                                                    styles.actionButtonTextPrimary,
                                                ]}
                                            >
                                                Check-out
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );

    const renderAnalytics = () => (
        <ScrollView
            style={styles.tabContent}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
        >
            <View style={styles.analyticsSection}>
                <Text style={styles.sectionTitle}>Statistiques globales</Text>
                <View style={styles.analyticsGrid}>
                    <View style={styles.analyticsCard}>
                        <Text style={styles.analyticsValue}>{stats.total_properties}</Text>
                        <Text style={styles.analyticsLabel}>Propriétés</Text>
                    </View>
                    <View style={styles.analyticsCard}>
                        <Text style={styles.analyticsValue}>{stats.total_reservations}</Text>
                        <Text style={styles.analyticsLabel}>Total réservations</Text>
                    </View>
                    <View style={styles.analyticsCard}>
                        <Text style={styles.analyticsValue}>{stats.occupancy_rate}%</Text>
                        <Text style={styles.analyticsLabel}>Taux occupation</Text>
                    </View>
                    <View style={styles.analyticsCard}>
                        <Text style={styles.analyticsValue}>
                            {stats.total_revenue.toLocaleString()}
                        </Text>
                        <Text style={styles.analyticsLabel}>Revenus totaux</Text>
                    </View>
                </View>
            </View>

            <View style={styles.analyticsSection}>
                <Text style={styles.sectionTitle}>Insights IA</Text>
                <Text style={styles.insightText}>
                    💡 Utilisez les insights IA pour optimiser vos tarifs et prévoir l'occupation
                </Text>
                <NativeButton
                    title="Voir insights IA"
                    onPress={() => {
                        if (properties.length > 0) {
                            // Navigation vers insights IA pour première propriété
                            (navigation as any).navigate('HotelAvailabilityManagement', {
                                propertyId: properties[0].id,
                                serviceId: properties[0].service_id,
                            });
                        } else {
                            notify.error('Aucune propriété disponible');
                        }
                    }}
                    variant="outline"
                    style={styles.insightButton}
                />
            </View>
        </ScrollView>
    );

    return (
        <SafeNativeView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Gestion Hôtels & Meublés</Text>
                    <Text style={styles.headerSubtitle}>
                        {user?.name || 'Gérant'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => (navigation as any).goBack()}
                    style={styles.headerButton}
                >
                    <SafeIcon name="x" size={24} color="#111827" />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
                    onPress={() => setActiveTab('dashboard')}
                >
                    <SafeIcon
                        name="home"
                        size={20}
                        color={activeTab === 'dashboard' ? modernColors.primary : '#6B7280'}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'dashboard' && styles.tabTextActive,
                        ]}
                    >
                        Dashboard
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'properties' && styles.tabActive]}
                    onPress={() => setActiveTab('properties')}
                >
                    <SafeIcon
                        name="building"
                        size={20}
                        color={activeTab === 'properties' ? modernColors.primary : '#6B7280'}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'properties' && styles.tabTextActive,
                        ]}
                    >
                        Propriétés
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'reservations' && styles.tabActive]}
                    onPress={() => setActiveTab('reservations')}
                >
                    <SafeIcon
                        name="calendar"
                        size={20}
                        color={activeTab === 'reservations' ? modernColors.primary : '#6B7280'}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'reservations' && styles.tabTextActive,
                        ]}
                    >
                        Réservations
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'analytics' && styles.tabActive]}
                    onPress={() => setActiveTab('analytics')}
                >
                    <SafeIcon
                        name="bar-chart-2"
                        size={20}
                        color={activeTab === 'analytics' ? modernColors.primary : '#6B7280'}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'analytics' && styles.tabTextActive,
                        ]}
                    >
                        Analytics
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'properties' && renderProperties()}
            {activeTab === 'reservations' && renderReservations()}
            {activeTab === 'analytics' && renderAnalytics()}
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    headerButton: {
        padding: 8,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: modernColors.primary,
    },
    tabText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    tabTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    tabContent: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        ...modernColors.shadowLight,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    quickActions: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    actionCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        ...modernColors.shadowLight,
    },
    actionLabel: {
        fontSize: 13,
        color: '#374151',
        marginTop: 8,
        textAlign: 'center',
    },
    recentSection: {
        padding: 16,
    },
    reservationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        ...modernColors.shadowLight,
    },
    reservationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    reservationProperty: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    reservationClient: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 4,
    },
    reservationUnit: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    reservationDates: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 8,
    },
    reservationFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    reservationAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    reservationActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
    },
    actionButtonPrimary: {
        backgroundColor: modernColors.primary,
    },
    actionButtonText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '600',
    },
    actionButtonTextPrimary: {
        color: '#FFFFFF',
    },
    alertCard: {
        flexDirection: 'row',
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 16,
        margin: 16,
        gap: 12,
    },
    alertContent: {
        flex: 1,
    },
    alertTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400E',
        marginBottom: 4,
    },
    alertText: {
        fontSize: 13,
        color: '#78350F',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 8,
        textAlign: 'center',
    },
    emptyButton: {
        marginTop: 24,
    },
    propertyCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        marginHorizontal: 16,
        ...modernColors.shadowLight,
    },
    propertyImageContainer: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 12,
    },
    propertyImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    propertyImagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    propertyContent: {
        flex: 1,
    },
    propertyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    propertyType: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 4,
    },
    propertyLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    propertyLocationText: {
        fontSize: 12,
        color: '#6B7280',
    },
    propertyPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        marginTop: 4,
    },
    listContent: {
        paddingVertical: 16,
    },
    analyticsSection: {
        padding: 16,
    },
    analyticsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    analyticsCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        ...modernColors.shadowLight,
    },
    analyticsValue: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    analyticsLabel: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
    },
    insightText: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 16,
        lineHeight: 20,
    },
    insightButton: {
        marginTop: 8,
    },
});

export default HotelMeubleFormScreen;

