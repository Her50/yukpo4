// ✅ AMÉLIORÉ: Composant carte pour afficher un service spécialisé avec design moderne et accessibilité

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeCard } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ServiceCardProps {
    service: {
        id: number;
        service_id: number;
        type: string;
        nom: string;
        is_active: boolean;
        is_available_now?: boolean;
        created_at: string;
        metadata?: any;
        image?: string;
        images?: string[];
    };
    onPress: () => void;
    onEdit?: () => void;
    accessibilityLabel?: string;
    accessibilityHint?: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
    service,
    onPress,
    onEdit,
    accessibilityLabel,
    accessibilityHint
}) => {
    const typeLabels: Record<string, string> = {
        pharmacie: 'Pharmacie',
        hopital: t('serviceCard.hopital'),
        laboratoire: 'Laboratoire',
        banque_sang: 'Banque de Sang',
        agence_voyage: 'Agence',
        covoiturage: 'Covoiturage',
        taxi: 'Taxi',
    };

    const typeIcons: Record<string, string> = {
        pharmacie: 'Pill',
        hopital: 'Hospital',
        laboratoire: 'Microscope',
        banque_sang: 'Droplet',
        agence_voyage: 'Bus',
        covoiturage: 'Users',
        taxi: 'Car',
    };

    const typeColors: Record<string, string[]> = {
        pharmacie: ['#10B981', '#34D399'],
        hopital: ['#EF4444', '#F87171'],
        laboratoire: ['#3B82F6', '#60A5FA'],
        banque_sang: ['#DC2626', '#F87171'],
        agence_voyage: ['#F59E0B', '#FBBF24'],
        covoiturage: ['#8B5CF6', '#A78BFA'],
        taxi: ['#F97316', '#FB923C'],
    };

    const typeColor = typeColors[service.type]?.[0] || modernColors.primary;
    const typeGradient = typeColors[service.type] || [modernColors.primary, modernColors.primary];
    const typeIcon = typeIcons[service.type] || 'circle';
    const typeLabel = typeLabels[service.type] || service.type;

    // ✅ NOUVEAU: Extraire l'image du service
    const serviceImage = service.image || service.images?.[0];

    // ✅ NOUVEAU: Labels d'accessibilité
    const defaultAccessibilityLabel = `${typeLabel} ${service.nom}, ${service.is_active ? 'actif' : 'inactif'}`;
    const defaultAccessibilityHint = t('serviceCard.doubletapezPourVoirLesDetails');

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || defaultAccessibilityLabel}
            accessibilityHint={accessibilityHint || defaultAccessibilityHint}
            accessibilityState={{ disabled: false }}
        >
            <NativeCard style={[styles.card, { borderLeftColor: typeColor }]}>
                {/* ✅ AMÉLIORÉ: Header avec image ou gradient */}
                <View style={styles.cardHeader}>
                    {serviceImage ? (
                        <Image
                            source={{ uri: serviceImage }}
                            style={styles.serviceImage}
                            resizeMode="cover"
                            accessibilityIgnoresInvertColors={false}
                        />
                    ) : (
                        <LinearGradient
                            colors={typeGradient as any}
                            style={styles.gradientContainer}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.iconContainer}>
                                <SafeIcon name={typeIcon} size={28} color="#FFFFFF" type="lucide" />
                            </View>
                        </LinearGradient>
                    )}
                    {onEdit && (
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            style={styles.editButton}
                            accessibilityRole="button"
                            accessibilityLabel={`Modifier ${service.nom}`}
                            accessibilityHint="Double-tapez pour modifier ce service"
                        >
                            <SafeIcon name="edit" size={18} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* ✅ AMÉLIORÉ: Nom du service avec meilleur contraste */}
                <Text style={styles.serviceName} numberOfLines={2} accessibilityRole="text">
                    {service.nom}
                </Text>

                {/* ✅ AMÉLIORÉ: Footer avec badges améliorés */}
                <View style={styles.cardFooter}>
                    <View style={[styles.typeBadge, { backgroundColor: typeColor + '15' }]}>
                        <SafeIcon name={typeIcon} size={12} color={typeColor} type="lucide" />
                        <Text style={[styles.typeText, { color: typeColor }]}>
                            {typeLabel}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.statusBadge,
                            {
                                backgroundColor: service.is_active
                                    ? modernColors.success + '25'
                                    : modernColors.warning + '25',
                                borderColor: service.is_active
                                    ? modernColors.success
                                    : modernColors.warning,
                            },
                        ]}
                    >
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: service.is_active ? modernColors.success : modernColors.warning }
                        ]} />
                        <Text
                            style={[
                                styles.statusText,
                                {
                                    color: service.is_active
                                        ? modernColors.success
                                        : modernColors.warning,
                                },
                            ]}
                        >
                            {service.is_active ? 'Actif' : 'Inactif'}
                        </Text>
                    </View>
                </View>

                {/* ✅ AMÉLIORÉ: Badge disponibilité avec meilleur design */}
                {service.is_available_now && (
                    <View style={styles.availableBadge}>
                        <View style={styles.availableDot} />
                        <SafeIcon name="clock" size={12} color={modernColors.success} type="lucide" />
                        <Text style={styles.availableText}>{t('serviceCard.disponibleMaintenant')}</Text>
                    </View>
                )}
            </NativeCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 12,
        borderLeftWidth: 4,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
        position: 'relative',
    },
    serviceImage: {
        width: '100%',
        height: 120,
        borderRadius: 8,
        marginBottom: 8,
    },
    gradientContainer: {
        width: '100%',
        height: 120,
        borderRadius: 8,
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        lineHeight: 22,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
        flex: 1,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    availableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: modernColors.success + '15',
        borderRadius: 8,
        gap: 6,
        alignSelf: 'flex-start',
    },
    availableDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.success,
    },
    availableText: {
        fontSize: 12,
        color: modernColors.success,
        fontWeight: '600',
    },
});

export default ServiceCard;
