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

interface BloodBankResultCardProps {
    banque: {
        id: number;
        service_id: number;
        nom: string;
        adresse?: string;
        quartier?: string;
        ville?: string;
        telephone?: string;
        telephone_urgence?: string;
        whatsapp?: string;
        stocks_groupes_sanguins?: Record<string, any>;
        accepte_dons: boolean;
        accepte_demandes: boolean;
        urgence_24h: boolean;
        is_available_now: boolean;
        distance_km?: number;
    };
}

const BloodBankResultCard: React.FC<BloodBankResultCardProps> = ({ banque }) => {
    const navigation = useNavigation();

    const groupesDisponibles = banque.stocks_groupes_sanguins
        ? Object.keys(banque.stocks_groupes_sanguins).filter(
            (groupe) =>
                banque.stocks_groupes_sanguins?.[groupe]?.quantite > 0
        )
        : [];

    const handlePress = () => {
        // Navigation vers détails si nécessaire
        // navigation.navigate('BloodBankDetails', { id: banque.id });
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <SafeIcon name="droplet" size={24} color="#DC2626" />
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>{banque.nom}</Text>
                        {banque.urgence_24h && (
                            <View style={styles.urgenceBadge}>
                                <Text style={styles.urgenceText}>URGENCE 24H</Text>
                            </View>
                        )}
                    </View>
                </View>
                {banque.is_available_now && (
                    <View style={styles.availableBadge}>
                        <Text style={styles.availableText}>Disponible</Text>
                    </View>
                )}
            </View>

            {(banque.quartier || banque.ville) && (
                <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>
                        {[banque.quartier, banque.ville].filter(Boolean).join(', ')}
                    </Text>
                </View>
            )}

            {groupesDisponibles.length > 0 && (
                <View style={styles.stocksSection}>
                    <Text style={styles.stocksLabel}>Groupes disponibles :</Text>
                    <View style={styles.groupesRow}>
                        {groupesDisponibles.slice(0, 6).map((groupe) => {
                            const stock = banque.stocks_groupes_sanguins?.[groupe];
                            return (
                                <View key={groupe} style={styles.groupeTag}>
                                    <Text style={styles.groupeText}>{groupe}</Text>
                                    {stock?.quantite && (
                                        <Text style={styles.groupeQuantite}>
                                            {stock.quantite} {stock.unite || 'poches'}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                        {groupesDisponibles.length > 6 && (
                            <Text style={styles.moreText}>
                                +{groupesDisponibles.length - 6}
                            </Text>
                        )}
                    </View>
                </View>
            )}

            <View style={styles.servicesRow}>
                {banque.accepte_dons && (
                    <View style={styles.serviceTag}>
                        <SafeIcon name="heart" size={12} color="#10B981" />
                        <Text style={styles.serviceTagText}>Accepte dons</Text>
                    </View>
                )}
                {banque.accepte_demandes && (
                    <View style={styles.serviceTag}>
                        <SafeIcon name="check-circle" size={12} color="#3B82F6" />
                        <Text style={styles.serviceTagText}>Accepte demandes</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                {banque.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {banque.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    {banque.telephone && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => Linking.openURL(`tel:${banque.telephone}`)}
                        >
                            <SafeIcon name="phone" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                    {banque.telephone_urgence && (
                        <TouchableOpacity
                            style={[styles.contactButton, styles.urgenceButton]}
                            onPress={() => Linking.openURL(`tel:${banque.telephone_urgence}`)}
                        >
                            <SafeIcon name="phone" size={16} color="#DC2626" />
                        </TouchableOpacity>
                    )}
                    {banque.whatsapp && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => {
                                const whatsappNumber = banque.whatsapp.replace(/[^0-9]/g, '');
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
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    titleContainer: {
        marginLeft: 8,
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    urgenceBadge: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    urgenceText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#DC2626',
        textTransform: 'uppercase',
    },
    availableBadge: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    availableText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 6,
    },
    stocksSection: {
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    stocksLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#991B1B',
        marginBottom: 8,
    },
    groupesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    groupeTag: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#DC2626',
    },
    groupeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#DC2626',
    },
    groupeQuantite: {
        fontSize: 10,
        color: '#991B1B',
        marginTop: 2,
    },
    moreText: {
        fontSize: 12,
        color: '#6B7280',
        alignSelf: 'center',
        marginLeft: 4,
    },
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    serviceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#F0FDF4',
        gap: 4,
    },
    serviceTagText: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    contactRow: {
        flexDirection: 'row',
        gap: 8,
    },
    contactButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    urgenceButton: {
        backgroundColor: '#FEE2E2',
    },
});

export default BloodBankResultCard;

