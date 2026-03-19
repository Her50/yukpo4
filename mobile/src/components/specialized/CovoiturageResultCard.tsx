import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface CovoiturageResultCardProps {
    covoiturage: {
        id: number;
        service_id: number;
        depart: string;
        destination: string;
        date_depart: string;
        heure_depart: string;
        nombre_places: number;
        places_disponibles: number;
        prix_par_place: number;
        devise: string;
        distance_km?: number;
    };
    onPress?: () => void;
}

const CovoiturageResultCard: React.FC<CovoiturageResultCardProps> = ({ covoiturage, onPress }) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            (navigation as any).navigate('ServiceDetail', {
                serviceId: covoiturage.service_id,
            });
        }
    };

    // Formater la date
    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>🚗</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{covoiturage.depart}</Text>
                    <View style={styles.arrowContainer}>
                        <SafeIcon name="arrow-right" size={16} color={modernColors.primary} />
                    </View>
                    <Text style={styles.title}>{covoiturage.destination}</Text>
                </View>
            </View>

            <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                    <SafeIcon name="calendar" size={14} color="#6B7280" />
                    <Text style={styles.detailText}>{formatDate(covoiturage.date_depart)}</Text>
                </View>
                <View style={styles.detailItem}>
                    <SafeIcon name="clock" size={14} color="#6B7280" />
                    <Text style={styles.detailText}>{covoiturage.heure_depart}</Text>
                </View>
            </View>

            <View style={styles.infoRow}>
                <View style={styles.placesBadge}>
                    <Text style={styles.placesText}>
                        {covoiturage.places_disponibles}/{covoiturage.nombre_places} places
                    </Text>
                </View>
                <View style={styles.priceBadge}>
                    <Text style={styles.priceText}>
                        {covoiturage.prix_par_place.toLocaleString()} {covoiturage.devise}
                    </Text>
                </View>
            </View>

            <View style={styles.footer}>
                {covoiturage.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {covoiturage.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.reserveButton]}
                        onPress={() => {
                            (navigation as any).navigate('Reservation', {
                                serviceId: covoiturage.service_id,
                                serviceType: 'covoiturage',
                                serviceName: `${covoiturage.depart} → ${covoiturage.destination}`,
                                reservationType: 'place',
                            });
                        }}
                    >
                        <SafeIcon name="calendar-plus" size={18} color="#fff" />
                        <Text style={[styles.actionButtonText, styles.reserveButtonText]}>
                            Réserver
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.chatButton]}
                        onPress={() => {
                            (navigation as any).navigate('ServiceDetail', {
                                serviceId: covoiturage.service_id,
                            });
                        }}
                    >
                        <SafeIcon name="message-circle" size={18} color="#fff" />
                        <Text style={[styles.actionButtonText, styles.chatButtonText]}>
                            Contacter
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
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
        borderLeftColor: '#8B5CF6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3E8FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 24,
    },
    titleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    arrowContainer: {
        marginHorizontal: 8,
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 14,
        color: '#6B7280',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    placesBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    placesText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    priceBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    priceText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    footer: {
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
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    reserveButton: {
        backgroundColor: modernColors.primary,
    },
    reserveButtonText: {
        color: '#fff',
    },
    chatButton: {
        backgroundColor: '#10B981',
    },
    chatButtonText: {
        color: '#fff',
    },
});

export default CovoiturageResultCard;

