// Écran pour afficher et gérer les demandes de retour
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface ReturnTripRequest {
    id: string;
    outbound_payment_id: string;
    return_from: string;
    return_to: string;
    preferred_return_date: string;
    preferred_return_time?: string;
    status: string;
    matched_product_id?: string;
    number_of_seats: number;
    created_at: string;
}

const BusReturnRequestsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [requests, setRequests] = useState<ReturnTripRequest[]>([]);

    const loadRequests = async () => {
        try {
            const response = await apiGet('/api/bus-tickets/return-requests');
            const resData = (response?.data || response) as any;
            if (resData.success && resData.requests) {
                setRequests(resData.requests);
            }
        } catch (error: any) {
            console.error('[BusReturnRequestsScreen] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de charger les demandes de retour');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadRequests();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return '#F59E0B'; // Orange
            case 'matched': return '#3B82F6'; // Bleu
            case 'completed': return '#10B981'; // Vert
            case 'cancelled': return '#EF4444'; // Rouge
            default: return '#6B7280';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'En attente';
            case 'matched': return 'Bus trouvé !';
            case 'completed': return 'Confirmé';
            case 'cancelled': return 'Annulé';
            default: return status;
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const handleConfirmReturn = async (request: ReturnTripRequest) => {
        if (!request.matched_product_id) {
            Alert.alert('Erreur', 'Aucun bus matché pour cette demande');
            return;
        }

        Alert.alert(
            'Confirmer le retour',
            `Voulez-vous confirmer votre retour de ${request.return_from} à ${request.return_to} ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Confirmer',
                    onPress: () => {
                        navigation.navigate('BusReturnConfirm' as never, {
                            requestId: request.id,
                            productId: request.matched_product_id,
                            numberOfSeats: request.number_of_seats,
                        } as never);
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Mes demandes de retour</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
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
                <Text style={styles.title}>Mes demandes de retour</Text>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {requests.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="inbox" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyText}>Aucune demande de retour</Text>
                        <Text style={styles.emptySubtext}>
                            Créez une demande de retour après avoir acheté un ticket aller
                        </Text>
                    </View>
                ) : (
                    <View style={styles.requestsList}>
                        {requests.map((request) => (
                            <View key={request.id} style={styles.requestCard}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.routeInfo}>
                                        <View style={styles.cityRow}>
                                            <View style={styles.cityDot} />
                                            <Text style={styles.cityName}>{request.return_from}</Text>
                                        </View>
                                        <View style={styles.routeLine} />
                                        <View style={styles.cityRow}>
                                            <View style={[styles.cityDot, styles.cityDotArrival]} />
                                            <Text style={styles.cityName}>{request.return_to}</Text>
                                        </View>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            { backgroundColor: getStatusColor(request.status) + '20' },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusText,
                                                { color: getStatusColor(request.status) },
                                            ]}
                                        >
                                            {getStatusLabel(request.status)}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.cardBody}>
                                    <View style={styles.infoRow}>
                                        <SafeIcon name="calendar" size={16} color="#6B7280" />
                                        <Text style={styles.infoText}>
                                            {formatDate(request.preferred_return_date)}
                                        </Text>
                                        {request.preferred_return_time && (
                                            <>
                                                <Text style={styles.infoText}> à </Text>
                                                <Text style={styles.infoText}>
                                                    {request.preferred_return_time}
                                                </Text>
                                            </>
                                        )}
                                    </View>
                                    <View style={styles.infoRow}>
                                        <SafeIcon name="users" size={16} color="#6B7280" />
                                        <Text style={styles.infoText}>
                                            {request.number_of_seats} place(s)
                                        </Text>
                                    </View>
                                    <Text style={styles.createdText}>
                                        Créée le {formatDate(request.created_at)}
                                    </Text>
                                </View>

                                {request.status === 'matched' && (
                                    <NativeButton
                                        title="Confirmer le retour"
                                        onPress={() => handleConfirmReturn(request)}
                                        variant="primary"
                                        size="medium"
                                        style={styles.confirmButton}
                                    />
                                )}

                                {request.status === 'pending' && (
                                    <View style={styles.waitingContainer}>
                                        <SafeIcon name="clock" size={20} color="#F59E0B" />
                                        <Text style={styles.waitingText}>
                                            Recherche d'un bus correspondant...
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6B7280',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    requestsList: {
        gap: 16,
    },
    requestCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    routeInfo: {
        flex: 1,
    },
    cityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    cityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.primary,
        marginRight: 8,
    },
    cityDotArrival: {
        backgroundColor: '#10B981',
    },
    cityName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    routeLine: {
        width: 2,
        height: 16,
        backgroundColor: '#E5E7EB',
        marginLeft: 3,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    cardBody: {
        marginTop: 8,
        gap: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#6B7280',
    },
    createdText: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 4,
    },
    confirmButton: {
        marginTop: 16,
    },
    waitingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        padding: 12,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        gap: 8,
    },
    waitingText: {
        fontSize: 14,
        color: '#92400E',
        fontWeight: '500',
    },
});

export default BusReturnRequestsScreen;

