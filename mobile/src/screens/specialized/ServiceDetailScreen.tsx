// ✅ NOUVEAU: Écran de détails de service générique et adaptatif

import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import ChatModalMobile from '../../components/ChatModalMobile';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface ServiceDetailScreenProps {
    route: {
        params: {
            serviceId: number;
            serviceType?: string;
            showReviews?: boolean;
        };
    };
    navigation: any;
}

const ServiceDetailScreen: React.FC<ServiceDetailScreenProps> = ({ route, navigation }) => {
    const { user } = useAuth();
    const { serviceId, serviceType, showReviews } = route.params;
    const scrollViewRef = useRef<ScrollView>(null);
    const commentsSectionY = useRef<number>(0);

    const [loading, setLoading] = useState(true);
    const [service, setService] = useState<any>(null);
    const [prestataire, setPrestataire] = useState<any>(null);
    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);
    const [detectedServiceType, setDetectedServiceType] = useState<string>(serviceType || '');

    useEffect(() => {
        loadServiceDetails();
        loadRatingStats();
    }, [serviceId]);

    // ✅ NOUVEAU 2026-03-03: Auto-scroll vers les commentaires si showReviews est true
    useEffect(() => {
        if (showReviews && !loading && service && commentsSectionY.current > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: commentsSectionY.current, animated: true });
            }, 400);
        }
    }, [showReviews, loading, service]);

    const loadServiceDetails = async () => {
        try {
            // Charger le service depuis l'endpoint unifié
            // Note: L'endpoint unifié retourne tous les services, on filtre côté client
            const response = await apiGet(`/api/specialized-services/user`);

            if (response.success && (response.data as any).services) {
                // Filtrer le service par service_id
                const allServices = (response.data as any).services;
                const serviceData = allServices.find((s: any) =>
                    (s.service_id === serviceId) || (s.id === serviceId)
                );

                if (serviceData) {
                    setService(serviceData);
                    const detectedType = serviceData.type_ || serviceType || '';
                    setDetectedServiceType(detectedType);

                    // Charger les infos du prestataire
                    // Le prestataire_id est dans metadata ou peut être déduit
                    const prestataireId = serviceData.metadata?.prestataire_id ||
                        serviceData.user_id ||
                        (serviceData.metadata as any)?.user_id;
                    if (prestataireId) {
                        try {
                            const prestataireResponse = await apiGet(`/api/users/${prestataireId}`);
                            if (prestataireResponse.success) {
                                setPrestataire(prestataireResponse.data);
                            }
                        } catch (e) {
                            console.warn('[ServiceDetailScreen] Impossible de charger prestataire:', e);
                        }
                    }
                } else {
                    console.warn('[ServiceDetailScreen] Service non trouvé pour serviceId:', serviceId);
                }
            }
        } catch (error: any) {
            console.error('[ServiceDetailScreen] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRatingStats = async () => {
        try {
            const response = await apiGet(
                `/api/specialized-services/${serviceId}/ratings/stats`
            );
            if (response.success) {
                setRatingStats((response.data as any).stats);
            }
        } catch (error: any) {
            console.error('[ServiceDetailScreen] Erreur chargement stats:', error);
        }
    };

    const handleOpenChat = async () => {
        if (!user || !service) return;

        try {
            // Créer ou récupérer la conversation
            const serviceTypeParam = service?.type_ || detectedServiceType || 'pharmacie';
            const response = await apiGet(
                `/api/specialized-services/${serviceId}/chat/conversation?service_type=${serviceTypeParam}`
            );

            if (response.success) {
                setConversationId((response.data as any).conversation_id);
                setShowChat(true);
            }
        } catch (error: any) {
            console.error('[ServiceDetailScreen] Erreur chat:', error);
            // Ouvrir quand même le chat
            setShowChat(true);
        }
    };

    const handleReservation = (reservationType: 'rdv' | 'place' | 'course' | 'ticket') => {
        if (!service || !user) return;

        navigation.navigate('Reservation', {
            serviceId: service.service_id || serviceId,
            serviceType: service.type_,
            serviceName: service.nom,
            prestataireId: service.metadata?.prestataire_id || service.user_id,
            reservationType,
        });
    };

    const renderContextualActions = () => {
        if (!service) return null;

        const type = service.type_ || detectedServiceType;

        if (type === 'pharmacie') {
            return (
                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="Contacter"
                        variant="primary"
                        onPress={handleOpenChat}
                        style={styles.actionButton}
                    />
                </View>
            );
        }

        if (type === 'hopital' || type === 'laboratoire') {
            return (
                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="Prendre RDV"
                        variant="primary"
                        onPress={() => handleReservation('rdv')}
                        style={styles.actionButton}
                    />
                    <NativeButton
                        title="Contacter"
                        variant="secondary"
                        onPress={handleOpenChat}
                        style={styles.actionButton}
                    />
                </View>
            );
        }

        if (type === 'covoiturage') {
            return (
                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="Réserver place"
                        variant="primary"
                        onPress={() => handleReservation('place')}
                        style={styles.actionButton}
                    />
                    <NativeButton
                        title="Contacter"
                        variant="secondary"
                        onPress={handleOpenChat}
                        style={styles.actionButton}
                    />
                </View>
            );
        }

        if (type === 'taxi') {
            return (
                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="Commander course"
                        variant="primary"
                        onPress={() => handleReservation('course')}
                        style={styles.actionButton}
                    />
                    <NativeButton
                        title="Contacter"
                        variant="secondary"
                        onPress={handleOpenChat}
                        style={styles.actionButton}
                    />
                </View>
            );
        }

        if (type === 'agence_voyage') {
            return (
                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="Réserver ticket"
                        variant="primary"
                        onPress={() => handleReservation('ticket')}
                        style={styles.actionButton}
                    />
                    <NativeButton
                        title="Contacter"
                        variant="secondary"
                        onPress={handleOpenChat}
                        style={styles.actionButton}
                    />
                </View>
            );
        }

        return (
            <View style={styles.actionsContainer}>
                <NativeButton
                    title="Contacter"
                    variant="primary"
                    onPress={handleOpenChat}
                    style={styles.actionButton}
                />
            </View>
        );
    };

    const renderServiceSpecificInfo = () => {
        if (!service) return null;

        const metadata = service.metadata || {};
        const type = service.type_ || detectedServiceType;

        if (type === 'pharmacie') {
            return (
                <NativeCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Informations</Text>
                    {metadata.is_on_duty_now && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                            <Text style={styles.infoText}>🟢 En service actuellement</Text>
                        </View>
                    )}
                    {metadata.permanent_24h && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="clock" size={16} color={modernColors.primary} />
                            <Text style={styles.infoText}>⏰ Service 24/7</Text>
                        </View>
                    )}
                    {metadata.services && Array.isArray(metadata.services) && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoText}>
                                Services: {metadata.services.join(', ')}
                            </Text>
                        </View>
                    )}
                </NativeCard>
            );
        }

        if (type === 'hopital') {
            return (
                <NativeCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Informations</Text>
                    {metadata.rdv_en_ligne && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="calendar" size={16} color={modernColors.primary} />
                            <Text style={styles.infoText}>📅 Prise de RDV en ligne disponible</Text>
                        </View>
                    )}
                    {metadata.urgences_disponible && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                            <Text style={styles.infoText}>🚨 Urgences disponibles</Text>
                        </View>
                    )}
                </NativeCard>
            );
        }

        if (type === 'covoiturage') {
            return (
                <NativeCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Trajet</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>
                            <Text style={styles.bold}>Départ:</Text> {metadata.depart}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>
                            <Text style={styles.bold}>Destination:</Text> {metadata.destination}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoText}>
                            <Text style={styles.bold}>Places disponibles:</Text>{' '}
                            {metadata.places_disponibles || 0}
                        </Text>
                    </View>
                    {metadata.prix_par_place && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoText}>
                                <Text style={styles.bold}>Prix:</Text> {metadata.prix_par_place}{' '}
                                {metadata.devise || 'XOF'}
                            </Text>
                        </View>
                    )}
                </NativeCard>
            );
        }

        return null;
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={modernColors.primary} />
            </View>
        );
    }

    if (!service) {
        return (
            <View style={styles.center}>
                <Text>Service non trouvé</Text>
            </View>
        );
    }

    return (
        <ScrollView ref={scrollViewRef} style={styles.container}>
            <NativeCard style={styles.headerCard}>
                <Text style={styles.title}>{service.nom}</Text>
                {ratingStats && ratingStats.total_ratings > 0 && (
                    <View style={styles.ratingRow}>
                        <SafeIcon name="star" size={20} color={modernColors.warning} />
                        <Text style={styles.ratingText}>
                            {ratingStats.average_rating.toFixed(1)} ({ratingStats.total_ratings}{' '}
                            avis)
                        </Text>
                    </View>
                )}
            </NativeCard>

            {renderServiceSpecificInfo()}

            {renderContextualActions()}

            {/* Section Avis */}
            <View
                style={styles.commentsSection}
                onLayout={(e) => {
                    commentsSectionY.current = e.nativeEvent.layout.y;
                }}
            >
                <ProductCommentsSection
                    serviceId={serviceId}
                    serviceTitle={service.nom}
                    onOpenChat={handleOpenChat}
                    mode="inline"
                />
            </View>

            {/* Chat Modal */}
            {showChat && user && (
                <ChatModalMobile
                    visible={showChat}
                    onClose={() => setShowChat(false)}
                    service={service}
                    prestataireInfo={prestataire}
                    user={user}
                    conversationId={conversationId || undefined}
                />
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCard: {
        margin: 16,
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    ratingText: {
        fontSize: 16,
        color: modernColors.text,
        fontWeight: '600',
    },
    infoCard: {
        margin: 16,
        marginTop: 0,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: modernColors.text,
    },
    bold: {
        fontWeight: '600',
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 12,
        margin: 16,
        marginTop: 0,
    },
    actionButton: {
        flex: 1,
    },
    commentsSection: {
        marginTop: 16,
    },
});

export default ServiceDetailScreen;

