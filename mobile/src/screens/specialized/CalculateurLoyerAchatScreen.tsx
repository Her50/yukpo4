import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

type Mode = 'loyer' | 'achat';

const CalculateurLoyerAchatScreen: React.FC = () => {
    const [mode, setMode] = useState<Mode>('achat');

    // Achat
    const [prixBien, setPrixBien] = useState('25000000');
    const [apport, setApport] = useState('5000000');
    const [tauxInteret, setTauxInteret] = useState('7');
    const [dureeMois, setDureeMois] = useState('180'); // 15 ans

    // Loyer
    const [loyerMensuel, setLoyerMensuel] = useState('150000');
    const [chargesLoyer, setChargesLoyer] = useState('20000');
    const [augmentationAnnuelle, setAugmentationAnnuelle] = useState('5');

    const calcAchat = useMemo(() => {
        const prix = parseFloat(prixBien) || 0;
        const ap = parseFloat(apport) || 0;
        const taux = (parseFloat(tauxInteret) || 7) / 100 / 12;
        const n = parseInt(dureeMois) || 180;
        const capital = prix - ap;
        if (capital <= 0 || taux === 0) return null;

        // Mensualité formule emprunt
        const mensualite = capital * (taux * Math.pow(1 + taux, n)) / (Math.pow(1 + taux, n) - 1);
        const coutTotal = mensualite * n + ap;
        const interets = coutTotal - prix;
        const fraisNotaire = prix * 0.07; // ~7% Cameroun

        return { mensualite, coutTotal, interets, fraisNotaire, capital, annees: Math.floor(n / 12) };
    }, [prixBien, apport, tauxInteret, dureeMois]);

    const calcLoyer = useMemo(() => {
        const loyer = parseFloat(loyerMensuel) || 0;
        const charges = parseFloat(chargesLoyer) || 0;
        const aug = (parseFloat(augmentationAnnuelle) || 5) / 100;
        const annees = calcAchat?.annees || 15;

        let totalLoye = 0;
        let loyerCourant = loyer + charges;
        for (let i = 0; i < annees; i++) {
            totalLoye += loyerCourant * 12;
            loyerCourant *= (1 + aug);
        }

        return { totalLoye, loyerFinal: loyerCourant, mensuelActuel: loyer + charges };
    }, [loyerMensuel, chargesLoyer, augmentationAnnuelle, calcAchat]);

    const verdict = useMemo(() => {
        if (!calcAchat || !calcLoyer) return null;
        const diffTotal = calcLoyer.totalLoye - calcAchat.coutTotal;
        if (diffTotal > 0) return { achatGagne: true, ecart: diffTotal };
        return { achatGagne: false, ecart: Math.abs(diffTotal) };
    }, [calcAchat, calcLoyer]);

    const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.modeRow}>
                <TouchableOpacity style={[styles.modeBtn, mode === 'achat' && styles.modeBtnActive]} onPress={() => setMode('achat')}>
                    <SafeIcon name="home" size={16} color={mode === 'achat' ? '#fff' : '#6B7280'} />
                    <Text style={[styles.modeBtnText, mode === 'achat' && styles.modeBtnTextActive]}>Acheter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeBtn, mode === 'loyer' && styles.modeBtnActive]} onPress={() => setMode('loyer')}>
                    <SafeIcon name="key" size={16} color={mode === 'loyer' ? '#fff' : '#6B7280'} />
                    <Text style={[styles.modeBtnText, mode === 'loyer' && styles.modeBtnTextActive]}>Louer</Text>
                </TouchableOpacity>
            </View>

            {/* Achat section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Paramètres achat</Text>

                <Text style={styles.label}>Prix du bien (FCFA)</Text>
                <TextInput style={styles.input} value={prixBien} onChangeText={setPrixBien} keyboardType="numeric" placeholder="25 000 000" />

                <Text style={styles.label}>Apport personnel (FCFA)</Text>
                <TextInput style={styles.input} value={apport} onChangeText={setApport} keyboardType="numeric" placeholder="5 000 000" />

                <Text style={styles.label}>Taux d'intérêt annuel (%)</Text>
                <View style={styles.sliderRow}>
                    {['5', '6', '7', '8', '10', '12'].map(t => (
                        <TouchableOpacity key={t} style={[styles.chip, tauxInteret === t && styles.chipActive]} onPress={() => setTauxInteret(t)}>
                            <Text style={[styles.chipText, tauxInteret === t && styles.chipTextActive]}>{t}%</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Durée du prêt</Text>
                <View style={styles.sliderRow}>
                    {[{ v: '60', l: '5 ans' }, { v: '120', l: '10 ans' }, { v: '180', l: '15 ans' }, { v: '240', l: '20 ans' }].map(d => (
                        <TouchableOpacity key={d.v} style={[styles.chip, dureeMois === d.v && styles.chipActive]} onPress={() => setDureeMois(d.v)}>
                            <Text style={[styles.chipText, dureeMois === d.v && styles.chipTextActive]}>{d.l}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Achat results */}
            {calcAchat && (
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Résultats achat</Text>
                    <View style={styles.resultMainRow}>
                        <Text style={styles.resultLabel}>Mensualité</Text>
                        <Text style={styles.resultMain}>{fmt(calcAchat.mensualite)} FCFA/mois</Text>
                    </View>
                    <View style={styles.resultRow}><Text style={styles.resultKey}>Capital emprunté</Text><Text style={styles.resultVal}>{fmt(calcAchat.capital)} FCFA</Text></View>
                    <View style={styles.resultRow}><Text style={styles.resultKey}>Intérêts totaux</Text><Text style={[styles.resultVal, { color: '#DC2626' }]}>{fmt(calcAchat.interets)} FCFA</Text></View>
                    <View style={styles.resultRow}><Text style={styles.resultKey}>Frais de notaire (~7%)</Text><Text style={styles.resultVal}>{fmt(calcAchat.fraisNotaire)} FCFA</Text></View>
                    <View style={[styles.resultRow, styles.totalRow]}><Text style={styles.totalKey}>Coût total</Text><Text style={styles.totalVal}>{fmt(calcAchat.coutTotal + calcAchat.fraisNotaire)} FCFA</Text></View>
                </View>
            )}

            {/* Loyer section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Paramètres location</Text>
                <Text style={styles.label}>Loyer mensuel (FCFA)</Text>
                <TextInput style={styles.input} value={loyerMensuel} onChangeText={setLoyerMensuel} keyboardType="numeric" placeholder="150 000" />
                <Text style={styles.label}>Charges mensuelles (FCFA)</Text>
                <TextInput style={styles.input} value={chargesLoyer} onChangeText={setChargesLoyer} keyboardType="numeric" placeholder="20 000" />
                <Text style={styles.label}>Augmentation annuelle (%)</Text>
                <View style={styles.sliderRow}>
                    {['2', '3', '5', '7', '10'].map(t => (
                        <TouchableOpacity key={t} style={[styles.chip, augmentationAnnuelle === t && styles.chipActive]} onPress={() => setAugmentationAnnuelle(t)}>
                            <Text style={[styles.chipText, augmentationAnnuelle === t && styles.chipTextActive]}>{t}%</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Loyer results */}
            {calcLoyer && calcAchat && (
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Résultats location sur {calcAchat.annees} ans</Text>
                    <View style={styles.resultMainRow}>
                        <Text style={styles.resultLabel}>Coût total</Text>
                        <Text style={styles.resultMain}>{fmt(calcLoyer.totalLoye)} FCFA</Text>
                    </View>
                    <View style={styles.resultRow}><Text style={styles.resultKey}>Loyer actuel/mois</Text><Text style={styles.resultVal}>{fmt(calcLoyer.mensuelActuel)} FCFA</Text></View>
                    <View style={styles.resultRow}><Text style={styles.resultKey}>Loyer final/mois</Text><Text style={styles.resultVal}>{fmt(calcLoyer.loyerFinal)} FCFA</Text></View>
                    <View style={[styles.resultRow, { marginTop: 4 }]}>
                        <Text style={styles.resultKey}>Patrimoine constitué</Text>
                        <Text style={[styles.resultVal, { color: '#DC2626' }]}>0 FCFA</Text>
                    </View>
                </View>
            )}

            {/* Verdict */}
            {verdict && calcAchat && calcLoyer && (
                <View style={[styles.verdictCard, { borderColor: verdict.achatGagne ? '#A7F3D0' : '#FCA5A5' }]}>
                    <View style={styles.verdictHeader}>
                        <SafeIcon name={verdict.achatGagne ? 'trending-up' : 'info'} size={22} color={verdict.achatGagne ? '#059669' : '#DC2626'} />
                        <Text style={[styles.verdictTitle, { color: verdict.achatGagne ? '#059669' : '#DC2626' }]}>
                            {verdict.achatGagne ? "L'achat est plus avantageux" : "La location peut être préférable"}
                        </Text>
                    </View>
                    <Text style={styles.verdictText}>
                        {verdict.achatGagne
                            ? `Sur ${calcAchat.annees} ans, vous économisez ${fmt(verdict.ecart)} FCFA en achetant. De plus, vous constituez un patrimoine de ${fmt(parseFloat(prixBien) || 0)} FCFA.`
                            : `Sur ${calcAchat.annees} ans, la location coûte ${fmt(verdict.ecart)} FCFA de moins. Investissez la différence pour optimiser votre patrimoine.`
                        }
                    </Text>
                    <View style={styles.verdictCompare}>
                        <View style={[styles.verdictItem, verdict.achatGagne && styles.verdictItemWinner]}>
                            <SafeIcon name="home" size={16} color={verdict.achatGagne ? '#059669' : '#374151'} />
                            <Text style={styles.verdictItemLabel}>Achat</Text>
                            <Text style={styles.verdictItemValue}>{fmt((calcAchat.coutTotal + calcAchat.fraisNotaire))} F</Text>
                        </View>
                        <Text style={styles.vs}>VS</Text>
                        <View style={[styles.verdictItem, !verdict.achatGagne && styles.verdictItemWinner]}>
                            <SafeIcon name="key" size={16} color={!verdict.achatGagne ? '#059669' : '#374151'} />
                            <Text style={styles.verdictItemLabel}>Location</Text>
                            <Text style={styles.verdictItemValue}>{fmt(calcLoyer.totalLoye)} F</Text>
                        </View>
                    </View>
                </View>
            )}

            <Text style={styles.disclaimer}>Simulation indicative. Consultez un conseiller financier pour une analyse personnalisée.</Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    modeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#fff' },
    modeBtnActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    modeBtnText: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
    modeBtnTextActive: { color: '#fff' },
    section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 10 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F9FAFB', fontSize: 15 },
    sliderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
    chipActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    chipTextActive: { color: '#fff' },
    resultCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    resultTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 14 },
    resultMainRow: { backgroundColor: '#F0F9FF', borderRadius: 10, padding: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resultLabel: { fontSize: 14, color: '#0369A1', fontWeight: '600' },
    resultMain: { fontSize: 18, fontWeight: '800', color: '#0369A1' },
    resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    resultKey: { fontSize: 13, color: '#6B7280' },
    resultVal: { fontSize: 13, fontWeight: '700', color: '#111827' },
    totalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 8, paddingTop: 10 },
    totalKey: { fontSize: 14, fontWeight: '700', color: '#111827' },
    totalVal: { fontSize: 16, fontWeight: '800', color: '#111827' },
    verdictCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 2 },
    verdictHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    verdictTitle: { fontSize: 16, fontWeight: '800' },
    verdictText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 14 },
    verdictCompare: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    verdictItem: { flex: 1, alignItems: 'center', gap: 6, padding: 12, borderRadius: 10, backgroundColor: '#F9FAFB' },
    verdictItemWinner: { backgroundColor: '#F0FDF4' },
    verdictItemLabel: { fontSize: 13, color: '#374151', fontWeight: '600' },
    verdictItemValue: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center' },
    vs: { fontSize: 14, fontWeight: '800', color: '#9CA3AF' },
    disclaimer: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },
});

export default CalculateurLoyerAchatScreen;
