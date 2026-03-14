/**
 * RealEstateAIFeatures - Composant réutilisable pour fonctionnalités IA immobilier
 * 
 * Fonctionnalités:
 * - Recommandations IA selon profil
 * - Estimation prix IA
 * - Comparaison biens
 * - Alertes prix
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { hapticPress } from '../utils/hapticFeedback';
import SafeIcon from './SafeIcon';

interface RecommendationResult {
    properties: Array<{
        property_id: number;
        property_name: string;
        match_score: number;
        price: number;
        location: string;
        features: string[];
    }>;
    reasoning: string;
}

interface PriceEstimateResult {
    estimated_price: number;
    price_range: {
        min: number;
        max: number;
    };
    confidence: number;
    factors: Array<{
        factor: string;
        impact: string;
    }>;
    comparable_properties: number;
}

interface ComparisonResult {
    properties: Array<{
        property_id: number;
        property_name: string;
        price: number;
        features: Record<string, any>;
        score: number;
    }>;
    winner: number;
    summary: string;
}

interface RealEstateAIFeaturesProps {
    visible: boolean;
    onClose: () => void;
    propertyId?: number;
}

const RealEstateAIFeatures: React.FC<RealEstateAIFeaturesProps> = ({
    visible,
    onClose,
    propertyId
}) => {
    const [activeTab, setActiveTab] = useState<'recommendations' | 'estimate' | 'compare' | 'alerts'>('recommendations');
    const [loading, setLoading] = useState(false);

    // État pour recommandations
    const [budget, setBudget] = useState('');
    const [location, setLocation] = useState('');
    const [preferences, setPreferences] = useState('');
    const [recommendationResult, setRecommendationResult] = useState<RecommendationResult | null>(null);

    // État pour estimation
    const [propertyType, setPropertyType] = useState('');
    const [surface, setSurface] = useState('');
    const [rooms, setRooms] = useState('');
    const [locationEstimate, setLocationEstimate] = useState('');
    const [estimateResult, setEstimateResult] = useState<PriceEstimateResult | null>(null);

    // État pour comparaison
    const [propertyIds, setPropertyIds] = useState<string>('');
    const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

    // État pour alertes
    const [alertCriteria, setAlertCriteria] = useState('');
    const [alertPriceMax, setAlertPriceMax] = useState('');
    const [savedAlerts, setSavedAlerts] = useState<any[]>([]);

    // Obtenir recommandations
    const getRecommendations = async () => {
        if (!budget.trim() || !location.trim()) {
            Alert.alert('Erreur', 'Veuillez renseigner au moins le budget et la localisation');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/immobilier/ai/recommendations', {
                budget: parseFloat(budget),
                location: location.trim(),
                preferences: preferences.trim() || undefined,
            });

            if (response?.success && response?.data) {
                setRecommendationResult(response.data as any);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible d\'obtenir des recommandations');
            }
        } catch (error: any) {
            console.error('[RealEstateAIFeatures] Erreur recommandations:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Estimer prix
    const estimatePrice = async () => {
        if (!propertyType.trim() || !surface.trim() || !locationEstimate.trim()) {
            Alert.alert('Erreur', 'Veuillez renseigner le type, la surface et la localisation');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/immobilier/ai/price-estimate', {
                property_type: propertyType.trim(),
                surface: parseFloat(surface),
                rooms: rooms ? parseInt(rooms) : undefined,
                location: locationEstimate.trim(),
            });

            if (response?.success && response?.data) {
                setEstimateResult(response.data as any);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible d\'estimer le prix');
            }
        } catch (error: any) {
            console.error('[RealEstateAIFeatures] Erreur estimation:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Comparer biens
    const compareProperties = async () => {
        const ids = propertyIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (ids.length < 2) {
            Alert.alert('Erreur', 'Veuillez entrer au moins 2 IDs de biens séparés par des virgules');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/immobilier/compare', {
                property_ids: ids,
            });

            if (response?.success && response?.data) {
                setComparisonResult(response.data as any);
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible de comparer les biens');
            }
        } catch (error: any) {
            console.error('[RealEstateAIFeatures] Erreur comparaison:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Créer alerte
    const createAlert = async () => {
        if (!alertCriteria.trim() || !alertPriceMax.trim()) {
            Alert.alert('Erreur', 'Veuillez renseigner les critères et le prix maximum');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/immobilier/alerts', {
                criteria: alertCriteria.trim(),
                max_price: parseFloat(alertPriceMax),
            });

            if (response?.success) {
                Alert.alert('Succès', 'Alerte créée avec succès');
                loadAlerts();
            } else {
                Alert.alert('Erreur', response?.message || 'Impossible de créer l\'alerte');
            }
        } catch (error: any) {
            console.error('[RealEstateAIFeatures] Erreur création alerte:', error);
            Alert.alert('Erreur', error?.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // Charger alertes
    const loadAlerts = async () => {
        try {
            const response = await apiGet('/api/immobilier/my-alerts');
            if (response?.success && response?.data) {
                setSavedAlerts(response.data as any);
            }
        } catch (error) {
            console.error('[RealEstateAIFeatures] Erreur chargement alertes:', error);
        }
    };

    React.useEffect(() => {
        if (visible && activeTab === 'alerts') {
            loadAlerts();
        }
    }, [visible, activeTab]);

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
                        colors={['#8B5CF6', '#A78BFA']}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.headerIconContainer}>
                                <SafeIcon name="home" size={24} color="#FFFFFF" type="lucide" />
                            </View>
                            <Text style={styles.headerTitle}>Fonctionnalités IA Immobilier</Text>
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
                            { id: 'recommendations', label: 'Recommandations', icon: 'sparkles' },
                            { id: 'estimate', label: 'Estimation', icon: 'calculator' },
                            { id: 'compare', label: 'Comparer', icon: 'git-compare' },
                            { id: 'alerts', label: 'Alertes', icon: 'bell' },
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
                                    color={activeTab === tab.id ? '#8B5CF6' : '#6B7280'}
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
                                <ActivityIndicator size="large" color="#8B5CF6" />
                                <Text style={styles.loadingText}>Analyse en cours...</Text>
                            </View>
                        )}

                        {/* Recommendations Tab */}
                        {activeTab === 'recommendations' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Recommandations IA</Text>
                                <Text style={styles.sectionDescription}>
                                    Obtenez des recommandations personnalisées selon votre budget et préférences
                                </Text>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Budget maximum (FCFA)"
                                    value={budget}
                                    onChangeText={setBudget}
                                    keyboardType="numeric"
                                />

                                <TextInput
                                    style={styles.input}
                                    placeholder="Localisation recherchée *"
                                    value={location}
                                    onChangeText={setLocation}
                                />

                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Préférences (ex: proche école, parking, jardin...)"
                                    value={preferences}
                                    onChangeText={setPreferences}
                                    multiline
                                    numberOfLines={3}
                                />

                                <TouchableOpacity
                                    onPress={getRecommendations}
                                    disabled={!budget.trim() || !location.trim()}
                                    style={[
                                        styles.actionButton,
                                        (!budget.trim() || !location.trim()) && styles.actionButtonDisabled
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Obtenir recommandations</Text>
                                </TouchableOpacity>

                                {recommendationResult && (
                                    <View style={styles.resultCard}>
                                        <Text style={styles.resultTitle}>Raisonnement:</Text>
                                        <Text style={styles.resultText}>{recommendationResult.reasoning}</Text>
                                        <Text style={styles.resultSubtitle}>Biens recommandés:</Text>
                                        {recommendationResult.properties.map((property, index) => (
                                            <View key={index} style={styles.propertyCard}>
                                                <Text style={styles.propertyName}>{property.property_name}</Text>
                                                <Text style={styles.propertyPrice}>
                                                    {property.price.toLocaleString()} FCFA
                                                </Text>
                                                <Text style={styles.propertyLocation}>{property.location}</Text>
                                                <Text style={styles.propertyScore}>
                                                    Score: {property.match_score}/10
                                                </Text>
                                                {property.features.length > 0 && (
                                                    <Text style={styles.propertyFeatures}>
                                                        {property.features.join(', ')}
                                                    </Text>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Estimate Tab */}
                        {activeTab === 'estimate' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Estimation de prix IA</Text>
                                <Text style={styles.sectionDescription}>
                                    Estimez le prix d'un bien immobilier selon ses caractéristiques
                                </Text>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Type de bien (ex: Appartement, Maison, Studio...)"
                                    value={propertyType}
                                    onChangeText={setPropertyType}
                                />

                                <View style={styles.row}>
                                    <TextInput
                                        style={[styles.input, styles.inputHalf]}
                                        placeholder="Surface (m²) *"
                                        value={surface}
                                        onChangeText={setSurface}
                                        keyboardType="numeric"
                                    />
                                    <TextInput
                                        style={[styles.input, styles.inputHalf]}
                                        placeholder="Nombre de pièces"
                                        value={rooms}
                                        onChangeText={setRooms}
                                        keyboardType="numeric"
                                    />
                                </View>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Localisation *"
                                    value={locationEstimate}
                                    onChangeText={setLocationEstimate}
                                />

                                <TouchableOpacity
                                    onPress={estimatePrice}
                                    disabled={!propertyType.trim() || !surface.trim() || !locationEstimate.trim()}
                                    style={[
                                        styles.actionButton,
                                        (!propertyType.trim() || !surface.trim() || !locationEstimate.trim()) && styles.actionButtonDisabled
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Estimer le prix</Text>
                                </TouchableOpacity>

                                {estimateResult && (
                                    <View style={styles.resultCard}>
                                        <Text style={styles.resultTitle}>
                                            Prix estimé: {estimateResult.estimated_price.toLocaleString()} FCFA
                                        </Text>
                                        <Text style={styles.resultText}>
                                            Fourchette: {estimateResult.price_range.min.toLocaleString()} - {estimateResult.price_range.max.toLocaleString()} FCFA
                                        </Text>
                                        <Text style={styles.resultText}>
                                            Confiance: {(estimateResult.confidence * 100).toFixed(0)}%
                                        </Text>
                                        <Text style={styles.resultText}>
                                            {estimateResult.comparable_properties} biens comparables analysés
                                        </Text>
                                        <Text style={styles.resultSubtitle}>Facteurs d'influence:</Text>
                                        {estimateResult.factors.map((factor, index) => (
                                            <View key={index} style={styles.factorItem}>
                                                <Text style={styles.factorName}>{factor.factor}</Text>
                                                <Text style={styles.factorImpact}>{factor.impact}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Compare Tab */}
                        {activeTab === 'compare' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Comparer des biens</Text>
                                <Text style={styles.sectionDescription}>
                                    Comparez plusieurs biens pour prendre la meilleure décision
                                </Text>

                                <TextInput
                                    style={styles.input}
                                    placeholder="IDs des biens (séparés par des virgules, ex: 123, 456, 789)"
                                    value={propertyIds}
                                    onChangeText={setPropertyIds}
                                    keyboardType="numeric"
                                />

                                <TouchableOpacity
                                    onPress={compareProperties}
                                    disabled={!propertyIds.trim()}
                                    style={[styles.actionButton, !propertyIds.trim() && styles.actionButtonDisabled]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Comparer</Text>
                                </TouchableOpacity>

                                {comparisonResult && (
                                    <View style={styles.resultCard}>
                                        <Text style={styles.resultTitle}>Résumé:</Text>
                                        <Text style={styles.resultText}>{comparisonResult.summary}</Text>
                                        <Text style={styles.resultSubtitle}>Comparaison détaillée:</Text>
                                        {comparisonResult.properties.map((property, index) => (
                                            <View key={index} style={[
                                                styles.propertyCard,
                                                property.property_id === comparisonResult.winner && styles.winnerCard
                                            ]}>
                                                {property.property_id === comparisonResult.winner && (
                                                    <View style={styles.winnerBadge}>
                                                        <SafeIcon name="award" size={16} color="#FBBF24" type="lucide" />
                                                        <Text style={styles.winnerText}>Meilleur choix</Text>
                                                    </View>
                                                )}
                                                <Text style={styles.propertyName}>{property.property_name}</Text>
                                                <Text style={styles.propertyPrice}>
                                                    {property.price.toLocaleString()} FCFA
                                                </Text>
                                                <Text style={styles.propertyScore}>
                                                    Score: {property.score}/10
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Alerts Tab */}
                        {activeTab === 'alerts' && !loading && (
                            <View>
                                <Text style={styles.sectionTitle}>Alertes prix</Text>
                                <Text style={styles.sectionDescription}>
                                    Créez des alertes pour être notifié quand un bien correspond à vos critères
                                </Text>

                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Critères de recherche (ex: Appartement 3 pièces, Yaoundé, proche école...)"
                                    value={alertCriteria}
                                    onChangeText={setAlertCriteria}
                                    multiline
                                    numberOfLines={3}
                                />

                                <TextInput
                                    style={styles.input}
                                    placeholder="Prix maximum (FCFA)"
                                    value={alertPriceMax}
                                    onChangeText={setAlertPriceMax}
                                    keyboardType="numeric"
                                />

                                <TouchableOpacity
                                    onPress={createAlert}
                                    disabled={!alertCriteria.trim() || !alertPriceMax.trim()}
                                    style={[
                                        styles.actionButton,
                                        (!alertCriteria.trim() || !alertPriceMax.trim()) && styles.actionButtonDisabled
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.actionButtonText}>Créer une alerte</Text>
                                </TouchableOpacity>

                                {savedAlerts.length > 0 && (
                                    <View style={styles.resultCard}>
                                        <Text style={styles.resultSubtitle}>Mes alertes actives:</Text>
                                        {savedAlerts.map((alert, index) => (
                                            <View key={index} style={styles.alertCard}>
                                                <Text style={styles.alertCriteria}>{alert.criteria}</Text>
                                                <Text style={styles.alertPrice}>
                                                    Prix max: {alert.max_price.toLocaleString()} FCFA
                                                </Text>
                                                {alert.matches_count > 0 && (
                                                    <Text style={styles.alertMatches}>
                                                        {alert.matches_count} bien(s) correspondant(s)
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
        backgroundColor: '#EDE9FE',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    tabTextActive: {
        color: '#8B5CF6',
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
    inputHalf: {
        flex: 1,
        marginRight: 8,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    textArea: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    actionButton: {
        marginTop: 8,
        marginBottom: 20,
        backgroundColor: '#8B5CF6',
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
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginTop: 12,
    },
    resultTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    resultText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        marginBottom: 8,
    },
    resultSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 16,
        marginBottom: 8,
    },
    propertyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    winnerCard: {
        borderColor: '#FBBF24',
        borderWidth: 2,
    },
    winnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        gap: 4,
    },
    winnerText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
    },
    propertyName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    propertyPrice: {
        fontSize: 18,
        fontWeight: '700',
        color: '#8B5CF6',
        marginBottom: 4,
    },
    propertyLocation: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    propertyScore: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '600',
        marginTop: 4,
    },
    propertyFeatures: {
        fontSize: 12,
        color: '#374151',
        marginTop: 8,
        fontStyle: 'italic',
    },
    factorItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    factorName: {
        fontSize: 14,
        color: '#374151',
    },
    factorImpact: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B5CF6',
    },
    alertCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    alertCriteria: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    alertPrice: {
        fontSize: 14,
        color: '#8B5CF6',
        marginBottom: 4,
    },
    alertMatches: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '600',
        marginTop: 4,
    },
});

export default RealEstateAIFeatures;

