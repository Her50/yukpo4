import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    Card,
    Chip,
    Divider,
    IconButton,
    Paragraph,
    Text,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocation } from '../../contexts/LocationContext';
import { serviceService } from '../../services/api';

interface Service {
    id: string;
    name: string;
    description: string;
    category: string;
    price?: number;
    location?: {
        address: string;
        latitude: number;
        longitude: number;
    };
    provider: {
        id: string;
        name: string;
        email: string;
        phone: string;
        rating: number;
    };
    images?: string[];
    rating?: number;
    reviews?: Array<{
        id: string;
        user: string;
        rating: number;
        comment: string;
        date: string;
    }>;
    createdAt: string;
}

const ServiceDetailScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { location } = useLocation();

    const [service, setService] = useState<Service | null>(null);
    const [loading, setLoading] = useState(true);
    const [contactLoading, setContactLoading] = useState(false);

    const serviceId = route.params?.serviceId;

    useEffect(() => {
        if (serviceId) {
            loadService();
        }
    }, [serviceId]);

    const loadService = async () => {
        try {
            setLoading(true);
            const response = await serviceService.getServiceById(serviceId);
            setService(response.data);
        } catch (error) {
            console.error('Erreur lors du chargement du service:', error);
            Alert.alert('Erreur', 'Impossible de charger les détails du service');
        } finally {
            setLoading(false);
        }
    };

    const handleCall = async (phone: string) => {
        try {
            setContactLoading(true);
            const url = `tel:${phone}`;
            await Linking.openURL(url);
        } catch (error) {
            Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application téléphone');
        } finally {
            setContactLoading(false);
        }
    };

    const handleEmail = async (email: string) => {
        try {
            setContactLoading(true);
            const url = `mailto:${email}`;
            await Linking.openURL(url);
        } catch (error) {
            Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application email');
        } finally {
            setContactLoading(false);
        }
    };

    const handleChat = () => {
        if (service?.provider.id) {
            navigation.navigate('AIChat' as never, {
                providerId: service.provider.id
            } as never);
        }
    };

    const handleDirections = () => {
        if (service?.location && location) {
            const { latitude, longitude } = service.location;
            const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
            Linking.openURL(url);
        }
    };

    const renderStars = (rating: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Ionicons
                    key={i}
                    name={i <= rating ? 'star' : 'star-outline'}
                    size={16}
                    color="#fbbf24"
                />
            );
        }
        return stars;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!service) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Service non trouvé</Text>
                    <Button onPress={() => navigation.goBack()}>
                        Retour
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                {/* Header */}
                <View style={styles.header}>
                    <IconButton
                        icon="arrow-left"
                        onPress={() => navigation.goBack()}
                    />
                    <Title style={styles.title}>{service.name}</Title>
                    <IconButton
                        icon="share"
                        onPress={() => {
                            // TODO: Implémenter le partage
                        }}
                    />
                </View>

                {/* Service Info */}
                <Card style={styles.serviceCard}>
                    <Card.Content>
                        <View style={styles.serviceHeader}>
                            <Title style={styles.serviceTitle}>{service.name}</Title>
                            {service.price && (
                                <Text style={styles.servicePrice}>{service.price} FCFA</Text>
                            )}
                        </View>

                        <Chip mode="outlined" style={styles.categoryChip}>
                            {service.category}
                        </Chip>

                        <Paragraph style={styles.serviceDescription}>
                            {service.description}
                        </Paragraph>

                        {service.rating && (
                            <View style={styles.ratingContainer}>
                                <View style={styles.starsContainer}>
                                    {renderStars(service.rating)}
                                </View>
                                <Text style={styles.ratingText}>
                                    {service.rating}/5 ({service.reviews?.length || 0} avis)
                                </Text>
                            </View>
                        )}
                    </Card.Content>
                </Card>

                {/* Provider Info */}
                <Card style={styles.providerCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Prestataire</Title>

                        <View style={styles.providerInfo}>
                            <View style={styles.providerDetails}>
                                <Text style={styles.providerName}>{service.provider.name}</Text>
                                {service.provider.rating && (
                                    <View style={styles.providerRating}>
                                        <View style={styles.starsContainer}>
                                            {renderStars(service.provider.rating)}
                                        </View>
                                        <Text style={styles.providerRatingText}>
                                            {service.provider.rating}/5
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </Card.Content>
                </Card>

                {/* Location */}
                {service.location && (
                    <Card style={styles.locationCard}>
                        <Card.Content>
                            <Title style={styles.sectionTitle}>Localisation</Title>
                            <Text style={styles.locationText}>{service.location.address}</Text>
                            <Button
                                mode="outlined"
                                onPress={handleDirections}
                                style={styles.directionsButton}
                                icon="map-marker"
                            >
                                Itinéraire
                            </Button>
                        </Card.Content>
                    </Card>
                )}

                {/* Contact Actions */}
                <Card style={styles.contactCard}>
                    <Card.Content>
                        <Title style={styles.sectionTitle}>Contact</Title>

                        <View style={styles.contactActions}>
                            <Button
                                mode="contained"
                                onPress={() => handleCall(service.provider.phone)}
                                loading={contactLoading}
                                style={styles.contactButton}
                                icon="phone"
                            >
                                Appeler
                            </Button>

                            <Button
                                mode="outlined"
                                onPress={() => handleEmail(service.provider.email)}
                                loading={contactLoading}
                                style={styles.contactButton}
                                icon="email"
                            >
                                Email
                            </Button>

                            <Button
                                mode="outlined"
                                onPress={handleChat}
                                style={styles.contactButton}
                                icon="chat"
                            >
                                Chat
                            </Button>
                        </View>
                    </Card.Content>
                </Card>

                {/* Reviews */}
                {service.reviews && service.reviews.length > 0 && (
                    <Card style={styles.reviewsCard}>
                        <Card.Content>
                            <Title style={styles.sectionTitle}>Avis clients</Title>

                            {service.reviews.map((review) => (
                                <View key={review.id} style={styles.reviewItem}>
                                    <View style={styles.reviewHeader}>
                                        <Text style={styles.reviewUser}>{review.user}</Text>
                                        <View style={styles.starsContainer}>
                                            {renderStars(review.rating)}
                                        </View>
                                    </View>
                                    <Text style={styles.reviewComment}>{review.comment}</Text>
                                    <Text style={styles.reviewDate}>{review.date}</Text>

                                    {review.id !== service.reviews![service.reviews!.length - 1].id && (
                                        <Divider style={styles.reviewDivider} />
                                    )}
                                </View>
                            ))}
                        </Card.Content>
                    </Card>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: '#dc2626',
        marginBottom: 16,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#ffffff',
        elevation: 2,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginHorizontal: 8,
    },
    serviceCard: {
        margin: 16,
        elevation: 2,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    serviceTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        flex: 1,
        marginRight: 8,
    },
    servicePrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    categoryChip: {
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    serviceDescription: {
        fontSize: 16,
        color: '#64748b',
        lineHeight: 24,
        marginBottom: 12,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        marginRight: 8,
    },
    ratingText: {
        fontSize: 14,
        color: '#64748b',
    },
    providerCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 12,
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerDetails: {
        flex: 1,
    },
    providerName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    providerRating: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerRatingText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
    },
    locationCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        elevation: 2,
    },
    locationText: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 12,
    },
    directionsButton: {
        alignSelf: 'flex-start',
    },
    contactCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        elevation: 2,
    },
    contactActions: {
        flexDirection: 'row',
        gap: 8,
    },
    contactButton: {
        flex: 1,
    },
    reviewsCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        elevation: 2,
    },
    reviewItem: {
        paddingVertical: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    reviewUser: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    reviewComment: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 4,
    },
    reviewDate: {
        fontSize: 12,
        color: '#94a3b8',
    },
    reviewDivider: {
        marginTop: 12,
    },
});

export default ServiceDetailScreen;

