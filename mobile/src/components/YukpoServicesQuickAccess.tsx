// @ts-nocheck
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
                            {/* Yukpo sur une ligne avec icône */}
                            <View style={styles.yukpoRow}>
                                <SafeIcon name={service.icon} size={12} color="#FFFFFF" />
                                <Text style={styles.yukpoText}>
                                    <Text style={styles.yukpoYukWhite}>Yuk</Text>
                                    <Text style={styles.yukpoPoWhite}>po</Text>
                                </Text>
                            </View>

                            {/* Titre du service sur la ligne suivante */}
                            <Text style={styles.serviceTitle} numberOfLines={1}>
                                {service.title}
                            </Text>

                            {/* Description rapprochée */}
                            <Text style={styles.serviceDescription} numberOfLines={2}>{service.description}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 32, // Augmenté pour faire descendre le bloc et combler le vide
        paddingHorizontal: 0,
    },
    yukpoYukWhite: {
        color: '#FEF3C7',
        fontWeight: '800',
    },
    yukpoPoWhite: {
        color: '#FEE2E2',
        fontWeight: '800',
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
        padding: 6,
        minHeight: 85, // Augmenté pour avoir plus d'espace pour les 3 lignes
        justifyContent: 'space-between',
    },
    // Ligne pour Yukpo avec icône
    yukpoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginBottom: 2,
    },
    yukpoText: {
        fontSize: 9,
        lineHeight: 11,
    },
    serviceTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 3, // Petit espace avant la description
        lineHeight: 13,
    },
    serviceDescription: {
        fontSize: 7.5,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 10,
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
