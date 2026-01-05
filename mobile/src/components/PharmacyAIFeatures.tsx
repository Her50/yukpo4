/**
 * PharmacyAIFeatures - Composant réutilisable pour fonctionnalités IA pharmacie
 * 
 * Fonctionnalités:
 * - Vérification interactions médicamenteuses
 * - Suggestion dosage
 * - Calcul budget médicaments
 * - Recherche produits
 */

import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SafeIcon from './SafeIcon';
import { NativeButton } from './SafeNativeDesign';
import { apiPost, apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { hapticPress } from '../utils/hapticFeedback';

interface Medication {
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
}

interface InteractionResult {
    medications: string[];
    severity: 'low' | 'moderate' | 'high' | 'critical';
    description: string;
    recommendation: string;
}

interface DosageSuggestion {
    medication: string;
    suggested_dosage: string;
    frequency: string;
    duration: string;
    notes: string;
    warnings: string[];
}

interface BudgetResult {
    total: number;
    currency: string;
    items: Array<{
        name: string;
        price: number;
        quantity: number;
        subtotal: number;
    }>;
    pharmacies: Array<{
        pharmacy_id: number;
        pharmacy_name: string;
        total: number;
        distance_km?: number;
    }>;
}

interface PharmacyAIFeaturesProps {
    pharmacyId?: number;
    visible: boolean;
    onClose: () => void;
    initialMedications?: Medication[];
}

const PharmacyAIFeatures: React.FC<PharmacyAIFeaturesProps> = ({
    pharmacyId,
    visible,
    onClose,
    initialMedications = []
}) => {
    const [activeTab, setActiveTab] = useState<'interactions' | 'dosage' | 'budget' | 'search'>('interactions');
    const [loading, setLoading] = useState(false);
    
    // État pour interactions
    const [medications, setMedications] = useState<Medication[]>(initialMedications);
    const [interactionResult, setInteractionResult] = useState<InteractionResult | null>(null);
    
    // État pour dosage
    const [dosageMedication, setDosageMedication] = useState('');
    const [dosageAge, setDosageAge] = useState('');
    const [dosageWeight, setDosageWeight] = useState('');
    const [dosageCondition, setDosageCondition] = useState('');
    const [dosageResult, setDosageResult] = useState<DosageSuggestion | null>(null);
    
    // État pour budget
    const [budgetItems, setBudgetItems] = useState<Array<{ name: string; quantity: number }>>([]);
    const [budgetResult, setBudgetResult] = useState<BudgetResult | null>(null);
    
    // État pour recherche produits
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState<any[]>([]);

    // Ajouter médicament pour interactions
    const addMedication = () => {
        setMedications([...medications, { name: '' }]);
    };

    const updateMedication = (index: number, field: keyof Medication, value: string) => {
        const updated = [...medications];
        updated[index] = { ...updated[index], [field]: value };
        setMedications(updated);
    };

    const removeMedication = (index: number) => {
        setMedications(medications.filter((_, i) => i !== index));
    };

    // Vérifier interactions médicamenteuses
    const checkInteractions = async () => {
        if (medications.length < 2) {
            Alert.alert('Erreur', 'Veuillez ajouter au moins 2 médicaments pour vérifier les interactions');
            return;
        }

        const medNames = medications.map(m => m.name.trim()).filter(Boolean);
        if (medNames.length < 2) {
            Alert.alert('Erreur', 'Veuillez renseigner les noms des médicaments');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/pharmacies/ai/interactions', {
                medications: medNames,
                dosages: medications.map(m => m.dosage || '').filter(Boolean),
            });

            if (response?.success && response?.data) {
                setInteractionResult(response.data);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible de vérifier les interactions');
            }
        } catch (error: any) {
            console.error('[PharmacyAIFeatures] Erreur vérification interactions:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Suggérer dosage
    const suggestDosage = async () => {
        if (!dosageMedication.trim()) {
            Alert.alert('Erreur', 'Veuillez renseigner le nom du médicament');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/pharmacies/ai/dosage', {
                medication: dosageMedication.trim(),
                age: dosageAge ? parseInt(dosageAge) : undefined,
                weight: dosageWeight ? parseFloat(dosageWeight) : undefined,
                condition: dosageCondition.trim() || undefined,
            });

            if (response?.success && response?.data) {
                setDosageResult(response.data);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible de suggérer le dosage');
            }
        } catch (error: any) {
            console.error('[PharmacyAIFeatures] Erreur suggestion dosage:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Calculer budget
    const calculateBudget = async () => {
        if (budgetItems.length === 0) {
            Alert.alert('Erreur', 'Veuillez ajouter au moins un produit');
            return;
        }

        const validItems = budgetItems.filter(item => item.name.trim() && item.quantity > 0);
        if (validItems.length === 0) {
            Alert.alert('Erreur', 'Veuillez renseigner des produits valides');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/pharmacies/products/budget', {
                items: validItems,
                pharmacy_id: pharmacyId,
            });

            if (response?.success && response?.data) {
                setBudgetResult(response.data);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible de calculer le budget');
            }
        } catch (error: any) {
            console.error('[PharmacyAIFeatures] Erreur calcul budget:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Rechercher produits
    const searchProducts = async () => {
        if (!productSearch.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un terme de recherche');
            return;
        }

        try {
            setLoading(true);
            const response = await apiGet(`/api/pharmacies/products/search?query=${encodeURIComponent(productSearch.trim())}`);

            if (response?.success && response?.data) {
                setProductResults(Array.isArray(response.data) ? response.data : response.data.products || []);
            } else {
                Alert.alert('Erreur', response?.message || 'Aucun produit trouvé');
                setProductResults([]);
            }
        } catch (error: any) {
            console.error('[PharmacyAIFeatures] Erreur recherche produits:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
            setProductResults([]);
        } finally {
            setLoading(false);
        }
    };

    const addBudgetItem = () => {
        setBudgetItems([...budgetItems, { name: '', quantity: 1 }]);
    };

    const updateBudgetItem = (index: number, field: 'name' | 'quantity', value: string | number) => {
        const updated = [...budgetItems];
        updated[index] = { ...updated[index], [field]: value };
        setBudgetItems(updated);
    };

    const removeBudgetItem = (index: number) => {
        setBudgetItems(budgetItems.filter((_, i) => i !== index));
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#DC2626';
            case 'high': return '#F59E0B';
            case 'moderate': return '#FBBF24';
            case 'low': return '#10B981';
            default: return '#6B7280';
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#EC4899', '#F472B6']}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.headerIconContainer}>
                                <SafeIcon name="sparkles" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <Text style={styles.headerTitle}>Fonctionnalités IA</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                            >
                                <SafeIcon name="x" size={24} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    {/* Tabs */}
                    <View style={styles.tabsContainer}>
                        {[
                            { id: 'interactions', label: 'Interactions', icon: 'alert-triangle' },
                            { id: 'dosage', label: 'Dosage', icon: 'pill' },
                            { id: 'budget', label: 'Budget', icon: 'calculator' },
                            { id: 'search', label: 'Recherche', icon: 'search' },
                        ].map((tab) => (
                            <TouchableOpacity
                                key={tab.id}
                                style={[
                                    styles.tab,
                                    activeTab === tab.id && styles.tabActive
                                ]}
                                onPress={() => {
                                    hapticPress();
                                    setActiveTab(tab.id as any);
                                }}
                            >
                                <SafeIcon
                                    name={tab.icon}
                                    size={16}
                                    color={activeTab === tab.id ? '#EC4899' : '#6B7280'}
                                    type="lucide"
                                />
                                <Text style={[
                                    styles.tabText,
                                    activeTab === tab.id && styles.tabTextActive
                                ]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#EC4899" />
                                <Text style={styles.loadingText}>Analyse en cours...</Text>
                            </View>
                        )}

                        {/* Interactions Tab */}
                        {activeTab === 'interactions' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Vérifier les interactions médicamenteuses</Text>
                                <Text style={styles.sectionDescription}>
                                    Ajoutez les médicaments que vous prenez pour vérifier les interactions possibles
                                </Text>

                                {medications.map((med, index) => (
                                    <View key={index} style={styles.medicationCard}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Nom du médicament"
                                            value={med.name}
                                            onChangeText={(text) => updateMedication(index, 'name', text)}
                                        />
                                        <View style={styles.medicationRow}>
                                            <TextInput
                                                style={[styles.input, styles.inputSmall]}
                                                placeholder="Dosage (optionnel)"
                                                value={med.dosage || ''}
                                                onChangeText={(text) => updateMedication(index, 'dosage', text)}
                                            />
                                            <TextInput
                                                style={[styles.input, styles.inputSmall]}
                                                placeholder="Fréquence (optionnel)"
                                                value={med.frequency || ''}
                                                onChangeText={(text) => updateMedication(index, 'frequency', text)}
                                            />
                                        </View>
                                        {medications.length > 1 && (
                                            <TouchableOpacity
                                                style={styles.removeButton}
                                                onPress={() => removeMedication(index)}
                                            >
                                                <SafeIcon name="trash-2" size={16} color="#DC2626" type="lucide" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}

                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={addMedication}
                                >
                                    <SafeIcon name="plus" size={20} color="#EC4899" type="lucide" />
                                    <Text style={styles.addButtonText}>Ajouter un médicament</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={checkInteractions}
                                    disabled={medications.length < 2}
                                    style={[styles.actionButton, medications.length < 2 && styles.actionButtonDisabled]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Vérifier les interactions</Text>
                                </TouchableOpacity>

                                {interactionResult && (
                                    <View style={[styles.resultCard, { borderColor: getSeverityColor(interactionResult.severity) }]}>
                                        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(interactionResult.severity) }]}>
                                            <Text style={styles.severityText}>
                                                {interactionResult.severity.toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.resultTitle}>Médicaments concernés:</Text>
                                        <Text style={styles.resultText}>{interactionResult.medications.join(', ')}</Text>
                                        <Text style={styles.resultTitle}>Description:</Text>
                                        <Text style={styles.resultText}>{interactionResult.description}</Text>
                                        <Text style={styles.resultTitle}>Recommandation:</Text>
                                        <Text style={[styles.resultText, styles.recommendationText]}>
                                            {interactionResult.recommendation}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Dosage Tab */}
                        {activeTab === 'dosage' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Suggestion de dosage IA</Text>
                                <Text style={styles.sectionDescription}>
                                    Obtenez des suggestions de dosage personnalisées selon l'âge, le poids et la condition
                                </Text>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Nom du médicament *"
                                    value={dosageMedication}
                                    onChangeText={setDosageMedication}
                                />

                                <View style={styles.row}>
                                    <TextInput
                                        style={[styles.input, styles.inputHalf]}
                                        placeholder="Âge (années)"
                                        value={dosageAge}
                                        onChangeText={setDosageAge}
                                        keyboardType="numeric"
                                    />
                                    <TextInput
                                        style={[styles.input, styles.inputHalf]}
                                        placeholder="Poids (kg)"
                                        value={dosageWeight}
                                        onChangeText={setDosageWeight}
                                        keyboardType="numeric"
                                    />
                                </View>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Condition médicale (optionnel)"
                                    value={dosageCondition}
                                    onChangeText={setDosageCondition}
                                />

                                <TouchableOpacity
                                    onPress={suggestDosage}
                                    disabled={!dosageMedication.trim()}
                                    style={[styles.actionButton, !dosageMedication.trim() && styles.actionButtonDisabled]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Obtenir suggestion</Text>
                                </TouchableOpacity>

                                {dosageResult && (
                                    <View style={styles.resultCard}>
                                        <Text style={styles.resultTitle}>Médicament: {dosageResult.medication}</Text>
                                        <View style={styles.dosageInfo}>
                                            <View style={styles.dosageItem}>
                                                <Text style={styles.dosageLabel}>Dosage suggéré:</Text>
                                                <Text style={styles.dosageValue}>{dosageResult.suggested_dosage}</Text>
                                            </View>
                                            <View style={styles.dosageItem}>
                                                <Text style={styles.dosageLabel}>Fréquence:</Text>
                                                <Text style={styles.dosageValue}>{dosageResult.frequency}</Text>
                                            </View>
                                            <View style={styles.dosageItem}>
                                                <Text style={styles.dosageLabel}>Durée:</Text>
                                                <Text style={styles.dosageValue}>{dosageResult.duration}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.resultTitle}>Notes:</Text>
                                        <Text style={styles.resultText}>{dosageResult.notes}</Text>
                                        {dosageResult.warnings.length > 0 && (
                                            <>
                                                <Text style={styles.resultTitle}>⚠️ Avertissements:</Text>
                                                {dosageResult.warnings.map((warning, index) => (
                                                    <Text key={index} style={styles.warningText}>• {warning}</Text>
                                                ))}
                                            </>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Budget Tab */}
                        {activeTab === 'budget' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Calculer le budget</Text>
                                <Text style={styles.sectionDescription}>
                                    Estimez le coût total de vos médicaments et comparez les prix entre pharmacies
                                </Text>

                                {budgetItems.map((item, index) => (
                                    <View key={index} style={styles.budgetItemCard}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Nom du produit"
                                            value={item.name}
                                            onChangeText={(text) => updateBudgetItem(index, 'name', text)}
                                        />
                                        <View style={styles.quantityRow}>
                                            <Text style={styles.quantityLabel}>Quantité:</Text>
                                            <View style={styles.quantityControls}>
                                                <TouchableOpacity
                                                    style={styles.quantityButton}
                                                    onPress={() => updateBudgetItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                                                >
                                                    <SafeIcon name="minus" size={16} color="#FFFFFF" type="lucide" />
                                                </TouchableOpacity>
                                                <Text style={styles.quantityValue}>{item.quantity}</Text>
                                                <TouchableOpacity
                                                    style={styles.quantityButton}
                                                    onPress={() => updateBudgetItem(index, 'quantity', item.quantity + 1)}
                                                >
                                                    <SafeIcon name="plus" size={16} color="#FFFFFF" type="lucide" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        {budgetItems.length > 1 && (
                                            <TouchableOpacity
                                                style={styles.removeButton}
                                                onPress={() => removeBudgetItem(index)}
                                            >
                                                <SafeIcon name="trash-2" size={16} color="#DC2626" type="lucide" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}

                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={addBudgetItem}
                                >
                                    <SafeIcon name="plus" size={20} color="#EC4899" type="lucide" />
                                    <Text style={styles.addButtonText}>Ajouter un produit</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={calculateBudget}
                                    disabled={budgetItems.length === 0}
                                    style={[styles.actionButton, budgetItems.length === 0 && styles.actionButtonDisabled]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Calculer le budget</Text>
                                </TouchableOpacity>

                                {budgetResult && (
                                    <View style={styles.resultCard}>
                                        <Text style={styles.resultTitle}>Budget total: {budgetResult.total} {budgetResult.currency}</Text>
                                        <Text style={styles.resultSubtitle}>Détail des produits:</Text>
                                        {budgetResult.items.map((item, index) => (
                                            <View key={index} style={styles.budgetDetailItem}>
                                                <Text style={styles.budgetDetailText}>
                                                    {item.name} x{item.quantity}: {item.subtotal} {budgetResult.currency}
                                                </Text>
                                            </View>
                                        ))}
                                        {budgetResult.pharmacies.length > 0 && (
                                            <>
                                                <Text style={styles.resultSubtitle}>Comparaison pharmacies:</Text>
                                                {budgetResult.pharmacies.map((pharmacy, index) => (
                                                    <View key={index} style={styles.pharmacyComparison}>
                                                        <Text style={styles.pharmacyName}>{pharmacy.pharmacy_name}</Text>
                                                        <Text style={styles.pharmacyPrice}>
                                                            {pharmacy.total} {budgetResult.currency}
                                                        </Text>
                                                        {pharmacy.distance_km && (
                                                            <Text style={styles.pharmacyDistance}>
                                                                {pharmacy.distance_km.toFixed(1)} km
                                                            </Text>
                                                        )}
                                                    </View>
                                                ))}
                                            </>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Search Tab */}
                        {activeTab === 'search' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Rechercher des produits</Text>
                                <Text style={styles.sectionDescription}>
                                    Trouvez des médicaments et produits pharmaceutiques disponibles
                                </Text>

                                <View style={styles.searchContainer}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Rechercher un produit..."
                                        value={productSearch}
                                        onChangeText={setProductSearch}
                                        onSubmitEditing={searchProducts}
                                    />
                                    <TouchableOpacity
                                        style={styles.searchButton}
                                        onPress={searchProducts}
                                    >
                                        <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                                    </TouchableOpacity>
                                </View>

                                {productResults.length > 0 && (
                                    <View style={styles.resultsContainer}>
                                        <Text style={styles.resultsTitle}>
                                            {productResults.length} produit(s) trouvé(s)
                                        </Text>
                                        {productResults.map((product, index) => (
                                            <View key={index} style={styles.productCard}>
                                                <Text style={styles.productName}>{product.name || product.nom}</Text>
                                                {product.price && (
                                                    <Text style={styles.productPrice}>
                                                        {product.price} {product.currency || 'FCFA'}
                                                    </Text>
                                                )}
                                                {product.pharmacy_name && (
                                                    <Text style={styles.productPharmacy}>
                                                        Disponible chez: {product.pharmacy_name}
                                                    </Text>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginLeft: 12,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        gap: 4,
    },
    tabActive: {
        backgroundColor: '#FEE2E2',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    tabTextActive: {
        color: '#EC4899',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
        lineHeight: 20,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
    },
    inputSmall: {
        flex: 1,
        marginRight: 8,
    },
    inputHalf: {
        flex: 1,
        marginRight: 8,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    medicationCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        position: 'relative',
    },
    medicationRow: {
        flexDirection: 'row',
        marginTop: 8,
    },
    removeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 4,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: '#FEE2E2',
        borderRadius: 12,
        marginBottom: 16,
        gap: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EC4899',
    },
    actionButton: {
        marginTop: 8,
        marginBottom: 20,
        backgroundColor: '#EC4899',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    resultCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        marginTop: 12,
    },
    severityBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 12,
    },
    severityText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    resultTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginTop: 12,
        marginBottom: 4,
    },
    resultText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    recommendationText: {
        fontWeight: '600',
        color: '#059669',
    },
    dosageInfo: {
        marginVertical: 12,
    },
    dosageItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    dosageLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    dosageValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    warningText: {
        fontSize: 13,
        color: '#DC2626',
        marginTop: 4,
        lineHeight: 18,
    },
    budgetItemCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        position: 'relative',
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    quantityLabel: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    quantityButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EC4899',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        minWidth: 30,
        textAlign: 'center',
    },
    resultSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 16,
        marginBottom: 8,
    },
    budgetDetailItem: {
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    budgetDetailText: {
        fontSize: 14,
        color: '#374151',
    },
    pharmacyComparison: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    pharmacyName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    pharmacyPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EC4899',
        marginRight: 8,
    },
    pharmacyDistance: {
        fontSize: 12,
        color: '#6B7280',
    },
    searchContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchButton: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: '#EC4899',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultsContainer: {
        marginTop: 16,
    },
    resultsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    productCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EC4899',
        marginBottom: 4,
    },
    productPharmacy: {
        fontSize: 12,
        color: '#6B7280',
    },
});

export default PharmacyAIFeatures;

