// @ts-nocheck
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface YukpoService {
    id: string;
    title: string;
    icon: string;
    gradient: string[];
    description: string;
    comingSoon?: boolean;
}

interface YukpoServicesQuickAccessProps {
    onServicePress?: (serviceId: string) => void;
}

const YukpoServicesQuickAccess: React.FC<YukpoServicesQuickAccessProps> = ({
    onServicePress
}) => {
    const services: YukpoService[] = [
        {
            id: 'sante',
            title: 'Santé',
            icon: 'activity',
            gradient: ['#EF4444', '#F87171'],
            description: 'Pharmacies de garde, banque de sang, spécialistes',
            comingSoon: true
        },
        {
            id: 'etude',
            title: 'Étude',
            icon: 'book-open',
            gradient: ['#3B82F6', '#60A5FA'],
            description: 'Institutions, filières, soutien scolaire, orientation',
            comingSoon: true
        },
        {
            id: 'immo',
            title: 'Immo',
            icon: 'home',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: 'Biens immobiliers, décoration, déménagement',
            comingSoon: true
        },
        {
            id: 'bayamselam',
            title: 'BayamSelam',
            icon: 'trending-down',
            gradient: ['#10B981', '#34D399'],
            description: 'Comparatif prix marché, achats en ligne',
            comingSoon: true
        },
        {
            id: 'livraison',
            title: 'Livraison',
            icon: 'truck',
            gradient: ['#F59E0B', '#FBBF24'],
            description: 'Transfert colis, livraison avec suivi GPS',
            comingSoon: true
        },
        {
            id: 'voyage',
            title: 'Voyage',
            icon: 'map',
            gradient: ['#06B6D4', '#22D3EE'],
            description: 'Covoiturage, billets, courses',
            comingSoon: true
        }
    ];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                <Text style={styles.yukpoYuk}>Yuk</Text>
                <Text style={styles.yukpoPo}>po</Text>
                <Text style={styles.titleRest}> Services</Text>
            </Text>
            <Text style={styles.subtitle}>Fonctionnalités à venir</Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {services.map((service) => (
                    <TouchableOpacity
                        key={service.id}
                        style={styles.serviceCard}
                        onPress={() => onServicePress?.(service.id)}
                    >
                        <LinearGradient
                            colors={service.gradient}
                            style={styles.cardGradient}
                        >
                            <View style={styles.iconContainer}>
                                <SafeIcon name={service.icon} size={32} color="#FFFFFF" />
                            </View>

                            <Text style={styles.serviceTitle}>
                                <Text style={styles.yukpoYukWhite}>Yuk</Text>
                                <Text style={styles.yukpoPoWhite}>po</Text>
                                <Text> {service.title}</Text>
                            </Text>
                            <Text style={styles.serviceDescription}>{service.description}</Text>

                            {service.comingSoon && (
                                <View style={styles.badgeContainer}>
                                    <Text style={styles.badgeText}>Bientôt</Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 12,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    yukpoYuk: {
        color: '#EAB308', // Jaune pour Yuk
        fontWeight: '900',
    },
    yukpoPo: {
        color: '#DC2626', // Rouge pour po
        fontWeight: '900',
    },
    titleRest: {
        color: modernColors.text,
        fontWeight: '600',
    },
    yukpoYukWhite: {
        color: '#FEF3C7', // Jaune clair pour Yuk sur fond coloré
        fontWeight: '700',
    },
    yukpoPoWhite: {
        color: '#FEE2E2', // Rouge clair pour po sur fond coloré
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    scrollContent: {
        paddingHorizontal: 4,
    },
    serviceCard: {
        width: 150,
        marginRight: 12,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardGradient: {
        padding: 14,
        minHeight: 160,
        justifyContent: 'space-between',
    },
    iconContainer: {
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    serviceTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    serviceDescription: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 15,
    },
    badgeContainer: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default YukpoServicesQuickAccess;
