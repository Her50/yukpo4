// ✅ Hub de recherche santé - Point d'entrée pour tous les services de santé
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface HealthService {
    id: string;
    title: string;
    icon: string;
    gradient: string[];
    description: string;
    route: string;
    badge?: string;
}

const HealthServicesHubScreen: React.FC = () => {
    const navigation = useNavigation();

    const healthServices: HealthService[] = [
        {
            id: 'pharmacie',
            title: 'Pharmacie',
            icon: 'pill',
            gradient: ['#EC4899', '#F472B6'],
            description: 'Rechercher une pharmacie de garde ou classique',
            route: 'PharmacieSearch',
            badge: '24/7'
        },
        {
            id: 'hopital',
            title: 'Hôpital',
            icon: 'hospital',
            gradient: ['#EF4444', '#F87171'],
            description: 'Trouver un hôpital ou une clinique',
            route: 'HopitalSearch',
        },
        {
            id: 'laboratoire',
            title: 'Laboratoire',
            icon: 'flask',
            gradient: ['#3B82F6', '#60A5FA'],
            description: 'Rechercher un laboratoire d\'analyses',
            route: 'LaboratoireSearch',
        },
        {
            id: 'banque-sang',
            title: 'Banque de sang',
            icon: 'heart',
            gradient: ['#DC2626', '#F87171'],
            description: 'Trouver une banque de sang ou faire un don',
            route: 'BanqueSangSearch',
            badge: 'Urgent'
        },
    ];

    const handleServicePress = (service: HealthService) => {
        hapticPress();
        (navigation as any).navigate(service.route);
    };

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        hapticPress();
                        navigation.goBack();
                    }}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Services de santé</Text>
                    <Text style={styles.headerSubtitle}>
                        Recherchez rapidement le service médical dont vous avez besoin
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero section */}
                <View style={styles.heroSection}>
                    <View style={styles.heroIconContainer}>
                        <SafeIcon name="heart" size={48} color="#EC4899" type="lucide" />
                    </View>
                    <Text style={styles.heroTitle}>Votre santé, notre priorité</Text>
                    <Text style={styles.heroDescription}>
                        Accédez rapidement aux services de santé près de chez vous
                    </Text>
                </View>

                {/* Services grid */}
                <View style={styles.servicesGrid}>
                    {healthServices.map((service) => (
                        <TouchableOpacity
                            key={service.id}
                            style={styles.serviceCard}
                            onPress={() => handleServicePress(service)}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={service.gradient}
                                style={styles.cardGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                {service.badge && (
                                    <View style={styles.badgeContainer}>
                                        <Text style={styles.badgeText}>{service.badge}</Text>
                                    </View>
                                )}
                                <View style={styles.iconContainer}>
                                    <SafeIcon
                                        name={service.icon}
                                        size={32}
                                        color="#FFFFFF"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.serviceTitle}>{service.title}</Text>
                                <Text style={styles.serviceDescription} numberOfLines={2}>
                                    {service.description}
                                </Text>
                                <View style={styles.arrowContainer}>
                                    <SafeIcon
                                        name="arrow-right"
                                        size={16}
                                        color="#FFFFFF"
                                        type="lucide"
                                    />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Quick tips */}
                <View style={styles.tipsSection}>
                    <Text style={styles.tipsTitle}>💡 Conseils</Text>
                    <View style={styles.tipItem}>
                        <Text style={styles.tipText}>
                            • Les pharmacies de garde sont disponibles 24/7
                        </Text>
                    </View>
                    <View style={styles.tipItem}>
                        <Text style={styles.tipText}>
                            • Vérifiez les horaires avant de vous déplacer
                        </Text>
                    </View>
                    <View style={styles.tipItem}>
                        <Text style={styles.tipText}>
                            • Les banques de sang acceptent les dons volontaires
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        paddingTop: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
        marginTop: 4,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 24,
        marginBottom: 24,
    },
    heroIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    heroDescription: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    servicesGrid: {
        gap: 16,
        marginBottom: 24,
    },
    serviceCard: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    cardGradient: {
        padding: 20,
        minHeight: 140,
        position: 'relative',
    },
    badgeContainer: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    iconContainer: {
        marginBottom: 12,
    },
    serviceTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    serviceDescription: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 18,
        marginBottom: 8,
    },
    arrowContainer: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tipsSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    tipsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    tipItem: {
        marginBottom: 8,
    },
    tipText: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
});

export default HealthServicesHubScreen;





