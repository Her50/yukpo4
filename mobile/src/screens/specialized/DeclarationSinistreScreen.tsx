// Écran utilisateur: Déclaration de sinistre
// Formulaire complet pour déclarer un sinistre sur une police active

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import assuranceService, { type CreateClaimPayload, type InsurancePolicy } from '../../services/assuranceService';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const TYPES_SINISTRES = [
    { key: 'accident', label: 'Accident', icon: 'alert-triangle', color: '#DC2626' },
    { key: 'vol', label: 'Vol', icon: 'lock', color: '#7C3AED' },
    { key: 'incendie', label: 'Incendie', icon: 'zap', color: '#F59E0B' },
    { key: 'degats_eaux', label: t('declarationSinistre.degatsDesEaux'), icon: 'droplet', color: '#3B82F6' },
    { key: 'catastrophe_naturelle', label: 'Catastrophe naturelle', icon: 'cloud-rain', color: '#6366F1' },
    { key: 'maladie', label: 'Maladie', icon: 'heart', color: '#DC2626' },
    { key: 'hospitalisation', label: 'Hospitalisation', icon: 'activity', color: '#059669' },
    { key: 'deces', label: t('declarationSinistre.deces'), icon: 'shield', color: '#374151' },
    { key: 'bris_glace', label: 'Bris de glace', icon: 'square', color: '#2563EB' },
    { key: 'panne', label: t('declarationSinistre.panneMecanique'), icon: 'tool', color: '#D97706' },
    { key: 'autre', label: 'Autre', icon: 'help-circle', color: '#6B7280' },
];

const DeclarationSinistreScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const policy = (route.params as any)?.policy as InsurancePolicy | undefined;
    const devise = getCurrencyIntelligently() || 'FCFA';

    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(1);

    const [typeSinistre, setTypeSinistre] = useState('');
    const [dateSinistre, setDateSinistre] = useState(new Date().toISOString().split('T')[0]);
    const [lieuSinistre, setLieuSinistre] = useState('');
    const [description, setDescription] = useState('');
    const [circonstances, setCirconstances] = useState('');
    const [dommagesEstimes, setDommagesEstimes] = useState('');
    const [montantReclame, setMontantReclame] = useState('');
    const [temoins, setTemoins] = useState('');

    const canProceedStep1 = typeSinistre && dateSinistre;
    const canProceedStep2 = description.trim().length >= 20;
    const canSubmit = canProceedStep1 && canProceedStep2;

    const handleSubmit = async () => {
        if (!policy) {
            Alert.alert('Erreur', t('declarationSinistreScreen.aucunePoliceSelectionnee'));
            return;
        }
        if (!canSubmit) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
            return;
        }

        setSubmitting(true);
        try {
            const payload: CreateClaimPayload = {
                policy_id: policy.id,
                type_sinistre: typeSinistre,
                date_sinistre: dateSinistre,
                lieu_sinistre: lieuSinistre || undefined,
                description_sinistre: description,
                circonstances: circonstances || undefined,
                temoins: temoins ? { description: temoins } : undefined,
                dommages_estimes: dommagesEstimes ? parseFloat(dommagesEstimes) : undefined,
                montant_reclame: montantReclame ? parseFloat(montantReclame) : undefined,
            };

            const result = await assuranceService.createClaim(payload);

            if (result.success) {
                Alert.alert(
                    t('declarationSinistreScreen.sinistreDeclare'),
                    t('declarationSinistreScreen.votreDeclarationAEteEnregistreennnumeroDe', { result_numero_sinistre: result.numero_sinistre }),
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', t('declarationSinistreScreen.impossibleDeSoumettreLaDeclarationVeuillez'));
            }
        } catch (e) {
            Alert.alert('Erreur', 'Une erreur est survenue lors de la soumission.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderStep1 = () => (
        <>
            <Text style={s.stepTitle}>{t('declarationSinistre.typeDeSinistre')}</Text>
            <Text style={s.stepDesc}>{t('declarationSinistre.selectionnezLeTypeDeSinistre')}</Text>

            <View style={s.typesGrid}>
                {TYPES_SINISTRES.map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[s.typeCard, typeSinistre === t.key && { borderColor: t.color, borderWidth: 2, backgroundColor: t.color + '10' }]}
                        onPress={() => setTypeSinistre(t.key)}>
                        <View style={[s.typeIcon, { backgroundColor: t.color + '15' }]}>
                            <SafeIcon name={t.icon as any} size={20} color={t.color} />
                        </View>
                        <Text style={[s.typeLabel, typeSinistre === t.key && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={s.fieldLabel}>Date du sinistre *</Text>
            <TextInput style={s.input} placeholder="AAAA-MM-JJ" value={dateSinistre}
                onChangeText={setDateSinistre} />

            <Text style={s.fieldLabel}>Lieu du sinistre</Text>
            <TextInput style={s.input} placeholder={t('declarationSinistreScreen.adresseOuDescriptionDuLieu')}
                value={lieuSinistre} onChangeText={setLieuSinistre} />
        </>
    );

    const renderStep2 = () => (
        <>
            <Text style={s.stepTitle}>Description du sinistre</Text>
            <Text style={s.stepDesc}>{t('declarationSinistre.decrivezLesCirconstancesEtLes')}</Text>

            <Text style={s.fieldLabel}>{t('declarationSinistre.descriptionDetaillee')}</Text>
            <TextInput
                style={[s.input, s.textArea]}
                placeholder={t('declarationSinistre.decrivezLeSinistreCeQui')}est passé, les dommages constatés, les personnes impliquées..."
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
            />
            <Text style={s.charCount}>{description.length}/20 caractères minimum</Text>

            <Text style={s.fieldLabel}>Circonstances</Text>
            <TextInput
                style={[s.input, s.textArea, { height: 80 }]}
                placeholder={t('declarationSinistre.detailsSupplementairesSurLesCirconstance')}
                multiline
                textAlignVertical="top"
                value={circonstances}
                onChangeText={setCirconstances}
            />

            <Text style={s.fieldLabel}>{t('declarationSinistre.temoinsNomsContacts')}</Text>
            <TextInput style={s.input} placeholder={t('declarationSinistre.nomsEtCoordonneesDesTemoins')}
                value={temoins} onChangeText={setTemoins} />
        </>
    );

    const renderStep3 = () => (
        <>
            <Text style={s.stepTitle}>{t('declarationSinistre.estimationFinanciere')}</Text>
            <Text style={s.stepDesc}>{t('declarationSinistre.indiquezUneEstimationDesDommages')}</Text>

            <Text style={s.fieldLabel}>{t('declarationSinistreScreen.estimatedDamages')} ({devise})</Text>
            <TextInput style={s.input} placeholder={t('declarationSinistre.estimationDeLaValeurDes')}
                keyboardType="numeric" value={dommagesEstimes} onChangeText={setDommagesEstimes} />

            <Text style={s.fieldLabel}>{t('declarationSinistreScreen.claimedAmount')} ({devise})</Text>
            <TextInput style={s.input} placeholder={t('declarationSinistre.montantQueVousSouhaitezReclamer')}
                keyboardType="numeric" value={montantReclame} onChangeText={setMontantReclame} />

            <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>{t('declarationSinistre.recapitulatif')}</Text>
                <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Police</Text>
                    <Text style={s.summaryValue}>{policy?.numero_police || 'N/A'}</Text>
                </View>
                <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Produit</Text>
                    <Text style={s.summaryValue}>{policy?.nom_produit || 'N/A'}</Text>
                </View>
                <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>{t('declarationSinistre.typeSinistre')}</Text>
                    <Text style={s.summaryValue}>{TYPES_SINISTRES.find(t => t.key === typeSinistre)?.label || typeSinistre}</Text>
                </View>
                <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Date</Text>
                    <Text style={s.summaryValue}>{dateSinistre}</Text>
                </View>
                {lieuSinistre ? (
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Lieu</Text>
                        <Text style={s.summaryValue} numberOfLines={1}>{lieuSinistre}</Text>
                    </View>
                ) : null}
                {dommagesEstimes ? (
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Dommages</Text>
                        <Text style={[s.summaryValue, { color: '#DC2626' }]}>{parseFloat(dommagesEstimes).toLocaleString()} {devise}</Text>
                    </View>
                ) : null}
                {montantReclame ? (
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>{t('declarationSinistre.reclame')}</Text>
                        <Text style={[s.summaryValue, { color: '#059669', fontWeight: '700' }]}>{parseFloat(montantReclame).toLocaleString()} {devise}</Text>
                    </View>
                ) : null}
            </View>
        </>
    );

    return (
        <View style={s.container}>
            <LinearGradient colors={['#D97706', '#B45309']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>{t('declarationSinistre.declarationDeSinistre')}</Text>
                        {policy && <Text style={s.headerSub}>Police: {policy.numero_police}</Text>}
                    </View>
                </View>
                <View style={s.stepsRow}>
                    {[1, 2, 3].map(n => (
                        <View key={n} style={s.stepIndicator}>
                            <View style={[s.stepDot, step >= n && s.stepDotActive]}>
                                <Text style={[s.stepDotText, step >= n && { color: '#fff' }]}>{n}</Text>
                            </View>
                            <Text style={[s.stepName, step >= n && { color: '#fff' }]}>
                                {n === 1 ? 'Type' : n === 2 ? t('declarationSinistreScreen.details') : 'Montants'}
                            </Text>
                        </View>
                    ))}
                </View>
            </LinearGradient>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={s.footer}>
                {step > 1 && (
                    <TouchableOpacity style={s.prevBtn} onPress={() => setStep(s => s - 1)}>
                        <SafeIcon name="arrow-left" size={18} color="#6366F1" />
                        <Text style={s.prevBtnText}>{t('declarationSinistre.precedent')}</Text>
                    </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                {step < 3 ? (
                    <TouchableOpacity
                        style={[s.nextBtn, !(step === 1 ? canProceedStep1 : canProceedStep2) && s.btnDisabled]}
                        disabled={!(step === 1 ? canProceedStep1 : canProceedStep2)}
                        onPress={() => setStep(s => s + 1)}>
                        <Text style={s.nextBtnText}>{t('declarationSinistreScreen.suivant')}</Text>
                        <SafeIcon name="arrow-right" size={18} color="#fff" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[s.submitBtn, !canSubmit && s.btnDisabled]} disabled={!canSubmit || submitting} onPress={handleSubmit}>
                        {submitting ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <SafeIcon name="send" size={18} color="#fff" />
                                <Text style={s.submitBtnText}>Soumettre</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
    stepsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
    stepIndicator: { alignItems: 'center', gap: 4 },
    stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    stepDotActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
    stepDotText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
    stepName: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
    stepTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
    stepDesc: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
    input: { backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB' },
    textArea: { height: 140, textAlignVertical: 'top' },
    charCount: { fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'right' },
    typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeCard: { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
    typeIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    typeLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    summaryCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    summaryLabel: { fontSize: 13, color: '#6B7280' },
    summaryValue: { fontSize: 13, color: '#1F2937', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
    footer: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16 },
    prevBtnText: { fontSize: 14, color: '#6366F1', fontWeight: '600' },
    nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
    nextBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#D97706', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
    submitBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    btnDisabled: { opacity: 0.5 },
});

export default DeclarationSinistreScreen;
