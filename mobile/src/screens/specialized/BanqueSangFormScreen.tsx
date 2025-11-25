import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
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
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const BanqueSangFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const serviceId = (route.params as any)?.serviceId;
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
    const [stocks, setStocks] = useState<Record<string, { quantite: string; unite: string }>>({});

    const updateStock = (groupe: string, field: 'quantite' | 'unite', value: string) => {
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

    const handleSubmit = async () => {
        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom.trim()) {
            Alert.alert('Erreur', 'Le nom de la banque de sang est obligatoire');
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

            const payload = {
                service_id: serviceId,
                hopital_id: hopitalId || null,
                nom: formData.nom,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null,
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
                    <Text style={styles.sectionTitle}>Stocks par Groupe Sanguin</Text>
                    <Text style={styles.sectionSubtitle}>
                        Indiquez les quantités disponibles pour chaque groupe
                    </Text>
                    {GROUPES_SANGUINS.map((groupe) => (
                        <View key={groupe} style={styles.stockRow}>
                            <View style={styles.stockLabel}>
                                <Text style={styles.stockGroupe}>{groupe}</Text>
                            </View>
                            <View style={styles.stockInputs}>
                                <TextInput
                                    style={styles.stockInput}
                                    value={stocks[groupe]?.quantite || ''}
                                    onChangeText={(text) => updateStock(groupe, 'quantite', text)}
                                    placeholder="0"
                                    keyboardType="numeric"
                                />
                                <TextInput
                                    style={[styles.stockInput, { flex: 0.6 }]}
                                    value={stocks[groupe]?.unite || 'poches'}
                                    onChangeText={(text) => updateStock(groupe, 'unite', text)}
                                    placeholder="poches"
                                />
                            </View>
                        </View>
                    ))}
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

                <NativeButton
                    onPress={handleSubmit}
                    disabled={loading || !formData.nom.trim()}
                    variant="primary"
                    style={styles.submitButton}
                >
                    <Text style={styles.submitButtonText}>
                        {loading ? 'Enregistrement...' : 'Enregistrer la Banque de Sang'}
                    </Text>
                </NativeButton>
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
    },
    submitButton: {
        marginTop: 24,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default BanqueSangFormScreen;

