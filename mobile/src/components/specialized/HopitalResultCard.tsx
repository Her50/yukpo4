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

interface HopitalResultCardProps {
    hospital: {
        id: number;
        service_id: number;
        nom: string;
        type_etablissement?: string;
        adresse?: string;
        quartier?: string;
        ville?: string;
        telephone?: string;
        whatsapp?: string;
        is_available_now?: boolean;
        distance_km?: number;
        prestations_medicales?: string[];
        urgences_disponible?: boolean;
    };
    onPress?: () => void;
}

const HopitalResultCard: React.FC<HopitalResultCardProps> = ({ hospital, onPress }) => {
    const navigation = useNavigation();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            (navigation as any).navigate('ServiceDetail', {
                serviceId: hospital.service_id,
            });
        }
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>🏥</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{hospital.nom}</Text>
                    {hospital.type_etablissement && (
                        <Text style={styles.type}>{hospital.type_etablissement}</Text>
                    )}
                    {hospital.is_available_now && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>🟢 DISPONIBLE</Text>
                        </View>
                    )}
                </View>
            </View>

            {(hospital.quartier || hospital.ville) && (
                <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>
                        {[hospital.quartier, hospital.ville].filter(Boolean).join(', ')}
                    </Text>
                </View>
            )}

            {hospital.urgences_disponible && (
                <View style={styles.urgencesBadge}>
                    <Text style={styles.urgencesText}>🚨 Urgences disponibles</Text>
                </View>
            )}

            {hospital.prestations_medicales && hospital.prestations_medicales.length > 0 && (
                <View style={styles.prestationsRow}>
                    {hospital.prestations_medicales.slice(0, 3).map((prestation, index) => (
                        <View key={index} style={styles.prestationTag}>
                            <Text style={styles.prestationTagText}>{prestation}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.footer}>
                {hospital.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {hospital.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    {hospital.telephone && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => Linking.openURL(`tel:${hospital.telephone}`)}
                        >
                            <SafeIcon name="phone" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                    {hospital.whatsapp && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => {
                                const whatsappNumber = hospital.whatsapp?.replace(/[^0-9]/g, '') || '';
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
        borderLeftColor: '#EF4444',
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
        backgroundColor: '#FEE2E2',
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
    type: {
        fontSize: 14,
        color: '#6B7280',
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
    urgencesBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 8,
    },
    urgencesText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    prestationsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    prestationTag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    prestationTagText: {
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

export default HopitalResultCard;

