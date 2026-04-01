/**
 * Écran vérification conducteur (KYC) — CNI recto/verso + selfie
 */
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import SafeIcon from '../../components/SafeIcon';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface VerificationStatus {
    id: number;
    status: 'pending' | 'under_review' | 'approved' | 'rejected';
    cni_front_url?: string;
    cni_back_url?: string;
    selfie_url?: string;
    rejection_reason?: string;
    submitted_at: string;
    is_complete: boolean;
}

const STATUS_CONFIG = {
    pending:      { color: '#F59E0B', label: 'En attente',         icon: 'clock' },
    under_review: { color: '#3B82F6', label: 'En cours de vérif.', icon: 'search' },
    approved:     { color: '#10B981', label: 'Vérifié ✓',          icon: 'check-circle' },
    rejected:     { color: '#EF4444', label: 'Rejeté',             icon: 'x-circle' },
};

const DriverVerificationScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = (route.params as any) || {};
    const serviceType: string = params.serviceType || 'taxi';

    const [status, setStatus] = useState<VerificationStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [cniFront, setCniFront] = useState<string | null>(null);
    const [cniBack, setCniBack] = useState<string | null>(null);
    const [selfie, setSelfie] = useState<string | null>(null);

    useEffect(() => { loadStatus(); }, []);

    const loadStatus = async () => {
        try {
            const res = await apiGet(`/api/driver/verification/${serviceType}`);
            const data = (res?.data || res) as any;
            if (data?.success && data?.verification) {
                setStatus(data.verification);
                if (data.verification.cni_front_url) setCniFront(data.verification.cni_front_url);
                if (data.verification.cni_back_url) setCniBack(data.verification.cni_back_url);
                if (data.verification.selfie_url) setSelfie(data.verification.selfie_url);
            }
        } catch { } finally { setLoading(false); }
    };

    const pickImage = async (setter: (uri: string) => void, label: string) => {
        const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm !== 'granted') {
            Alert.alert('Permission requise', `Autorisez l'accès à la galerie pour ajouter votre ${label}.`);
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            aspect: label === 'selfie' ? [1, 1] : [16, 9],
        });
        if (!result.canceled && result.assets[0]) {
            setter(result.assets[0].uri);
        }
    };

    const takeSelfie = async () => {
        const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
        if (perm !== 'granted') {
            Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra pour le selfie.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setSelfie(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!cniFront || !cniBack || !selfie) {
            Alert.alert('Documents manquants', 'Veuillez fournir CNI recto, verso et selfie.');
            return;
        }
        try {
            setSubmitting(true);
            const res = await apiPost('/api/driver/verification', {
                service_type: serviceType,
                cni_front_url: cniFront,
                cni_back_url: cniBack,
                selfie_url: selfie,
            });
            const data = (res?.data || res) as any;
            if (data?.success) {
                Alert.alert('Documents soumis !', data.message || 'Vérification en cours. Résultat sous 24h.', [
                    { text: 'OK', onPress: () => { loadStatus(); } },
                ]);
            } else {
                Alert.alert('Erreur', data?.error || 'Impossible de soumettre les documents.');
            }
        } catch (err: any) {
            Alert.alert('Erreur', err?.message || 'Erreur réseau.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <View style={st.center}><ActivityIndicator size="large" color="#6366F1" /></View>;
    }

    const cfg = status ? STATUS_CONFIG[status.status] : null;
    const isApproved = status?.status === 'approved';
    const canResubmit = !status || status.status === 'rejected';

    return (
        <ScrollView style={st.container} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Header */}
            <LinearGradient colors={['#4338CA', '#6366F1', '#818CF8']} style={st.hero}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={st.heroIcon}>
                    <SafeIcon name="shield-check" size={32} color="#4338CA" />
                </View>
                <Text style={st.heroTitle}>Vérification conducteur</Text>
                <Text style={st.heroSub}>
                    {serviceType === 'taxi' ? 'Taxi Yukpo' : 'Covoiturage Yukpo'}
                </Text>
            </LinearGradient>

            {/* Statut actuel */}
            {status && cfg && (
                <View style={[st.statusCard, { borderColor: cfg.color }]}>
                    <SafeIcon name={cfg.icon} size={22} color={cfg.color} />
                    <View style={{ flex: 1 }}>
                        <Text style={[st.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                        {status.rejection_reason && (
                            <Text style={st.rejectionText}>Motif : {status.rejection_reason}</Text>
                        )}
                        <Text style={st.statusDate}>
                            Soumis le {new Date(status.submitted_at).toLocaleDateString('fr-FR')}
                        </Text>
                    </View>
                </View>
            )}

            {isApproved ? (
                <View style={st.approvedBox}>
                    <SafeIcon name="check-circle" size={56} color="#10B981" />
                    <Text style={st.approvedTitle}>Compte vérifié !</Text>
                    <Text style={st.approvedText}>
                        Votre identité a été vérifiée. Vous pouvez maintenant exercer en tant que conducteur certifié Yukpo.
                    </Text>
                    <View style={st.badgeRow}>
                        <SafeIcon name="shield" size={16} color="#10B981" />
                        <Text style={st.badgeText}>Conducteur certifié Yukpo</Text>
                    </View>
                </View>
            ) : (
                <>
                    {/* Explications */}
                    <View style={st.infoCard}>
                        <Text style={st.infoTitle}>Pourquoi vérifier votre identité ?</Text>
                        {[
                            'Protéger les passagers et les conducteurs',
                            'Accéder au badge "Conducteur certifié"',
                            'Augmenter votre taux d\'acceptation',
                            'Conforme à la réglementation camerounaise',
                        ].map((item, i) => (
                            <View key={i} style={st.infoRow}>
                                <SafeIcon name="check" size={14} color="#6366F1" />
                                <Text style={st.infoText}>{item}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Upload CNI recto */}
                    <View style={st.section}>
                        <Text style={st.sectionTitle}>1. CNI Recto</Text>
                        <TouchableOpacity
                            style={[st.uploadBox, cniFront && st.uploadBoxFilled]}
                            onPress={() => pickImage(setCniFront, 'CNI recto')}
                            disabled={!canResubmit}
                        >
                            {cniFront ? (
                                <Image source={{ uri: cniFront }} style={st.previewImg} />
                            ) : (
                                <>
                                    <SafeIcon name="credit-card" size={32} color="#6366F1" />
                                    <Text style={st.uploadLabel}>Appuyez pour ajouter</Text>
                                    <Text style={st.uploadHint}>Face avant de la CNI</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Upload CNI verso */}
                    <View style={st.section}>
                        <Text style={st.sectionTitle}>2. CNI Verso</Text>
                        <TouchableOpacity
                            style={[st.uploadBox, cniBack && st.uploadBoxFilled]}
                            onPress={() => pickImage(setCniBack, 'CNI verso')}
                            disabled={!canResubmit}
                        >
                            {cniBack ? (
                                <Image source={{ uri: cniBack }} style={st.previewImg} />
                            ) : (
                                <>
                                    <SafeIcon name="credit-card" size={32} color="#6366F1" />
                                    <Text style={st.uploadLabel}>Appuyez pour ajouter</Text>
                                    <Text style={st.uploadHint}>Face arrière de la CNI</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Selfie */}
                    <View style={st.section}>
                        <Text style={st.sectionTitle}>3. Selfie en temps réel</Text>
                        <View style={st.selfieRow}>
                            <TouchableOpacity
                                style={[st.uploadBox, { flex: 1 }, selfie && st.uploadBoxFilled]}
                                onPress={takeSelfie}
                                disabled={!canResubmit}
                            >
                                {selfie ? (
                                    <Image source={{ uri: selfie }} style={st.previewImg} />
                                ) : (
                                    <>
                                        <SafeIcon name="camera" size={32} color="#6366F1" />
                                        <Text style={st.uploadLabel}>Prendre un selfie</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                        <Text style={st.selfieHint}>
                            Photo de votre visage bien éclairé, sans lunettes de soleil.
                        </Text>
                    </View>

                    {/* Progression */}
                    <View style={st.progressBar}>
                        {[cniFront, cniBack, selfie].map((doc, i) => (
                            <View key={i} style={[st.progressStep, doc && { backgroundColor: '#6366F1' }]}>
                                {doc && <SafeIcon name="check" size={12} color="#fff" />}
                            </View>
                        ))}
                        <Text style={st.progressText}>
                            {[cniFront, cniBack, selfie].filter(Boolean).length}/3 documents
                        </Text>
                    </View>

                    {/* Bouton soumettre */}
                    {canResubmit && (
                        <TouchableOpacity
                            style={[st.submitBtn, (!cniFront || !cniBack || !selfie || submitting) && { opacity: 0.5 }]}
                            onPress={handleSubmit}
                            disabled={!cniFront || !cniBack || !selfie || submitting}
                        >
                            {submitting
                                ? <ActivityIndicator color="#fff" />
                                : <SafeIcon name="send" size={18} color="#fff" />}
                            <Text style={st.submitBtnText}>
                                {submitting ? 'Envoi en cours...' : 'Soumettre pour vérification'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {status?.status === 'under_review' && (
                        <View style={st.reviewingBox}>
                            <ActivityIndicator color="#3B82F6" />
                            <Text style={st.reviewingText}>
                                Vos documents sont en cours de vérification.{'\n'}Résultat attendu sous 24h.
                            </Text>
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
    backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 40, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
    heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
    statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    statusLabel: { fontSize: 15, fontWeight: '700' },
    rejectionText: { fontSize: 12, color: '#EF4444', marginTop: 2 },
    statusDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    approvedBox: { alignItems: 'center', padding: 32, gap: 12 },
    approvedTitle: { fontSize: 24, fontWeight: '800', color: '#065F46' },
    approvedText: { fontSize: 14, color: '#047857', textAlign: 'center', lineHeight: 22 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
    badgeText: { fontSize: 14, color: '#065F46', fontWeight: '700' },
    infoCard: { margin: 16, backgroundColor: '#EEF2FF', borderRadius: 12, padding: 16 },
    infoTitle: { fontSize: 14, fontWeight: '700', color: '#3730A3', marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    infoText: { fontSize: 13, color: '#4338CA' },
    section: { marginHorizontal: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
    uploadBox: { borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', gap: 8, backgroundColor: '#fff', minHeight: 120, justifyContent: 'center' },
    uploadBoxFilled: { borderColor: '#6366F1', borderStyle: 'solid', padding: 4 },
    uploadLabel: { fontSize: 13, color: '#6366F1', fontWeight: '600' },
    uploadHint: { fontSize: 11, color: '#9CA3AF' },
    previewImg: { width: '100%', height: 120, borderRadius: 8 },
    selfieRow: { flexDirection: 'row', gap: 10 },
    selfieHint: { fontSize: 11, color: '#6B7280', marginTop: 6 },
    progressBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 20 },
    progressStep: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
    progressText: { fontSize: 12, color: '#6B7280', marginLeft: 4 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, backgroundColor: '#6366F1', borderRadius: 14, paddingVertical: 16, marginBottom: 12, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    reviewingBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16 },
    reviewingText: { fontSize: 13, color: '#1D4ED8', flex: 1, lineHeight: 20 },
});

export default DriverVerificationScreen;
