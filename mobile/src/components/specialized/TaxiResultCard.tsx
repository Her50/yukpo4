import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface TaxiResultCardProps {
    taxi: {
        id: number;
        service_id: number;
        nom_chauffeur?: string;
        telephone: string;
        whatsapp?: string;
        zone_intervention?: string[];
        is_available_now?: boolean;
        is_on_duty?: boolean;
        distance_km?: number;
    };
    onPress?: () => void;
}

const TaxiResultCard: React.FC<TaxiResultCardProps> = ({ taxi, onPress }) => {
    const navigation = useNavigation();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            (navigation as any).navigate('ServiceDetail', {
                serviceId: taxi.service_id,
            });
        }
    };

    const handleCall = () => {
        Linking.openURL(`tel:${taxi.telephone}`);
    };

    const handleWhatsApp = () => {
        if (taxi.whatsapp) {
            const whatsappNumber = taxi.whatsapp.replace(/[^0-9]/g, '');
            Linking.openURL(`https://wa.me/${whatsappNumber}`);
        }
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>🚕</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>
                        {taxi.nom_chauffeur || `Taxi ${taxi.telephone}`}
                    </Text>
                    {taxi.is_available_now && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>🟢 DISPONIBLE</Text>
                        </View>
                    )}
                </View>
            </View>

            {taxi.zone_intervention && taxi.zone_intervention.length > 0 && (
                <View style={styles.zonesRow}>
                    <Text style={styles.zonesLabel}>Zones:</Text>
                    {taxi.zone_intervention.slice(0, 3).map((zone, index) => (
                        <View key={index} style={styles.zoneTag}>
                            <Text style={styles.zoneTagText}>{zone}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.footer}>
                {taxi.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {taxi.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    <TouchableOpacity
                        style={styles.contactButton}
                        onPress={handleCall}
                    >
                        <SafeIcon name="phone" size={16} color={modernColors.primary} />
                    </TouchableOpacity>
                    {taxi.whatsapp && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={handleWhatsApp}
                        >
                            <SafeIcon name="message-circle" size={16} color="#25D366" />
                        </TouchableOpacity>
                    )}
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
        borderLeftColor: '#F97316',
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
        backgroundColor: '#FFF7ED',
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
    zonesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    zonesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginRight: 4,
    },
    zoneTag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    zoneTagText: {
        fontSize: 12,
        color: '#374151',
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
});

export default TaxiResultCard;

