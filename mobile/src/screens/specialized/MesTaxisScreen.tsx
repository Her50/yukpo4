// ✅ Écran de gestion des taxis (prestataire)
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface Taxi {
    id: number;
    service_id: number;
    user_id: number;
    nom_chauffeur?: string;
    telephone?: string;
    whatsapp?: string;
    zone_intervention?: string[];
    gps_actuel?: string;
    is_available_now: boolean;
    is_on_duty: boolean;
    type_vehicule?: string;
    marque_modele?: string;
    tarif_base?: number;
    tarif_par_km?: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const MesTaxisScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [taxis, setTaxis] = useState<Taxi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [updatingAvailability, setUpdatingAvailability] = useState<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            if (user) {
                loadTaxis(true);
            } else {
                Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir vos taxis');
                navigation.goBack();
            }
        }, [user])
    );

    const loadTaxis = async (isRefresh = false) => {
        if (!user) return;

        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const queryParams = new URLSearchParams();
            if (statusFilter !== 'all') {
                if (statusFilter === 'active') {
                    queryParams.append('status', 'active');
                } else if (statusFilter === 'inactive') {
                    queryParams.append('status', 'inactive');
                }
            }

            const url = `/api/taxis${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            const response = await apiGet(url);

            if (response.success && response.data) {
                const rd: any = response.data;
                const taxisData = Array.isArray(rd) ? rd : rd.data || [];
                setTaxis(taxisData);
            } else {
                Alert.alert('Erreur', 'Impossible de charger vos taxis');
            }
        } catch (error: any) {
            console.error('[MesTaxisScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger vos taxis');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleToggleAvailability = async (taxi: Taxi) => {
        if (!user) return;

        try {
            setUpdatingAvailability(taxi.id);
            const newAvailability = !taxi.is_available_now;

            const response = await apiPost(`/api/taxis/${taxi.id}/update-availability`, {
                is_available_now: newAvailability,
                gps_actuel: taxi.gps_actuel || null,
            });

            if (response.success) {
                // Mettre à jour localement
                setTaxis(taxis.map(t =>
                    t.id === taxi.id
                        ? { ...t, is_available_now: newAvailability, is_on_duty: newAvailability }
                        : t
                ));
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de mettre à jour la disponibilité');
            }
        } catch (error: any) {
            console.error('[MesTaxisScreen] Erreur disponibilité:', error);
            Alert.alert('Erreur', error.message || 'Impossible de mettre à jour la disponibilité');
        } finally {
            setUpdatingAvailability(null);
        }
    };

    const handleTaxiPress = (taxi: Taxi) => {
        navigation.navigate('TaxiForm' as never, {
            serviceId: taxi.service_id,
            mode: 'edit',
        } as never);
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const renderTaxi = ({ item }: { item: Taxi }) => (
        <TouchableOpacity onPress={() => handleTaxiPress(item)}>
            <NativeCard style={styles.taxiCard}>
                <View style={styles.taxiHeader}>
                    <View style={styles.taxiInfo}>
                        <Text style={styles.taxiName}>
                            {item.nom_chauffeur || item.telephone || `Taxi #${item.id}`}
                        </Text>
                        {item.type_vehicule && (
                            <Text style={styles.taxiType}>{item.type_vehicule}</Text>
                        )}
                    </View>
                    <View style={[styles.statusBadge, item.is_available_now && styles.statusBadgeAvailable]}>
                        <Text style={[styles.statusText, item.is_available_now && styles.statusTextAvailable]}>
                            {item.is_available_now ? 'Disponible' : 'Occupé'}
                        </Text>
                    </View>
                </View>

                <View style={styles.taxiDetails}>
                    {item.telephone && (
                        <View style={styles.detailItem}>
                            <SafeIcon name="phone" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.detailText}>{item.telephone}</Text>
                        </View>
                    )}
                    {item.zone_intervention && item.zone_intervention.length > 0 && (
                        <View style={styles.detailItem}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.detailText} numberOfLines={1}>
                                {item.zone_intervention.join(', ')}
                            </Text>
                        </View>
                    )}
                    {(item.tarif_base || item.tarif_par_km) && (
                        <View style={styles.detailItem}>
                            <SafeIcon name="tag" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.detailText}>
                                {item.tarif_base ? `${item.tarif_base.toLocaleString('fr-FR')} FCFA` : ''}
                                {item.tarif_base && item.tarif_par_km ? ' + ' : ''}
                                {item.tarif_par_km ? `${item.tarif_par_km.toLocaleString('fr-FR')} FCFA/km` : ''}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.taxiActions}>
                    <View style={styles.availabilityRow}>
                        <Text style={styles.availabilityLabel}>Disponibilité</Text>
                        {updatingAvailability === item.id ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        ) : (
                            <Switch
                                value={item.is_available_now}
                                onValueChange={() => handleToggleAvailability(item)}
                                trackColor={{ false: '#D1D5DB', true: modernColors.primary + '80' }}
                                thumbColor={item.is_available_now ? modernColors.primary : '#fff'}
                            />
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleTaxiPress(item)}
                    >
                        <SafeIcon name="edit" size={16} color={modernColors.primary} />
                        <Text style={styles.editButtonText}>Modifier</Text>
                    </TouchableOpacity>
                </View>
            </NativeCard>
        </TouchableOpacity>
    );

    const statusFilters = [
        { key: 'all', label: 'Tous' },
        { key: 'active', label: 'Actifs' },
        { key: 'inactive', label: 'Inactifs' },
    ];

    if (loading && taxis.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Mes taxis</Text>
                </View>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement de vos taxis...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Mes taxis</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('TaxiForm' as never, { mode: 'create' } as never)}
                    style={styles.addButton}
                >
                    <SafeIcon name="plus" size={24} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {/* Filtres de statut */}
            <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
                    {statusFilters.map((filter) => (
                        <TouchableOpacity
                            key={filter.key}
                            style={[
                                styles.filterChip,
                                statusFilter === filter.key && styles.filterChipActive,
                            ]}
                            onPress={() => {
                                setStatusFilter(filter.key);
                                loadTaxis(true);
                            }}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    statusFilter === filter.key && styles.filterChipTextActive,
                                ]}
                            >
                                {filter.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {taxis.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="car" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Aucun taxi trouvé</Text>
                    <Text style={styles.emptySubtext}>
                        {statusFilter === 'all'
                            ? 'Créez votre premier taxi'
                            : `Aucun taxi avec le statut "${statusFilters.find(f => f.key === statusFilter)?.label}"`}
                    </Text>
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => {
                            navigation.navigate('TaxiForm' as never, { mode: 'create' } as never);
                        }}
                    >
                        <SafeIcon name="plus" size={20} color="#fff" />
                        <Text style={styles.createButtonText}>Créer un taxi</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={taxis}
                    renderItem={renderTaxi}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadTaxis(true)}
                            colors={[modernColors.primary]}
                        />
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    addButton: {
        padding: 8,
    },
    filtersContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filtersContent: {
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    taxiCard: {
        padding: 16,
        marginBottom: 12,
    },
    taxiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    taxiInfo: {
        flex: 1,
    },
    taxiName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    taxiType: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#EF4444' + '20',
    },
    statusBadgeAvailable: {
        backgroundColor: '#10B981' + '20',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
    },
    statusTextAvailable: {
        color: '#10B981',
    },
    taxiDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    taxiActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    availabilityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    availabilityLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default MesTaxisScreen;

