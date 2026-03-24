// ✅ Hub de recherche santé REFONDU - Urgences, pharmacie de garde dynamique, recherche unifiée
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet } from '../../services/api';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface HealthService {
    id: string;
    title: string;
    icon: string;
    gradient: string[];
    description: string;
    route: string;
    badge?: string;
    count?: number;
}

interface NearbyPharmacy {
    id: number;
    nom: string;
    adresse?: string;
    telephone?: string;
    distance_km?: number;
    is_on_duty_now?: boolean;
}

const HealthServicesHubScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    const [searchQuery, setSearchQuery] = useState('');
    const [dutyPharmacy, setDutyPharmacy] = useState<NearbyPharmacy | null>(null);
    const [loadingDuty, setLoadingDuty] = useState(true);
    const [servicesCounts, setServicesCounts] = useState<Record<string, number>>({});

    const healthServices: HealthService[] = [
        {
            id: 'pharmacie',
            title: 'Pharmacie',
            icon: 'pill',
            gradient: ['#10B981', '#34D399'],
            description: t('healthServicesHub.medicamentsPharmaciesDeGarde'),
            route: 'PharmacieHome',
            badge: '24/7',
            count: servicesCounts.pharmacie || 0,
        },
        {
            id: 'hopital',
            title: t('healthServicesHub.hopitalClinique'),
            icon: 'hospital',
            gradient: ['#EF4444', '#F87171'],
            description: t('healthServicesHub.urgencesConsultationsSpecialistes'),
            route: 'HopitalHome',
            count: servicesCounts.hopital || 0,
        },
        {
            id: 'laboratoire',
            title: 'Laboratoire',
            icon: 'microscope',
            gradient: ['#3B82F6', '#60A5FA'],
            description: t('healthServicesHub.analysesMedicalesImagerie'),
            route: 'LaboratoireHome',
            count: servicesCounts.laboratoire || 0,
        },
        {
            id: 'banque-sang',
            title: 'Banque de sang',
            icon: 'droplet',
            gradient: ['#DC2626', '#EF4444'],
            description: 'Don de sang, transfusion',
            route: 'BanqueSangSearch',
            badge: 'Vital',
            count: servicesCounts.banque_sang || 0,
        },
    ];

    // Charger la pharmacie de garde la plus proche
    const loadDutyPharmacy = useCallback(async () => {
        setLoadingDuty(true);
        try {
            const params: any = { limit: 1, on_duty: true };
            if (location?.coords) {
                params.lat = location.coords.latitude;
                params.lng = location.coords.longitude;
                params.radius_km = 20;
            }
            const response = await apiGet('/api/pharmacies/products/search', { params: { query: 'garde', ...params } });
            const rd: any = response?.data;
            if (response?.success && rd?.products?.length > 0) {
                const p = rd.products[0];
                setDutyPharmacy({
                    id: p.pharmacy_service_id || p.id,
                    nom: p.pharmacy_name || 'Pharmacie de garde',
                    adresse: p.pharmacy_quartier ? `${p.pharmacy_quartier}, ${p.pharmacy_ville}` : p.pharmacy_ville,
                    telephone: p.pharmacy_telephone,
                    distance_km: p.distance_km,
                    is_on_duty_now: true,
                });
            }
        } catch (err) {
            console.warn('[HealthHub] Erreur chargement pharmacie de garde:', err);
        } finally {
            setLoadingDuty(false);
        }
    }, [location]);

    useEffect(() => {
        loadDutyPharmacy();
    }, [loadDutyPharmacy]);

    const handleServicePress = (service: HealthService) => {
        (navigation as any).navigate(service.route);
    };

    const handleEmergencyCall = () => {
        const emergencyNumber = '119';
        Linking.openURL(`tel:${emergencyNumber}`).catch(() => {
            Linking.openURL(`tel:112`);
        });
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        const q = searchQuery.trim().toLowerCase();
        // Routing intelligent basé sur le terme recherché
        if (q.includes('pharmacie') || q.includes(t('healthServicesHubScreen.medicament')) || q.includes('medicament') || q.includes('doliprane') || q.includes('paracetamol')) {
            (navigation as any).navigate('PharmacieHome');
        } else if (q.includes('urgence') || q.includes(t('healthServicesHubScreen.hopital')) || q.includes('hopital') || q.includes('clinique')) {
            (navigation as any).navigate('HopitalHome');
        } else if (q.includes('analyse') || q.includes('laboratoire') || q.includes('labo') || q.includes('radio') || q.includes('scanner')) {
            (navigation as any).navigate('LaboratoireHome');
        } else if (q.includes('sang') || q.includes('don') || q.includes('transfusion')) {
            (navigation as any).navigate('BanqueSangSearch');
        } else {
            // Par défaut, hub hôpitaux (cohérent avec l’entrée accueil)
            (navigation as any).navigate('HopitalHome');
        }
    };

    const handleCallPharmacy = (phone?: string) => {
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient santé */}
            <LinearGradient colors={['#EC4899', '#F472B6']} style={styles.headerGradient}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>{t('healthServicesHub.servicesDeSante')}</Text>
                        <Text style={styles.headerSubtitle}>{t('healthServicesHub.trouvezRapidementLaideMedicale')}</Text>
                    </View>
                    {/* Bouton urgence */}
                    <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyCall} activeOpacity={0.7}>
                        <SafeIcon name="phone" size={18} color="#FFFFFF" type="lucide" />
                        <Text style={styles.emergencyText}>119</Text>
                    </TouchableOpacity>
                </View>

                {/* Barre de recherche unifiée santé */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <SafeIcon name="search" size={18} color="#9CA3AF" type="lucide" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t('healthServicesHub.paracetamolOphtalmologueAnalyseSang')}
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {/* Bandeau urgence */}
                <TouchableOpacity
                    style={styles.urgencyBanner}
                    onPress={() => (navigation as any).navigate('HopitalHome')}
                    activeOpacity={0.8}
                >
                    <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.urgencyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <SafeIcon name="alert-triangle" size={24} color="#FFFFFF" type="lucide" />
                        <View style={styles.urgencyContent}>
                            <Text style={styles.urgencyTitle}>{t('healthServicesHub.urgenceMedicale')}</Text>
                            <Text style={styles.urgencySubtitle}>{t('healthServicesHub.trouvezLhopitalLePlusProche')}</Text>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color="#FFFFFF" type="lucide" />
                    </LinearGradient>
                </TouchableOpacity>

                {/* Pharmacie de garde du jour */}
                {loadingDuty ? (
                    <View style={styles.dutyCard}>
                        <ActivityIndicator size="small" color="#10B981" />
                        <Text style={styles.dutyLoadingText}>{t('healthServicesHub.recherchePharmacieDeGarde')}</Text>
                    </View>
                ) : dutyPharmacy ? (
                    <View style={styles.dutyCard}>
                        <View style={styles.dutyHeader}>
                            <View style={styles.dutyBadge}>
                                <Text style={styles.dutyBadgeText}>DE GARDE</Text>
                            </View>
                            <Text style={styles.dutyTitle}>Pharmacie de garde</Text>
                        </View>
                        <Text style={styles.dutyName}>{dutyPharmacy.nom}</Text>
                        {dutyPharmacy.adresse && (
                            <View style={styles.dutyRow}>
                                <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" />
                                <Text style={styles.dutyInfo}>{dutyPharmacy.adresse}</Text>
                                {dutyPharmacy.distance_km != null && (
                                    <Text style={styles.dutyDistance}>{dutyPharmacy.distance_km < 1 ? `${Math.round(dutyPharmacy.distance_km * 1000)}m` : `${dutyPharmacy.distance_km.toFixed(1)}km`}</Text>
                                )}
                            </View>
                        )}
                        <View style={styles.dutyActions}>
                            {dutyPharmacy.telephone && (
                                <TouchableOpacity style={styles.dutyCallButton} onPress={() => handleCallPharmacy(dutyPharmacy.telephone)}>
                                    <SafeIcon name="phone" size={16} color="#FFFFFF" type="lucide" />
                                    <Text style={styles.dutyCallText}>Appeler</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.dutyDetailsButton}
                                onPress={() => (navigation as any).navigate('PharmacieSearch')}
                            >
                                <Text style={styles.dutyDetailsText}>Voir toutes</Text>
                                <SafeIcon name="chevron-right" size={16} color="#10B981" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}

                {/* Grille des services */}
                <Text style={styles.sectionTitle}>{t('healthServicesHub.servicesDisponibles')}</Text>
                <View style={styles.servicesGrid}>
                    {healthServices.map((service) => (
                        <TouchableOpacity
                            key={service.id}
                            style={styles.serviceCard}
                            onPress={() => handleServicePress(service)}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={service.gradient as any}
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
                                    <SafeIcon name={service.icon} size={28} color="#FFFFFF" type="lucide" />
                                </View>
                                <Text style={styles.serviceTitle}>{service.title}</Text>
                                <Text style={styles.serviceDescription} numberOfLines={2}>{service.description}</Text>
                                <View style={styles.arrowContainer}>
                                    <SafeIcon name="arrow-right" size={14} color="#FFFFFF" type="lucide" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Raccourcis rapides */}
                <Text style={styles.sectionTitle}>{t('healthServicesHub.accesRapide')}</Text>
                <View style={styles.quickActionsRow}>
                    <TouchableOpacity style={styles.quickAction} onPress={() => (navigation as any).navigate('PharmacieHome')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
                            <SafeIcon name="pill" size={20} color="#10B981" type="lucide" />
                        </View>
                        <Text style={styles.quickActionText}>Pharmacie{'\n'}de garde</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => (navigation as any).navigate('HopitalHome')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                            <SafeIcon name="stethoscope" size={20} color="#EF4444" type="lucide" />
                        </View>
                        <Text style={styles.quickActionText}>Prendre{'\n'}un RDV</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => (navigation as any).navigate('BanqueSangSearch')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                            <SafeIcon name="droplet" size={20} color="#DC2626" type="lucide" />
                        </View>
                        <Text style={styles.quickActionText}>Donner{'\n'}du sang</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAction} onPress={() => (navigation as any).navigate('LaboratoireHome')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                            <SafeIcon name="microscope" size={20} color="#3B82F6" type="lucide" />
                        </View>
                        <Text style={styles.quickActionText}>{t('healthServicesHubScreen.medicalAnalysis')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Conseils santé */}
                <View style={styles.tipsSection}>
                    <Text style={styles.tipsTitle}>{t('healthServicesHub.conseilsSante')}</Text>
                    <View style={styles.tipItem}>
                        <SafeIcon name="check-circle" size={14} color="#10B981" type="lucide" />
                        <Text style={styles.tipText}>{t('healthServicesHub.lesPharmaciesDeGardeChangent')}</Text>
                    </View>
                    <View style={styles.tipItem}>
                        <SafeIcon name="check-circle" size={14} color="#10B981" type="lucide" />
                        <Text style={styles.tipText}>{t('healthServicesHub.appelezLe119EnCas')}</Text>
                    </View>
                    <View style={styles.tipItem}>
                        <SafeIcon name="check-circle" size={14} color="#10B981" type="lucide" />
                        <Text style={styles.tipText}>{t('healthServicesHub.verifiezLaDisponibiliteAvantDe')}</Text>
                    </View>
                    <View style={styles.tipItem}>
                        <SafeIcon name="heart" size={14} color="#DC2626" type="lucide" />
                        <Text style={styles.tipText}>Donnez du sang — un geste qui sauve des vies</Text>
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
    headerGradient: {
        paddingTop: Platform.OS === 'android' ? 36 : 8,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 2,
    },
    emergencyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DC2626',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 4,
    },
    emergencyText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    searchContainer: {
        marginTop: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    urgencyBanner: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    urgencyGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    urgencyContent: {
        flex: 1,
    },
    urgencyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    urgencySubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 2,
    },
    dutyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#D1FAE5',
        elevation: 2,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    dutyLoadingText: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 8,
        textAlign: 'center',
    },
    dutyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    dutyBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    dutyBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    dutyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    dutyName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
    },
    dutyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    dutyInfo: {
        fontSize: 13,
        color: '#6B7280',
        flex: 1,
    },
    dutyDistance: {
        fontSize: 13,
        fontWeight: '600',
        color: '#10B981',
    },
    dutyActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dutyCallButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
        flex: 1,
        justifyContent: 'center',
    },
    dutyCallText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    dutyDetailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#10B981',
        gap: 4,
    },
    dutyDetailsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        marginTop: 4,
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    serviceCard: {
        width: '48%' as any,
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
    },
    cardGradient: {
        padding: 16,
        minHeight: 130,
        position: 'relative',
    },
    badgeContainer: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    iconContainer: {
        marginBottom: 10,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 15,
    },
    arrowContainer: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    quickAction: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
    },
    quickActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickActionText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
        lineHeight: 14,
    },
    tipsSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
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
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 10,
    },
    tipText: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
        flex: 1,
    },
});

export default HealthServicesHubScreen;









