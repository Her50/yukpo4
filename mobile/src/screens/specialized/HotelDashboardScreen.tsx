// ✅ NOUVEAU: Dashboard professionnel pour prestataires Hôtel/Meublé
// Exploite les 16 endpoints backend hotel_room_management_routes
// Remplace la redirection vers ImmobilierForm pour les types hotel/meuble

import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import ServiceTeamManager from '../../components/ServiceTeamManager';
import { useAuth } from '../../contexts/AuthContext';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

type TabType = 'overview' | 'reservations' | 'properties' | 'ai' | 'team';

interface HotelProperty {
    id: number;
    service_id: number;
    titre: string;
    type_bien: string;
    adresse?: string;
    ville?: string;
    nb_chambres?: number;
    prix_location_mensuel?: number;
    prix_vente?: number;
    is_available_now?: boolean;
    photos?: string[];
}

interface Reservation {
    id: number;
    property_id: number;
    property_name?: string;
    nom_client: string;
    telephone_client: string;
    email_client?: string;
    date_arrivee: string;
    date_depart: string;
    nombre_adultes: number;
    nombre_enfants?: number;
    nombre_chambres: number;
    prix_total: number;
    montant_avance?: number;
    payment_status: string;
    reservation_status: string;
    status?: string;
    checked_in_at?: string;
    checked_out_at?: string;
    can_check_in?: boolean;
    can_check_out?: boolean;
    created_at: string;
}

const HotelDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data states
    const [properties, setProperties] = useState<HotelProperty[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [aiInsights, setAiInsights] = useState<any>(null);
    const [loadingAI, setLoadingAI] = useState(false);

    // Modal states
    const [showNewReservationModal, setShowNewReservationModal] = useState(false);
    const [showBlockageModal, setShowBlockageModal] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState<HotelProperty | null>(null);

    // New reservation form
    const [newReservation, setNewReservation] = useState({
        nom_client: '',
        telephone_client: '',
        email_client: '',
        date_arrivee: '',
        date_depart: '',
        nombre_adultes: '1',
        nombre_enfants: '0',
        nombre_chambres: '1',
        prix_nuitee: '',
        notes: '',
    });

    const devise = getCurrencyIntelligently() || 'FCFA';

    const formatPrice = (price: number) => {
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M ${devise}`;
        if (price >= 1000) return `${(price / 1000).toFixed(0)}K ${devise}`;
        return `${price} ${devise}`;
    };

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    };

    // ✅ Load all data
    const loadData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const [propsRes, reservRes] = await Promise.all([
                immobilierService.getMyHotelProperties(),
                immobilierService.getMyHotelReservations(),
            ]);

            const propsData = (propsRes?.data || propsRes) as any;
            if (propsData?.success || propsData?.data) {
                setProperties(propsData?.data || []);
            }

            const reservData = (reservRes?.data || reservRes) as any;
            if (reservData?.success || reservData?.data) {
                const rawReservations = reservData?.data || [];
                // Map backend 'status' field to mobile 'reservation_status'
                const mapped = rawReservations.map((r: any) => ({
                    ...r,
                    reservation_status: r.reservation_status || r.status || 'pending',
                    checked_in_at: r.checked_in_at || (r.status === 'checked_in' ? 'yes' : undefined),
                    checked_out_at: r.checked_out_at || (r.status === 'checked_out' ? 'yes' : undefined),
                }));
                setReservations(mapped);
            }
        } catch (error) {
            console.error('[HotelDashboard] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    // ✅ Statistics
    const stats = {
        totalProperties: properties.length,
        totalReservations: reservations.length,
        pendingReservations: reservations.filter(r => r.reservation_status === 'confirmed' && !r.checked_in_at).length,
        checkedIn: reservations.filter(r => r.checked_in_at && !r.checked_out_at).length,
        totalRevenue: reservations.reduce((sum, r) => sum + (r.prix_total || 0), 0),
        pendingPayments: reservations.filter(r => r.payment_status !== 'paid').length,
    };

    // ✅ Check-in
    const handleCheckIn = async (reservation: Reservation) => {
        try {
            const res = await immobilierService.checkInReservation(reservation.id);
            const resData = (res?.data || res) as any;
            if (resData?.success) {
                Alert.alert('Succès', `Check-in effectué pour ${reservation.nom_client}`);
                loadData(true);
            } else {
                Alert.alert('Erreur', resData?.message || 'Erreur lors du check-in');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible d\'effectuer le check-in');
        }
    };

    // ✅ Check-out
    const handleCheckOut = async (reservation: Reservation) => {
        Alert.alert('Confirmer le check-out', `Check-out de ${reservation.nom_client} ?`, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Confirmer', onPress: async () => {
                    try {
                        const res = await immobilierService.checkOutReservation(reservation.id);
                        const resData = (res?.data || res) as any;
                        if (resData?.success) {
                            Alert.alert('Succès', 'Check-out effectué');
                            loadData(true);
                        } else {
                            Alert.alert('Erreur', resData?.message || 'Erreur check-out');
                        }
                    } catch (error: any) {
                        Alert.alert('Erreur', error.message || 'Impossible d\'effectuer le check-out');
                    }
                }
            }
        ]);
    };

    // ✅ View QR codes
    const handleViewQRCodes = async (reservation: Reservation) => {
        (navigation as any).navigate('HotelReservationQR', {
            reservationId: reservation.id,
            propertyName: reservation.property_name,
        });
    };

    // ✅ Create manual reservation
    const handleCreateReservation = async () => {
        if (!selectedProperty) {
            Alert.alert('Erreur', 'Sélectionnez d\'abord une propriété');
            return;
        }
        if (!newReservation.nom_client.trim() || !newReservation.telephone_client.trim()) {
            Alert.alert('Erreur', 'Nom et téléphone du client sont requis');
            return;
        }
        if (!newReservation.date_arrivee || !newReservation.date_depart) {
            Alert.alert('Erreur', 'Dates d\'arrivée et de départ requises');
            return;
        }

        const nbNuits = Math.max(1, Math.ceil(
            (new Date(newReservation.date_depart).getTime() - new Date(newReservation.date_arrivee).getTime()) / (1000 * 60 * 60 * 24)
        ));
        const prixNuitee = parseFloat(newReservation.prix_nuitee) || 0;
        const nbChambres = parseInt(newReservation.nombre_chambres) || 1;
        const prixTotal = prixNuitee * nbNuits * nbChambres;

        try {
            const res = await immobilierService.createManualReservation({
                property_id: selectedProperty.id,
                date_arrivee: newReservation.date_arrivee,
                date_depart: newReservation.date_depart,
                nombre_adultes: parseInt(newReservation.nombre_adultes) || 1,
                nombre_enfants: parseInt(newReservation.nombre_enfants) || 0,
                nombre_chambres: nbChambres,
                nom_client: newReservation.nom_client.trim(),
                telephone_client: newReservation.telephone_client.trim(),
                email_client: newReservation.email_client.trim() || undefined,
                prix_nuitee: prixNuitee,
                prix_total: prixTotal,
                montant_total: prixTotal,
                manual_reservation_source: 'dashboard',
                notes: newReservation.notes.trim() || undefined,
            });

            const resData = (res?.data || res) as any;
            if (resData?.success) {
                Alert.alert('Succès', 'Réservation créée avec succès');
                setShowNewReservationModal(false);
                setNewReservation({
                    nom_client: '', telephone_client: '', email_client: '',
                    date_arrivee: '', date_depart: '',
                    nombre_adultes: '1', nombre_enfants: '0', nombre_chambres: '1',
                    prix_nuitee: '', notes: '',
                });
                loadData(true);
            } else {
                Alert.alert('Erreur', resData?.message || 'Erreur lors de la création');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de créer la réservation');
        }
    };

    // ✅ Load AI insights
    const handleLoadAIInsights = async (propertyId: number) => {
        setLoadingAI(true);
        try {
            const res = await immobilierService.getPropertyAIInsights(propertyId);
            const resData = (res?.data || res) as any;
            if (resData?.success) {
                setAiInsights(resData?.data || resData);
            } else {
                Alert.alert('Info', 'Les insights IA ne sont pas encore disponibles pour ce bien');
            }
        } catch (error) {
            console.error('[HotelDashboard] Erreur IA insights:', error);
            Alert.alert('Info', 'Les insights IA seront disponibles prochainement');
        } finally {
            setLoadingAI(false);
        }
    };

    // ✅ Navigate to add property
    const handleAddProperty = () => {
        const partnerType = user?.partner_type || 'hotel';
        (navigation as any).navigate('ImmobilierForm', {
            mode: 'create',
            initialTypeBien: partnerType === 'meuble' ? 'meuble' : 'hotel',
        });
    };

    // ✅ Navigate to scan QR
    const handleScanQR = () => {
        (navigation as any).navigate('HotelQRScanner');
    };

    // ✅ Get payment status badge
    const getPaymentBadge = (status: string) => {
        switch (status) {
            case 'paid': return { label: 'Payé', color: '#10B981', bg: '#10B98115' };
            case 'partial': return { label: 'Avance payée', color: '#F59E0B', bg: '#F59E0B15' };
            case 'pending': return { label: 'En attente', color: '#EF4444', bg: '#EF444415' };
            default: return { label: status, color: '#6B7280', bg: '#6B728015' };
        }
    };

    // ✅ Get reservation status badge
    const getReservationBadge = (reservation: Reservation) => {
        if (reservation.checked_out_at) return { label: 'Terminé', color: '#6B7280', icon: 'log-out' };
        if (reservation.checked_in_at) return { label: 'En séjour', color: '#10B981', icon: 'home' };
        if (reservation.reservation_status === 'confirmed') return { label: 'Confirmé', color: '#3B82F6', icon: 'check-circle' };
        if (reservation.reservation_status === 'cancelled') return { label: 'Annulé', color: '#EF4444', icon: 'x-circle' };
        return { label: 'En attente', color: '#F59E0B', icon: 'clock' };
    };

    // ============ RENDER SECTIONS ============

    const renderOverviewTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Stats Cards */}
            <View style={styles.statsGrid}>
                <View style={[styles.statCard, { borderLeftColor: '#3B82F6' }]}>
                    <SafeIcon name="building" size={22} color="#3B82F6" />
                    <Text style={styles.statValue}>{stats.totalProperties}</Text>
                    <Text style={styles.statLabel}>Propriétés</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
                    <SafeIcon name="calendar" size={22} color="#10B981" />
                    <Text style={styles.statValue}>{stats.totalReservations}</Text>
                    <Text style={styles.statLabel}>Réservations</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
                    <SafeIcon name="user-check" size={22} color="#F59E0B" />
                    <Text style={styles.statValue}>{stats.checkedIn}</Text>
                    <Text style={styles.statLabel}>En séjour</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#8B5CF6' }]}>
                    <SafeIcon name="banknote" size={22} color="#8B5CF6" />
                    <Text style={styles.statValue}>{formatPrice(stats.totalRevenue)}</Text>
                    <Text style={styles.statLabel}>Revenus</Text>
                </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Actions rapides</Text>
            <View style={styles.quickActionsRow}>
                <TouchableOpacity style={styles.quickAction} onPress={handleAddProperty}>
                    <View style={[styles.quickActionIcon, { backgroundColor: '#3B82F615' }]}>
                        <SafeIcon name="plus" size={22} color="#3B82F6" />
                    </View>
                    <Text style={styles.quickActionLabel}>Ajouter un bien</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction} onPress={() => setShowNewReservationModal(true)}>
                    <View style={[styles.quickActionIcon, { backgroundColor: '#10B98115' }]}>
                        <SafeIcon name="calendar-plus" size={22} color="#10B981" />
                    </View>
                    <Text style={styles.quickActionLabel}>Nouvelle réservation</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction} onPress={handleScanQR}>
                    <View style={[styles.quickActionIcon, { backgroundColor: '#8B5CF615' }]}>
                        <SafeIcon name="scan" size={22} color="#8B5CF6" />
                    </View>
                    <Text style={styles.quickActionLabel}>Scanner QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction} onPress={() => setActiveTab('ai')}>
                    <View style={[styles.quickActionIcon, { backgroundColor: '#F59E0B15' }]}>
                        <SafeIcon name="sparkles" size={22} color="#F59E0B" />
                    </View>
                    <Text style={styles.quickActionLabel}>IA Insights</Text>
                </TouchableOpacity>
            </View>

            {/* Pending reservations */}
            {stats.pendingReservations > 0 && (
                <>
                    <Text style={styles.sectionTitle}>
                        Arrivées en attente ({stats.pendingReservations})
                    </Text>
                    {reservations
                        .filter(r => r.reservation_status === 'confirmed' && !r.checked_in_at)
                        .slice(0, 3)
                        .map(r => renderReservationCard(r))}
                    {stats.pendingReservations > 3 && (
                        <TouchableOpacity
                            style={styles.seeAllButton}
                            onPress={() => setActiveTab('reservations')}
                        >
                            <Text style={styles.seeAllText}>Voir toutes les réservations</Text>
                            <SafeIcon name="chevron-right" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                </>
            )}

            {/* Currently checked in */}
            {stats.checkedIn > 0 && (
                <>
                    <Text style={styles.sectionTitle}>
                        Clients en séjour ({stats.checkedIn})
                    </Text>
                    {reservations
                        .filter(r => r.checked_in_at && !r.checked_out_at)
                        .map(r => renderReservationCard(r))}
                </>
            )}

            {/* Empty state */}
            {properties.length === 0 && (
                <NativeCard style={styles.emptyCard}>
                    <View style={styles.emptyContent}>
                        <SafeIcon name="building" size={48} color={modernColors.textSecondary} />
                        <Text style={styles.emptyTitle}>Bienvenue sur votre Dashboard</Text>
                        <Text style={styles.emptyText}>
                            Commencez par ajouter votre premier bien hôtelier pour gérer vos réservations, check-in/out et tarification IA.
                        </Text>
                        <NativeButton
                            title="Ajouter un bien"
                            onPress={handleAddProperty}
                            style={{ marginTop: 16, backgroundColor: modernColors.primary }}
                        />
                    </View>
                </NativeCard>
            )}
        </ScrollView>
    );

    const renderReservationCard = (reservation: Reservation) => {
        const resBadge = getReservationBadge(reservation);
        const payBadge = getPaymentBadge(reservation.payment_status);

        return (
            <NativeCard key={reservation.id} style={styles.reservationCard}>
                <View style={styles.reservationHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.clientName}>{reservation.nom_client}</Text>
                        <Text style={styles.clientPhone}>{reservation.telephone_client}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: resBadge.color + '15' }]}>
                        <SafeIcon name={resBadge.icon as any} size={14} color={resBadge.color} />
                        <Text style={[styles.statusText, { color: resBadge.color }]}>{resBadge.label}</Text>
                    </View>
                </View>

                <View style={styles.reservationDetails}>
                    <View style={styles.detailRow}>
                        <SafeIcon name="calendar" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.detailText}>
                            {formatDate(reservation.date_arrivee)} → {formatDate(reservation.date_depart)}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <SafeIcon name="users" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.detailText}>
                            {reservation.nombre_adultes} adulte{reservation.nombre_adultes > 1 ? 's' : ''}
                            {reservation.nombre_enfants ? ` + ${reservation.nombre_enfants} enfant(s)` : ''}
                            {' · '}{reservation.nombre_chambres} chambre{reservation.nombre_chambres > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <SafeIcon name="banknote" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.detailText}>{formatPrice(reservation.prix_total)}</Text>
                        <View style={[styles.payBadge, { backgroundColor: payBadge.bg }]}>
                            <Text style={[styles.payBadgeText, { color: payBadge.color }]}>{payBadge.label}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.reservationActions}>
                    {!reservation.checked_in_at && reservation.reservation_status === 'confirmed' && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                            onPress={() => handleCheckIn(reservation)}
                        >
                            <SafeIcon name="log-in" size={16} color="#fff" />
                            <Text style={styles.actionBtnText}>Check-in</Text>
                        </TouchableOpacity>
                    )}
                    {reservation.checked_in_at && !reservation.checked_out_at && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                            onPress={() => handleCheckOut(reservation)}
                        >
                            <SafeIcon name="log-out" size={16} color="#fff" />
                            <Text style={styles.actionBtnText}>Check-out</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
                        onPress={() => handleViewQRCodes(reservation)}
                    >
                        <SafeIcon name="qr-code" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>QR</Text>
                    </TouchableOpacity>
                    {reservation.payment_status !== 'paid' && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
                            onPress={() => (navigation as any).navigate('HotelBookingPayment', {
                                reservationId: reservation.id,
                                montantTotal: reservation.prix_total,
                                propertyName: reservation.property_name,
                            })}
                        >
                            <SafeIcon name="credit-card" size={16} color="#fff" />
                            <Text style={styles.actionBtnText}>Payer</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </NativeCard>
        );
    };

    const renderReservationsTab = () => (
        <FlatList
            data={reservations}
            keyExtractor={(item) => `reservation-${item.id}`}
            renderItem={({ item }) => renderReservationCard(item)}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
                <NativeCard style={styles.emptyCard}>
                    <View style={styles.emptyContent}>
                        <SafeIcon name="calendar" size={48} color={modernColors.textSecondary} />
                        <Text style={styles.emptyTitle}>Aucune réservation</Text>
                        <Text style={styles.emptyText}>
                            Les réservations de vos clients apparaîtront ici. Vous pouvez aussi créer des réservations manuelles.
                        </Text>
                        <NativeButton
                            title="Nouvelle réservation"
                            onPress={() => setShowNewReservationModal(true)}
                            style={{ marginTop: 16 }}
                        />
                    </View>
                </NativeCard>
            }
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
            }
        />
    );

    const renderPropertiesTab = () => (
        <FlatList
            data={properties}
            keyExtractor={(item) => `property-${item.id}`}
            renderItem={({ item }) => (
                <NativeCard style={styles.propertyCard}>
                    <View style={styles.propertyHeader}>
                        <View style={[styles.propertyTypeBadge, {
                            backgroundColor: item.type_bien === 'hotel' ? '#3B82F615' : '#8B5CF615'
                        }]}>
                            <SafeIcon
                                name={item.type_bien === 'hotel' ? 'building' : 'home'}
                                size={18}
                                color={item.type_bien === 'hotel' ? '#3B82F6' : '#8B5CF6'}
                            />
                            <Text style={[styles.propertyTypeText, {
                                color: item.type_bien === 'hotel' ? '#3B82F6' : '#8B5CF6'
                            }]}>
                                {item.type_bien === 'hotel' ? 'Hôtel' : 'Meublé'}
                            </Text>
                        </View>
                        <View style={[styles.availBadge, {
                            backgroundColor: item.is_available_now ? '#10B98115' : '#EF444415'
                        }]}>
                            <View style={[styles.availDot, {
                                backgroundColor: item.is_available_now ? '#10B981' : '#EF4444'
                            }]} />
                            <Text style={{
                                fontSize: 12,
                                color: item.is_available_now ? '#10B981' : '#EF4444',
                                fontWeight: '600',
                            }}>
                                {item.is_available_now ? 'Disponible' : 'Complet'}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.propertyName}>{item.titre}</Text>
                    {item.adresse && (
                        <View style={styles.detailRow}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.detailText}>{item.adresse}{item.ville ? `, ${item.ville}` : ''}</Text>
                        </View>
                    )}
                    {item.nb_chambres && (
                        <View style={styles.detailRow}>
                            <SafeIcon name="bed-double" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.detailText}>{item.nb_chambres} chambre{item.nb_chambres > 1 ? 's' : ''}</Text>
                        </View>
                    )}
                    {(item.prix_location_mensuel || item.prix_vente) && (
                        <View style={styles.detailRow}>
                            <SafeIcon name="banknote" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.detailText}>
                                {item.prix_location_mensuel
                                    ? `${formatPrice(item.prix_location_mensuel)}/nuit`
                                    : formatPrice(item.prix_vente || 0)}
                            </Text>
                        </View>
                    )}

                    <View style={styles.propertyActions}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: modernColors.primary }]}
                            onPress={() => (navigation as any).navigate('ImmobilierForm', {
                                propertyId: item.id,
                                serviceId: item.service_id,
                                mode: 'edit',
                            })}
                        >
                            <SafeIcon name="edit" size={16} color="#fff" />
                            <Text style={styles.actionBtnText}>Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                            onPress={() => handleLoadAIInsights(item.id)}
                        >
                            <SafeIcon name="sparkles" size={16} color="#fff" />
                            <Text style={styles.actionBtnText}>IA Tarifs</Text>
                        </TouchableOpacity>
                    </View>
                </NativeCard>
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
                <NativeCard style={styles.emptyCard}>
                    <View style={styles.emptyContent}>
                        <SafeIcon name="building" size={48} color={modernColors.textSecondary} />
                        <Text style={styles.emptyTitle}>Aucun bien enregistré</Text>
                        <Text style={styles.emptyText}>
                            Ajoutez votre premier bien hôtelier ou meublé pour commencer à gérer vos réservations.
                        </Text>
                        <NativeButton
                            title="Ajouter un bien"
                            onPress={handleAddProperty}
                            style={{ marginTop: 16 }}
                        />
                    </View>
                </NativeCard>
            }
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
            }
        />
    );

    const renderAITab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <NativeCard style={styles.aiCard}>
                <View style={styles.aiHeader}>
                    <SafeIcon name="sparkles" size={24} color="#F59E0B" />
                    <Text style={styles.aiTitle}>Intelligence Artificielle</Text>
                </View>
                <Text style={styles.aiDescription}>
                    Obtenez des insights IA sur vos propriétés : suggestions de tarifs, prévisions de remplissage et optimisations.
                </Text>

                {properties.length === 0 ? (
                    <Text style={styles.aiNoData}>Ajoutez d'abord un bien pour obtenir des insights IA.</Text>
                ) : (
                    <View style={{ gap: 8 }}>
                        {properties.map(p => (
                            <TouchableOpacity
                                key={p.id}
                                style={styles.aiPropertyBtn}
                                onPress={() => handleLoadAIInsights(p.id)}
                            >
                                <SafeIcon name="building" size={18} color={modernColors.primary} />
                                <Text style={styles.aiPropertyName} numberOfLines={1}>{p.titre}</Text>
                                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </NativeCard>

            {loadingAI && (
                <View style={styles.aiLoadingContainer}>
                    <ActivityIndicator size="large" color="#F59E0B" />
                    <Text style={styles.aiLoadingText}>Analyse IA en cours...</Text>
                </View>
            )}

            {aiInsights && !loadingAI && (
                <NativeCard style={styles.aiResultCard}>
                    <Text style={styles.aiResultTitle}>Insights IA</Text>
                    {aiInsights.pricing_suggestion && (
                        <View style={styles.insightBlock}>
                            <SafeIcon name="trending-up" size={18} color="#10B981" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.insightLabel}>Tarif suggéré</Text>
                                <Text style={styles.insightValue}>
                                    {typeof aiInsights.pricing_suggestion === 'object'
                                        ? JSON.stringify(aiInsights.pricing_suggestion)
                                        : aiInsights.pricing_suggestion}
                                </Text>
                            </View>
                        </View>
                    )}
                    {aiInsights.occupancy_forecast && (
                        <View style={styles.insightBlock}>
                            <SafeIcon name="bar-chart" size={18} color="#3B82F6" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.insightLabel}>Prévision remplissage</Text>
                                <Text style={styles.insightValue}>
                                    {typeof aiInsights.occupancy_forecast === 'object'
                                        ? JSON.stringify(aiInsights.occupancy_forecast)
                                        : aiInsights.occupancy_forecast}
                                </Text>
                            </View>
                        </View>
                    )}
                    {aiInsights.recommendations && (
                        <View style={styles.insightBlock}>
                            <SafeIcon name="lightbulb" size={18} color="#F59E0B" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.insightLabel}>Recommandations</Text>
                                <Text style={styles.insightValue}>
                                    {Array.isArray(aiInsights.recommendations)
                                        ? aiInsights.recommendations.join('\n')
                                        : typeof aiInsights.recommendations === 'object'
                                            ? JSON.stringify(aiInsights.recommendations)
                                            : aiInsights.recommendations}
                                </Text>
                            </View>
                        </View>
                    )}
                    {/* Fallback: show raw data if specific fields not found */}
                    {!aiInsights.pricing_suggestion && !aiInsights.occupancy_forecast && !aiInsights.recommendations && (
                        <Text style={styles.insightValue}>
                            {typeof aiInsights === 'string' ? aiInsights : JSON.stringify(aiInsights, null, 2)}
                        </Text>
                    )}
                </NativeCard>
            )}
        </ScrollView>
    );

    // ✅ New Reservation Modal
    const renderNewReservationModal = () => (
        <Modal visible={showNewReservationModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Nouvelle réservation</Text>
                        <TouchableOpacity onPress={() => setShowNewReservationModal(false)}>
                            <SafeIcon name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Property selector */}
                        <Text style={styles.inputLabel}>Propriété</Text>
                        <View style={styles.propertySelector}>
                            {properties.map(p => (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[
                                        styles.propertySelectorItem,
                                        selectedProperty?.id === p.id && styles.propertySelectorItemActive,
                                    ]}
                                    onPress={() => setSelectedProperty(p)}
                                >
                                    <Text style={[
                                        styles.propertySelectorText,
                                        selectedProperty?.id === p.id && { color: '#fff' },
                                    ]} numberOfLines={1}>{p.titre}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Nom du client *</Text>
                        <TextInput
                            style={styles.input}
                            value={newReservation.nom_client}
                            onChangeText={v => setNewReservation(prev => ({ ...prev, nom_client: v }))}
                            placeholder="Ex: Jean Dupont"
                        />

                        <Text style={styles.inputLabel}>Téléphone *</Text>
                        <TextInput
                            style={styles.input}
                            value={newReservation.telephone_client}
                            onChangeText={v => setNewReservation(prev => ({ ...prev, telephone_client: v }))}
                            placeholder="Ex: +237 6XX XXX XXX"
                            keyboardType="phone-pad"
                        />

                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                            style={styles.input}
                            value={newReservation.email_client}
                            onChangeText={v => setNewReservation(prev => ({ ...prev, email_client: v }))}
                            placeholder="client@email.com"
                            keyboardType="email-address"
                        />

                        <View style={styles.rowInputs}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Arrivée * (AAAA-MM-JJ)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newReservation.date_arrivee}
                                    onChangeText={v => setNewReservation(prev => ({ ...prev, date_arrivee: v }))}
                                    placeholder="2026-03-10"
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.inputLabel}>Départ * (AAAA-MM-JJ)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newReservation.date_depart}
                                    onChangeText={v => setNewReservation(prev => ({ ...prev, date_depart: v }))}
                                    placeholder="2026-03-12"
                                />
                            </View>
                        </View>

                        <View style={styles.rowInputs}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Adultes</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newReservation.nombre_adultes}
                                    onChangeText={v => setNewReservation(prev => ({ ...prev, nombre_adultes: v }))}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.inputLabel}>Enfants</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newReservation.nombre_enfants}
                                    onChangeText={v => setNewReservation(prev => ({ ...prev, nombre_enfants: v }))}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.inputLabel}>Chambres</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newReservation.nombre_chambres}
                                    onChangeText={v => setNewReservation(prev => ({ ...prev, nombre_chambres: v }))}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <Text style={styles.inputLabel}>Prix par nuit ({devise})</Text>
                        <TextInput
                            style={styles.input}
                            value={newReservation.prix_nuitee}
                            onChangeText={v => setNewReservation(prev => ({ ...prev, prix_nuitee: v }))}
                            placeholder="Ex: 25000"
                            keyboardType="numeric"
                        />

                        <Text style={styles.inputLabel}>Notes</Text>
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                            value={newReservation.notes}
                            onChangeText={v => setNewReservation(prev => ({ ...prev, notes: v }))}
                            placeholder="Notes optionnelles..."
                            multiline
                        />

                        <NativeButton
                            title="Créer la réservation"
                            onPress={handleCreateReservation}
                            style={{ marginTop: 16, marginBottom: 32, backgroundColor: modernColors.primary }}
                        />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    // ============ MAIN RENDER ============

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de votre espace...</Text>
            </View>
        );
    }

    const partnerLabel = user?.partner_type === 'meuble' ? 'Meublé' : 'Hôtel';

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#1E3A5F', '#2563EB']}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Dashboard {partnerLabel}</Text>
                        <Text style={styles.headerSubtitle}>
                            {stats.totalProperties} bien{stats.totalProperties > 1 ? 's' : ''} · {stats.checkedIn} en séjour
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handleScanQR} style={styles.scanButton}>
                        <SafeIcon name="scan" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    {([
                        { key: 'overview', label: 'Vue d\'ensemble', icon: 'layout-dashboard' },
                        { key: 'reservations', label: 'Réservations', icon: 'calendar' },
                        { key: 'properties', label: 'Mes biens', icon: 'building' },
                        { key: 'ai', label: 'IA', icon: 'sparkles' },
                        { key: 'team', label: 'Équipe', icon: 'users' },
                    ] as { key: TabType; label: string; icon: string }[]).map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                            onPress={() => setActiveTab(tab.key)}
                        >
                            <SafeIcon
                                name={tab.icon as any}
                                size={16}
                                color={activeTab === tab.key ? '#fff' : '#ffffff80'}
                            />
                            <Text style={[
                                styles.tabLabel,
                                activeTab === tab.key && styles.tabLabelActive,
                            ]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'reservations' && renderReservationsTab()}
                {activeTab === 'properties' && renderPropertiesTab()}
                {activeTab === 'ai' && renderAITab()}
                {activeTab === 'team' && <ServiceTeamManager serviceId={properties[0]?.service_id?.toString()} onClose={() => setActiveTab('overview')} />}
            </View>

            {/* Modals */}
            {renderNewReservationModal()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 12, fontSize: 15, color: modernColors.textSecondary, fontWeight: '500' },

    // Header
    header: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backButton: { marginRight: 12, padding: 4 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: '#ffffffCC', marginTop: 2 },
    scanButton: { padding: 8, backgroundColor: '#ffffff20', borderRadius: 10 },

    // Tabs
    tabsContainer: { flexDirection: 'row', gap: 4, paddingBottom: 8 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, backgroundColor: '#ffffff15' },
    tabActive: { backgroundColor: '#ffffff30' },
    tabLabel: { fontSize: 11, color: '#ffffff80', fontWeight: '500' },
    tabLabelActive: { color: '#fff', fontWeight: '700' },

    // Content
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    statValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 },
    statLabel: { fontSize: 12, color: modernColors.textSecondary, marginTop: 2 },

    // Quick Actions
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    quickActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickActionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickActionLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },

    // Reservation Card
    reservationCard: { marginBottom: 12, padding: 14, borderRadius: 12, backgroundColor: '#fff' },
    reservationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    clientName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    clientPhone: { fontSize: 13, color: modernColors.textSecondary, marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 12, fontWeight: '600' },
    reservationDetails: { gap: 6, marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { fontSize: 13, color: '#374151', flex: 1 },
    payBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    payBadgeText: { fontSize: 11, fontWeight: '600' },
    reservationActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    actionBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },

    // Property Card
    propertyCard: { marginBottom: 12, padding: 14, borderRadius: 12, backgroundColor: '#fff' },
    propertyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    propertyTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    propertyTypeText: { fontSize: 12, fontWeight: '600' },
    availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    availDot: { width: 6, height: 6, borderRadius: 3 },
    propertyName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
    propertyActions: { flexDirection: 'row', gap: 8, marginTop: 12 },

    // AI Tab
    aiCard: { padding: 16, borderRadius: 12, backgroundColor: '#fff', marginBottom: 16 },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    aiTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    aiDescription: { fontSize: 14, color: modernColors.textSecondary, marginBottom: 16, lineHeight: 20 },
    aiNoData: { fontSize: 14, color: modernColors.textSecondary, fontStyle: 'italic' },
    aiPropertyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    aiPropertyName: { fontSize: 14, fontWeight: '500', color: '#111827', flex: 1 },
    aiLoadingContainer: { alignItems: 'center', paddingVertical: 24 },
    aiLoadingText: { marginTop: 8, fontSize: 14, color: '#F59E0B', fontWeight: '500' },
    aiResultCard: { padding: 16, borderRadius: 12, backgroundColor: '#fff', marginBottom: 16 },
    aiResultTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    insightBlock: { flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start' },
    insightLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
    insightValue: { fontSize: 13, color: modernColors.textSecondary, lineHeight: 18 },

    // Empty state
    emptyCard: { padding: 24, borderRadius: 12, backgroundColor: '#fff' },
    emptyContent: { alignItems: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 },
    emptyText: { fontSize: 14, color: modernColors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // See all
    seeAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
    seeAllText: { fontSize: 14, color: modernColors.primary, fontWeight: '600' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
    rowInputs: { flexDirection: 'row' },
    propertySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    propertySelectorItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    propertySelectorItemActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    propertySelectorText: { fontSize: 13, fontWeight: '500', color: '#374151' },
});

export default HotelDashboardScreen;
