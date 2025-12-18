// ✅ Écran de détails d'un bien immobilier
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
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
import { NativeButton } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import PropertyPhotoGallery from '../../components/specialized/PropertyPhotoGallery';
import { immobilierService, RealEstateProperty } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';

type RouteParams = {
    propertyId: number;
};

const ImmobilierDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const propertyId = route.params?.propertyId;

    const [property, setProperty] = useState<RealEstateProperty | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [virtualTours, setVirtualTours] = useState<any[]>([]);

    useEffect(() => {
        if (propertyId) {
            loadProperty();
        }
    }, [propertyId]);

    const loadProperty = async () => {
        if (!propertyId) return;

        try {
            setError(null);
            const response = await immobilierService.getPropertyDetails(propertyId);
            if (response.success && response.data) {
                setProperty(response.data);
                // Vérifier si c'est un favori (à implémenter côté backend)
                // Pour l'instant, on peut vérifier dans les favoris
                try {
                    const favoritesResponse = await immobilierService.getMyFavorites();
                    if (favoritesResponse.success && favoritesResponse.data) {
                        const isFav = favoritesResponse.data.some((p) => p.id === propertyId);
                        setIsFavorite(isFav);
                    }
                } catch (e) {
                    // Ignorer l'erreur de favoris
                }
            } else {
                setError('Bien non trouvé');
            }
        } catch (err: any) {
            console.error('[ImmobilierDetailsScreen] Erreur:', err);
            setError(err.message || 'Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const handleBookVisit = () => {
        if (!property) return;
        (navigation as any).navigate('ImmobilierBooking', {
            propertyId: property.id,
            propertyName: property.titre,
        });
    };

    const handleSimulateLoan = () => {
        if (!property) return;
        Alert.alert(
            'Simulation de prêt',
            'Cette fonctionnalité sera disponible prochainement',
            [{ text: 'OK' }]
        );
    };

    const handleToggleFavorite = async () => {
        if (!property) return;
        try {
            if (isFavorite) {
                await immobilierService.removeFromFavorites(property.id);
                setIsFavorite(false);
                Alert.alert('Succès', 'Bien retiré des favoris');
            } else {
                await immobilierService.addToFavorites(property.id);
                setIsFavorite(true);
                Alert.alert('Succès', 'Bien ajouté aux favoris');
            }
        } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Erreur lors de la mise à jour');
        }
    };

    const handleShare = async () => {
        if (!property) return;
        try {
            const response = await immobilierService.shareProperty(property.id, 'link');
            if (response.success && response.share_url) {
                Alert.alert(
                    'Partage',
                    `Lien de partage : ${response.share_url}`,
                    [{ text: 'OK' }]
                );
            }
        } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Erreur lors du partage');
        }
    };

    const handleTrackView = async () => {
        if (!property) return;
        try {
            await immobilierService.trackPropertyView(property.id, undefined, ['description'], 'details');
        } catch (e) {
            // Ignorer les erreurs de tracking
        }
    };

    useEffect(() => {
        if (property) {
            handleTrackView();
        }
    }, [property]);

    const formatPrice = (price?: number) => {
        if (!price) return 'Prix sur demande';
        if (price >= 1000000) {
            return `${(price / 1000000).toFixed(1)}M FCFA`;
        }
        return `${(price / 1000).toFixed(0)}K FCFA`;
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (error || !property) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error || 'Bien non trouvé'}</Text>
                <NativeButton
                    title="Retour"
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header avec actions */}
            <View style={styles.headerActions}>
                <TouchableOpacity
                    style={styles.headerActionButton}
                    onPress={handleToggleFavorite}
                >
                    <SafeIcon
                        name={isFavorite ? 'heart' : 'heart-outline'}
                        size={24}
                        color={isFavorite ? '#EF4444' : '#6B7280'}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerActionButton}
                    onPress={handleShare}
                >
                    <SafeIcon name="share-2" size={24} color="#6B7280" />
                </TouchableOpacity>
            </View>

            {/* Galerie photos avec visites virtuelles */}
            {(property.photos && property.photos.length > 0) || virtualTours.length > 0 ? (
                <PropertyPhotoGallery
                    photos={property.photos || []}
                    virtualTours={virtualTours}
                />
            ) : (
                <View style={styles.imageContainer}>
                    <SafeIcon name="image" size={64} color="#9CA3AF" />
                    <Text style={styles.noPhotoText}>Aucune photo disponible</Text>
                </View>
            )}

            <View style={styles.content}>
                {/* Titre et statut */}
                <View style={styles.header}>
                    <Text style={styles.title}>{property.titre}</Text>
                    <Text style={styles.statut}>{property.statut}</Text>
                </View>

                {/* Prix */}
                <View style={styles.priceSection}>
                    {property.prix_vente && (
                        <Text style={styles.price}>{formatPrice(property.prix_vente)}</Text>
                    )}
                    {property.prix_location_mensuel && (
                        <Text style={styles.price}>
                            {formatPrice(property.prix_location_mensuel)}/mois
                        </Text>
                    )}
                </View>

                {/* Caractéristiques */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🏠 Caractéristiques</Text>
                    <View style={styles.detailsGrid}>
                        {property.type_bien && (
                            <View style={styles.detailItem}>
                                <SafeIcon name="home" size={20} color={modernColors.primary} />
                                <Text style={styles.detailLabel}>Type</Text>
                                <Text style={styles.detailValue}>{property.type_bien}</Text>
                            </View>
                        )}
                        {property.superficie_m2 && (
                            <View style={styles.detailItem}>
                                <SafeIcon name="maximize" size={20} color={modernColors.primary} />
                                <Text style={styles.detailLabel}>Superficie</Text>
                                <Text style={styles.detailValue}>{property.superficie_m2} m²</Text>
                            </View>
                        )}
                        {property.nb_chambres && (
                            <View style={styles.detailItem}>
                                <SafeIcon name="bed" size={20} color={modernColors.primary} />
                                <Text style={styles.detailLabel}>Chambres</Text>
                                <Text style={styles.detailValue}>{property.nb_chambres}</Text>
                            </View>
                        )}
                        {property.nb_salles_bain && (
                            <View style={styles.detailItem}>
                                <SafeIcon name="droplet" size={20} color={modernColors.primary} />
                                <Text style={styles.detailLabel}>Salles de bain</Text>
                                <Text style={styles.detailValue}>{property.nb_salles_bain}</Text>
                            </View>
                        )}
                    </View>
                    {property.standing && (
                        <View style={styles.standingBadge}>
                            <Text style={styles.standingText}>⭐ {property.standing}</Text>
                        </View>
                    )}
                </View>

                {/* Localisation */}
                {(property.quartier || property.ville) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📍 Localisation</Text>
                        <View style={styles.locationRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.locationText}>
                                {[property.quartier, property.ville].filter(Boolean).join(', ')}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Description */}
                {property.description && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📝 Description</Text>
                        <Text style={styles.description}>{property.description}</Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsSection}>
                    <NativeButton
                        title="📅 Réserver une visite"
                        onPress={handleBookVisit}
                        style={styles.actionButton}
                    />
                    {property.prix_vente && (
                        <NativeButton
                            title="💰 Simuler un prêt"
                            onPress={handleSimulateLoan}
                            style={[styles.actionButton, styles.secondaryButton]}
                        />
                    )}
                </View>

                {/* Contact */}
                <View style={styles.contactSection}>
                    <Text style={styles.sectionTitle}>📞 Contact</Text>
                    <View style={styles.contactRow}>
                        {property.telephone && (
                            <TouchableOpacity
                                style={styles.contactButton}
                                onPress={() => Linking.openURL(`tel:${property.telephone}`)}
                            >
                                <SafeIcon name="phone" size={24} color={modernColors.primary} />
                                <Text style={styles.contactButtonText}>Appeler</Text>
                            </TouchableOpacity>
                        )}
                        {property.whatsapp && (
                            <TouchableOpacity
                                style={[styles.contactButton, styles.whatsappButton]}
                                onPress={() => {
                                    const whatsappNumber = property.whatsapp?.replace(/[^0-9]/g, '') || '';
                                    Linking.openURL(`https://wa.me/${whatsappNumber}`);
                                }}
                            >
                                <SafeIcon name="message-circle" size={24} color="#25D366" />
                                <Text style={[styles.contactButtonText, styles.whatsappText]}>WhatsApp</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    imageContainer: {
        width: '100%',
        height: 300,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    noPhotoText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    headerActions: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        flexDirection: 'row',
        gap: 8,
    },
    headerActionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    content: {
        padding: 16,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    statut: {
        fontSize: 16,
        color: '#6B7280',
    },
    priceSection: {
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    price: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.primary,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 12,
    },
    detailItem: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    detailLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginTop: 4,
    },
    standingBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
    },
    standingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F59E0B',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    locationText: {
        fontSize: 16,
        color: '#6B7280',
    },
    description: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
    },
    actionsSection: {
        marginTop: 8,
        marginBottom: 24,
        gap: 12,
    },
    actionButton: {
        marginBottom: 0,
    },
    secondaryButton: {
        backgroundColor: '#6366F1',
    },
    contactSection: {
        marginTop: 8,
    },
    contactRow: {
        flexDirection: 'row',
        gap: 12,
    },
    contactButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        gap: 8,
    },
    whatsappButton: {
        backgroundColor: '#DCFCE7',
    },
    contactButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    whatsappText: {
        color: '#25D366',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    backButton: {
        marginTop: 24,
    },
});

export default ImmobilierDetailsScreen;

