import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { modernColors } from '../../theme/modernTheme';
import OrderDeliveryModal from '../delivery/OrderDeliveryModal';
import SafeIcon from '../SafeIcon';

interface PharmacieResultCardProps {
    pharmacy: {
        id: number;
        service_id: number;
        nom: string;
        adresse?: string;
        quartier?: string;
        ville?: string;
        telephone?: string;
        whatsapp?: string;
        is_on_duty_now?: boolean;
        distance_km?: number;
        services?: string[];
        // ✅ 2025-01-27: Statistiques ratings
        average_rating?: number;
        total_ratings?: number;
    };
    onPress?: () => void;
    onContact?: () => void;
}

const PharmacieResultCard: React.FC<PharmacieResultCardProps> = ({ pharmacy, onPress, onContact }) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            (navigation as any).navigate('ServiceDetail', {
                serviceId: pharmacy.service_id,
            });
        }
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>💊</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{pharmacy.nom}</Text>
                    {pharmacy.is_on_duty_now && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>🟢 DE GARDE</Text>
                        </View>
                    )}
                </View>
            </View>

            {(pharmacy.quartier || pharmacy.ville) && (
                <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>
                        {[pharmacy.quartier, pharmacy.ville].filter(Boolean).join(', ')}
                    </Text>
                </View>
            )}

            {pharmacy.services && pharmacy.services.length > 0 && (
                <View style={styles.servicesRow}>
                    {pharmacy.services.slice(0, 3).map((service, index) => (
                        <View key={index} style={styles.serviceTag}>
                            <Text style={styles.serviceTagText}>{service}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* ✅ 2025-01-27: Statistiques de ratings */}
            {(pharmacy.average_rating !== undefined || pharmacy.total_ratings !== undefined) && (
                <View style={styles.ratingsRow}>
                    <SafeIcon name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingsText}>
                        {pharmacy.average_rating ? `${pharmacy.average_rating.toFixed(1)}` : 'N/A'}
                        {pharmacy.total_ratings !== undefined && pharmacy.total_ratings > 0 && (
                            <Text style={styles.ratingsCount}> ({pharmacy.total_ratings} avis)</Text>
                        )}
                    </Text>
                </View>
            )}

            <View style={styles.footer}>
                {pharmacy.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {pharmacy.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    {pharmacy.telephone && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => {
                                Linking.openURL(`tel:${pharmacy.telephone}`);
                            }}
                        >
                            <SafeIcon name="phone" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                    {pharmacy.whatsapp && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => {
                                const whatsappNumber = pharmacy.whatsapp.replace(/[^0-9]/g, '');
                                Linking.openURL(`https://wa.me/${whatsappNumber}`);
                            }}
                        >
                            <SafeIcon name="message-circle" size={16} color="#25D366" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Actions contextuelles */}
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.chatButton]}
                    onPress={() => {
                        if (onContact) {
                            onContact();
                        } else {
                            (navigation as any).navigate('ServiceDetailSpecialized', {
                                serviceId: pharmacy.service_id,
                                serviceType: 'pharmacie',
                            });
                        }
                    }}
                >
                    <SafeIcon name="message-circle" size={18} color="#fff" />
                    <Text style={[styles.actionButtonText, styles.chatButtonText]}>
                        Contacter
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.deliveryButton]}
                    onPress={() => setShowDeliveryModal(true)}
                >
                    <SafeIcon name="truck" size={18} color="#fff" />
                    <Text style={[styles.actionButtonText, styles.deliveryButtonText]}>
                        Livraison
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Delivery Modal */}
            <OrderDeliveryModal
                visible={showDeliveryModal}
                onClose={() => setShowDeliveryModal(false)}
                serviceId={pharmacy.service_id}
                productName={`Pharmacie - ${pharmacy.nom}`}
                onSuccess={(deliveryId) => {
                    setShowDeliveryModal(false);
                    // Optionnel: navigation ou notification
                }}
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#10B981',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 24,
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
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    serviceTag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    serviceTagText: {
        fontSize: 12,
        color: '#374151',
    },
    // ✅ 2025-01-27: Styles pour ratings
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
        marginLeft: 4,
    },
    contactRow: {
        flexDirection: 'row',
        gap: 8,
    },
    contactButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionsRow: {
        flexDirection: 'row',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 6,
    },
    deliveryButton: {
        backgroundColor: modernColors.primary,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    deliveryButtonText: {
        color: '#fff',
    },
    chatButton: {
        backgroundColor: '#10B981',
        marginRight: 8,
    },
    chatButtonText: {
        color: '#fff',
    },
});

export default PharmacieResultCard;

