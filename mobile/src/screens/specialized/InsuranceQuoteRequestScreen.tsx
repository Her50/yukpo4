// ✅ Écran de demande de devis Assurance IA
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import assuranceService, { InsuranceProfile, InsuranceQuote } from '../../services/assuranceService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

const TYPES_ASSURANCE = ['Auto', 'Santé', 'Habitation', 'Vie', 'Voyage', 'Professionnelle', 'Responsabilité civile'];
const SITUATIONS_FAMILIALES = ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve', 'Union libre'];

const InsuranceQuoteRequestScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as { typeAssurance?: string; compagnie?: string; ville?: string } | undefined;

    const [typeAssurance, setTypeAssurance] = useState(params?.typeAssurance || '');
    const [age, setAge] = useState('');
    const [profession, setProfession] = useState('');
    const [ville, setVille] = useState(params?.ville || '');
    const [situationFamiliale, setSituationFamiliale] = useState('');
    const [nombrePersonnes, setNombrePersonnes] = useState('1');
    const [budgetMensuel, setBudgetMensuel] = useState('');
    const [vehiculeType, setVehiculeType] = useState('');
    const [vehiculeValeur, setVehiculeValeur] = useState('');
    const [bienType, setBienType] = useState('');
    const [bienValeur, setBienValeur] = useState('');
    const [loading, setLoading] = useState(false);
    const [quote, setQuote] = useState<InsuranceQuote | null>(null);
    const [showResults, setShowResults] = useState(false);

    const handleGenerateQuote = async () => {
        if (!typeAssurance) {
            Alert.alert('Attention', 'Veuillez sélectionner un type d\'assurance');
            return;
        }

        hapticPress();
        setLoading(true);
        setShowResults(false);

        try {
            const profile: InsuranceProfile = {};
            if (age) profile.age = parseInt(age);
            if (profession) profile.profession = profession;
            if (ville) profile.ville = ville;
            if (situationFamiliale) profile.situation_familiale = situationFamiliale;
            if (nombrePersonnes) profile.nombre_personnes = parseInt(nombrePersonnes);
            if (budgetMensuel) profile.budget_mensuel = parseFloat(budgetMensuel);
            if (vehiculeType) profile.vehicule_type = vehiculeType;
            if (vehiculeValeur) profile.vehicule_valeur = parseFloat(vehiculeValeur);
            if (bienType) profile.bien_immobilier_type = bienType;
            if (bienValeur) profile.bien_immobilier_valeur = parseFloat(bienValeur);

            const result = await assuranceService.generateQuote(typeAssurance, profile);

            if (result) {
                setQuote(result);
                setShowResults(true);
            } else {
                Alert.alert('Erreur', 'Impossible de générer le devis. Veuillez réessayer.');
            }
        } catch (error) {
            console.error('[InsuranceQuoteRequest] Erreur:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la génération du devis');
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price: number) => {
        return `${price.toLocaleString('fr-FR')} FCFA`;
    };

    if (showResults && quote) {
        return (
            <SafeNativeView style={styles.container}>
                <LinearGradient colors={['#1E40AF', '#3B82F6']} style={styles.headerGradient}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => { hapticPress(); setShowResults(false); }} style={styles.backButton}>
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerContent}>
                            <SafeIcon name="file-text" size={28} color="#FFFFFF" type="lucide" />
                            <Text style={styles.headerTitle}>Votre devis IA</Text>
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
                    {/* En-tête du devis */}
                    <NativeCard style={styles.quoteCard}>
                        <View style={styles.quoteHeader}>
                            <SafeIcon name="shield-check" size={32} color="#1E40AF" type="lucide" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.quoteProduit}>{quote.produit}</Text>
                                <Text style={styles.quoteCompagnie}>{quote.compagnie_suggeree}</Text>
                            </View>
                        </View>
                        <View style={styles.scoreContainer}>
                            <Text style={styles.scoreLabel}>Score d'adéquation</Text>
                            <View style={styles.scoreBadge}>
                                <Text style={styles.scoreText}>{Math.round(quote.score_adequation * 100)}%</Text>
                            </View>
                        </View>
                    </NativeCard>

                    {/* Primes */}
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>💰 Primes estimées</Text>
                        <View style={styles.primeRow}>
                            <Text style={styles.primeLabel}>Mensuelle</Text>
                            <Text style={styles.primeValue}>{formatPrice(quote.prime_mensuelle_estimee)}</Text>
                        </View>
                        <View style={styles.primeRow}>
                            <Text style={styles.primeLabel}>Annuelle</Text>
                            <Text style={[styles.primeValue, { color: '#1E40AF', fontWeight: '700' }]}>{formatPrice(quote.prime_annuelle_estimee)}</Text>
                        </View>
                    </NativeCard>

                    {/* Couvertures */}
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>🛡️ Couvertures incluses</Text>
                        {quote.couvertures_incluses.map((c, i) => (
                            <View key={i} style={styles.listItem}>
                                <SafeIcon name="check-circle" size={16} color="#10B981" type="lucide" />
                                <Text style={styles.listText}>{c}</Text>
                            </View>
                        ))}
                    </NativeCard>

                    {/* Franchises */}
                    {quote.franchises.length > 0 && (
                        <NativeCard style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>📋 Franchises</Text>
                            {quote.franchises.map((f, i) => (
                                <View key={i} style={styles.franchiseRow}>
                                    <Text style={styles.franchiseGarantie}>{f.garantie}</Text>
                                    <Text style={styles.franchiseMontant}>{f.montant}</Text>
                                </View>
                            ))}
                        </NativeCard>
                    )}

                    {/* Avantages */}
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>✅ Avantages</Text>
                        {quote.avantages.map((a, i) => (
                            <View key={i} style={styles.listItem}>
                                <SafeIcon name="star" size={16} color="#F59E0B" type="lucide" />
                                <Text style={styles.listText}>{a}</Text>
                            </View>
                        ))}
                    </NativeCard>

                    {/* Justification */}
                    <NativeCard style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>💡 Pourquoi ce produit ?</Text>
                        <Text style={styles.justification}>{quote.justification}</Text>
                    </NativeCard>

                    {/* Actions */}
                    <View style={styles.actionsContainer}>
                        <NativeButton
                            title="Nouveau devis"
                            onPress={() => { hapticPress(); setShowResults(false); }}
                            style={styles.secondaryButton}
                        />
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <LinearGradient colors={['#1E40AF', '#3B82F6']} style={styles.headerGradient}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { hapticPress(); navigation.goBack(); }} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerIconContainer}>
                            <SafeIcon name="file-text" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>Demander un devis IA</Text>
                        <Text style={styles.headerSubtitle}>Notre IA génère un devis personnalisé en quelques secondes</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
                {/* Type d'assurance */}
                <Text style={styles.fieldLabel}>Type d'assurance *</Text>
                <View style={styles.chipContainer}>
                    {TYPES_ASSURANCE.map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[styles.chip, typeAssurance === type && styles.chipSelected]}
                            onPress={() => { hapticPress(); setTypeAssurance(type); }}
                        >
                            <Text style={[styles.chipText, typeAssurance === type && styles.chipTextSelected]}>{type}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Profil personnel */}
                <Text style={styles.sectionLabel}>Votre profil</Text>

                <View style={styles.row}>
                    <View style={styles.halfField}>
                        <NativeInput
                            placeholder="Âge"
                            value={age}
                            onChangeText={setAge}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.halfField}>
                        <NativeInput
                            placeholder="Nb personnes"
                            value={nombrePersonnes}
                            onChangeText={setNombrePersonnes}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <NativeInput
                    placeholder="Profession"
                    value={profession}
                    onChangeText={setProfession}
                />

                <NativeInput
                    placeholder="Ville"
                    value={ville}
                    onChangeText={setVille}
                />

                <Text style={styles.fieldLabel}>Situation familiale</Text>
                <View style={styles.chipContainer}>
                    {SITUATIONS_FAMILIALES.map((sit) => (
                        <TouchableOpacity
                            key={sit}
                            style={[styles.chip, situationFamiliale === sit && styles.chipSelected]}
                            onPress={() => { hapticPress(); setSituationFamiliale(sit); }}
                        >
                            <Text style={[styles.chipText, situationFamiliale === sit && styles.chipTextSelected]}>{sit}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <NativeInput
                    placeholder="Budget mensuel max (FCFA)"
                    value={budgetMensuel}
                    onChangeText={setBudgetMensuel}
                    keyboardType="numeric"
                />

                {/* Champs conditionnels Auto */}
                {(typeAssurance === 'Auto') && (
                    <>
                        <Text style={styles.sectionLabel}>Véhicule</Text>
                        <NativeInput
                            placeholder="Type de véhicule (berline, SUV, moto...)"
                            value={vehiculeType}
                            onChangeText={setVehiculeType}
                        />
                        <NativeInput
                            placeholder="Valeur du véhicule (FCFA)"
                            value={vehiculeValeur}
                            onChangeText={setVehiculeValeur}
                            keyboardType="numeric"
                        />
                    </>
                )}

                {/* Champs conditionnels Habitation */}
                {(typeAssurance === 'Habitation') && (
                    <>
                        <Text style={styles.sectionLabel}>Bien immobilier</Text>
                        <NativeInput
                            placeholder="Type de bien (appartement, maison, villa...)"
                            value={bienType}
                            onChangeText={setBienType}
                        />
                        <NativeInput
                            placeholder="Valeur du bien (FCFA)"
                            value={bienValeur}
                            onChangeText={setBienValeur}
                            keyboardType="numeric"
                        />
                    </>
                )}

                {/* Bouton */}
                <View style={styles.buttonContainer}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                            <Text style={styles.loadingText}>Génération du devis en cours...</Text>
                            <Text style={styles.loadingSubtext}>Notre IA analyse votre profil</Text>
                        </View>
                    ) : (
                        <NativeButton
                            title="🤖 Générer mon devis IA"
                            onPress={handleGenerateQuote}
                            style={styles.generateButton}
                        />
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    headerGradient: { paddingTop: 44, paddingBottom: 20, paddingHorizontal: 16 },
    header: { flexDirection: 'row', alignItems: 'flex-start' },
    backButton: { padding: 8, marginRight: 8, marginTop: 4 },
    headerContent: { flex: 1, alignItems: 'center' },
    headerIconContainer: { marginBottom: 8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 4 },
    scrollContent: { flex: 1 },
    scrollContainer: { padding: 16 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
    sectionLabel: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 8 },
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    chipSelected: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
    chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
    chipTextSelected: { color: '#FFFFFF' },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },
    buttonContainer: { marginTop: 24 },
    generateButton: { backgroundColor: '#1E40AF' },
    loadingContainer: { alignItems: 'center', paddingVertical: 24 },
    loadingText: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#374151' },
    loadingSubtext: { marginTop: 4, fontSize: 13, color: '#6B7280' },
    // Results styles
    quoteCard: { padding: 16, marginBottom: 16 },
    quoteHeader: { flexDirection: 'row', alignItems: 'center' },
    quoteProduit: { fontSize: 18, fontWeight: '700', color: '#111827' },
    quoteCompagnie: { fontSize: 14, color: '#6B7280', marginTop: 2 },
    scoreContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    scoreLabel: { fontSize: 14, color: '#6B7280' },
    scoreBadge: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    scoreText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    sectionCard: { padding: 16, marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    primeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    primeLabel: { fontSize: 14, color: '#6B7280' },
    primeValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
    listItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    listText: { fontSize: 14, color: '#374151', flex: 1 },
    franchiseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    franchiseGarantie: { fontSize: 14, color: '#374151' },
    franchiseMontant: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
    justification: { fontSize: 14, color: '#374151', lineHeight: 20 },
    actionsContainer: { marginTop: 16 },
    secondaryButton: { backgroundColor: '#6B7280' },
});

export default InsuranceQuoteRequestScreen;
