import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from './SafeIcon';
import { hapticPress } from '../utils/hapticFeedback';

interface YukpoService {
    id: string;
    title: string;
    icon: string;
    gradient: string[];
    description: string;
    comingSoon?: boolean;
}

interface ServiceCategory {
    id: string;
    title: string;
    icon: string;
    gradient: string[];
    description: string;
    services: YukpoService[];
}

interface YukpoServicesQuickAccessProps {
    onServicePress?: (serviceId: string) => void;
}

const YukpoServicesQuickAccess: React.FC<YukpoServicesQuickAccessProps> = ({
    onServicePress
}) => {
    const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);

    // Tous les services disponibles
    const allServices: YukpoService[] = [
        {
            id: 'sante',
            title: 'Santé',
            icon: 'heart',
            gradient: ['#EC4899', '#F472B6'],
            description: 'Rechercher pharmacies, hôpitaux, banques de sang',
            comingSoon: false
        },
        {
            id: 'assurance',
            title: 'Assurance',
            icon: 'shield',
            gradient: ['#14B8A6', '#2DD4BF'],
            description: 'Produits assurance, sinistres',
            comingSoon: true
        },
        {
            id: 'etude',
            title: 'Étude',
            icon: 'book-open',
            gradient: ['#3B82F6', '#60A5FA'],
            description: 'Rechercher établissements, orientation',
            comingSoon: false
        },
        {
            id: 'immo',
            title: 'Immo',
            icon: 'home',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: 'Rechercher biens immobiliers',
            comingSoon: false
        },
        {
            id: 'voyage',
            title: 'Voyage',
            icon: 'map',
            gradient: ['#06B6D4', '#22D3EE'],
            description: 'Rechercher agences, covoiturage',
            comingSoon: false
        },
        {
            id: 'livraison',
            title: 'Livraison',
            icon: 'truck',
            gradient: ['#F59E0B', '#FBBF24'],
            description: 'Transfert colis, suivi GPS',
            comingSoon: false
        },
        {
            id: 'auto',
            title: 'Auto',
            icon: 'car',
            gradient: ['#EF4444', '#F87171'],
            description: 'Vente automobile, occasion',
            comingSoon: true
        },
        {
            id: 'bayamselam',
            title: 'BayamSelam',
            icon: 'trending-down',
            gradient: ['#10B981', '#34D399'],
            description: 'Comparatif prix, achats',
            comingSoon: true
        },
        {
            id: 'emploi',
            title: 'Emploi',
            icon: 'briefcase',
            gradient: ['#6366F1', '#818CF8'],
            description: 'Offres d\'emploi, recrutement',
            comingSoon: false
        }
    ];

    // Regroupement en catégories (6 blocs - 2 colonnes x 3 lignes)
    const categories: ServiceCategory[] = [
        {
            id: 'sante-protection',
            title: 'Santé & Protection',
            icon: 'heart',
            gradient: ['#EC4899', '#F472B6'],
            description: 'Santé, assurance',
            services: allServices.filter(s => s.id === 'sante' || s.id === 'assurance')
        },
        {
            id: 'education',
            title: 'Éducation',
            icon: 'book-open',
            gradient: ['#3B82F6', '#60A5FA'],
            description: 'Formation, orientation',
            services: allServices.filter(s => s.id === 'etude')
        },
        {
            id: 'immobilier',
            title: 'Immobilier',
            icon: 'home',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: 'Biens immobiliers',
            services: allServices.filter(s => s.id === 'immo')
        },
        {
            id: 'transport',
            title: 'Transport & Mobilité',
            icon: 'truck',
            gradient: ['#F59E0B', '#FBBF24'],
            description: 'Voyage, livraison, auto',
            services: allServices.filter(s => s.id === 'voyage' || s.id === 'livraison' || s.id === 'auto')
        },
        {
            id: 'commerce',
            title: 'Commerce & Marché',
            icon: 'trending-down',
            gradient: ['#10B981', '#34D399'],
            description: 'Comparatif, achats',
            services: allServices.filter(s => s.id === 'bayamselam')
        },
        {
            id: 'emploi-services',
            title: 'Emploi & Services Pro',
            icon: 'briefcase',
            gradient: ['#6366F1', '#818CF8'],
            description: 'Emploi, services pro',
            services: allServices.filter(s => s.id === 'emploi')
        }
    ];

    const handleCategoryPress = (category: ServiceCategory) => {
        hapticPress();
        setSelectedCategory(category);
    };

    const handleServiceSelect = (serviceId: string) => {
        hapticPress();
        setSelectedCategory(null);
        onServicePress?.(serviceId);
    };

    const closeModal = () => {
        hapticPress();
        setSelectedCategory(null);
    };

    return (
        <View style={styles.container}>
            {/* ✅ Blocs de catégories (3 lignes x 2 colonnes - 6 blocs au total) */}
            <View style={styles.categoriesGrid}>
                {categories.map((category) => (
                    <TouchableOpacity
                        key={category.id}
                        style={styles.categoryBlock}
                        onPress={() => handleCategoryPress(category)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={category.gradient}
                            style={styles.categoryGradient}
                        >
                            <View style={styles.categoryIconContainer}>
                                <SafeIcon name={category.icon} size={22} color="#FFFFFF" />
                            </View>
                            <Text style={styles.categoryTitle} numberOfLines={2}>
                                {category.title}
                            </Text>
                            <Text style={styles.categoryDescription} numberOfLines={1}>
                                {category.services.length} service{category.services.length > 1 ? 's' : ''}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Modal pour afficher les services d'une catégorie */}
            <Modal
                visible={selectedCategory !== null}
                transparent={true}
                animationType="slide"
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Header du modal */}
                        {selectedCategory && (
                            <>
                                <View style={styles.modalHeader}>
                                    <LinearGradient
                                        colors={selectedCategory.gradient}
                                        style={styles.modalHeaderGradient}
                                    >
                                        <View style={styles.modalHeaderContent}>
                                            <View style={styles.modalIconContainer}>
                                                <SafeIcon name={selectedCategory.icon} size={32} color="#FFFFFF" />
                                            </View>
                                            <View style={styles.modalTitleContainer}>
                                                <Text style={styles.modalTitle}>
                                                    {selectedCategory.title}
                                                </Text>
                                                <Text style={styles.modalSubtitle}>
                                                    {selectedCategory.description}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.closeButton}
                                                onPress={closeModal}
                                            >
                                                <SafeIcon name="x" size={24} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </LinearGradient>
                                </View>

                                {/* Liste des services */}
                                <ScrollView
                                    style={styles.servicesList}
                                    contentContainerStyle={styles.servicesListContent}
                                >
                                    {selectedCategory.services.map((service) => (
                                        <TouchableOpacity
                                            key={service.id}
                                            style={styles.serviceItem}
                                            onPress={() => handleServiceSelect(service.id)}
                                            activeOpacity={0.7}
                                        >
                                            <LinearGradient
                                                colors={service.gradient}
                                                style={styles.serviceItemGradient}
                                            >
                                                <View style={styles.serviceItemIconContainer}>
                                                    <SafeIcon name={service.icon} size={24} color="#FFFFFF" />
                                                    {service.comingSoon && (
                                                        <View style={styles.serviceComingSoonBadge}>
                                                            <Text style={styles.serviceComingSoonText}>Bientôt</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.serviceItemContent}>
                                                    <Text style={styles.serviceItemTitle}>
                                                        {service.title}
                                                    </Text>
                                                    <Text style={styles.serviceItemDescription} numberOfLines={2}>
                                                        {service.description}
                                                    </Text>
                                                </View>
                                                <View style={styles.serviceItemArrow}>
                                                    <SafeIcon name="chevron-right" size={20} color="#FFFFFF" />
                                                </View>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 0,
        paddingHorizontal: 0,
    },
    // Grille de catégories (3 lignes x 2 colonnes - 6 blocs au total)
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    categoryBlock: {
        width: '48%', // 2 colonnes avec espacement
        minWidth: 150,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 8,
    },
    categoryGradient: {
        padding: 14,
        minHeight: 110, // Réduit pour tenir dans l'écran
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryIconContainer: {
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    categoryTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 4,
        lineHeight: 18,
    },
    categoryDescription: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 10,
    },
    modalHeader: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    modalHeaderGradient: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    modalHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    modalTitleContainer: {
        flex: 1,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    servicesList: {
        flex: 1,
    },
    servicesListContent: {
        padding: 16,
        paddingBottom: 32,
    },
    serviceItem: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    serviceItemGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        minHeight: 80,
    },
    serviceItemIconContainer: {
        position: 'relative',
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    serviceComingSoonBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    serviceComingSoonText: {
        fontSize: 8,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    serviceItemContent: {
        flex: 1,
    },
    serviceItemTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    serviceItemDescription: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 18,
    },
    serviceItemArrow: {
        marginLeft: 12,
    },
});

export default YukpoServicesQuickAccess;
