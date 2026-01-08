import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
// ✅ SUPPRIMÉ : WeekScheduleSelector (planning hebdomadaire supprimé)
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

// ✅ SUPPRIMÉ : ScheduleDay interface (planning hebdomadaire supprimé)

const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const BanqueSangFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const hopitalId = (route.params as any)?.hopitalId; // Optionnel
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        nom: '',
        adresse: '',
        quartier: null as LocationObject | string | null,
        // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
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
    // ✅ SUPPRIMÉ : showScheduleModal et schedule (planning hebdomadaire supprimé)

    // ✅ NOUVEAU: Charger automatiquement les données du partenaire si user.partner_type === 'banquesang'
    useEffect(() => {
        const loadPartnerData = async () => {
            if (user?.role === 'partenaire' && user?.partner_type === 'banquesang') {
                try {
                    // Récupérer les données du partenaire depuis /api/partners/me
                    const response = await apiGet('/api/partners/me');
                    
                    if (response.success && response.data) {
                        const partnerData = response.data;
                        
                        // Si le partenaire a déjà une banque de sang, charger ses données
                        if (partnerData.banque_sang_id) {
                            const banqueResponse = await apiGet(`/api/banques-sang/${partnerData.banque_sang_id}`);
                            if (banqueResponse.success && banqueResponse.data) {
                                const banqueData = banqueResponse.data;
                                setFormData({
                                    nom: banqueData.nom || '',
                                    adresse: banqueData.adresse || '',
                                    quartier: banqueData.quartier ? { raw: banqueData.quartier, place_name: banqueData.quartier } : null,
                                    accepte_dons: banqueData.accepte_dons ?? true,
                                    accepte_demandes: banqueData.accepte_demandes ?? true,
                                    urgence_24h: banqueData.urgence_24h ?? false,
                                    telephone: banqueData.telephone || '',
                                    telephone_urgence: banqueData.telephone_urgence || '',
                                    whatsapp: banqueData.whatsapp || '',
                                    email: banqueData.email || '',
                                });
                                if (banqueData.service_id) {
                                    setServiceId(banqueData.service_id);
                                }
                                if (banqueData.id) {
                                    // Mode édition
                                    (route.params as any).specializedServiceId = banqueData.id;
                                }
                            }
                        } else if (partnerData.service_id) {
                            // Si le partenaire a un service mais pas encore de banque de sang, pré-remplir avec les infos du service
                            setServiceId(partnerData.service_id);
                            setFormData(prev => ({
                                ...prev,
                                nom: partnerData.nom || partnerData.titre_service || '',
                                adresse: partnerData.adresse || '',
                                telephone: partnerData.telephone || '',
                                email: partnerData.email || '',
                            }));
                        }
                    }
                } catch (error: any) {
                    console.error('[BanqueSangFormScreen] Erreur chargement données partenaire:', error);
                }
            }
        };

        loadPartnerData();
    }, [user?.role, user?.partner_type]);

    // ✅ NOUVEAU : Charger les données existantes si mode='edit' et specializedServiceId fourni
    // (compatible avec l'ancien système banqueId)
    useEffect(() => {
        const idToLoad = specializedServiceId || banqueId;
        if ((mode === 'edit' && specializedServiceId) || banqueId) {
            loadBanqueData(idToLoad);
        }
    }, [mode, specializedServiceId, banqueId]);

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

    const loadBanqueData = async (id?: number) => {
        const banqueIdToLoad = id || banqueId || specializedServiceId;
        if (!banqueIdToLoad) return;

        try {
            setLoadingData(true);
            const response = await apiGet(`/api/banques-sang/${banqueIdToLoad}`);
            if (response.success && response.data) {
                const data = response.data as any;
                setFormData({
                    nom: data.nom || '',
                    adresse: data.adresse || '',
                    quartier: data.quartier || null,
                    // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
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
                    Object.entries(data.stocks_groupes_sanguins as Record<string, any>).forEach(([groupe, stock]: [string, any]) => {
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

    // ✅ SUPPRIMÉ : handleScheduleSave (planning hebdomadaire supprimé)

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

            // ✅ SUPPRIMÉ : planning_hebdomadaire (pas d'utilité selon demande)

            const quartierValue = typeof formData.quartier === 'string'
                ? formData.quartier
                : formData.quartier?.raw || formData.quartier?.place_name || null;

            const payload = {
                service_id: finalServiceId,
                hopital_id: hopitalId || null,
                nom: formData.nom,
                adresse: formData.adresse || null,
                quartier: quartierValue,
                // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
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
            <KeyboardAwareScreen style={styles.container}>
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

                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier"
                            value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRECTION: Extraire la valeur à stocker (string ou LocationObject selon besoin)
                                const quartierValue = location.raw || location.place_name || '';
                                setFormData({ 
                                    ...formData, 
                                    quartier: quartierValue,
                                    // ✅ NOUVEAU: Extraire automatiquement ville et pays si disponibles
                                    ville: location.components?.ville || formData.ville,
                                    pays: location.components?.pays || formData.pays,
                                });
                            }}
                            placeholder="Rechercher un quartier (inclut ville et pays)..."
                            scope="neighborhood"
                            enrichWithBackend
                        />
                        <Text style={styles.hintText}>
                            Le quartier permet de récupérer automatiquement la ville et le pays
                        </Text>
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

                    {/* ✅ SUPPRIMÉ : Planning hebdomadaire (pas d'utilité) */}

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
            </KeyboardAwareScreen>

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

            {/* ✅ SUPPRIMÉ : WeekScheduleSelector (planning hebdomadaire supprimé) */}
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
    // ✅ sectionHeader déjà défini plus haut, pas de duplication
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
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    submitButton: {
        marginTop: 24,
    },
});

export default BanqueSangFormScreen;

