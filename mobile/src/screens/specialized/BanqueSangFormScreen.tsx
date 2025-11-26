import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import WeekScheduleSelector from '../../components/WeekScheduleSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface ScheduleDay {
    day: number;
    enabled: boolean;
    timeSlots: Array<{ start: string; end: string }>;
}

const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const BanqueSangFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const hopitalId = (route.params as any)?.hopitalId; // Optionnel

    const [formData, setFormData] = useState({
        nom: '',
        adresse: '',
        quartier: '',
        ville: '',
        accepte_dons: true,
        accepte_demandes: true,
        urgence_24h: false,
        telephone: '',
        telephone_urgence: '',
        whatsapp: '',
        email: '',
    });

    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const banqueId = (route.params as any)?.banqueId; // Si on édite
    const [stocks, setStocks] = useState<Record<string, { quantite: string; unite: string }>>({});
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [schedule, setSchedule] = useState<ScheduleDay[]>([]);

    // Charger les données existantes si on édite
    useEffect(() => {
        if (banqueId) {
            loadBanqueData();
        }
    }, [banqueId]);

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.nom) {
                try {
                    const serviceData = {
                        titre_service: formData.nom || 'Banque de Sang',
                        description: 'Banque de sang',
                        category: 'sante',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[BanqueSangFormScreen] Erreur création service:', error);
                }
            }
        };

        if (!serviceId && formData.nom) {
            createServiceIfNeeded();
        }
    }, [formData.nom, serviceId, user?.id]);

    const loadBanqueData = async () => {
        try {
            setLoadingData(true);
            const response = await apiGet(`/api/banques-sang/${banqueId}`);
            if (response.success && response.data) {
                const data = response.data;
                setFormData({
                    nom: data.nom || '',
                    adresse: data.adresse || '',
                    quartier: data.quartier || '',
                    ville: data.ville || '',
                    accepte_dons: data.accepte_dons ?? true,
                    accepte_demandes: data.accepte_demandes ?? true,
                    urgence_24h: data.urgence_24h ?? false,
                    telephone: data.telephone || '',
                    telephone_urgence: data.telephone_urgence || '',
                    whatsapp: data.whatsapp || '',
                    email: data.email || '',
                });

                // Charger les stocks existants
                if (data.stocks_groupes_sanguins) {
                    const loadedStocks: Record<string, { quantite: string; unite: string }> = {};
                    Object.entries(data.stocks_groupes_sanguins).forEach(([groupe, stock]: [string, any]) => {
                        loadedStocks[groupe] = {
                            quantite: String(stock.quantite || ''),
                            unite: stock.unite || 'poches',
                        };
                    });
                    setStocks(loadedStocks);
                }
            }
        } catch (error: any) {
            console.error('Erreur chargement banque:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const updateStock = (groupe: string, field: 'quantite' | 'unite', value: string) => {
        // Validation : seulement des nombres pour la quantité
        if (field === 'quantite' && value && !/^\d+$/.test(value)) {
            return; // Ignorer les caractères non numériques
        }

        setStocks((prev) => ({
            ...prev,
            [groupe]: {
                ...prev[groupe],
                [field]: value,
                quantite: field === 'quantite' ? value : prev[groupe]?.quantite || '',
                unite: field === 'unite' ? value : prev[groupe]?.unite || 'poches',
            },
        }));
    };

    const getStockStatus = (quantite: string): 'disponible' | 'moyen' | 'faible' | 'vide' => {
        const qty = parseInt(quantite) || 0;
        if (qty === 0) return 'vide';
        if (qty <= 5) return 'faible';
        if (qty <= 10) return 'moyen';
        return 'disponible';
    };

    const getStockStatusColor = (status: string) => {
        switch (status) {
            case 'disponible':
                return '#10B981';
            case 'moyen':
                return '#F59E0B';
            case 'faible':
                return '#EF4444';
            default:
                return '#9CA3AF';
        }
    };

    const totalStocks = Object.values(stocks).reduce((sum, stock) => {
        return sum + (parseInt(stock.quantite) || 0);
    }, 0);

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const handleScheduleSave = (savedSchedule: ScheduleDay[]) => {
        setSchedule(savedSchedule);
        setShowScheduleModal(false);
    };

    const handleSubmit = async () => {
        // ✅ Créer le service si nécessaire
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                setLoading(true);
                const serviceData = {
                    titre_service: formData.nom || 'Banque de Sang',
                    description: 'Banque de sang',
                    category: 'sante',
                };

                const response = await servicesApi.createService(serviceData);
                if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                    finalServiceId = (response.data as any).id;
                    setServiceId(finalServiceId);
                } else {
                    Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                    setLoading(false);
                    return;
                }
            } catch (error: any) {
                console.error('[BanqueSangFormScreen] Erreur création service:', error);
                Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                setLoading(false);
                return;
            }
        }

        if (!finalServiceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            setLoading(false);
            return;
        }

        if (!formData.nom.trim()) {
            Alert.alert('Erreur', 'Le nom de la banque de sang est obligatoire');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Construire stocks_groupes_sanguins JSONB
            const stocks_json: Record<string, any> = {};
            for (const [groupe, stock] of Object.entries(stocks)) {
                if (stock.quantite && parseInt(stock.quantite) > 0) {
                    stocks_json[groupe] = {
                        quantite: parseInt(stock.quantite),
                        unite: stock.unite || 'poches',
                        derniere_maj: new Date().toISOString(),
                    };
                }
            }

            // Construire le planning hebdomadaire depuis schedule
            const planningHebdomadaire = schedule.length > 0
                ? schedule.map(day => ({
                    day: day.day,
                    enabled: day.enabled,
                    timeSlots: day.timeSlots
                }))
                : null;

            const payload = {
                service_id: finalServiceId,
                hopital_id: hopitalId || null,
                nom: formData.nom,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                planning_hebdomadaire: planningHebdomadaire,
                stocks_groupes_sanguins: Object.keys(stocks_json).length > 0 ? stocks_json : null,
                accepte_dons: formData.accepte_dons,
                accepte_demandes: formData.accepte_demandes,
                urgence_24h: formData.urgence_24h,
                telephone: formData.telephone || null,
                telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
            };

            const response = await apiPost('/api/banques-sang', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Banque de sang enregistrée avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer la banque de sang');
            }
        } catch (error: any) {
            console.error('Erreur création banque de sang:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Enregistrer une Banque de Sang</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nom de la banque de sang *</Text>
                        <NativeInput
                            value={formData.nom}
                            onChangeText={(text) => setFormData({ ...formData, nom: text })}
                            placeholder="Ex: Banque de Sang Centrale"
                        />
                    </View>

                    {/* ✅ Localisation avec Google Maps */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Localisation GPS</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPS ? 'Localisation sélectionnée' : 'Sélectionner sur la carte'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        {selectedGPS && (
                            <Text style={styles.gpsText}>{selectedGPS}</Text>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Adresse</Text>
                        <NativeInput
                            value={formData.adresse}
                            onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                            placeholder="Adresse complète"
                            multiline
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Quartier</Text>
                            <NativeInput
                                value={formData.quartier}
                                onChangeText={(text) => setFormData({ ...formData, quartier: text })}
                                placeholder="Quartier"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Ville</Text>
                            <NativeInput
                                value={formData.ville}
                                onChangeText={(text) => setFormData({ ...formData, ville: text })}
                                placeholder="Ville"
                            />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View>
                                <Text style={styles.sectionTitle}>Stocks par Groupe Sanguin</Text>
                                <Text style={styles.sectionSubtitle}>
                                    Indiquez les quantités disponibles pour chaque groupe
                                </Text>
                            </View>
                            {totalStocks > 0 && (
                                <View style={styles.totalStocksBadge}>
                                    <Text style={styles.totalStocksText}>
                                        {totalStocks} poches totales
                                    </Text>
                                </View>
                            )}
                        </View>

                        {GROUPES_SANGUINS.map((groupe) => {
                            const quantite = stocks[groupe]?.quantite || '';
                            const status = getStockStatus(quantite);
                            const statusColor = getStockStatusColor(status);

                            return (
                                <View key={groupe} style={styles.stockRow}>
                                    <View style={styles.stockLabel}>
                                        <Text style={styles.stockGroupe}>{groupe}</Text>
                                        {quantite && (
                                            <View
                                                style={[
                                                    styles.stockStatusIndicator,
                                                    { backgroundColor: statusColor },
                                                ]}
                                            />
                                        )}
                                    </View>
                                    <View style={styles.stockInputs}>
                                        <View style={styles.quantiteContainer}>
                                            <TextInput
                                                style={[
                                                    styles.stockInput,
                                                    quantite && {
                                                        borderColor: statusColor,
                                                        backgroundColor: `${statusColor}10`,
                                                    },
                                                ]}
                                                value={quantite}
                                                onChangeText={(text) => updateStock(groupe, 'quantite', text)}
                                                placeholder="0"
                                                keyboardType="numeric"
                                            />
                                            {quantite && (
                                                <Text style={[styles.stockStatusText, { color: statusColor }]}>
                                                    {status === 'disponible'
                                                        ? '✓'
                                                        : status === 'moyen'
                                                            ? '⚠'
                                                            : status === 'faible'
                                                                ? '⚠⚠'
                                                                : ''}
                                                </Text>
                                            )}
                                        </View>
                                        <TextInput
                                            style={[styles.stockInput, styles.uniteInput]}
                                            value={stocks[groupe]?.unite || 'poches'}
                                            onChangeText={(text) => updateStock(groupe, 'unite', text)}
                                            placeholder="poches"
                                        />
                                    </View>
                                </View>
                            );
                        })}

                        {/* Résumé des stocks */}
                        {totalStocks > 0 && (
                            <View style={styles.stocksSummary}>
                                <Text style={styles.summaryTitle}>Résumé des stocks</Text>
                                <View style={styles.summaryRow}>
                                    <View style={styles.summaryItem}>
                                        <Text style={styles.summaryLabel}>Total poches</Text>
                                        <Text style={styles.summaryValue}>{totalStocks}</Text>
                                    </View>
                                    <View style={styles.summaryItem}>
                                        <Text style={styles.summaryLabel}>Groupes renseignés</Text>
                                        <Text style={styles.summaryValue}>
                                            {Object.values(stocks).filter((s) => parseInt(s.quantite) > 0).length}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* ✅ Planning hebdomadaire */}
                    <View style={styles.inputGroup}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.label}>Planning hebdomadaire</Text>
                            <TouchableOpacity
                                style={styles.planningButton}
                                onPress={() => setShowScheduleModal(true)}
                            >
                                <SafeIcon name="calendar" size={16} color={modernColors.primary} />
                                <Text style={styles.planningButtonText}>
                                    {schedule.length > 0 ? 'Modifier' : 'Configurer'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {schedule.length > 0 && (
                            <Text style={styles.scheduleSummary}>
                                {schedule.filter(d => d.enabled).length} jour(s) configuré(s)
                            </Text>
                        )}
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Accepte les dons</Text>
                        <Switch
                            value={formData.accepte_dons}
                            onValueChange={(value) => setFormData({ ...formData, accepte_dons: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Accepte les demandes</Text>
                        <Switch
                            value={formData.accepte_demandes}
                            onValueChange={(value) =>
                                setFormData({ ...formData, accepte_demandes: value })
                            }
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Urgence 24h/24</Text>
                        <Switch
                            value={formData.urgence_24h}
                            onValueChange={(value) => setFormData({ ...formData, urgence_24h: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Téléphone</Text>
                        <NativeInput
                            value={formData.telephone}
                            onChangeText={(text) => setFormData({ ...formData, telephone: text })}
                            placeholder="+237 6XX XX XX XX"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Téléphone Urgence</Text>
                        <NativeInput
                            value={formData.telephone_urgence}
                            onChangeText={(text) =>
                                setFormData({ ...formData, telephone_urgence: text })
                            }
                            placeholder="+237 6XX XX XX XX"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>WhatsApp</Text>
                        <NativeInput
                            value={formData.whatsapp}
                            onChangeText={(text) => setFormData({ ...formData, whatsapp: text })}
                            placeholder="+237 6XX XX XX XX"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <NativeInput
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            placeholder="banque@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Enregistrement...' : 'Enregistrer la Banque de Sang'}
                        onPress={handleSubmit}
                        disabled={loading || !formData.nom.trim()}
                        variant="primary"
                        size="large"
                        style={styles.submitButton}
                    />
                </View>
            </ScrollView>

            {/* Modals */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={location ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null}
                title="Sélectionner la localisation"
            />

            <WeekScheduleSelector
                visible={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                onSave={handleScheduleSave}
                initialSchedule={schedule}
                title="Planning hebdomadaire"
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    form: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    section: {
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 16,
    },
    stockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    stockLabel: {
        width: 60,
    },
    stockGroupe: {
        fontSize: 16,
        fontWeight: '700',
        color: '#DC2626', // Rouge pour sang
    },
    stockInputs: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
    },
    stockInput: {
        flex: 1,
        padding: 10,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 14,
        color: '#111827',
    },
    uniteInput: {
        flex: 0.6,
    },
    quantiteContainer: {
        flex: 1,
        position: 'relative',
    },
    stockStatusIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 4,
    },
    stockStatusText: {
        position: 'absolute',
        right: 8,
        top: 10,
        fontSize: 12,
        fontWeight: '700',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    totalStocksBadge: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    totalStocksText: {
        fontSize: 12,
        fontWeight: '700',
        color: modernColors.primary,
    },
    stocksSummary: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 16,
    },
    summaryItem: {
        flex: 1,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    gpsText: {
        marginTop: 8,
        fontSize: 12,
        color: '#6B7280',
    },
    planningButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: `${modernColors.primary}15`,
        borderRadius: 8,
    },
    planningButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    scheduleSummary: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    submitButton: {
        marginTop: 24,
    },
});

export default BanqueSangFormScreen;

