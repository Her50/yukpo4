// ✅ Détails d'une agence de voyage avec boutons d'action (Mobile)
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface AgenceVoyageDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom_agence: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    services_voyage?: string[];
    compagnies_bus?: string[];
    destinations?: string[];
    heures_ouverture?: string;
    heures_fermeture?: string;
    telephone?: string;
    email?: string;
}

const AgenceVoyageDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;

    const [agence, setAgence] = useState<AgenceVoyageDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAgenceDetails();
    }, []);

    const loadAgenceDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/agences-voyage/${params.agenceId}`);

            if (response.success && response.data) {
                setAgence(response.data);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails de l\'agence de voyage');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[AgenceVoyageDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleCall = () => {
        if (agence?.telephone) {
            Linking.openURL(`tel:${agence.telephone}`);
        }
    };

    const handleBookTicket = () => {
        navigation.navigate('BusTicketSearch' as never);
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!agence) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Agence de voyage non trouvée</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Détails</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <NativeCard style={styles.detailsCard}>
                    <View style={styles.titleRow}>
                        <SafeIcon name="bus" size={32} color={modernColors.primary} />
                        <View style={styles.titleContainer}>
                            <Text style={styles.nom}>{agence.nom_agence}</Text>
                        </View>
                    </View>

                    <View style={styles.badgesRow}>
                        <View style={[styles.statusBadge, agence.is_available_now && styles.statusBadgeAvailable]}>
                            <Text style={[styles.statusText, agence.is_available_now && styles.statusTextAvailable]}>
                                {agence.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Text>
                        </View>
                    </View>

                    {(agence.adresse || agence.ville || agence.quartier) && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <View style={styles.infoContent}>
                                {agence.adresse && <Text style={styles.infoText}>{agence.adresse}</Text>}
                                <Text style={styles.infoSubtext}>
                                    {[agence.quartier, agence.ville].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                        </View>
                    )}

                    {agence.gps && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{agence.gps}</Text>
                        </View>
                    )}

                    {agence.telephone && (
                        <TouchableOpacity style={styles.infoRow} onPress={handleCall}>
                            <SafeIcon name="phone" size={20} color={modernColors.primary} />
                            <Text style={[styles.infoText, styles.linkText]}>{agence.telephone}</Text>
                        </TouchableOpacity>
                    )}

                    {agence.email && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="mail" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{agence.email}</Text>
                        </View>
                    )}

                    {(agence.heures_ouverture || agence.heures_fermeture) && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Horaires</Text>
                            <Text style={styles.infoText}>
                                {agence.heures_ouverture && agence.heures_fermeture
                                    ? `${agence.heures_ouverture} - ${agence.heures_fermeture}`
                                    : agence.heures_ouverture || agence.heures_fermeture || 'Non renseignés'}
                            </Text>
                        </View>
                    )}

                    {agence.destinations && agence.destinations.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Destinations</Text>
                            <View style={styles.tagsContainer}>
                                {agence.destinations.map((dest, idx) => (
                                    <View key={idx} style={styles.tag}>
                                        <Text style={styles.tagText}>{dest}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {agence.compagnies_bus && agence.compagnies_bus.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Compagnies de bus</Text>
                            <View style={styles.tagsContainer}>
                                {agence.compagnies_bus.map((comp, idx) => (
                                    <View key={idx} style={styles.tag}>
                                        <Text style={styles.tagText}>{comp}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {agence.services_voyage && agence.services_voyage.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Services</Text>
                            <View style={styles.tagsContainer}>
                                {agence.services_voyage.map((service, idx) => (
                                    <View key={idx} style={styles.tag}>
                                        <Text style={styles.tagText}>{service}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </NativeCard>

                <View style={styles.actionsContainer}>
                    <NativeButton onPress={handleBookTicket} style={styles.actionButton}>
                        <SafeIcon name="bus" size={20} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Réserver un billet</Text>
                    </NativeButton>
                    {agence.telephone && (
                        <NativeButton onPress={handleCall} style={[styles.actionButton, styles.actionButtonSecondary]}>
                            <SafeIcon name="phone" size={20} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Appeler</Text>
                        </NativeButton>
                    )}
                </View>
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    detailsCard: {
        padding: 20,
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    titleContainer: {
        flex: 1,
    },
    nom: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    badgesRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
    },
    statusBadgeAvailable: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '600',
    },
    statusTextAvailable: {
        color: '#065F46',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 12,
    },
    infoContent: {
        flex: 1,
    },
    infoText: {
        fontSize: 16,
        color: '#111827',
    },
    infoSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    linkText: {
        color: modernColors.primary,
    },
    section: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 12,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#DBEAFE',
    },
    tagText: {
        fontSize: 14,
        color: '#1E40AF',
        fontWeight: '600',
    },
    actionsContainer: {
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    actionButtonSecondary: {
        backgroundColor: modernColors.primary,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
});

export default AgenceVoyageDetailsScreen;

