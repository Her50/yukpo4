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

interface LaboratoireResultCardProps {
    laboratory: {
        id: number;
        service_id: number;
        nom: string;
        type_laboratoire?: string;
        quartier?: string;
        ville?: string;
        telephone?: string;
        whatsapp?: string;
        is_available_now?: boolean;
        distance_km?: number;
        analyses_disponibles?: string[];
        imagerie_disponible?: string[];
    };
    onPress?: () => void;
}

const LaboratoireResultCard: React.FC<LaboratoireResultCardProps> = ({ laboratory, onPress }) => {
    const navigation = useNavigation();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            (navigation as any).navigate('ServiceDetailSpecialized', {
                serviceId: laboratory.service_id,
                serviceType: 'laboratoire',
            });
        }
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>🔬</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{laboratory.nom}</Text>
                    {laboratory.type_laboratoire && (
                        <Text style={styles.type}>{laboratory.type_laboratoire}</Text>
                    )}
                </View>
            </View>

            {(laboratory.quartier || laboratory.ville) && (
                <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>
                        {[laboratory.quartier, laboratory.ville].filter(Boolean).join(', ')}
                    </Text>
                </View>
            )}

            {(laboratory.analyses_disponibles && laboratory.analyses_disponibles.length > 0) && (
                <View style={styles.servicesRow}>
                    <Text style={styles.servicesLabel}>Analyses:</Text>
                    {laboratory.analyses_disponibles.slice(0, 3).map((analyse, index) => (
                        <View key={index} style={styles.serviceTag}>
                            <Text style={styles.serviceTagText}>{analyse}</Text>
                        </View>
                    ))}
                </View>
            )}

            {(laboratory.imagerie_disponible && laboratory.imagerie_disponible.length > 0) && (
                <View style={styles.servicesRow}>
                    <Text style={styles.servicesLabel}>Imagerie:</Text>
                    {laboratory.imagerie_disponible.slice(0, 3).map((imagerie, index) => (
                        <View key={index} style={styles.serviceTag}>
                            <Text style={styles.serviceTagText}>{imagerie}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.rdvButton]}
                    onPress={() => {
                        (navigation as any).navigate('Reservation', {
                            serviceId: laboratory.service_id,
                            serviceType: 'laboratoire',
                            serviceName: laboratory.nom,
                            reservationType: 'rdv',
                        });
                    }}
                >
                    <SafeIcon name="calendar-plus" size={18} color="#fff" />
                    <Text style={[styles.actionButtonText, styles.rdvButtonText]}>
                        Prendre RDV
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.chatButton]}
                    onPress={() => {
                        (navigation as any).navigate('ServiceDetailSpecialized', {
                            serviceId: laboratory.service_id,
                            serviceType: 'laboratoire',
                        });
                    }}
                >
                    <SafeIcon name="message-circle" size={18} color="#fff" />
                    <Text style={[styles.actionButtonText, styles.chatButtonText]}>
                        Contacter
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                {laboratory.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {laboratory.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    {laboratory.telephone && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => Linking.openURL(`tel:${laboratory.telephone}`)}
                        >
                            <SafeIcon name="phone" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                    {laboratory.whatsapp && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => {
                                const whatsappNumber = laboratory.whatsapp?.replace(/[^0-9]/g, '') || '';
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
        borderLeftColor: '#3B82F6',
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
        backgroundColor: '#DBEAFE',
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
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    servicesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginRight: 4,
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

export default LaboratoireResultCard;

