import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';

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

    const servicesSante: ServiceSpecialise[] = [
        {
            id: 'pharmacie',
            title: 'Pharmacie',
            icon: '💊',
            description: 'Enregistrer une pharmacie avec garde',
            route: 'PharmacieForm',
            color: '#10B981', // Vert
        },
        {
            id: 'hopital',
            title: 'Hôpital/Clinique',
            icon: '🏥',
            description: 'Enregistrer un établissement de santé',
            route: 'HopitalForm',
            color: '#EF4444', // Rouge
        },
        {
            id: 'laboratoire',
            title: 'Laboratoire/Imagerie',
            icon: '🔬',
            description: 'Enregistrer un laboratoire',
            route: 'LaboratoireForm',
            color: '#3B82F6', // Bleu
        },
        {
            id: 'banque_sang',
            title: 'Banque de Sang',
            icon: '🩸',
            description: 'Enregistrer une banque de sang',
            route: 'BanqueSangForm',
            color: '#DC2626', // Rouge foncé
        },
    ];

    const servicesTransport: ServiceSpecialise[] = [
        {
            id: 'agence_voyage',
            title: 'Agence de Voyage',
            icon: '🚌',
            description: 'Enregistrer une agence de voyage',
            route: 'AgenceVoyageForm',
            color: '#F59E0B', // Orange
        },
        {
            id: 'covoiturage',
            title: 'Covoiturage',
            icon: '🚗',
            description: 'Proposer un trajet partagé',
            route: 'CovoiturageForm',
            color: '#8B5CF6', // Violet
        },
        {
            id: 'taxi',
            title: 'Taxi de Ville',
            icon: '🚕',
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
                    <Text style={styles.groupIcon}>🏥</Text>
                    <Text style={styles.groupTitle}>Santé</Text>
                </View>
                <View style={styles.servicesGrid}>
                    {servicesSante.map((service) => (
                        <TouchableOpacity
                            key={service.id}
                            style={[styles.serviceCard, { borderLeftColor: service.color }]}
                            onPress={() => (navigation as any).navigate(service.route)}
                        >
                            <Text style={styles.serviceIcon}>{service.icon}</Text>
                            <Text style={styles.serviceTitle}>{service.title}</Text>
                            <Text style={styles.serviceDescription}>
                                {service.description}
                            </Text>
                            <View style={styles.serviceArrow}>
                                <SafeIcon name="chevron-right" size={20} color={service.color} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Groupe Transport */}
            <View style={styles.group}>
                <View style={styles.groupHeader}>
                    <Text style={styles.groupIcon}>🚗</Text>
                    <Text style={styles.groupTitle}>Transport</Text>
                </View>
                <View style={styles.servicesGrid}>
                    {servicesTransport.map((service) => (
                        <TouchableOpacity
                            key={service.id}
                            style={[styles.serviceCard, { borderLeftColor: service.color }]}
                            onPress={() => (navigation as any).navigate(service.route)}
                        >
                            <Text style={styles.serviceIcon}>{service.icon}</Text>
                            <Text style={styles.serviceTitle}>{service.title}</Text>
                            <Text style={styles.serviceDescription}>
                                {service.description}
                            </Text>
                            <View style={styles.serviceArrow}>
                                <SafeIcon name="chevron-right" size={20} color={service.color} />
                            </View>
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
    },
    groupIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    groupTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    servicesGrid: {
        gap: 12,
    },
    serviceCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    serviceIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    serviceTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    serviceArrow: {
        alignSelf: 'flex-end',
        marginTop: 4,
    },
});

export default MesServicesSpecialisesScreen;

