// ✅ Écran de détails d'un bien immobilier
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import PropertyPhotoGallery from '../../components/specialized/PropertyPhotoGallery';
import { immobilierService, RealEstateProperty } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';

type RouteParams = {
    propertyId: number;
};

const ImmobilierDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const propertyId = route.params?.propertyId;

    const [property, setProperty] = useState<RealEstateProperty | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [virtualTours, setVirtualTours] = useState<any[]>([]);
    // ✅ IA: Simulation prêt
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [loanDuration, setLoanDuration] = useState('20');
    const [loanDownPayment, setLoanDownPayment] = useState('10');
    const [loanMonthlyIncome, setLoanMonthlyIncome] = useState('');
    const [loanResult, setLoanResult] = useState<any>(null);
    const [loadingLoan, setLoadingLoan] = useState(false);
    // ✅ IA: Estimation prix
    const [priceEstimate, setPriceEstimate] = useState<any>(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    // ✅ IA: Recommandations
    const [aiRecommendation, setAiRecommendation] = useState<any>(null);
    const [loadingRecommendation, setLoadingRecommendation] = useState(false);

    useEffect(() => {
        if (propertyId) {
            loadProperty();
        }
    }, [propertyId]);

    const loadProperty = async () => {
        if (!propertyId) return;
        try {
            setError(null);
            const response = await immobilierService.getPropertyDetails(propertyId);
            if (response.success && response.data) {
                setProperty(response.data);
                try {
                    const favoritesResponse = await immobilierService.getMyFavorites();
                    if (favoritesResponse.success && favoritesResponse.data) {
                        const isFav = favoritesResponse.data.some((p) => p.id === propertyId);
                        setIsFavorite(isFav);
                    }
                } catch (e) {
                    // Ignorer l'erreur de favoris
                }
            } else {
                setError('Bien non trouvé');
            }
        } catch (err: any) {
            console.error('[ImmobilierDetailsScreen] Erreur:', err);
            setError(err.message || 'Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const handleBookVisit = () => {
        if (!property) return;
        (navigation as any).navigate('ImmobilierBooking', {
            propertyId: property.id,
            propertyName: property.titre,
        });
    };

    const handleSimulateLoan = () => {
        if (!property) return;
        setShowLoanModal(true);
    };

    const handleConfirmLoanSimulation = async () => {
        if (!property) return;
        try {
            setLoadingLoan(true);
            const response = await immobilierService.simulateLoan(
                property.id,
                parseFloat(loanDownPayment) || 10,
                parseInt(loanDuration) || 20,
                loanMonthlyIncome ? parseFloat(loanMonthlyIncome) : undefined
            );
            if (response.success && (response as any).simulation) {
                setLoanResult((response as any).simulation);
            } else {
                // Fallback: calcul local
                const price = property.prix_vente || 0;
                const apport = price * ((parseFloat(loanDownPayment) || 10) / 100);
                const montant = price - apport;
                const duration = parseInt(loanDuration) || 20;
                const rate = 5.5;
                const monthlyRate = rate / 100 / 12;
                const nbMonths = duration * 12;
                const mensualite = montant * (monthlyRate * Math.pow(1 + monthlyRate, nbMonths)) / (Math.pow(1 + monthlyRate, nbMonths) - 1);
                setLoanResult({
                    property_price: price,
                    down_payment: Math.round(apport),
                    loan_amount: Math.round(montant),
                    interest_rate: rate,
                    loan_duration_years: duration,
                    monthly_payment: Math.round(mensualite),
                    total_interest: Math.round(mensualite * nbMonths - montant),
                    total_cost: Math.round(mensualite * nbMonths),
                    affordability_analysis: 'Calcul local (le serveur n\'a pas répondu)',
                });
            }
        } catch (error: any) {
            console.warn('[ImmobilierDetails] Erreur simulation prêt:', error);
            Alert.alert('Erreur', 'Impossible de simuler le prêt');
        } finally {
            setLoadingLoan(false);
        }
    };

    // ✅ IA: Estimation prix
    const handleAIPriceEstimate = async () => {
        if (!property) return;
        try {
            setLoadingEstimate(true);
            const response = await immobilierService.estimatePrice(
                property.type_bien || 'maison',
                property.superficie_m2 || 100,
                property.nb_chambres || 2,
                property.standing || 'Standard',
                property.quartier || '',
                property.ville || 'Douala'
            );
            if (response.success && (response as any).estimate) {
                setPriceEstimate((response as any).estimate);
            } else {
                Alert.alert('IA non disponible', 'L\'estimation IA n\'est pas encore opérationnelle pour ce bien.');
            }
        } catch (error: any) {
            console.warn('[ImmobilierDetails] Erreur estimation IA:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir l\'estimation IA');
        } finally {
            setLoadingEstimate(false);
        }
    };

    // ✅ IA: Recommandations personnalisées
    const handleAIRecommendations = async () => {
        if (!property) return;
        try {
            setLoadingRecommendation(true);
            const budget = property.prix_vente || property.prix_location_mensuel || 50000000;
            const response = await immobilierService.getAIRecommendations(
                budget * 1.2,
                property.type_bien,
                property.nb_chambres,
                property.quartier,
                property.ville || 'Douala'
            );
            if (response.success && (response as any).recommendation) {
                setAiRecommendation((response as any).recommendation);
            } else {
                Alert.alert('IA non disponible', 'Les recommandations IA ne sont pas encore opérationnelles.');
            }
        } catch (error: any) {
            console.warn('[ImmobilierDetails] Erreur recommandations IA:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir les recommandations IA');
        } finally {
            setLoadingRecommendation(false);
        }
    };

    const handleToggleFavorite = async () => {
        if (!property) return;
        try {
            if (isFavorite) {
                await immobilierService.removeFromFavorites(property.id);
                setIsFavorite(false);
                Alert.alert('Succès', 'Bien retiré des favoris');
            } else {
                await immobilierService.addToFavorites(property.id);
                setIsFavorite(true);
                Alert.alert('Succès', 'Bien ajouté aux favoris');
            }
        } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Erreur lors de la mise à jour');
        }
    };

    const handleShare = async () => {
        if (!property) return;
        try {
            const response = await immobilierService.shareProperty(property.id, 'link');
            if (response.success && response.share_url) {
                Alert.alert(
                    'Partage',
                    `Lien de partage : ${response.share_url}`,
                    [{ text: 'OK' }]
                );
            }
        } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Erreur lors du partage');
        }
    };

    const handleTrackView = async () => {
        if (!property) return;
        try {
            await immobilierService.trackPropertyView(property.id, undefined, ['description'], 'details');
        } catch (e) {
            // Ignorer les erreurs de tracking
        }
    };

    useEffect(() => {
        if (property) {
            handleTrackView();
        }
    }, [property]);

    const formatPrice = (price?: number) => {
        if (!price) return 'Prix sur demande';
        if (price >= 1000000) {
            return `${(price / 1000000).toFixed(1)}M FCFA`;
        }
        return `${(price / 1000).toFixed(0)}K FCFA`;
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (error || !property) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error || 'Bien non trouvé'}</Text>
                <NativeButton
                    title="Retour"
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Header avec actions */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerActionButton}
                        onPress={handleToggleFavorite}
                    >
                        <SafeIcon
                            name={isFavorite ? 'heart' : 'heart-outline'}
                            size={24}
                            color={isFavorite ? '#EF4444' : '#6B7280'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerActionButton}
                        onPress={handleShare}
                    >
                        <SafeIcon name="share-2" size={24} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                {/* Galerie photos avec visites virtuelles */}
                {(property.photos && property.photos.length > 0) || virtualTours.length > 0 ? (
                    <PropertyPhotoGallery
                        photos={property.photos || []}
                        virtualTours={virtualTours}
                    />
                ) : (
                    <View style={styles.imageContainer}>
                        <SafeIcon name="image" size={64} color="#9CA3AF" />
                        <Text style={styles.noPhotoText}>Aucune photo disponible</Text>
                    </View>
                )}

                <View style={styles.content}>
                    {/* Titre et statut */}
                    <View style={styles.header}>
                        <Text style={styles.title}>{property.titre}</Text>
                        <Text style={styles.statut}>{property.statut}</Text>
                    </View>

                    {/* Prix */}
                    <View style={styles.priceSection}>
                        {property.prix_vente && (
                            <Text style={styles.price}>{formatPrice(property.prix_vente)}</Text>
                        )}
                        {property.prix_location_mensuel && (
                            <Text style={styles.price}>
                                {formatPrice(property.prix_location_mensuel)}/mois
                            </Text>
                        )}
                    </View>

                    {/* Caractéristiques */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Caractéristiques</Text>
                        <View style={styles.detailsGrid}>
                            {property.type_bien && (
                                <View style={styles.detailItem}>
                                    <SafeIcon name="home" size={20} color={modernColors.primary} />
                                    <Text style={styles.detailLabel}>Type</Text>
                                    <Text style={styles.detailValue}>{property.type_bien}</Text>
                                </View>
                            )}
                            {property.superficie_m2 && (
                                <View style={styles.detailItem}>
                                    <SafeIcon name="maximize" size={20} color={modernColors.primary} />
                                    <Text style={styles.detailLabel}>Superficie</Text>
                                    <Text style={styles.detailValue}>{property.superficie_m2} m²</Text>
                                </View>
                            )}
                            {property.nb_chambres && (
                                <View style={styles.detailItem}>
                                    <SafeIcon name="bed" size={20} color={modernColors.primary} />
                                    <Text style={styles.detailLabel}>Chambres</Text>
                                    <Text style={styles.detailValue}>{property.nb_chambres}</Text>
                                </View>
                            )}
                            {property.nb_salles_bain && (
                                <View style={styles.detailItem}>
                                    <SafeIcon name="droplet" size={20} color={modernColors.primary} />
                                    <Text style={styles.detailLabel}>Salles de bain</Text>
                                    <Text style={styles.detailValue}>{property.nb_salles_bain}</Text>
                                </View>
                            )}
                        </View>
                        {property.standing && (
                            <View style={styles.standingBadge}>
                                <Text style={styles.standingText}>{property.standing}</Text>
                            </View>
                        )}
                    </View>

                    {/* Localisation */}
                    {(property.quartier || property.ville) && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Localisation</Text>
                            <View style={styles.locationRow}>
                                <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                                <Text style={styles.locationText}>
                                    {[property.quartier, property.ville].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Description */}
                    {property.description && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Description</Text>
                            <Text style={styles.description}>{property.description}</Text>
                        </View>
                    )}

                    {/* ✅ IA: Estimation prix */}
                    <NativeCard style={styles.iaCard}>
                        <Text style={styles.sectionTitle}>Estimation IA du prix</Text>
                        {priceEstimate ? (
                            <View>
                                <View style={styles.estimateRow}>
                                    <Text style={styles.estimateLabel}>Prix estimé</Text>
                                    <Text style={styles.estimateValue}>
                                        {priceEstimate.estimated_price?.toLocaleString() || 'N/A'} FCFA
                                    </Text>
                                </View>
                                <View style={styles.estimateRow}>
                                    <Text style={styles.estimateLabel}>Fourchette</Text>
                                    <Text style={styles.estimateSubvalue}>
                                        {(priceEstimate.price_range_min || 0).toLocaleString()} - {(priceEstimate.price_range_max || 0).toLocaleString()} FCFA
                                    </Text>
                                </View>
                                <View style={styles.estimateRow}>
                                    <Text style={styles.estimateLabel}>Prix/m²</Text>
                                    <Text style={styles.estimateSubvalue}>
                                        {priceEstimate.price_per_m2?.toLocaleString() || 'N/A'} FCFA
                                    </Text>
                                </View>
                                {priceEstimate.confidence_level && (
                                    <View style={styles.confidenceBadge}>
                                        <Text style={styles.confidenceText}>Confiance: {Math.round(priceEstimate.confidence_level * 100)}%</Text>
                                    </View>
                                )}
                                {priceEstimate.reasoning && (
                                    <Text style={styles.reasoningText}>{priceEstimate.reasoning}</Text>
                                )}
                            </View>
                        ) : (
                            <NativeButton
                                title={loadingEstimate ? 'Analyse en cours...' : 'Obtenir estimation IA'}
                                onPress={handleAIPriceEstimate}
                                variant="outline"
                                disabled={loadingEstimate}
                            />
                        )}
                    </NativeCard>

                    {/* ✅ IA: Recommandations */}
                    <NativeCard style={styles.iaCard}>
                        <Text style={styles.sectionTitle}>Recommandations IA</Text>
                        {aiRecommendation ? (
                            <View>
                                {aiRecommendation.recommendations && (
                                    <Text style={styles.recommendationText}>{aiRecommendation.recommendations}</Text>
                                )}
                                {aiRecommendation.budget_analysis && (
                                    <View style={styles.analysisBlock}>
                                        <Text style={styles.analysisTitle}>Analyse budget</Text>
                                        <Text style={styles.analysisText}>{aiRecommendation.budget_analysis}</Text>
                                    </View>
                                )}
                                {aiRecommendation.location_analysis && (
                                    <View style={styles.analysisBlock}>
                                        <Text style={styles.analysisTitle}>Analyse localisation</Text>
                                        <Text style={styles.analysisText}>{aiRecommendation.location_analysis}</Text>
                                    </View>
                                )}
                                {aiRecommendation.investment_potential && (
                                    <View style={styles.analysisBlock}>
                                        <Text style={styles.analysisTitle}>Potentiel d'investissement</Text>
                                        <Text style={styles.analysisText}>{aiRecommendation.investment_potential}</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <NativeButton
                                title={loadingRecommendation ? 'Analyse en cours...' : 'Obtenir recommandations IA'}
                                onPress={handleAIRecommendations}
                                variant="outline"
                                disabled={loadingRecommendation}
                            />
                        )}
                    </NativeCard>

                    {/* Actions */}
                    <View style={styles.actionsSection}>
                        <NativeButton
                            title="Réserver une visite"
                            onPress={handleBookVisit}
                            style={styles.actionButton}
                        />
                        {property.prix_vente && (
                            <NativeButton
                                title="Simuler un prêt"
                                onPress={handleSimulateLoan}
                                style={[styles.actionButton, styles.secondaryButton]}
                            />
                        )}
                    </View>

                    {/* Contact */}
                    <View style={styles.contactSection}>
                        <Text style={styles.sectionTitle}>Contact</Text>
                        <View style={styles.contactRow}>
                            {(property as any).telephone && (
                                <TouchableOpacity
                                    style={styles.contactButton}
                                    onPress={() => Linking.openURL(`tel:${(property as any).telephone}`)}
                                >
                                    <SafeIcon name="phone" size={24} color={modernColors.primary} />
                                    <Text style={styles.contactButtonText}>Appeler</Text>
                                </TouchableOpacity>
                            )}
                            {(property as any).whatsapp && (
                                <TouchableOpacity
                                    style={[styles.contactButton, styles.whatsappButton]}
                                    onPress={() => {
                                        const whatsappNumber = ((property as any).whatsapp || '').replace(/[^0-9]/g, '');
                                        Linking.openURL(`https://wa.me/${whatsappNumber}`);
                                    }}
                                >
                                    <SafeIcon name="message-circle" size={24} color="#25D366" />
                                    <Text style={[styles.contactButtonText, styles.whatsappText]}>WhatsApp</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* ✅ Modal Simulation Prêt */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showLoanModal}
                onRequestClose={() => setShowLoanModal(false)}
            >
                <View style={styles.modalBackground}>
                    <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalScrollContent}>
                        <Text style={styles.modalTitle}>Simulation de prêt immobilier</Text>
                        {property && (
                            <Text style={styles.modalSubtitle}>
                                {property.titre} - {formatPrice(property.prix_vente)}
                            </Text>
                        )}

                        <View style={styles.loanInputGroup}>
                            <Text style={styles.loanInputLabel}>Apport personnel (%)</Text>
                            <TextInput
                                style={styles.loanInput}
                                value={loanDownPayment}
                                onChangeText={setLoanDownPayment}
                                keyboardType="numeric"
                                placeholder="10"
                            />
                        </View>

                        <View style={styles.loanInputGroup}>
                            <Text style={styles.loanInputLabel}>Durée (années)</Text>
                            <TextInput
                                style={styles.loanInput}
                                value={loanDuration}
                                onChangeText={setLoanDuration}
                                keyboardType="numeric"
                                placeholder="20"
                            />
                        </View>

                        <View style={styles.loanInputGroup}>
                            <Text style={styles.loanInputLabel}>Revenu mensuel (optionnel, FCFA)</Text>
                            <TextInput
                                style={styles.loanInput}
                                value={loanMonthlyIncome}
                                onChangeText={setLoanMonthlyIncome}
                                keyboardType="numeric"
                                placeholder="500000"
                            />
                        </View>

                        {!loanResult ? (
                            <NativeButton
                                title={loadingLoan ? 'Calcul en cours...' : 'Simuler'}
                                onPress={handleConfirmLoanSimulation}
                                disabled={loadingLoan}
                            />
                        ) : (
                            <View style={styles.loanResultContainer}>
                                <Text style={styles.loanResultTitle}>Résultat de la simulation</Text>
                                <View style={styles.loanResultRow}>
                                    <Text style={styles.loanResultLabel}>Montant emprunté</Text>
                                    <Text style={styles.loanResultValue}>
                                        {loanResult.loan_amount?.toLocaleString()} FCFA
                                    </Text>
                                </View>
                                <View style={styles.loanResultRow}>
                                    <Text style={styles.loanResultLabel}>Apport</Text>
                                    <Text style={styles.loanResultValue}>
                                        {loanResult.down_payment?.toLocaleString()} FCFA
                                    </Text>
                                </View>
                                <View style={styles.loanResultRow}>
                                    <Text style={styles.loanResultLabel}>Taux d'intérêt</Text>
                                    <Text style={styles.loanResultValue}>
                                        {loanResult.interest_rate}%
                                    </Text>
                                </View>
                                <View style={[styles.loanResultRow, styles.loanResultHighlight]}>
                                    <Text style={styles.loanResultLabelBold}>Mensualité</Text>
                                    <Text style={styles.loanResultValueBold}>
                                        {loanResult.monthly_payment?.toLocaleString()} FCFA/mois
                                    </Text>
                                </View>
                                <View style={styles.loanResultRow}>
                                    <Text style={styles.loanResultLabel}>Coût total</Text>
                                    <Text style={styles.loanResultValue}>
                                        {loanResult.total_cost?.toLocaleString()} FCFA
                                    </Text>
                                </View>
                                <View style={styles.loanResultRow}>
                                    <Text style={styles.loanResultLabel}>Total intérêts</Text>
                                    <Text style={[styles.loanResultValue, { color: '#EF4444' }]}>
                                        {loanResult.total_interest?.toLocaleString()} FCFA
                                    </Text>
                                </View>
                                {loanResult.affordability_analysis && (
                                    <Text style={styles.loanAnalysis}>
                                        {loanResult.affordability_analysis}
                                    </Text>
                                )}
                                {loanResult.recommendations && (
                                    <Text style={styles.loanRecommendations}>
                                        {loanResult.recommendations}
                                    </Text>
                                )}
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <NativeButton
                                title="Fermer"
                                onPress={() => {
                                    setShowLoanModal(false);
                                    setLoanResult(null);
                                }}
                                variant="ghost"
                            />
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    imageContainer: {
        width: '100%',
        height: 300,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    noPhotoText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    headerActions: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        flexDirection: 'row',
        gap: 8,
    },
    headerActionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    content: {
        padding: 16,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    statut: {
        fontSize: 16,
        color: '#6B7280',
    },
    priceSection: {
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    price: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.primary,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 12,
    },
    detailItem: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    detailLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginTop: 4,
    },
    standingBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
    },
    standingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F59E0B',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    locationText: {
        fontSize: 16,
        color: '#6B7280',
    },
    description: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
    },
    actionsSection: {
        marginTop: 8,
        marginBottom: 24,
        gap: 12,
    },
    actionButton: {
        marginBottom: 0,
    },
    secondaryButton: {
        backgroundColor: '#6366F1',
    },
    contactSection: {
        marginTop: 8,
    },
    contactRow: {
        flexDirection: 'row',
        gap: 12,
    },
    contactButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        gap: 8,
    },
    whatsappButton: {
        backgroundColor: '#DCFCE7',
    },
    contactButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    whatsappText: {
        color: '#25D366',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    backButton: {
        marginTop: 24,
    },
    // ✅ IA Cards
    iaCard: {
        padding: 16,
        marginBottom: 16,
    },
    estimateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    estimateLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    estimateValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#059669',
    },
    estimateSubvalue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    confidenceBadge: {
        alignSelf: 'flex-start',
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
    },
    confidenceText: {
        fontSize: 12,
        color: '#1D4ED8',
        fontWeight: '600',
    },
    reasoningText: {
        marginTop: 10,
        fontSize: 13,
        color: '#6B7280',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    recommendationText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 22,
        marginBottom: 12,
    },
    analysisBlock: {
        marginTop: 10,
        padding: 10,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    analysisTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    analysisText: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 20,
    },
    // ✅ Modal Prêt
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
    },
    modalScrollContent: {
        padding: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
    },
    modalActions: {
        marginTop: 16,
        alignItems: 'center',
    },
    loanInputGroup: {
        marginBottom: 14,
    },
    loanInputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    loanInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#111827',
        backgroundColor: '#F9FAFB',
    },
    loanResultContainer: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    loanResultTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    loanResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    loanResultHighlight: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        borderRadius: 6,
        marginVertical: 4,
    },
    loanResultLabel: {
        fontSize: 13,
        color: '#6B7280',
    },
    loanResultValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    loanResultLabelBold: {
        fontSize: 15,
        fontWeight: '700',
        color: '#059669',
    },
    loanResultValueBold: {
        fontSize: 15,
        fontWeight: '700',
        color: '#059669',
    },
    loanAnalysis: {
        marginTop: 12,
        fontSize: 13,
        color: '#374151',
        lineHeight: 20,
    },
    loanRecommendations: {
        marginTop: 8,
        fontSize: 13,
        color: '#6B7280',
        fontStyle: 'italic',
        lineHeight: 20,
    },
});

export default ImmobilierDetailsScreen;
