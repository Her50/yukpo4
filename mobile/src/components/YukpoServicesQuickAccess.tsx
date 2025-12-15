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
import { modernColors } from '../theme/modernTheme';

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
    const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

    // ✅ Les 13 services spécialisés (incluant bourse_livre et bayamselam, excluant livraison)
    const allServices: YukpoService[] = [
        // Santé (4 services)
        {
            id: 'pharmacie',
            title: 'Pharmacie',
            icon: 'pill',
            gradient: ['#10B981', '#34D399'],
            description: 'Pharmacies de garde',
            comingSoon: false
        },
        {
            id: 'hopital',
            title: 'Hôpital',
            icon: 'hospital',
            gradient: ['#EF4444', '#F87171'],
            description: 'Hôpitaux, cliniques',
            comingSoon: false
        },
        {
            id: 'laboratoire',
            title: 'Laboratoire',
            icon: 'microscope',
            gradient: ['#3B82F6', '#60A5FA'],
            description: 'Analyses médicales',
            comingSoon: false
        },
        {
            id: 'banque_sang',
            title: 'Banque de Sang',
            icon: 'droplet',
            gradient: ['#DC2626', '#F87171'],
            description: 'Don de sang',
            comingSoon: false
        },
        // Transport (3 services)
        {
            id: 'agence_voyage',
            title: 'Agence Voyage',
            icon: 'bus',
            gradient: ['#F59E0B', '#FBBF24'],
            description: 'Billets, réservations',
            comingSoon: false
        },
        {
            id: 'covoiturage',
            title: 'Covoiturage',
            icon: 'users',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: 'Partage de trajet',
            comingSoon: false
        },
        {
            id: 'taxi',
            title: 'Taxi',
            icon: 'car',
            gradient: ['#F97316', '#FB923C'],
            description: 'Transport rapide',
            comingSoon: false
        },
        // Éducation (2 services)
        {
            id: 'orientation_scolaire',
            title: 'Orientation',
            icon: 'book-open',
            gradient: ['#10B981', '#34D399'],
            description: 'Orientation scolaire',
            comingSoon: false
        },
        {
            id: 'bourse_livre',
            title: 'Bourse du Livre',
            icon: 'book-open',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: 'Livres scolaires',
            comingSoon: false
        },
        // Emploi (1 service)
        {
            id: 'offres_emploi',
            title: 'Offres d\'Emploi',
            icon: 'briefcase',
            gradient: ['#6366F1', '#818CF8'],
            description: 'Recrutement',
            comingSoon: false
        },
        // Vie quotidienne (1 service)
        {
            id: 'menu_planning',
            title: 'Planification Menus',
            icon: 'coffee',
            gradient: ['#F59E0B', '#FBBF24'],
            description: 'Menus, repas',
            comingSoon: false
        },
        // Immobilier (1 service)
        {
            id: 'immo',
            title: 'Immobilier',
            icon: 'home',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: 'Biens immobiliers',
            comingSoon: false
        },
        // Commerce (1 service)
        {
            id: 'bayamselam',
            title: 'BayamSelam',
            icon: 'trending-down',
            gradient: ['#10B981', '#34D399'],
            description: 'Comparatif prix',
            comingSoon: true
        }
    ];

    // ✅ Regroupement en 6 catégories (3 colonnes x 2 lignes = 6 blocs)
    const categories: ServiceCategory[] = [
        {
            id: 'sante',
            title: 'Santé',
            icon: 'heart',
            gradient: ['#EC4899', '#F472B6'],
            description: '4 services',
            services: allServices.filter(s => s && s.id && ['pharmacie', 'hopital', 'laboratoire', 'banque_sang'].includes(s.id))
        },
        {
            id: 'transport',
            title: 'Transport',
            icon: 'truck',
            gradient: ['#F59E0B', '#FBBF24'],
            description: '3 services',
            services: allServices.filter(s => s && s.id && ['agence_voyage', 'covoiturage', 'taxi'].includes(s.id))
        },
        {
            id: 'education',
            title: 'Éducation',
            icon: 'book-open',
            gradient: ['#3B82F6', '#60A5FA'],
            description: '2 services',
            services: allServices.filter(s => s && s.id && ['orientation_scolaire', 'bourse_livre'].includes(s.id))
        },
        {
            id: 'emploi',
            title: 'Emploi',
            icon: 'briefcase',
            gradient: ['#6366F1', '#818CF8'],
            description: '1 service',
            services: allServices.filter(s => s && s.id && s.id === 'offres_emploi')
        },
        {
            id: 'vie_quotidienne',
            title: 'Vie Quotidienne',
            icon: 'coffee',
            gradient: ['#F59E0B', '#FBBF24'],
            description: '2 services',
            services: allServices.filter(s => s && s.id && ['menu_planning', 'bayamselam'].includes(s.id))
        },
        {
            id: 'immobilier',
            title: 'Immobilier',
            icon: 'home',
            gradient: ['#8B5CF6', '#A78BFA'],
            description: '1 service',
            services: allServices.filter(s => s && s.id && s.id === 'immo')
        }
    ];

    const handleCategoryPress = (category: ServiceCategory) => {
        hapticPress();
        console.log('[YukpoServicesQuickAccess] 📦 Catégorie sélectionnée:', category.id, category.title);
        console.log('[YukpoServicesQuickAccess] 📦 Services disponibles:', category.services.map(s => s.id));
        
        // ✅ NOUVEAU: Si la catégorie a plusieurs services, ouvrir horizontalement au même endroit
        if (category.services && category.services.length > 1) {
            setExpandedCategoryId(expandedCategoryId === category.id ? null : category.id);
        } else {
            // Si un seul service, naviguer directement
            if (category.services && category.services.length === 1 && category.services[0] && category.services[0].id) {
                handleServiceSelect(category.services[0].id);
            }
        }
    };

    const handleServiceSelect = (serviceId: string) => {
        if (!serviceId || typeof serviceId !== 'string') {
            console.warn('[YukpoServicesQuickAccess] ⚠️ Service ID invalide:', serviceId);
            return;
        }
        hapticPress();
        console.log('[YukpoServicesQuickAccess] ✅ Service sélectionné:', serviceId);
        setSelectedCategory(null);
        setExpandedCategoryId(null); // ✅ Fermer l'expansion horizontale
        if (onServicePress) {
            console.log('[YukpoServicesQuickAccess] 🚀 Appel onServicePress avec:', serviceId);
            onServicePress(serviceId);
        } else {
            console.warn('[YukpoServicesQuickAccess] ⚠️ onServicePress n\'est pas défini');
        }
    };

    const closeModal = () => {
        hapticPress();
        setSelectedCategory(null);
    };

    const expandedCategory = expandedCategoryId ? categories.find(c => c.id === expandedCategoryId) : null;
    
    return (
        <View style={styles.container}>
            {/* ✅ Blocs de catégories (2 lignes x 3 colonnes - 6 blocs au total) */}
            <View style={styles.categoriesGrid}>
                {categories.map((category, index) => {
                    const isExpanded = expandedCategoryId === category.id;
                    const hasMultipleServices = category.services && category.services.length > 1;
                    
                    // ✅ SÉCURISÉ: Vérifier que category existe et a les propriétés nécessaires
                    if (!category || !category.id) {
                        return null;
                    }
                    
                    // ✅ SÉCURISÉ: Calculer le nombre de services de manière sécurisée
                    const servicesCount = (category.services && Array.isArray(category.services)) 
                        ? category.services.length 
                        : 0;
                    const servicesText = servicesCount > 0 
                        ? `${servicesCount} service${servicesCount > 1 ? 's' : ''}`
                        : '0 service';
                    
                    return (
                        <View key={category.id || `category-${index}`} style={styles.categoryWrapper}>
                            <TouchableOpacity
                                style={styles.categoryBlock}
                                onPress={() => handleCategoryPress(category)}
                                activeOpacity={0.8}
                            >
                                {/* ✅ Style miniaturisé comme GOZEM - fond gris clair */}
                                <View style={styles.categorySoftContainer}>
                                    <View style={styles.categoryIconContainer}>
                                        <SafeIcon name={category.icon || 'default'} size={12} color="#6B7280" /> {/* ✅ MINIATURISÉ: De 16 à 12 */}
                                    </View>
                                    <Text style={styles.categoryTitle} numberOfLines={2}>
                                        {category?.title ? String(category.title) : ''}
                                    </Text>
                                    <Text style={styles.categoryDescription} numberOfLines={1}>
                                        {servicesText}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </View>
            
            {/* ✅ Menu horizontal des services (affiché en dessous de la grille, toute largeur) */}
            {expandedCategory && expandedCategory.services && expandedCategory.services.length > 1 && (
                <View style={styles.expandedServicesContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.expandedServicesContent}
                    >
                        {expandedCategory.services.filter(s => s && s.id).map((service, index) => {
                            // ✅ SÉCURISÉ: Vérifier que service existe et a les propriétés nécessaires
                            if (!service || !service.id) {
                                return null;
                            }
                            
                            return (
                                <TouchableOpacity
                                    key={service.id || `service-${index}`}
                                    style={styles.expandedServiceItem}
                                    onPress={() => handleServiceSelect(service.id || '')}
                                    activeOpacity={0.7}
                                    disabled={service.comingSoon}
                                >
                                    <View style={[styles.expandedServiceIconContainer, { backgroundColor: service.gradient && service.gradient[0] ? `${service.gradient[0]}15` : '#F3F4F615' }]}>
                                        <SafeIcon name={service.icon || 'default'} size={18} color={service.gradient && service.gradient[0] ? service.gradient[0] : '#6B7280'} />
                                        {service.comingSoon && (
                                            <View style={styles.serviceComingSoonBadge}>
                                                <Text style={styles.serviceComingSoonText}>Bientôt</Text>
                                            </View>
                                        )}
                                    </View>
                                <Text style={styles.expandedServiceTitle} numberOfLines={1}>
                                    {service?.title ? String(service.title) : ''}
                                </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* Modal pour afficher les services d'une catégorie */}
            <Modal
                visible={selectedCategory !== null}
                transparent={true}
                animationType="slide"
                onRequestClose={closeModal}
                statusBarTranslucent={true}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Header du modal */}
                        {selectedCategory && (
                            <>
                                <View style={styles.modalHeader}>
                                    <LinearGradient
                                        colors={selectedCategory.gradient && selectedCategory.gradient.length > 0 ? selectedCategory.gradient : ['#6B7280', '#9CA3AF']}
                                        style={styles.modalHeaderGradient}
                                    >
                                        <View style={styles.modalHeaderContent}>
                                            <View style={styles.modalIconContainer}>
                                                <SafeIcon name={selectedCategory.icon || 'default'} size={32} color="#FFFFFF" />
                                            </View>
                                            <View style={styles.modalTitleContainer}>
                                                <Text style={styles.modalTitle}>
                                                    {selectedCategory?.title ? String(selectedCategory.title) : ''}
                                                </Text>
                                                <Text style={styles.modalSubtitle}>
                                                    {selectedCategory?.description ? String(selectedCategory.description) : ''}
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
                                    showsVerticalScrollIndicator={true}
                                >
                                    {!selectedCategory.services || selectedCategory.services.length === 0 ? (
                                        <View style={styles.emptyServicesContainer}>
                                            <Text style={styles.emptyServicesText}>
                                                Aucun service disponible dans cette catégorie
                                            </Text>
                                        </View>
                                    ) : (
                                        selectedCategory.services.filter(s => s && s.id).map((service, index) => {
                                            // ✅ SÉCURISÉ: Vérifier que service existe et a les propriétés nécessaires
                                            if (!service || !service.id) {
                                                return null;
                                            }
                                            
                                            return (
                                                <TouchableOpacity
                                                    key={service.id || `service-${index}`}
                                                    style={styles.serviceItem}
                                                    onPress={() => {
                                                        console.log('[YukpoServicesQuickAccess] 🎯 Clic sur service:', service.id || 'unknown', service.title || '');
                                                        handleServiceSelect(service.id || '');
                                                    }}
                                                    activeOpacity={0.7}
                                                    disabled={service.comingSoon}
                                                >
                                                    <LinearGradient
                                                        colors={service.gradient && service.gradient.length > 0 ? service.gradient : ['#6B7280', '#9CA3AF']}
                                                        style={styles.serviceItemGradient}
                                                    >
                                                        <View style={styles.serviceItemIconContainer}>
                                                            <SafeIcon name={service.icon || 'default'} size={24} color="#FFFFFF" />
                                                            {service.comingSoon && (
                                                                <View style={styles.serviceComingSoonBadge}>
                                                                    <Text style={styles.serviceComingSoonText}>Bientôt</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <View style={styles.serviceItemContent}>
                                                    <Text style={styles.serviceItemTitle}>
                                                        {service?.title ? String(service.title) : ''}
                                                    </Text>
                                                    <Text style={styles.serviceItemDescription} numberOfLines={2}>
                                                        {service?.description ? String(service.description) : ''}
                                                    </Text>
                                                        </View>
                                                        <View style={styles.serviceItemArrow}>
                                                            <SafeIcon name="chevron-right" size={20} color="#FFFFFF" />
                                                        </View>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
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
    // ✅ Grille de catégories (2 lignes x 3 colonnes - 6 blocs au total)
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 4,
    },
    categoryWrapper: {
        width: '31%', // 3 colonnes avec espacement
        marginBottom: 4,
    },
    categoryBlock: {
        minWidth: 150,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    // ✅ Style miniaturisé comme GOZEM - fond blanc/gris clair
    categorySoftContainer: {
        padding: 8, // ✅ AUGMENTÉ: De 6 à 8 pour plus d'espace autour des éléments
        minHeight: 70, // ✅ AUGMENTÉ: De 60 à 70 pour plus d'espace vertical entre les blocs
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        gap: 4, // ✅ NOUVEAU: Espacement entre les éléments
    },
    categoryIconContainer: {
        marginBottom: 3,
        alignItems: 'center',
        justifyContent: 'center',
        width: 20, // ✅ MINIATURISÉ: De 28 à 20 pour plus d'espace entre les blocs
        height: 20, // ✅ MINIATURISÉ: De 28 à 20 pour plus d'espace entre les blocs
        borderRadius: 10, // ✅ MINIATURISÉ: De 14 à 10
        backgroundColor: '#F3F4F6', // ✅ Gris clair comme GOZEM
    },
    categoryTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#111827', // ✅ Texte foncé sur fond clair
        textAlign: 'center',
        marginTop: 4, // ✅ AUGMENTÉ: De marginBottom à marginTop pour plus d'espace après l'icône
        marginBottom: 2, // ✅ AUGMENTÉ: De 1 à 2
        lineHeight: 14,
    },
    categoryDescription: {
        fontSize: 9,
        color: '#6B7280', // ✅ Gris moyen
        textAlign: 'center',
    },
    // ✅ Styles pour menu horizontal des services (affiché en dessous de la grille, toute largeur)
    expandedServicesContainer: {
        marginTop: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        width: '100%',
    },
    expandedServicesContent: {
        gap: 8,
        paddingHorizontal: 2,
    },
    expandedServiceItem: {
        alignItems: 'center',
        minWidth: 60,
    },
    expandedServiceIconContainer: {
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    expandedServiceTitle: {
        fontSize: 10,
        fontWeight: '500',
        color: '#374151',
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
    emptyServicesContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyServicesText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default YukpoServicesQuickAccess;
