// 🏥 Sélecteur de Services Spécialisés Yukpo
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

// Types de services spécialisés disponibles avec icônes SafeIcon
export const SPECIALIZED_SERVICES = [
    {
        id: 'pharmacie',
        name: 'Pharmacie',
        iconName: 'pill', // SafeIcon name
        iconType: 'lucide' as const,
        emoji: '💊', // Fallback emoji
        specialized_type: 'pharmacie',
        description: 'Pharmacies et médicaments',
    },
    {
        id: 'hopital_clinique',
        name: 'Hôpital / Clinique',
        iconName: 'hospital',
        iconType: 'lucide' as const,
        emoji: '🏥',
        specialized_type: 'hopital_clinique',
        description: 'Hôpitaux, cliniques, médecins',
    },
    {
        id: 'laboratoire_imagerie',
        name: 'Laboratoire / Imagerie',
        iconName: 'microscope',
        iconType: 'lucide' as const,
        emoji: '🔬',
        specialized_type: 'laboratoire_imagerie',
        description: 'Analyses médicales, radiologie',
    },
    {
        id: 'agence_voyage',
        name: 'Agence de Voyage',
        iconName: 'plane',
        iconType: 'lucide' as const,
        emoji: '✈️',
        specialized_type: 'agence_voyage',
        description: 'Tickets de bus, billets d\'avion',
    },
    {
        id: 'covoiturage',
        name: 'Covoiturage',
        iconName: 'users',
        iconType: 'lucide' as const,
        emoji: '🚗',
        specialized_type: 'covoiturage',
        description: 'Partage de trajets',
    },
    {
        id: 'taxi_ville',
        name: 'Taxi',
        iconName: 'car',
        iconType: 'lucide' as const,
        emoji: '🚕',
        specialized_type: 'taxi_ville',
        description: 'Taxis de ville',
    },
    {
        id: 'banque_sang',
        name: 'Banque de Sang',
        iconName: 'droplet',
        iconType: 'lucide' as const,
        emoji: '🩸',
        specialized_type: 'banque_sang',
        description: 'Dons de sang, groupes sanguins',
    },
];

interface SpecializedServicesSelectorProps {
    compact?: boolean;
}

const SpecializedServicesSelector: React.FC<SpecializedServicesSelectorProps> = ({
    compact = true,
}) => {
    const navigation = useNavigation();
    const [menuVisible, setMenuVisible] = useState(false);

    const handleServiceSelect = (service: typeof SPECIALIZED_SERVICES[0]) => {
        setMenuVisible(false);
        // ✅ NOUVEAU: Naviguer vers la page de recherche spécialisée intermédiaire
        // Permet de saisir les critères (texte, GPS, moment/planning) avant la recherche
        (navigation as any).navigate('SpecializedSearch', {
            specializedType: service.specialized_type,
            serviceName: service.name,
            serviceIcon: service.emoji, // Utiliser l'emoji comme fallback
        });
    };

    if (compact) {
        // Version compacte pour le header
        return (
            <>
                <TouchableOpacity
                    style={styles.compactButton}
                    onPress={() => setMenuVisible(true)}
                    activeOpacity={0.7}
                >
                    {/* ✅ CORRIGÉ: Utiliser une icône de recherche au lieu de grid-3x3 pour éviter la confusion avec le texte Yukpo */}
                    <SafeIcon name="search" size={18} color="#fff" type="lucide" />
                </TouchableOpacity>

                {/* Menu déroulant vertical */}
                {menuVisible && (
                    <Modal
                        animationType="fade"
                        transparent={true}
                        visible={menuVisible}
                        onRequestClose={() => setMenuVisible(false)}
                    >
                        <TouchableOpacity
                            style={styles.menuOverlay}
                            activeOpacity={1}
                            onPress={() => setMenuVisible(false)}
                        >
                            <View style={styles.menuContent} onStartShouldSetResponder={() => true}>
                                {/* Header */}
                                <View style={styles.menuHeader}>
                                    <View style={styles.menuTitleContainer}>
                                        <SafeIcon name="sparkles" size={20} color={modernColors.primary} />
                                        <Text style={styles.menuTitle}>Services Spécialisés</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setMenuVisible(false)}
                                        style={styles.closeButton}
                                    >
                                        <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Liste des services */}
                                <ScrollView
                                    style={styles.servicesList}
                                    showsVerticalScrollIndicator={false}
                                    nestedScrollEnabled={true}
                                >
                                    {SPECIALIZED_SERVICES.map((service) => (
                                        <TouchableOpacity
                                            key={service.id}
                                            style={styles.serviceItem}
                                            onPress={() => handleServiceSelect(service)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.serviceIconContainer}>
                                                <SafeIcon
                                                    name={service.iconName}
                                                    size={24}
                                                    color={modernColors.primary}
                                                    type={service.iconType}
                                                />
                                            </View>
                                            <View style={styles.serviceInfo}>
                                                <Text style={styles.serviceName}>{service.name}</Text>
                                                <Text style={styles.serviceDescription}>{service.description}</Text>
                                            </View>
                                            <SafeIcon
                                                name="chevron-right"
                                                size={16}
                                                color={modernColors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                )}
            </>
        );
    }

    // Version non-compacte (pour d'autres écrans si nécessaire)
    return (
        <View style={styles.container}>
            {/* Implémentation non-compacte si nécessaire */}
        </View>
    );
};

const styles = StyleSheet.create({
    compactButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary, // ✅ CORRIGÉ: Utiliser la couleur primaire pour meilleure visibilité
        width: 32,
        height: 32,
        borderRadius: 16,
        marginLeft: 0, // ✅ CORRIGÉ: Supprimé pour décaler l'icône plus vers la gauche, exploitant l'espace entre drapeau et Yukpo
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)', // ✅ Bordure subtile pour séparation
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 100,
    },
    menuContent: {
        width: '85%',
        maxWidth: 400,
        maxHeight: '70%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden',
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    menuTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    servicesList: {
        maxHeight: 500,
    },
    serviceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
        gap: 12,
    },
    serviceIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // serviceIconEmoji removed - using SafeIcon instead
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    serviceDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    container: {
        // Styles pour version non-compacte
    },
});

export default SpecializedServicesSelector;

