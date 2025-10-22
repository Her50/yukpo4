import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
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
            id: 'immo',
            title: 'Immo',
            icon: 'home',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: 'Biens immobiliers, décoration',
            comingSoon: true
        },
        {
            id: 'voyage',
            title: 'Voyage',
            icon: 'map',
            gradient: ['#06B6D4', '#22D3EE'],
            description: 'Covoiturage, billets, courses',
            comingSoon: true
        },
        {
            id: 'auto',
            title: 'Auto',
            icon: 'car',
            gradient: ['#EF4444', '#F87171'],
            description: 'Vente automobile, occasion, neuf',
            comingSoon: true
        },
        {
            id: 'livraison',
            title: 'Livraison',
            icon: 'truck',
            gradient: ['#F59E0B', '#FBBF24'],
            description: 'Transfert colis, suivi GPS',
            comingSoon: true
        },
        {
            id: 'bayamselam',
            title: 'BayamSelam',
            icon: 'trending-down',
            gradient: ['#10B981', '#34D399'],
            description: 'Comparatif prix, achats en ligne',
            comingSoon: true
        },
        {
            id: 'sante',
            title: 'Santé',
            icon: 'heart',
            gradient: ['#EC4899', '#F472B6'],
            description: 'Pharmacies, banque de sang',
            comingSoon: true
        },
        {
            id: 'etude',
            title: 'Étude',
            icon: 'book-open',
            gradient: ['#3B82F6', '#60A5FA'],
            description: 'Institutions, soutien scolaire',
            comingSoon: true
        },
        {
            id: 'assurance',
            title: 'Assurance',
            icon: 'shield',
            gradient: ['#14B8A6', '#2DD4BF'],
            description: 'Produits assurance, sinistres',
            comingSoon: true
        }
    ];

    return (
        <View style={styles.container}>
            {/* ✅ Grille 2 lignes x 4 colonnes */}
            <View style={styles.gridContainer}>
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
                            {/* Ligne 1 : Icône + Yukpo ensemble */}
                            <View style={styles.yukpoRow}>
                                <SafeIcon name={service.icon} size={14} color="#FFFFFF" />
                                <Text style={styles.yukpoText}>
                                    <Text style={styles.yukpoYukWhite}>Yuk</Text>
                                    <Text style={styles.yukpoPoWhite}>po</Text>
                                </Text>
                            </View>

                            {/* Ligne 2 : Nom du service centré, proche de Yukpo */}
                            <Text style={styles.serviceTitle} numberOfLines={1}>
                                {service.title}
                            </Text>

                            {/* Ligne 3 : Description */}
                            <Text style={styles.serviceDescription} numberOfLines={2}>
                                {service.description}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 32,
        paddingHorizontal: 0,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 4,
    },
    serviceCard: {
        width: '24%', // 4 colonnes
        minWidth: 75,
        borderRadius: 8,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        marginBottom: 4,
    },
    cardGradient: {
        padding: 8,
        minHeight: 90,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    // Ligne 1 : Icône + Yukpo
    yukpoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginBottom: 2, // Très proche du titre
    },
    yukpoText: {
        fontSize: 10,
        lineHeight: 12,
    },
    yukpoYukWhite: {
        color: '#FEF3C7',
        fontWeight: '800',
        fontSize: 10,
    },
    yukpoPoWhite: {
        color: '#FEE2E2',
        fontWeight: '800',
        fontSize: 10,
    },
    // Ligne 2 : Nom du service (centré, proche de Yukpo)
    serviceTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 14,
        marginBottom: 3, // Espace avant description
    },
    // Ligne 3 : Description
    serviceDescription: {
        fontSize: 7.5,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 9,
        textAlign: 'center',
        paddingHorizontal: 2,
    },
    badgeContainer: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 10,
        marginTop: 6,
    },
    badgeText: {
        fontSize: 8,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default YukpoServicesQuickAccess;
