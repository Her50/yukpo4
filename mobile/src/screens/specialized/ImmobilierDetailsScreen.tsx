// ✅ REFONTE 2026-03-07: ImmobilierDetailsScreen → UX moderne
// Hero gradient indigo, galerie photos, caractéristiques, IA estimation/recommandations, simulation prêt, partage, pull-to-refresh
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import PropertyPhotoGallery from '../../components/specialized/PropertyPhotoGallery';
import { immobilierService, RealEstateProperty } from '../../services/immobilierService';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type RouteParams = { propertyId: number };

const ImmobilierDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute() as any;
    const propertyId = route.params?.propertyId;

    const [property, setProperty] = useState<RealEstateProperty | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [virtualTours, setVirtualTours] = useState<any[]>([]);
    // IA: Simulation prêt
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [loanDuration, setLoanDuration] = useState('20');
    const [loanDownPayment, setLoanDownPayment] = useState('10');
    const [loanMonthlyIncome, setLoanMonthlyIncome] = useState('');
    const [loanResult, setLoanResult] = useState<any>(null);
    const [loadingLoan, setLoadingLoan] = useState(false);
    // IA: Estimation prix
    const [priceEstimate, setPriceEstimate] = useState<any>(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    // IA: Recommandations
    const [aiRecommendation, setAiRecommendation] = useState<any>(null);
    const [loadingRecommendation, setLoadingRecommendation] = useState(false);

    useEffect(() => { if (propertyId) loadProperty(); }, [propertyId]);
    useEffect(() => { if (property) handleTrackView(); }, [property]);

    const loadProperty = async () => {
        if (!propertyId) return;
        try {
            setError(null);
            const response = await immobilierService.getPropertyDetails(propertyId);
            if (response.success && response.data) {
                setProperty((response as any).data);
                try { const fav = await immobilierService.getMyFavorites(); if (fav.success && fav.data) setIsFavorite(((fav.data as unknown) as any[]).some((p: any) => p.id === propertyId)); } catch { }
            } else { setError(t('immobilierDetails.bienNonTrouve')); }
        } catch (err: any) { setError(err.message || 'Erreur lors du chargement'); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadProperty(); setRefreshing(false); }, [propertyId]);

    const isHotelOrMeuble = property?.type_bien === 'hotel' || property?.type_bien === 'meuble';
    const handleBookVisit = () => {
        if (!property) return;
        if (isHotelOrMeuble) {
            (navigation as any).navigate('HotelBooking', {
                propertyId: property.id,
                propertyName: property.titre,
                typeBien: property.type_bien,
                prixNuitee: property.prix_location_mensuel || 0,
                ville: property.ville || '',
            });
        } else {
            (navigation as any).navigate('ImmobilierBooking', { propertyId: property.id, propertyName: property.titre });
        }
    };
    const handleSimulateLoan = () => { if (!property) return; setShowLoanModal(true); };

    const handleConfirmLoanSimulation = async () => {
        if (!property) return;
        try {
            setLoadingLoan(true);
            const response = await immobilierService.simulateLoan(property.id, parseFloat(loanDownPayment) || 10, parseInt(loanDuration) || 20, loanMonthlyIncome ? parseFloat(loanMonthlyIncome) : undefined);
            if (response.success && (response as any).simulation) { setLoanResult((response as any).simulation); }
            else {
                const price = property.prix_vente || 0;
                const apport = price * ((parseFloat(loanDownPayment) || 10) / 100);
                const montant = price - apport;
                const duration = parseInt(loanDuration) || 20;
                const rate = 5.5;
                const monthlyRate = rate / 100 / 12;
                const nbMonths = duration * 12;
                const mensualite = montant * (monthlyRate * Math.pow(1 + monthlyRate, nbMonths)) / (Math.pow(1 + monthlyRate, nbMonths) - 1);
                setLoanResult({ property_price: price, down_payment: Math.round(apport), loan_amount: Math.round(montant), interest_rate: rate, loan_duration_years: duration, monthly_payment: Math.round(mensualite), total_interest: Math.round(mensualite * nbMonths - montant), total_cost: Math.round(mensualite * nbMonths), affordability_analysis: 'Calcul local (le serveur n\t('immobilierDetailsScreen.aPasRepondu') });
            }
        } catch { Alert.alert('Erreur', 'Impossible de simuler le prêt'); }
        finally { setLoadingLoan(false); }
    };

    const handleAIPriceEstimate = async () => {
        if (!property) return;
        try {
            setLoadingEstimate(true);
            const response = await immobilierService.estimatePrice(property.type_bien || 'maison', property.superficie_m2 || 100, property.nb_chambres || 2, property.standing || 'Standard', property.quartier || '', property.ville || 'Douala');
            if (response.success && (response as any).estimate) setPriceEstimate((response as any).estimate);
            else Alert.alert('IA non disponible', 'L\'estimation IA n\'est pas encore opérationnelle.');
        } catch { Alert.alert('Erreur', 'Impossible d\'obtenir l\'estimation IA'); }
        finally { setLoadingEstimate(false); }
    };

    const handleAIRecommendations = async () => {
        if (!property) return;
        try {
            setLoadingRecommendation(true);
            const budget = property.prix_vente || property.prix_location_mensuel || 50000000;
            const response = await immobilierService.getAIRecommendations(budget * 1.2, property.type_bien, property.nb_chambres, property.quartier, property.ville || 'Douala');
            if (response.success && (response as any).recommendation) setAiRecommendation((response as any).recommendation);
            else Alert.alert('IA non disponible', 'Les recommandations IA ne sont pas encore opérationnelles.');
        } catch { Alert.alert('Erreur', 'Impossible d\'obtenir les recommandations IA'); }
        finally { setLoadingRecommendation(false); }
    };

    const handleToggleFavorite = async () => {
        if (!property) return;
        try {
            if (isFavorite) { await immobilierService.removeFromFavorites(property.id); setIsFavorite(false); }
            else { await immobilierService.addToFavorites(property.id); setIsFavorite(true); }
        } catch (err: any) { Alert.alert('Erreur', err.message || 'Erreur lors de la mise à jour'); }
    };

    const handleShare = async () => {
        if (!property) return;
        try {
            await Share.share({
                message: `${property.titre}${property.prix_vente ? '\nPrix: ' + formatPrice(property.prix_vente) : ''}${property.prix_location_mensuel ? '\nLoyer: ' + formatPrice(property.prix_location_mensuel) + '/mois' : ''}${property.quartier || property.ville ? '\n📍 ' + [property.quartier, property.ville].filter(Boolean).join(', ') : ''}\nVia Yukpo`,
                title: property.titre,
            });
        } catch { }
    };

    const handleTrackView = async () => { if (!property) return; try { await immobilierService.trackPropertyView(property.id, undefined, ['description'], 'details'); } catch { } };

    const formatPrice = (price?: number) => {
        if (!price) return 'Prix sur demande';
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M FCFA`;
        return `${(price / 1000).toFixed(0)}K FCFA`;
    };

    if (loading) return (<View style={st.center}><ActivityIndicator size="large" color="#6366F1" /><Text style={st.centerText}>{t('immobilierDetails.chargement')}</Text></View>);
    if (error || !property) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#6366F1" /><Text style={st.centerText}>{error || t('immobilierDetails.bienNonTrouve')}</Text><TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}><Text style={{ color: '#6366F1', fontWeight: '600' }}>Retour</Text></TouchableOpacity></View>);

    return (
        <View style={st.container}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6366F1']} />}>

                {/* Hero Gradient Header */}
                <LinearGradient colors={['#312E81', '#4F46E5', '#818CF8']} style={st.hero}>
                    <View style={st.heroTop}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={handleToggleFavorite} style={st.heroBtn}>
                                <SafeIcon name={isFavorite ? 'heart' : 'heart'} size={20} color={isFavorite ? '#EF4444' : '#fff'} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share" size={20} color="#fff" /></TouchableOpacity>
                        </View>
                    </View>
                    <View style={st.heroContent}>
                        <View style={st.heroIconWrap}><SafeIcon name="home" size={28} color="#6366F1" /></View>
                        <Text style={st.heroTitle} numberOfLines={2}>{property.titre}</Text>
                        {(property.quartier || property.ville) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                <SafeIcon name="map-pin" size={14} color="rgba(255,255,255,0.8)" />
                                <Text style={st.heroSub}>{[property.quartier, property.ville].filter(Boolean).join(', ')}</Text>
                            </View>
                        )}
                        <View style={st.heroBadges}>
                            {property.statut && (
                                <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}><Text style={st.badgeText}>{property.statut}</Text></View>
                            )}
                            {property.type_bien && (
                                <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><SafeIcon name="home" size={12} color="#fff" /><Text style={st.badgeText}>{property.type_bien}</Text></View>
                            )}
                            {property.standing && (
                                <View style={[st.badge, { backgroundColor: 'rgba(252,211,77,0.3)' }]}><SafeIcon name="star" size={12} color="#FCD34D" /><Text style={st.badgeText}>{property.standing}</Text></View>
                            )}
                        </View>
                        {/* Price display */}
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                            {property.prix_vente ? <Text style={st.heroPrice}>{formatPrice(property.prix_vente)}</Text> : null}
                            {property.prix_location_mensuel ? <Text style={st.heroPrice}>{formatPrice(property.prix_location_mensuel)}/mois</Text> : null}
                        </View>
                    </View>
                </LinearGradient>

                {/* Photo Gallery */}
                {(property.photos && property.photos.length > 0) || virtualTours.length > 0 ? (
                    <PropertyPhotoGallery photos={property.photos || []} virtualTours={virtualTours} />
                ) : (
                    <View style={{ height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', marginHorizontal: 16, marginTop: 12, borderRadius: 12 }}>
                        <SafeIcon name="image" size={40} color="#9CA3AF" />
                        <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 6 }}>{t('immobilierDetails.aucunePhoto')}</Text>
                    </View>
                )}

                {/* Quick Actions */}
                <View style={st.quickRow}>
                    {[
                        (property as any).telephone && { icon: 'phone', label: 'Appeler', color: '#6366F1', onPress: () => Linking.openURL(`tel:${(property as any).telephone}`) },
                        (property as any).whatsapp && { icon: 'message-circle', label: 'WhatsApp', color: '#25D366', onPress: () => Linking.openURL(`https://wa.me/${((property as any).whatsapp || '').replace(/[^0-9]/g, '')}`) },
                        { icon: isFavorite ? 'heart' : 'heart', label: isFavorite ? 'Favori ♥' : 'Favoris', color: '#EF4444', onPress: handleToggleFavorite },
                        { icon: 'share-2', label: t('immobilierDetailsScreen.partager'), color: '#8B5CF6', onPress: handleShare },
                    ].filter(Boolean).map((a: any, i) => (
                        <TouchableOpacity key={i} style={st.quickAction} onPress={a.onPress}>
                            <View style={[st.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon} size={20} color={a.color} /></View>
                            <Text style={st.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Characteristics Card */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="list" size={18} color="#6366F1" /><Text style={st.cardTitle}>{t('immobilierDetails.caracteristiques')}</Text></View>
                    <View style={st.detailsGrid}>
                        {property.type_bien && (<View style={st.detailItem}><SafeIcon name="home" size={20} color="#6366F1" /><Text style={st.detailLabel}>Type</Text><Text style={st.detailValue}>{property.type_bien}</Text></View>)}
                        {property.superficie_m2 && (<View style={st.detailItem}><SafeIcon name="maximize" size={20} color="#6366F1" /><Text style={st.detailLabel}>Superficie</Text><Text style={st.detailValue}>{property.superficie_m2} m²</Text></View>)}
                        {property.nb_chambres && (<View style={st.detailItem}><SafeIcon name="bed" size={20} color="#6366F1" /><Text style={st.detailLabel}>Chambres</Text><Text style={st.detailValue}>{property.nb_chambres}</Text></View>)}
                        {property.nb_salles_bain && (<View style={st.detailItem}><SafeIcon name="droplet" size={20} color="#6366F1" /><Text style={st.detailLabel}>Salles de bain</Text><Text style={st.detailValue}>{property.nb_salles_bain}</Text></View>)}
                    </View>
                </View>

                {/* Description */}
                {property.description && (
                    <View style={st.card}>
                        <View style={st.cardHeader}><SafeIcon name="file-text" size={18} color="#6366F1" /><Text style={st.cardTitle}>Description</Text></View>
                        <Text style={st.descText}>{property.description}</Text>
                    </View>
                )}

                {/* IA: Estimation prix */}
                <View style={[st.card, { borderLeftWidth: 3, borderLeftColor: '#059669' }]}>
                    <View style={st.cardHeader}><SafeIcon name="trending-up" size={18} color="#059669" /><Text style={st.cardTitle}>Estimation IA du prix</Text></View>
                    {priceEstimate ? (
                        <View>
                            <View style={st.estimateRow}><Text style={st.estimateLabel}>{t('immobilierDetails.prixEstime')}</Text><Text style={st.estimateValue}>{priceEstimate.estimated_price?.toLocaleString() || 'N/A'} FCFA</Text></View>
                            <View style={st.estimateRow}><Text style={st.estimateLabel}>Fourchette</Text><Text style={st.estimateSubvalue}>{(priceEstimate.price_range_min || 0).toLocaleString()} - {(priceEstimate.price_range_max || 0).toLocaleString()} FCFA</Text></View>
                            <View style={st.estimateRow}><Text style={st.estimateLabel}>Prix/m²</Text><Text style={st.estimateSubvalue}>{priceEstimate.price_per_m2?.toLocaleString() || 'N/A'} FCFA</Text></View>
                            {priceEstimate.confidence_level && (<View style={st.confBadge}><Text style={st.confText}>Confiance: {Math.round(priceEstimate.confidence_level * 100)}%</Text></View>)}
                            {priceEstimate.reasoning && (<Text style={st.reasoningText}>{priceEstimate.reasoning}</Text>)}
                        </View>
                    ) : (
                        <TouchableOpacity style={st.aiBtn} onPress={handleAIPriceEstimate} disabled={loadingEstimate}>
                            {loadingEstimate ? <ActivityIndicator size="small" color="#059669" /> : <SafeIcon name="zap" size={16} color="#059669" />}
                            <Text style={st.aiBtnText}>{loadingEstimate ? 'Analyse en cours...' : 'Obtenir estimation IA'}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* IA: Recommandations */}
                <View style={[st.card, { borderLeftWidth: 3, borderLeftColor: '#8B5CF6' }]}>
                    <View style={st.cardHeader}><SafeIcon name="compass" size={18} color="#8B5CF6" /><Text style={st.cardTitle}>Recommandations IA</Text></View>
                    {aiRecommendation ? (
                        <View>
                            {aiRecommendation.recommendations && (<Text style={st.recText}>{aiRecommendation.recommendations}</Text>)}
                            {aiRecommendation.budget_analysis && (<View style={st.analysisBlock}><Text style={st.analysisTitle}>Analyse budget</Text><Text style={st.analysisText}>{aiRecommendation.budget_analysis}</Text></View>)}
                            {aiRecommendation.location_analysis && (<View style={st.analysisBlock}><Text style={st.analysisTitle}>Analyse localisation</Text><Text style={st.analysisText}>{aiRecommendation.location_analysis}</Text></View>)}
                            {aiRecommendation.investment_potential && (<View style={st.analysisBlock}><Text style={st.analysisTitle}>Potentiel d'investissement</Text><Text style={st.analysisText}>{aiRecommendation.investment_potential}</Text></View>)}
                        </View>
                    ) : (
                        <TouchableOpacity style={[st.aiBtn, { borderColor: '#8B5CF6' }]} onPress={handleAIRecommendations} disabled={loadingRecommendation}>
                            {loadingRecommendation ? <ActivityIndicator size="small" color="#8B5CF6" /> : <SafeIcon name="compass" size={16} color="#8B5CF6" />}
                            <Text style={[st.aiBtnText, { color: '#8B5CF6' }]}>{loadingRecommendation ? 'Analyse en cours...' : 'Obtenir recommandations IA'}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Action Buttons */}
                <View style={{ paddingHorizontal: 16, gap: 10, marginBottom: 12 }}>
                    <TouchableOpacity style={st.primaryBtn} onPress={handleBookVisit}>
                        <SafeIcon name={isHotelOrMeuble ? 'bed' : 'calendar'} size={20} color="#fff" />
                        <Text style={st.primaryBtnText}>{isHotelOrMeuble ? t('immobilierDetailsScreen.reserverUnSejour') : 'Réserver une visite'}</Text>
                    </TouchableOpacity>
                    {property.prix_vente && (
                        <TouchableOpacity style={[st.primaryBtn, { backgroundColor: '#4F46E5' }]} onPress={handleSimulateLoan}>
                            <SafeIcon name="calculator" size={20} color="#fff" />
                            <Text style={st.primaryBtnText}>{t('immobilierDetails.simulerUnPret')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Loan Simulation Modal */}
            <Modal animationType="slide" transparent visible={showLoanModal} onRequestClose={() => setShowLoanModal(false)}>
                <View style={st.modalBg}>
                    <ScrollView style={st.modalContainer} contentContainerStyle={st.modalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View>
                                <Text style={st.modalTitle}>{t('immobilierDetails.simulationDePret')}</Text>
                                <Text style={st.modalSub}>{property.titre} - {formatPrice(property.prix_vente)}</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setShowLoanModal(false); setLoanResult(null); }} style={{ padding: 4 }}><SafeIcon name="x" size={24} color="#6B7280" /></TouchableOpacity>
                        </View>

                        <View style={st.loanGroup}><Text style={st.loanLabel}>Apport personnel (%)</Text><TextInput style={st.loanInput} value={loanDownPayment} onChangeText={setLoanDownPayment} keyboardType="numeric" placeholder="10" placeholderTextColor="#9CA3AF" /></View>
                        <View style={st.loanGroup}><Text style={st.loanLabel}>{t('immobilierDetails.dureeAnnees')}</Text><TextInput style={st.loanInput} value={loanDuration} onChangeText={setLoanDuration} keyboardType="numeric" placeholder="20" placeholderTextColor="#9CA3AF" /></View>
                        <View style={st.loanGroup}><Text style={st.loanLabel}>{t('immobilierDetails.revenuMensuelOptionnelFcfa')}/Text><TextInput style={st.loanInput} value={loanMonthlyIncome} onChangeText={setLoanMonthlyIncome} keyboardType="numeric" placeholder="500000" placeholderTextColor="#9CA3AF" /></View>

                        {!loanResult ? (
                            <TouchableOpacity style={st.primaryBtn} onPress={handleConfirmLoanSimulation} disabled={loadingLoan}>
                                {loadingLoan ? <ActivityIndicator color="#fff" /> : <SafeIcon name="calculator" size={18} color="#fff" />}
                                <Text style={st.primaryBtnText}>{loadingLoan ? 'Calcul...' : 'Simuler'}</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={st.loanResult}>
                                <Text style={st.loanResultTitle}>{t('immobilierDetails.resultat')}</Text>
                                <View style={st.loanRow}><Text style={st.loanRowLabel}>{t('immobilierDetails.montantEmprunte')}</Text><Text style={st.loanRowVal}>{loanResult.loan_amount?.toLocaleString()} FCFA</Text></View>
                                <View style={st.loanRow}><Text style={st.loanRowLabel}>Apport</Text><Text style={st.loanRowVal}>{loanResult.down_payment?.toLocaleString()} FCFA</Text></View>
                                <View style={st.loanRow}><Text style={st.loanRowLabel}>Taux</Text><Text style={st.loanRowVal}>{loanResult.interest_rate}%</Text></View>
                                <View style={[st.loanRow, st.loanHighlight]}><Text style={st.loanHighlightLabel}>{t('immobilierDetails.mensualite')}</Text><Text style={st.loanHighlightVal}>{loanResult.monthly_payment?.toLocaleString()} FCFA/mois</Text></View>
                                <View style={st.loanRow}><Text style={st.loanRowLabel}>{t('immobilierDetails.coutTotal')}</Text><Text style={st.loanRowVal}>{loanResult.total_cost?.toLocaleString()} FCFA</Text></View>
                                <View style={st.loanRow}><Text style={st.loanRowLabel}>{t('immobilierDetails.totalInterets')}</Text><Text style={[st.loanRowVal, { color: '#EF4444' }]}>{loanResult.total_interest?.toLocaleString()} FCFA</Text></View>
                                {loanResult.affordability_analysis && (<Text style={st.loanAnalysis}>{loanResult.affordability_analysis}</Text>)}
                                {loanResult.recommendations && (<Text style={st.loanRec}>{loanResult.recommendations}</Text>)}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#EEF2FF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF2FF' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280', textAlign: 'center' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
    heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    heroPrice: { fontSize: 22, fontWeight: '800', color: '#FCD34D' },
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    // Quick actions
    quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    quickAction: { alignItems: 'center', width: 64 },
    quickIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    quickLabel: { fontSize: 11, color: '#374151', textAlign: 'center', fontWeight: '500' },
    // Card
    card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
    // Details grid
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    detailItem: { flex: 1, minWidth: '45%' as any, alignItems: 'center', padding: 12, backgroundColor: '#EEF2FF', borderRadius: 10 },
    detailLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
    detailValue: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 2 },
    descText: { fontSize: 14, color: '#374151', lineHeight: 22 },
    // IA Estimation
    estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    estimateLabel: { fontSize: 13, color: '#6B7280' },
    estimateValue: { fontSize: 17, fontWeight: '700', color: '#059669' },
    estimateSubvalue: { fontSize: 13, fontWeight: '600', color: '#111827' },
    confBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 12 },
    confText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },
    reasoningText: { marginTop: 8, fontSize: 13, color: '#6B7280', fontStyle: 'italic', lineHeight: 20 },
    recText: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },
    analysisBlock: { marginTop: 8, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 8 },
    analysisTitle: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 4 },
    analysisText: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
    // AI buttons
    aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#059669', backgroundColor: '#F0FDF4' },
    aiBtnText: { fontSize: 14, fontWeight: '600', color: '#059669' },
    // Primary buttons
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#6366F1', padding: 16, borderRadius: 14, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
    modalContent: { padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    modalSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    loanGroup: { marginBottom: 14 },
    loanLabel: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
    loanInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 16, color: '#111827', backgroundColor: '#F9FAFB' },
    loanResult: { marginTop: 16, padding: 16, backgroundColor: '#F0FDF4', borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' },
    loanResultTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
    loanRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    loanRowLabel: { fontSize: 13, color: '#6B7280' },
    loanRowVal: { fontSize: 13, fontWeight: '600', color: '#111827' },
    loanHighlight: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, borderRadius: 6, marginVertical: 4 },
    loanHighlightLabel: { fontSize: 15, fontWeight: '700', color: '#059669' },
    loanHighlightVal: { fontSize: 15, fontWeight: '700', color: '#059669' },
    loanAnalysis: { marginTop: 10, fontSize: 13, color: '#374151', lineHeight: 20 },
    loanRec: { marginTop: 6, fontSize: 13, color: '#6B7280', fontStyle: 'italic', lineHeight: 20 },
});

export default ImmobilierDetailsScreen;
