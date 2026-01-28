/**
 * YukpoServicesQuickAccess - VERSION REFONDUE
 * 
 * Composant simple et robuste pour l'accès rapide aux services spécialisés Yukpo
 * - 13 services regroupés en 6 catégories
 * - Grille 3x2 de catégories
 * - Menu horizontal des services quand une catégorie est sélectionnée
 * - Modal pour afficher les services d'une catégorie
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
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

// ✅ NOUVEAU: Fonction pour assombrir une couleur hexadécimale
const darkenColor = (hex: string, percent: number = 30): string => {
    // Retirer le # si présent
    hex = hex.replace('#', '');
    
    // Convertir en RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Assombrir en réduisant chaque composante
    const darkenedR = Math.max(0, Math.floor(r * (1 - percent / 100)));
    const darkenedG = Math.max(0, Math.floor(g * (1 - percent / 100)));
    const darkenedB = Math.max(0, Math.floor(b * (1 - percent / 100)));
    
    // Convertir en hex
    const toHex = (n: number) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(darkenedR)}${toHex(darkenedG)}${toHex(darkenedB)}`;
};

// Types
interface Service {
    id: string;
    title: string;
    icon: string;
    gradient: [string, string];
    description: string;
    comingSoon?: boolean;
}

interface Category {
    id: string;
    title: string;
    icon: string;
    gradient: [string, string];
    serviceIds: string[];
}

interface YukpoServicesQuickAccessProps {
    onServicePress?: (serviceId: string) => void;
}

// Données des services (13 services)
const SERVICES_DATA: Service[] = [
    // Santé
    { id: 'pharmacie', title: 'Pharmacie', icon: 'pill', gradient: ['#10B981', '#34D399'], description: 'Pharmacies de garde', comingSoon: false },
    { id: 'hopital', title: 'Hôpital', icon: 'hospital', gradient: ['#EF4444', '#F87171'], description: 'Hôpitaux, cliniques', comingSoon: false },
    { id: 'laboratoire', title: 'Laboratoire', icon: 'microscope', gradient: ['#3B82F6', '#60A5FA'], description: 'Analyses médicales', comingSoon: false },
    { id: 'banque_sang', title: 'Transfusion', icon: 'droplet', gradient: ['#DC2626', '#F87171'], description: 'Don de sang', comingSoon: false },
    // Transport
    { id: 'agence_voyage', title: 'Ticket voyage', icon: 'bus', gradient: ['#F59E0B', '#FBBF24'], description: 'Billets, réservations', comingSoon: false },
    { id: 'covoiturage', title: 'Covoiturage', icon: 'users', gradient: ['#8B5CF6', '#A78BFA'], description: 'Partage de trajet', comingSoon: false },
    { id: 'taxi', title: 'Taxi', icon: 'car', gradient: ['#F97316', '#FB923C'], description: 'Transport rapide', comingSoon: false },
    // Éducation
    { id: 'orientation_scolaire', title: 'Orientation', icon: 'book-open', gradient: ['#10B981', '#34D399'], description: 'Orientation scolaire', comingSoon: false },
    { id: 'bourse_livre', title: 'Troc livre', icon: 'book-open', gradient: ['#8B5CF6', '#A78BFA'], description: 'Livres scolaires', comingSoon: false },
    // Emploi
    { id: 'offres_emploi', title: 'Offres d\'Emploi', icon: 'briefcase', gradient: ['#6366F1', '#818CF8'], description: 'Recrutement', comingSoon: false },
    // Vie quotidienne
    { id: 'menu_planning', title: 'Mon menu', icon: 'utensils-crossed', gradient: ['#F59E0B', '#FBBF24'], description: 'Menus, repas', comingSoon: false },
    { id: 'bayamselam', title: 'BayamSelam', icon: 'trending-down', gradient: ['#10B981', '#34D399'], description: 'Comparatif prix', comingSoon: false },
    // Immobilier
    { id: 'immo', title: 'Immobilier', icon: 'home', gradient: ['#8B5CF6', '#A78BFA'], description: 'Biens immobiliers', comingSoon: false },
    { id: 'hotel', title: 'Hôtel', icon: 'building', gradient: ['#F59E0B', '#FBBF24'], description: 'Hôtels et hébergements', comingSoon: false },
    { id: 'meuble', title: 'Meublé', icon: 'key', gradient: ['#8B5CF6', '#A78BFA'], description: 'Location meublée', comingSoon: false },
];

// Données des catégories (6 catégories)
const CATEGORIES_DATA: Category[] = [
    { id: 'sante', title: 'Santé', icon: 'heart', gradient: ['#EC4899', '#F472B6'], serviceIds: ['pharmacie', 'hopital', 'laboratoire', 'banque_sang'] },
    { id: 'transport', title: 'Transport', icon: 'car', gradient: ['#F59E0B', '#FBBF24'], serviceIds: ['agence_voyage', 'covoiturage', 'taxi'] },
    { id: 'education', title: 'Éducation', icon: 'book-open', gradient: ['#3B82F6', '#60A5FA'], serviceIds: ['orientation_scolaire', 'bourse_livre'] },
    { id: 'emploi', title: 'Emploi', icon: 'briefcase', gradient: ['#6366F1', '#818CF8'], serviceIds: ['offres_emploi'] },
    { id: 'vie_quotidienne', title: 'Ma cuisine', icon: 'utensils-crossed', gradient: ['#F59E0B', '#FBBF24'], serviceIds: ['menu_planning', 'bayamselam'] },
    { id: 'immobilier', title: 'Immobilier', icon: 'home', gradient: ['#8B5CF6', '#A78BFA'], serviceIds: ['immo', 'hotel', 'meuble'] },
];

const YukpoServicesQuickAccess: React.FC<YukpoServicesQuickAccessProps> = ({
    onServicePress
}) => {
    const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
    const [modalCategoryId, setModalCategoryId] = useState<string | null>(null);

    // Construire les catégories avec leurs services
    const categories = useMemo(() => {
        return CATEGORIES_DATA.map(cat => {
            const services = cat.serviceIds
                .map(id => SERVICES_DATA.find(s => s.id === id))
                .filter((s): s is Service => s !== undefined);
            
            return {
                ...cat,
                services
            };
        });
    }, []);

    // Trouver la catégorie étendue
    const expandedCategory = useMemo(() => {
        if (!expandedCategoryId) return null;
        return categories.find(c => c.id === expandedCategoryId) || null;
    }, [expandedCategoryId, categories]);

    // Trouver la catégorie du modal
    const modalCategory = useMemo(() => {
        if (!modalCategoryId) return null;
        return categories.find(c => c.id === modalCategoryId) || null;
    }, [modalCategoryId, categories]);

    // Gérer le clic sur une catégorie
    const handleCategoryPress = (categoryId: string) => {
        // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour navigation fluide
        // hapticPress();
        const category = categories.find(c => c.id === categoryId);
        if (!category) return;

        if (category.services.length === 1) {
            // Un seul service : naviguer directement
            handleServicePress(category.services[0].id);
        } else if (category.services.length > 1) {
            // Plusieurs services : étendre horizontalement
            setExpandedCategoryId(expandedCategoryId === categoryId ? null : categoryId);
        }
    };

    // Gérer le clic sur un service
    const handleServicePress = (serviceId: string) => {
        if (!serviceId || typeof serviceId !== 'string') return;
        
        // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour navigation fluide
        // hapticPress();
        setExpandedCategoryId(null);
        setModalCategoryId(null);
        
        if (onServicePress) {
            onServicePress(serviceId);
        }
    };

    // Fermer le modal
    const closeModal = () => {
        // ✅ DÉSACTIVÉ: Haptic feedback désactivé pour fluidité
        // hapticPress();
        setModalCategoryId(null);
    };

    // Obtenir le nombre de services pour une catégorie
    const getServiceCount = (categoryId: string): number => {
        const category = categories.find(c => c.id === categoryId);
        return category ? category.services.length : 0;
    };

    // Obtenir le texte du nombre de services
    const getServiceCountText = (count: number): string => {
        if (count === 0) return '0 service';
        if (count === 1) return '1 service';
        return `${count} services`;
    };

    return (
        <View style={styles.container}>
            {/* ✅ NOUVEAU: Barre horizontale des services au-dessus de la grille */}
            {expandedCategoryId && expandedCategory && expandedCategory.services.length > 1 && (
                <View style={styles.servicesBarContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.servicesBarContent}
                    >
                        {expandedCategory.services.map((service) => (
                            <TouchableOpacity
                                key={service.id}
                                style={styles.serviceMiniCard}
                                onPress={() => handleServicePress(service.id)}
                                activeOpacity={0.7}
                                disabled={service.comingSoon}
                            >
                                <View style={[styles.serviceMiniIconContainer, { backgroundColor: `${service.gradient[0]}15` }]}>
                                    <SafeIcon name={service.icon} size={24} color={darkenColor(service.gradient[0], 25)} />
                                    {service.comingSoon && (
                                        <View style={styles.badgeMini}>
                                            <Text style={styles.badgeMiniText}>Bientôt</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.serviceMiniTitle} numberOfLines={1}>
                                    {service.title}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Grille de catégories (3 colonnes x 2 lignes) */}
            <View style={styles.categoriesGrid}>
                {categories.map((category) => {
                    const serviceCount = getServiceCount(category.id);
                    const serviceCountText = getServiceCountText(serviceCount);
                    const isExpanded = expandedCategoryId === category.id;

                    return (
                        <View key={category.id} style={styles.categoryWrapper}>
                            <TouchableOpacity
                                style={[styles.categoryBlock, isExpanded && styles.categoryBlockExpanded]}
                                onPress={() => handleCategoryPress(category.id)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.categoryContent}>
                                    <View style={[styles.categoryIconContainer, { backgroundColor: `${category.gradient[0]}15` }]}>
                                        <SafeIcon name={category.icon} size={30} color={darkenColor(category.gradient[0], 25)} />
                                    </View>
                                    <Text style={styles.categoryTitle} numberOfLines={2}>
                                        {category.title}
                                    </Text>
                                    <Text style={styles.categoryDescription} numberOfLines={1}>
                                        {category.id === 'immobilier' 
                                            ? 'Immobilier, Hôtel, Meublé'
                                            : serviceCountText}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </View>

            {/* Modal pour afficher les services d'une catégorie */}
            <Modal
                visible={modalCategoryId !== null}
                transparent
                animationType="slide"
                onRequestClose={closeModal}
            >
                {modalCategory && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            {/* Header */}
                            <LinearGradient
                                colors={modalCategory.gradient}
                                style={styles.modalHeader}
                            >
                                <View style={styles.modalHeaderContent}>
                                    <View style={styles.modalIconContainer}>
                                        <SafeIcon name={modalCategory.icon} size={32} color="#FFFFFF" />
                                    </View>
                                    <View style={styles.modalTitleContainer}>
                                        <Text style={styles.modalTitle}>
                                            {modalCategory.title}
                                        </Text>
                                        <Text style={styles.modalSubtitle}>
                                            {getServiceCountText(modalCategory.services.length)}
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

                            {/* Liste des services */}
                            <ScrollView style={styles.servicesList} contentContainerStyle={styles.servicesListContent}>
                                {modalCategory.services.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>
                                            Aucun service disponible
                                        </Text>
                                    </View>
                                ) : (
                                    modalCategory.services.map((service) => (
                                        <TouchableOpacity
                                            key={service.id}
                                            style={styles.serviceItem}
                                            onPress={() => handleServicePress(service.id)}
                                            activeOpacity={0.7}
                                            disabled={service.comingSoon}
                                        >
                                            <LinearGradient
                                                colors={service.gradient}
                                                style={styles.serviceGradient}
                                            >
                                                <View style={styles.serviceIconContainer}>
                                                    <SafeIcon name={service.icon} size={24} color="#FFFFFF" />
                                                    {service.comingSoon && (
                                                        <View style={styles.badge}>
                                                            <Text style={styles.badgeText}>Bientôt</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.serviceContent}>
                                                    <Text style={styles.serviceTitle}>
                                                        {service.title}
                                                    </Text>
                                                    <Text style={styles.serviceDescription} numberOfLines={2}>
                                                        {service.description}
                                                    </Text>
                                                </View>
                                                <View style={styles.serviceArrow}>
                                                    <SafeIcon name="chevron-right" size={20} color="#FFFFFF" />
                                                </View>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </View>
                )}
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 0,
        paddingHorizontal: 0,
        backgroundColor: 'transparent', // ✅ CORRIGÉ: Fond transparent
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 4,
    },
    categoryWrapper: {
        width: '31%',
        marginBottom: 4,
    },
    categoryBlock: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    categoryBlockExpanded: {
        borderWidth: 2,
        borderColor: '#6366F1',
    },
    categoryContent: {
        padding: 8,
        minHeight: 70,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.background, // ✅ CORRIGÉ: Même couleur que l'en-tête et le pied de page (#f8fafc)
        borderRadius: 10,
    },
    categoryIconContainer: {
        width: 44, // ✅ AUGMENTÉ: De 36 à 44 pour encore plus de visibilité
        height: 44, // ✅ AUGMENTÉ: De 36 à 44 pour encore plus de visibilité
        borderRadius: 22, // ✅ AUGMENTÉ: De 18 à 22 pour correspondre à la taille
        backgroundColor: '#FFFFFF', // ✅ Fond blanc par défaut, sera surchargé avec la couleur de la catégorie
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6, // ✅ AUGMENTÉ: De 4 à 6 pour plus d'espace
    },
    categoryTitle: {
        fontSize: 12, // ✅ AUGMENTÉ: De 11 à 12 pour meilleure lisibilité
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 4, // ✅ AUGMENTÉ: De 2 à 4 pour plus d'espace
        lineHeight: 16, // ✅ AUGMENTÉ: De 14 à 16
    },
    categoryDescription: {
        fontSize: 10, // ✅ AUGMENTÉ: De 9 à 10 pour meilleure lisibilité
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 14, // ✅ AJOUTÉ: Hauteur de ligne
    },
    expandedContainer: {
        marginTop: 8,
        backgroundColor: modernColors.background, // ✅ CORRIGÉ: Même couleur que l'en-tête et le pied de page (#f8fafc)
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    expandedContent: {
        gap: 8,
        paddingHorizontal: 2,
    },
    expandedItem: {
        alignItems: 'center',
        minWidth: 60,
    },
    expandedIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        position: 'relative',
    },
    expandedTitle: {
        fontSize: 10,
        fontWeight: '500',
        color: '#374151',
        textAlign: 'center',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 8,
        color: '#FFFFFF',
        fontWeight: '700',
    },
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
    },
    modalHeader: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
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
    },
    serviceGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        minHeight: 80,
    },
    serviceIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        position: 'relative',
    },
    serviceContent: {
        flex: 1,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 18,
    },
    serviceArrow: {
        marginLeft: 12,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    // ✅ NOUVEAU: Styles pour la barre horizontale des services au-dessus de la grille
    servicesBarContainer: {
        marginBottom: 12,
        paddingVertical: 8,
        paddingHorizontal: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10, // ✅ Au-dessus de la grille
    },
    servicesBarContent: {
        paddingHorizontal: 6, // ✅ RÉDUIT: De 8 à 6 pour optimiser l'espace
        gap: 6, // ✅ RÉDUIT: De 8 à 6 pour moins d'espace entre les cartes
    },
    serviceMiniCard: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 60, // ✅ RÉDUIT: De 70 à 60 pour afficher 4 services sans scroll
        maxWidth: 75, // ✅ RÉDUIT: De 90 à 75
        paddingVertical: 6, // ✅ RÉDUIT: De 8 à 6
        paddingHorizontal: 8, // ✅ RÉDUIT: De 10 à 8
        backgroundColor: modernColors.background, // ✅ CORRIGÉ: Même couleur que l'en-tête et le pied de page (#f8fafc)
        borderRadius: 8, // ✅ RÉDUIT: De 10 à 8
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginRight: 6, // ✅ RÉDUIT: De 8 à 6 pour moins d'espace entre les cartes
    },
    serviceMiniIconContainer: {
        width: 48, // ✅ AUGMENTÉ: De 40 à 48 pour encore plus de visibilité
        height: 48, // ✅ AUGMENTÉ: De 40 à 48 pour encore plus de visibilité
        borderRadius: 24, // ✅ AUGMENTÉ: De 20 à 24 pour correspondre à la taille
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4, // ✅ RÉDUIT: De 6 à 4
        position: 'relative',
    },
    serviceMiniTitle: {
        fontSize: 9, // ✅ RÉDUIT: De 10 à 9 pour que le texte soit visible
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
        lineHeight: 11, // ✅ AJOUTÉ: Hauteur de ligne pour éviter le débordement
    },
    badgeMini: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 6,
    },
    badgeMiniText: {
        fontSize: 7,
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default YukpoServicesQuickAccess;
