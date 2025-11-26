import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_WIDTH = (width - (CARD_MARGIN * 3)) / 2; // 2 colonnes avec marges

interface ServiceSpecialise {
    id: string;
    title: string;
    icon: string;
    description: string;
    route: string;
    color: string;
}

const MesServicesSpecialisesScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [creatingService, setCreatingService] = useState<string | null>(null);

    // ✅ Créer automatiquement un service avant la navigation
    const handleServicePress = async (service: ServiceSpecialise) => {
        if (creatingService) return; // Éviter les clics multiples

        try {
            setCreatingService(service.id);

            // Créer un service minimal pour ce type de service spécialisé
            const serviceData = {
                titre_service: service.title,
                description: service.description,
                category: service.id.includes('pharmacie') || service.id.includes('hopital') || service.id.includes('laboratoire') || service.id.includes('banque_sang')
                    ? 'sante'
                    : 'transport',
            };

            const response = await servicesApi.createService(serviceData);

            if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                const serviceId = (response.data as any).id;
                // Naviguer vers le formulaire avec le serviceId
                (navigation as any).navigate(service.route, {
                    serviceId: serviceId
                });
            } else {
                Alert.alert(
                    'Erreur',
                    'Impossible de créer le service. Veuillez réessayer.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error: any) {
            console.error('[MesServicesSpecialisesScreen] Erreur création service:', error);
            Alert.alert(
                'Erreur',
                error.message || 'Une erreur est survenue lors de la création du service.',
                [{ text: 'OK' }]
            );
        } finally {
            setCreatingService(null);
        }
    };

    const servicesSante: ServiceSpecialise[] = [
        {
            id: 'pharmacie',
            title: 'Pharmacie',
            icon: 'pill', // ✅ Icône Lucide
            description: 'Enregistrer une pharmacie avec garde',
            route: 'PharmacieForm',
            color: '#10B981', // Vert
        },
        {
            id: 'hopital',
            title: 'Hôpital/Clinique',
            icon: 'hospital', // ✅ Icône Lucide
            description: 'Enregistrer un établissement de santé',
            route: 'HopitalForm',
            color: '#EF4444', // Rouge
        },
        {
            id: 'laboratoire',
            title: 'Laboratoire/Imagerie',
            icon: 'microscope', // ✅ Icône Lucide
            description: 'Enregistrer un laboratoire',
            route: 'LaboratoireForm',
            color: '#3B82F6', // Bleu
        },
        {
            id: 'banque_sang',
            title: 'Banque de Sang',
            icon: 'droplet', // ✅ Icône Lucide
            description: 'Enregistrer une banque de sang',
            route: 'BanqueSangForm',
            color: '#DC2626', // Rouge foncé
        },
    ];

    const servicesTransport: ServiceSpecialise[] = [
        {
            id: 'agence_voyage',
            title: 'Agence de Voyage',
            icon: 'bus', // ✅ Icône Lucide
            description: 'Enregistrer une agence de voyage',
            route: 'AgenceVoyageForm',
            color: '#F59E0B', // Orange
        },
        {
            id: 'covoiturage',
            title: 'Covoiturage',
            icon: 'users', // ✅ Icône Lucide
            description: 'Proposer un trajet partagé',
            route: 'CovoiturageForm',
            color: '#8B5CF6', // Violet
        },
        {
            id: 'taxi',
            title: 'Taxi de Ville',
            icon: 'car', // ✅ Icône Lucide
            description: 'Enregistrer un service de taxi',
            route: 'TaxiForm',
            color: '#F97316', // Orange foncé
        },
    ];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Mes Services Spécialisés</Text>
                <Text style={styles.subtitle}>
                    Gérez vos services de santé et de transport
                </Text>
            </View>

            {/* Groupe Santé */}
            <View style={styles.group}>
                <View style={styles.groupHeader}>
                    <SafeIcon name="heart-pulse" size={24} color="#EF4444" type="lucide" />
                    <Text style={styles.groupTitle}>Santé</Text>
                </View>
                <View style={styles.servicesGrid}>
                    {servicesSante.map((service) => (
                        <TouchableOpacity
                            key={service.id}
                            style={[styles.serviceCard, { borderLeftColor: service.color }]}
                            onPress={() => handleServicePress(service)}
                            disabled={creatingService === service.id}
                        >
                            <View style={[styles.serviceIconContainer, { backgroundColor: service.color + '15' }]}>
                                <SafeIcon
                                    name={service.icon}
                                    size={24}
                                    color={service.color}
                                    type="lucide"
                                />
                            </View>
                            <Text style={styles.serviceTitle} numberOfLines={2}>
                                {service.title}
                            </Text>
                            <Text style={styles.serviceDescription} numberOfLines={2}>
                                {service.description}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Groupe Transport */}
            <View style={styles.group}>
                <View style={styles.groupHeader}>
                    <SafeIcon name="car" size={24} color="#3B82F6" type="lucide" />
                    <Text style={styles.groupTitle}>Transport</Text>
                </View>
                <View style={styles.servicesGrid}>
                    {servicesTransport.map((service) => (
                        <TouchableOpacity
                            key={service.id}
                            style={[styles.serviceCard, { borderLeftColor: service.color }]}
                            onPress={() => handleServicePress(service)}
                            disabled={creatingService === service.id}
                        >
                            <View style={[styles.serviceIconContainer, { backgroundColor: service.color + '15' }]}>
                                <SafeIcon
                                    name={service.icon}
                                    size={24}
                                    color={service.color}
                                    type="lucide"
                                />
                            </View>
                            <Text style={styles.serviceTitle} numberOfLines={2}>
                                {service.title}
                            </Text>
                            <Text style={styles.serviceDescription} numberOfLines={2}>
                                {service.description}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        padding: 20,
        paddingTop: 40,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    group: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    groupTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginHorizontal: -CARD_MARGIN / 2,
    },
    serviceCard: {
        width: CARD_WIDTH,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: CARD_MARGIN,
        marginHorizontal: CARD_MARGIN / 2,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        minHeight: 160, // Hauteur minimale pour uniformité
    },
    serviceIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
        lineHeight: 20,
    },
    serviceDescription: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
    },
});

export default MesServicesSpecialisesScreen;

