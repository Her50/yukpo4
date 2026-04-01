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
import ServiceCardActions from './ServiceCardActions';

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
        // ✅ 2025-01-27: Statistiques ratings
        average_rating?: number;
        total_ratings?: number;
        // H3: Médecins de l'hôpital
        doctors?: Array<{
            id: number;
            nom: string;
            specialite: string;
            photo_url?: string;
            rating?: number;
        }>;
    };
    onPress?: () => void;
    onContact?: () => void;
}

const HopitalResultCard: React.FC<HopitalResultCardProps> = ({ hospital, onPress, onContact }) => {
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

            {/* ✅ 2025-01-27: Statistiques de ratings */}
            {(hospital.average_rating !== undefined || hospital.total_ratings !== undefined) && (
                <View style={styles.ratingsRow}>
                    <SafeIcon name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingsText}>
                        {hospital.average_rating ? `${hospital.average_rating.toFixed(1)}` : 'N/A'}
                        {hospital.total_ratings !== undefined && hospital.total_ratings > 0 && (
                            <Text style={styles.ratingsCount}> ({hospital.total_ratings} avis)</Text>
                        )}
                    </Text>
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
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.rdvButton]}
                        onPress={() => {
                            (navigation as any).navigate('Reservation', {
                                serviceId: hospital.service_id,
                                serviceType: 'hopital',
                                serviceName: hospital.nom,
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
                            if (onContact) {
                                onContact();
                            } else {
                                (navigation as any).navigate('ServiceDetailSpecialized', {
                                    serviceId: hospital.service_id,
                                    serviceType: 'hopital',
                                });
                            }
                        }}
                    >
                        <SafeIcon name="message-circle" size={18} color="#fff" />
                        <Text style={[styles.actionButtonText, styles.chatButtonText]}>
                            Contacter
                        </Text>
                    </TouchableOpacity>
                </View>
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
            {/* H3: Premier médecin de l'hôpital */}
            {hospital.doctors && hospital.doctors.length > 0 && (() => {
                const doc = hospital.doctors[0];
                return (
                    <View style={styles.doctorRow}>
                        <View style={styles.doctorAvatar}>
                            <SafeIcon name="user" size={16} color={modernColors.primary} />
                        </View>
                        <View>
                            <Text style={styles.doctorName}>{doc.nom}</Text>
                            <Text style={styles.doctorSpecialite}>{doc.specialite}</Text>
                        </View>
                        {doc.rating !== undefined && (
                            <View style={styles.doctorRatingBadge}>
                                <SafeIcon name="star" size={11} color="#F59E0B" />
                                <Text style={styles.doctorRatingText}>{doc.rating.toFixed(1)}</Text>
                            </View>
                        )}
                    </View>
                );
            })()}
            {/* ── Partage · Avis · Chat ─────────────────────────────────── */}
            <ServiceCardActions
                serviceId={hospital.service_id}
                serviceTitle={hospital.nom}
                serviceType="hopital"
                serviceDescription={hospital.prestations_medicales?.slice(0, 3).join(', ')}
                whatsapp={hospital.whatsapp}
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
    rdvButton: {
        backgroundColor: '#EF4444',
    },
    rdvButtonText: {
        color: '#fff',
    },
    chatButton: {
        backgroundColor: '#10B981',
    },
    chatButtonText: {
        color: '#fff',
    },
    // H3: Médecin affiché sur la carte
    doctorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        marginTop: 8,
    },
    doctorAvatar: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: modernColors.primary + '18',
        justifyContent: 'center', alignItems: 'center',
    },
    doctorName: { fontSize: 13, fontWeight: '600', color: '#111827' },
    doctorSpecialite: { fontSize: 11, color: '#6B7280' },
    doctorRatingBadge: {
        marginLeft: 'auto', flexDirection: 'row', alignItems: 'center',
        gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 7,
        paddingVertical: 3, borderRadius: 10,
    },
    doctorRatingText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
});

export default HopitalResultCard;

