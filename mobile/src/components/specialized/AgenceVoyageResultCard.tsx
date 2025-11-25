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

interface AgenceVoyageResultCardProps {
    agency: {
        id: number;
        service_id: number;
        nom_agence: string;
        quartier?: string;
        ville?: string;
        telephone?: string;
        whatsapp?: string;
        peut_emettre_tickets_bus?: boolean;
        distance_km?: number;
        services_voyage?: string[];
        compagnies_bus?: string[];
    };
    onPress?: () => void;
}

const AgenceVoyageResultCard: React.FC<AgenceVoyageResultCardProps> = ({ agency, onPress }) => {
    const navigation = useNavigation();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            (navigation as any).navigate('ServiceDetail', {
                serviceId: agency.service_id,
            });
        }
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>🚌</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{agency.nom_agence}</Text>
                    {agency.peut_emettre_tickets_bus && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>🎫 Tickets Bus</Text>
                        </View>
                    )}
                </View>
            </View>

            {(agency.quartier || agency.ville) && (
                <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>
                        {[agency.quartier, agency.ville].filter(Boolean).join(', ')}
                    </Text>
                </View>
            )}

            {agency.services_voyage && agency.services_voyage.length > 0 && (
                <View style={styles.servicesRow}>
                    {agency.services_voyage.slice(0, 3).map((service, index) => (
                        <View key={index} style={styles.serviceTag}>
                            <Text style={styles.serviceTagText}>{service}</Text>
                        </View>
                    ))}
                </View>
            )}

            {agency.compagnies_bus && agency.compagnies_bus.length > 0 && (
                <View style={styles.compagniesRow}>
                    <Text style={styles.compagniesLabel}>Compagnies:</Text>
                    {agency.compagnies_bus.slice(0, 2).map((compagnie, index) => (
                        <View key={index} style={styles.compagnieTag}>
                            <Text style={styles.compagnieTagText}>{compagnie}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.footer}>
                {agency.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {agency.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    {agency.telephone && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => Linking.openURL(`tel:${agency.telephone}`)}
                        >
                            <SafeIcon name="phone" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                    {agency.whatsapp && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => {
                                const whatsappNumber = agency.whatsapp?.replace(/[^0-9]/g, '') || '';
                                Linking.openURL(`https://wa.me/${whatsappNumber}`);
                            }}
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
        borderLeftColor: '#F59E0B',
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
        backgroundColor: '#FEF3C7',
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
        backgroundColor: '#F59E0B',
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
        marginBottom: 8,
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
    compagniesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    compagniesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginRight: 4,
    },
    compagnieTag: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    compagnieTagText: {
        fontSize: 12,
        color: '#92400E',
        fontWeight: '600',
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

export default AgenceVoyageResultCard;

