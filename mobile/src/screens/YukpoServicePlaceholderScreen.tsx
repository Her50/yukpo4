// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { modernColors } from '../theme/modernTheme';

interface ServiceInfo {
    id: string;
    title: string;
    icon: string;
    gradient: string[];
    description: string;
    features: string[];
}

const YukpoServicePlaceholderScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const serviceId = (route.params as any)?.serviceId || '';

    const serviceInfo: ServiceInfo[] = [
        {
            id: 'sante',
            title: 'Yukpo Santé',
            icon: 'Activity',
            gradient: ['#EF4444', '#F87171'],
            description: 'Plateforme complète de services médicaux et de santé au Cameroun',
            features: [
                'Rendez-vous médicaux en ligne',
                'Téléconsultation avec médecins',
                'Pharmacie de garde',
                'Ambulances d\'urgence',
                'Suivi médical personnalisé',
                'Assurance santé intégrée'
            ]
        },
        {
            id: 'scolaire',
            title: 'Yukpo Scolaire',
            icon: 'BookOpen',
            gradient: ['#3B82F6', '#60A5FA'],
            description: 'Éducation et formation pour tous les niveaux',
            features: [
                'Cours particuliers',
                'Préparation aux examens',
                'Formation professionnelle',
                'Soutien scolaire',
                'Bibliothèque numérique',
                'Orientation académique'
            ]
        },
        {
            id: 'bayamselam',
            title: 'Yukpo Bayamselam',
            icon: 'ShoppingBag',
            gradient: ['#10B981', '#34D399'],
            description: 'Commerce et vente en ligne sécurisée',
            features: [
                'Boutique en ligne',
                'Paiement sécurisé',
                'Livraison express',
                'Gestion des stocks',
                'Analytics de vente',
                'Support client 24/7'
            ]
        },
        {
            id: 'immo',
            title: 'Yukpo Immo',
            icon: 'Home',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: 'Immobilier et logement au Cameroun',
            features: [
                'Recherche de logements',
                'Visites virtuelles',
                'Estimation de biens',
                'Gestion locative',
                'Financement immobilier',
                'Services juridiques'
            ]
        },
        {
            id: 'colis',
            title: 'Yukpo Colis',
            icon: 'Package',
            gradient: ['#F59E0B', '#FBBF24'],
            description: 'Livraison et transport de colis',
            features: [
                'Envoi de colis',
                'Suivi en temps réel',
                'Livraison express',
                'Assurance transport',
                'Tarifs compétitifs',
                'Couverture nationale'
            ]
        },
        {
            id: 'travel',
            title: 'Yukpo Travel',
            icon: 'Car',
            gradient: ['#06B6D4', '#22D3EE'],
            description: 'Voyage et transport au Cameroun',
            features: [
                'Réservation de billets',
                'Location de véhicules',
                'Guides touristiques',
                'Hébergement',
                'Assistance voyage',
                'Plans de voyage personnalisés'
            ]
        }
    ];

    const currentService = serviceInfo.find(s => s.id === serviceId) || serviceInfo[0];

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={currentService.gradient}
                style={styles.header}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <View style={styles.iconContainer}>
                        <SafeIcon name={currentService.icon} size={48} color="#FFFFFF" />
                    </View>
                    <Text style={styles.title}>{currentService.title}</Text>
                    <Text style={styles.subtitle}>{currentService.description}</Text>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.comingSoonContainer}>
                    <View style={styles.badgeContainer}>
                        <SafeIcon name="clock" size={20} color="#F59E0B" />
                        <Text style={styles.badgeText}>Bientôt disponible</Text>
                    </View>

                    <Text style={styles.comingSoonTitle}>
                        Cette fonctionnalité sera bientôt disponible !
                    </Text>
                    <Text style={styles.comingSoonDescription}>
                        Nous travaillons activement pour vous offrir cette expérience exceptionnelle.
                        Soyez parmi les premiers à être notifiés lors du lancement.
                    </Text>
                </View>

                <View style={styles.featuresContainer}>
                    <Text style={styles.featuresTitle}>Fonctionnalités prévues</Text>

                    {currentService.features.map((feature, index) => (
                        <View key={index} style={styles.featureItem}>
                            <View style={styles.featureIcon}>
                                <SafeIcon name="check" size={16} color="#10B981" />
                            </View>
                            <Text style={styles.featureText}>{feature}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.notifyButton}>
                    <SafeIcon name="bell" size={20} color="#FFFFFF" />
                    <Text style={styles.notifyButtonText}>Me notifier au lancement</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerContent: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        lineHeight: 22,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    comingSoonContainer: {
        marginTop: 20,
        marginBottom: 30,
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 16,
        alignSelf: 'center',
    },
    badgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F59E0B',
        marginLeft: 8,
    },
    comingSoonTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    comingSoonDescription: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    featuresContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 20,
        marginBottom: 30,
    },
    featuresTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#D1FAE5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    notifyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginBottom: 30,
    },
    notifyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 8,
    },
});

export default YukpoServicePlaceholderScreen;