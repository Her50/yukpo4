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
            icon: 'heart',
            gradient: ['#10B981', '#34D399'],
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
            {/* ✅ Titre "Yukpo Services" supprimé */}

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
                            {/* ✅ Titre et icône sur la même ligne */}
                            <View style={styles.titleRow}>
                                <SafeIcon name={service.icon} size={20} color="#FFFFFF" />
                                <Text style={styles.serviceTitle}>
                                    <Text style={styles.yukpoYukWhite}>Yuk</Text>
                                    <Text style={styles.yukpoPoWhite}>po</Text>
                                    <Text> {service.title}</Text>
                                </Text>
                            </View>

                            <Text style={styles.serviceDescription}>{service.description}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8, // ✅ Réduit de 12 à 8
        paddingHorizontal: 4,
    },
    yukpoYukWhite: {
        color: '#FEF3C7',
        fontWeight: '700',
    },
    yukpoPoWhite: {
        color: '#FEE2E2',
        fontWeight: '700',
    },
    scrollContent: {
        paddingHorizontal: 4,
    },
    serviceCard: {
        width: 105, // ✅ Réduit de 115 à 105
        marginRight: 6, // ✅ Réduit de 8 à 6
        borderRadius: 10, // ✅ Réduit de 12 à 10
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardGradient: {
        padding: 6, // ✅ Réduit de 8 à 6
        minHeight: 95, // ✅ Réduit de 110 à 95
        justifyContent: 'space-between',
    },
    // ✅ Nouvelle ligne pour icône et titre
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    serviceTitle: {
        fontSize: 11, // ✅ Réduit de 13 à 11
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
    },
    serviceDescription: {
        fontSize: 8, // ✅ Réduit de 9 à 8
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 11, // ✅ Réduit de 13 à 11
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
