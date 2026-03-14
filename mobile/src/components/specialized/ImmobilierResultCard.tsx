import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RealEstateProperty } from '../../services/immobilierService';
import { mediaService } from '../../services/mediaService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImmobilierResultCardProps {
    property: RealEstateProperty;
    onPress?: () => void;
    onContact?: () => void;
}

const ImmobilierResultCard: React.FC<ImmobilierResultCardProps> = ({ property, onPress, onContact }) => {
    const navigation = useNavigation();
    const scrollViewRef = useRef<ScrollView>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            (navigation as any).navigate('ImmobilierDetails', {
                propertyId: property.id,
            });
        }
    };

    const handleScroll = (event: any) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / SCREEN_WIDTH);
        setCurrentImageIndex(index);
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'Prix sur demande';
        return `${(price / 1000).toFixed(0)}K FCFA`;
    };

    const getStatusIcon = (statut: string) => {
        if (statut.includes('vendre')) return '💰';
        if (statut.includes('louer')) return '🏠';
        return '🏡';
    };

    const photos = property.photos || [];
    const hasMultiplePhotos = photos.length > 1;

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.9}>
            {/* ✅ NOUVEAU: Galerie d'images avec swipe */}
            {photos.length > 0 ? (
                <View style={styles.imageContainer}>
                    <ScrollView
                        ref={scrollViewRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        style={styles.imageScrollView}
                    >
                        {photos.map((photo, index) => (
                            <Image
                                key={index}
                                source={{ uri: mediaService.getImageUrl(photo, { width: 800, quality: 85 }) }}
                                style={styles.image}
                                resizeMode="cover"
                            />
                        ))}
                    </ScrollView>

                    {/* Indicateur de pagination */}
                    {hasMultiplePhotos && (
                        <View style={styles.pagination}>
                            {photos.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.paginationDot,
                                        index === currentImageIndex && styles.paginationDotActive,
                                    ]}
                                />
                            ))}
                        </View>
                    )}

                    {/* Badge nombre de photos */}
                    {hasMultiplePhotos && (
                        <View style={styles.photoCountBadge}>
                            <SafeIcon name="image" size={12} color="#fff" type="lucide" />
                            <Text style={styles.photoCountText}>{photos.length}</Text>
                        </View>
                    )}
                </View>
            ) : (
                <View style={styles.imagePlaceholder}>
                    <SafeIcon name="home" size={48} color="#D1D5DB" />
                    <Text style={styles.placeholderText}>Aucune photo</Text>
                </View>
            )}

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title} numberOfLines={2}>
                            {property.titre}
                        </Text>
                        <View style={styles.statusRow}>
                            <Text style={styles.statusIcon}>{getStatusIcon(property.statut)}</Text>
                            <Text style={styles.status}>{property.statut}</Text>
                        </View>
                    </View>
                    {property.is_available_now && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>🟢 DISPONIBLE</Text>
                        </View>
                    )}
                </View>

                {/* Type et caractéristiques */}
                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <SafeIcon name="home" size={14} color="#6B7280" />
                        <Text style={styles.detailText}>{property.type_bien}</Text>
                    </View>
                    {property.superficie_m2 && (
                        <View style={styles.detailItem}>
                            <SafeIcon name="maximize" size={14} color="#6B7280" />
                            <Text style={styles.detailText}>{property.superficie_m2} m²</Text>
                        </View>
                    )}
                    {property.nb_chambres && (
                        <View style={styles.detailItem}>
                            <SafeIcon name="bed" size={14} color="#6B7280" />
                            <Text style={styles.detailText}>{property.nb_chambres} ch.</Text>
                        </View>
                    )}
                </View>

                {/* Localisation */}
                {(property.quartier || property.ville) && (
                    <View style={styles.locationRow}>
                        <SafeIcon name="map-pin" size={14} color="#6B7280" />
                        <Text style={styles.locationText}>
                            {[property.quartier, property.ville].filter(Boolean).join(', ')}
                        </Text>
                    </View>
                )}

                {/* Standing */}
                {property.standing && (
                    <View style={styles.standingRow}>
                        <Text style={styles.standingText}>⭐ {property.standing}</Text>
                    </View>
                )}

                {/* Ratings */}
                {(property.average_rating !== undefined || property.total_ratings !== undefined) && (
                    <View style={styles.ratingsRow}>
                        <SafeIcon name="star" size={14} color="#F59E0B" />
                        <Text style={styles.ratingsText}>
                            {property.average_rating ? `${property.average_rating.toFixed(1)}` : 'N/A'}
                            {property.total_ratings !== undefined && property.total_ratings > 0 && (
                                <Text style={styles.ratingsCount}> ({property.total_ratings} avis)</Text>
                            )}
                        </Text>
                    </View>
                )}

                {/* Prix */}
                <View style={styles.priceRow}>
                    {property.prix_vente && (
                        <Text style={styles.price}>
                            {formatPrice(property.prix_vente)}
                        </Text>
                    )}
                    {property.prix_location_mensuel && (
                        <Text style={styles.price}>
                            {formatPrice(property.prix_location_mensuel)}/mois
                        </Text>
                    )}
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    {property.distance_km && (
                        <View style={styles.distanceRow}>
                            <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                            <Text style={styles.distanceText}>
                                {property.distance_km.toFixed(1)} km
                            </Text>
                        </View>
                    )}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.visitButton]}
                            onPress={() => {
                                (navigation as any).navigate('ImmobilierBooking', {
                                    propertyId: property.id,
                                    propertyName: property.titre,
                                });
                            }}
                        >
                            <SafeIcon name="calendar-plus" size={18} color="#fff" />
                            <Text style={styles.actionButtonText}>Visite</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.contactButton]}
                            onPress={() => {
                                if (onContact) {
                                    onContact();
                                } else {
                                    (navigation as any).navigate('ImmobilierDetails', {
                                        propertyId: property.id,
                                    });
                                }
                            }}
                        >
                            <SafeIcon name="message-circle" size={18} color="#fff" />
                            <Text style={styles.actionButtonText}>Contacter</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.contactRow}>
                        {property.telephone && (
                            <TouchableOpacity
                                style={styles.contactButton}
                                onPress={() => Linking.openURL(`tel:${property.telephone}`)}
                            >
                                <SafeIcon name="phone" size={16} color={modernColors.primary} />
                            </TouchableOpacity>
                        )}
                        {property.whatsapp && (
                            <TouchableOpacity
                                style={styles.contactButton}
                                onPress={() => {
                                    const whatsappNumber = property.whatsapp?.replace(/[^0-9]/g, '') || '';
                                    Linking.openURL(`https://wa.me/${whatsappNumber}`);
                                }}
                            >
                                <SafeIcon name="message-circle" size={16} color="#25D366" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        height: 200,
        position: 'relative',
    },
    imageScrollView: {
        width: '100%',
        height: 200,
    },
    image: {
        width: SCREEN_WIDTH, // Largeur pleine écran pour le swipe
        height: 200,
        backgroundColor: '#F3F4F6',
    },
    imagePlaceholder: {
        width: '100%',
        height: 200,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
    },
    pagination: {
        position: 'absolute',
        bottom: 12,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    paginationDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    paginationDotActive: {
        width: 20,
        backgroundColor: '#fff',
    },
    photoCountBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    photoCountText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    content: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIcon: {
        fontSize: 16,
        marginRight: 4,
    },
    status: {
        fontSize: 14,
        color: '#6B7280',
    },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
        gap: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 14,
        color: '#6B7280',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 6,
    },
    standingRow: {
        marginBottom: 8,
    },
    standingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F59E0B',
    },
    ratingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
    },
    ratingsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    ratingsCount: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '400',
    },
    priceRow: {
        marginBottom: 12,
    },
    price: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    footer: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
        marginLeft: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    visitButton: {
        backgroundColor: modernColors.primary,
    },
    contactButton: {
        backgroundColor: '#6366F1',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    contactRow: {
        flexDirection: 'row',
        gap: 8,
    },
    contactButtonSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ImmobilierResultCard;

